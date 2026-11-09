"""Staff authentication: one admin account from env, signed JWT in an httpOnly cookie.

Env:
  ADMIN_EMAIL           required to enable login
  ADMIN_PASSWORD_HASH   preferred; generate with `python hash_password.py`
  ADMIN_PASSWORD        alternative (plain text, fine for local dev)
  JWT_SECRET            required in production (32+ random chars). If unset, a random
                        per-process secret is used (sessions reset on restart).
  SESSION_DAYS          default 7
  COOKIE_SECURE         default true (localhost still works over http in Chrome/Firefox)
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import os
import secrets
import time
from collections import defaultdict, deque

import jwt
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, Field

COOKIE = "afterlight_session"
ALG = "HS256"
_fallback_secret = secrets.token_urlsafe(48)


def _secret() -> str:
    return os.environ.get("JWT_SECRET", "").strip() or _fallback_secret


def _session_seconds() -> int:
    return int(float(os.environ.get("SESSION_DAYS", "7")) * 86400)


# ---------- password hashing (pbkdf2-sha256, stdlib only) ----------

ITERATIONS = 390_000


def hash_password(pw: str, iterations: int = ITERATIONS) -> str:
    salt = secrets.token_bytes(16)
    dk = hashlib.pbkdf2_hmac("sha256", pw.encode(), salt, iterations)
    b64 = lambda b: base64.urlsafe_b64encode(b).decode().rstrip("=")  # noqa: E731
    return f"pbkdf2_sha256:{iterations}:{b64(salt)}:{b64(dk)}"


def verify_password(pw: str, stored: str) -> bool:
    try:
        algo, it, salt, dk = stored.replace("$", ":").split(":")
        if algo != "pbkdf2_sha256":
            return False
        pad = lambda s: base64.urlsafe_b64decode(s + "=" * (-len(s) % 4))  # noqa: E731
        got = hashlib.pbkdf2_hmac("sha256", pw.encode(), pad(salt), int(it))
        return hmac.compare_digest(got, pad(dk))
    except Exception:  # noqa: BLE001
        return False


def check_credentials(email: str, password: str) -> bool:
    admin = os.environ.get("ADMIN_EMAIL", "").strip().lower()
    if not admin:
        return False
    email_ok = hmac.compare_digest(email.strip().lower().encode(), admin.encode())
    h = os.environ.get("ADMIN_PASSWORD_HASH", "").strip()
    if h:
        pw_ok = verify_password(password, h)
    else:
        plain = os.environ.get("ADMIN_PASSWORD", "")
        pw_ok = bool(plain) and hmac.compare_digest(password.encode(), plain.encode())
    return email_ok and pw_ok


def login_configured() -> bool:
    return bool(os.environ.get("ADMIN_EMAIL", "").strip()) and bool(
        os.environ.get("ADMIN_PASSWORD_HASH", "").strip() or os.environ.get("ADMIN_PASSWORD", ""))


# ---------- rate limit (in-memory; one instance is fine on Render free) ----------

MAX_FAILS = int(os.environ.get("LOGIN_MAX_FAILS", "5"))
WINDOW = int(os.environ.get("LOGIN_WINDOW_SECONDS", "900"))
_fails: dict[str, deque] = defaultdict(deque)


def client_ip(req: Request) -> str:
    fwd = req.headers.get("x-forwarded-for", "")
    return fwd.split(",")[0].strip() if fwd else (req.client.host if req.client else "?")


def _prune(q: deque) -> None:
    cutoff = time.time() - WINDOW
    while q and q[0] < cutoff:
        q.popleft()


# ---------- tokens ----------

def make_token(email: str) -> str:
    now = int(time.time())
    return jwt.encode({"sub": email, "role": "admin", "iat": now, "exp": now + _session_seconds()}, _secret(), algorithm=ALG)


def read_token(req: Request) -> dict | None:
    tok = req.cookies.get(COOKIE)
    if not tok:
        return None
    try:
        claims = jwt.decode(tok, _secret(), algorithms=[ALG])
    except jwt.PyJWTError:
        return None
    admin = os.environ.get("ADMIN_EMAIL", "").strip().lower()
    return claims if claims.get("role") == "admin" and claims.get("sub") == admin else None


def is_staff(req: Request) -> bool:
    return read_token(req) is not None


async def require_staff(req: Request) -> dict:
    claims = read_token(req)
    if not claims:
        raise HTTPException(401, "Please log in.")
    return claims


def _set_cookie(resp: Response, value: str, max_age: int) -> None:
    secure = os.environ.get("COOKIE_SECURE", "true").lower() != "false"
    resp.set_cookie(COOKIE, value, max_age=max_age, httponly=True, secure=secure, samesite="lax", path="/")


# ---------- routes ----------

router = APIRouter(prefix="/api/auth", tags=["auth"])


class LoginIn(BaseModel):
    email: str = Field(min_length=3, max_length=200)
    password: str = Field(min_length=1, max_length=200)


@router.post("/login")
async def login(body: LoginIn, req: Request, resp: Response):
    if not login_configured():
        raise HTTPException(503, "Staff login isn't configured on the server (set ADMIN_EMAIL and ADMIN_PASSWORD_HASH).")
    key = client_ip(req)
    q = _fails[key]
    _prune(q)
    if len(q) >= MAX_FAILS:
        retry = int(q[0] + WINDOW - time.time()) + 1
        raise HTTPException(429, f"Too many attempts. Try again in {max(1, retry // 60)} min.", headers={"Retry-After": str(retry)})
    if not check_credentials(body.email, body.password):
        q.append(time.time())
        raise HTTPException(401, "Wrong email or password.")
    q.clear()
    email = body.email.strip().lower()
    _set_cookie(resp, make_token(email), _session_seconds())
    return {"email": email}


@router.post("/logout")
async def logout(resp: Response):
    _set_cookie(resp, "", 0)
    return {"ok": True}


@router.get("/me")
async def me(req: Request):
    """200 with email=null when logged out (keeps the browser console free of 401 noise)."""
    claims = read_token(req)
    return {"email": claims["sub"] if claims else None}
