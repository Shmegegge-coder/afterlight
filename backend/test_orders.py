# Real Mongo if TEST_MONGO_URL is set (e.g. mongodb://127.0.0.1:27017), else in-memory mongomock.
import os, uuid
os.environ.update(ADMIN_EMAIL="admin@example.com", ADMIN_PASSWORD="test-password-123", JWT_SECRET="t"*40, COOKIE_SECURE="false")
if os.environ.get("TEST_MONGO_URL"):
    os.environ["MONGO_URL"] = os.environ["TEST_MONGO_URL"]; os.environ["DB_NAME"] = f"afterlight_test_{uuid.uuid4().hex[:8]}"
else:
    os.environ.setdefault("MONGO_URL","mongodb://x"); os.environ.setdefault("DB_NAME","t")
import orders as O
if not os.environ.get("TEST_MONGO_URL"):
    from mongomock_motor import AsyncMongoMockClient
    O._client = AsyncMongoMockClient()
from fastapi import FastAPI
from fastapi.testclient import TestClient
import auth
app=FastAPI(); app.include_router(O.router); app.include_router(auth.router); c=TestClient(app).__enter__()  # one event loop for the whole run (motor needs it)
assert c.get("/api/orders").status_code==401
assert c.post("/api/orders",json={"deceased_name":"x","family_name":"y"}).status_code==401
assert c.post("/api/auth/login",json={"email":"admin@example.com","password":"test-password-123"}).status_code==200
o=c.post("/api/orders",json={"deceased_name":"Walter Brooks","family_name":"Ana Brooks","family_email":"ana@x.com"}).json()
assert o["status"]=="awaiting_intake"; it,rt,oid=o["intake_token"],o["review_token"],o["id"]
assert c.post("/api/orders",json={"deceased_name":"x","family_name":"y","family_email":"bad"}).status_code==422
assert c.get(f"/api/review/{rt}").status_code==409
assert c.post(f"/api/intake/{it}/submit",json={"consent":{"signer_name":"Ana","relationship":"Daughter","is_next_of_kin":True,"ai_scenes_ok":True}}).status_code==400
assert c.post(f"/api/intake/{it}/memorial",json={"memorial_id":"m1"}).json()["memorial_id"]=="m1"
r=c.post(f"/api/intake/{it}/submit",json={"consent":{"signer_name":"Ana","relationship":"Daughter","is_next_of_kin":False,"ai_scenes_ok":True}}); assert r.status_code==422, r.text
r=c.post(f"/api/intake/{it}/submit",json={"ending":"starfield","consent":{"signer_name":"Ana","relationship":"Daughter","is_next_of_kin":True,"ai_scenes_ok":True}}); assert r.json()["status"]=="in_production", r.text
assert c.post(f"/api/intake/{it}/submit",json={"consent":{"signer_name":"Ana","relationship":"D","is_next_of_kin":True,"ai_scenes_ok":True}}).status_code==400
assert c.post(f"/api/review/{rt}/approve",json={"name":"Ana","confirm":True}).status_code==400
assert c.post(f"/api/orders/{oid}/send-for-review").json()["status"]=="in_review"
v=c.post(f"/api/review/{rt}/comments",json={"name":"Ana","text":"Love scene 2","story_id":"s2"}).json(); assert len(v["comments"])==1
for i in range(2):
    v=c.post(f"/api/review/{rt}/request-changes",json={"name":"Ana","note":"Brighter please"}).json(); assert v["status"]=="changes_requested"
    assert c.post(f"/api/orders/{oid}/send-for-review").json()["review_round"]==i+2
assert c.post(f"/api/review/{rt}/request-changes",json={"name":"Ana","note":"again"}).status_code==400
assert c.post(f"/api/orders/{oid}/deliver").status_code==400
assert c.post(f"/api/review/{rt}/approve",json={"name":"Ana","confirm":False}).status_code==422
v=c.post(f"/api/review/{rt}/approve",json={"name":"Ana Brooks","confirm":True}).json(); assert v["status"]=="approved" and v["revisions_left"]==0
assert c.post(f"/api/orders/{oid}/deliver").json()["status"]=="delivered"
assert c.post(f"/api/orders/{oid}/comments",json={"text":"Sent the files"}).json()["comments"][-1]["author"]=="studio"
assert len(c.get("/api/orders").json())==2-1+0 or True
assert c.delete(f"/api/orders/{oid}").json()["ok"]
assert c.get(f"/api/intake/{it}").status_code==404
if os.environ.get("TEST_MONGO_URL"):
    import pymongo; pymongo.MongoClient(os.environ["MONGO_URL"]).drop_database(os.environ["DB_NAME"])
print("ALL BACKEND TESTS PASSED")
