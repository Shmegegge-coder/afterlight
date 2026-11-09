"""Access rules: staff login, family tokens, public sample, rate limit.
Real Mongo if TEST_MONGO_URL is set, else mongomock."""
import os, uuid
os.environ.update(ADMIN_EMAIL="admin@example.com", JWT_SECRET="s" * 40, COOKIE_SECURE="false",
                  TEXT_PROVIDER="stub", IMAGE_PROVIDER="stub", LOGIN_MAX_FAILS="5")
from auth import hash_password
os.environ["ADMIN_PASSWORD_HASH"] = hash_password("correct horse 42")
os.environ.pop("ADMIN_PASSWORD", None)
real = bool(os.environ.get("TEST_MONGO_URL"))
os.environ["MONGO_URL"] = os.environ.get("TEST_MONGO_URL") or "mongodb://x"
os.environ["DB_NAME"] = f"afterlight_test_{uuid.uuid4().hex[:8]}"
import orders as O
if not real:
    from mongomock_motor import AsyncMongoMockClient
    O._client = AsyncMongoMockClient()
from fastapi.testclient import TestClient
from server import app

class As:
    """Same TestClient (one event loop, required by motor), with or without the staff cookie."""
    def __init__(self, c, cookie=None): self.c, self.cookie = c, cookie
    def __getattr__(self, m):
        def call(*a, **k):
            self.c.cookies.clear()
            if self.cookie:
                self.c.cookies.set("afterlight_session", self.cookie)
            r = getattr(self.c, m)(*a, **k)
            sc = r.headers.get("set-cookie", "")
            if self.cookie is not None and sc.startswith("afterlight_session="):
                self.cookie = None if "max-age=0" in sc.lower() else r.cookies.get("afterlight_session")
            return r
        return call
    @property
    def cookies(self): return self.c.cookies

with TestClient(app) as c:
    anon, fam, staff = As(c), As(c), As(c, cookie="")
    # public
    assert anon.get("/api/").status_code == 200
    assert anon.get("/api/memorials/sample-eleanor-vance").status_code == 200, "sample is public"
    # staff-only
    for m, p in [("get", "/api/memorials"), ("get", "/api/orders"), ("get", "/api/advisor/plans"), ("get", "/api/ai/status")]:
        assert getattr(anon, m)(p).status_code == 401, p
    assert anon.post("/api/memorials", json={"name": "x"}).status_code == 401
    assert anon.post("/api/advisor/plans/stream", json={"city": "a", "budget": 1, "goals": "g"}).status_code == 401
    assert anon.get("/api/auth/me").json()["email"] is None
    # login
    assert staff.post("/api/auth/login", json={"email": "admin@example.com", "password": "nope"}).status_code == 401
    r = staff.post("/api/auth/login", json={"email": "ADMIN@example.com", "password": "correct horse 42"})
    assert r.status_code == 200, r.text
    sc = r.headers["set-cookie"].lower()
    assert "httponly" in sc and "samesite=lax" in sc, sc
    assert staff.get("/api/auth/me").json()["email"] == "admin@example.com"
    assert staff.get("/api/memorials").status_code == 200
    # forged / wrong-secret cookie rejected
    import jwt, time
    bad = jwt.encode({"sub": "admin@example.com", "role": "admin", "exp": int(time.time()) + 99}, "wrong" * 10, algorithm="HS256")
    assert As(c, bad).get("/api/orders").status_code == 401
    # family intake token flow
    o = staff.post("/api/orders", json={"deceased_name": "Walter B", "family_name": "Ana B"}).json()
    H = {"X-Afterlight-Token": o["intake_token"]}
    RH = {"X-Afterlight-Token": o["review_token"]}
    mem = fam.post("/api/memorials", json={"name": "Walter B"}, headers=H)
    assert mem.status_code == 200, mem.text
    mid = mem.json()["id"]
    assert fam.post(f"/api/intake/{o['intake_token']}/memorial", json={"memorial_id": mid}).status_code == 200
    assert fam.post("/api/memorials", json={"name": "second"}, headers=H).status_code == 401, "only one memorial per intake"
    assert fam.get(f"/api/memorials/{mid}", headers=H).status_code == 200
    assert fam.get(f"/api/memorials/{mid}").status_code == 401, "no token, no access"
    assert fam.patch(f"/api/memorials/{mid}", json={"epitaph": "Dad"}, headers=H).status_code == 200
    assert fam.post(f"/api/memorials/{mid}/stories", json={"title": "t", "text": "x"}, headers=H).status_code == 200
    assert fam.post(f"/api/memorials/{mid}/narration/generate", headers=H).status_code == 401, "families can't run AI"
    assert fam.delete(f"/api/memorials/{mid}", headers=H).status_code == 401
    assert fam.patch(f"/api/memorials/{mid}", json={"epitaph": "x"}, headers=RH).status_code == 403, "review token is read-only"
    assert fam.get("/api/memorials/sample-eleanor-vance", headers=H).status_code == 200
    other = staff.post("/api/memorials", json={"name": "Other"}).json()["id"]
    assert fam.get(f"/api/memorials/{other}", headers=H).status_code == 403, "token only opens its own memorial"
    assert fam.patch(f"/api/memorials/{other}", json={"epitaph": "x"}, headers=H).status_code == 403
    sub = fam.post(f"/api/intake/{o['intake_token']}/submit", json={"consent": {"signer_name": "Ana", "relationship": "D", "is_next_of_kin": True, "ai_scenes_ok": True}})
    assert sub.status_code == 200
    assert fam.patch(f"/api/memorials/{mid}", json={"epitaph": "late"}, headers=H).status_code == 403, "locked after submit"
    assert fam.get(f"/api/memorials/{mid}", headers=RH).status_code == 200
    # staff generation works (stub)
    assert staff.post(f"/api/memorials/{mid}/narration/generate").status_code == 200
    # logout
    assert staff.post("/api/auth/logout").status_code == 200
    assert staff.get("/api/orders").status_code == 401
    # rate limit: 5 failures then 429 even with the right password
    rl = anon
    for _ in range(5):
        assert rl.post("/api/auth/login", json={"email": "admin@example.com", "password": "bad"}, headers={"X-Forwarded-For": "9.9.9.9"}).status_code == 401
    r = rl.post("/api/auth/login", json={"email": "admin@example.com", "password": "correct horse 42"}, headers={"X-Forwarded-For": "9.9.9.9"})
    assert r.status_code == 429 and "Retry-After" in r.headers, r.status_code

if real:
    import pymongo; pymongo.MongoClient(os.environ["MONGO_URL"]).drop_database(os.environ["DB_NAME"])
print("ALL AUTH TESTS PASSED", "(real mongod)" if real else "(mongomock)")
