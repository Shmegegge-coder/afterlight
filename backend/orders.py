"""Memory Film orders: staff order desk, family intake and family approval.

Self-contained FastAPI router. Wire it into server.py with:

    from orders import router as orders_router
    app.include_router(orders_router)

Uses the same MONGO_URL / DB_NAME env vars as the rest of the backend and stores
everything in the `orders` collection. Families never see order ids, only two
unguessable tokens: one for intake, one for review.
"""

from __future__ import annotations

import os
import secrets
import uuid
from datetime import datetime, timezone
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException

from auth import require_staff
from motor.motor_asyncio import AsyncIOMotorClient
import re

from pydantic import BaseModel, Field, field_validator

router = APIRouter(prefix="/api", tags=["orders"])

_client: Optional[AsyncIOMotorClient] = None


def _db():
    global _client
    if _client is None:
        _client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    return _client[os.environ["DB_NAME"]]


def orders():
    return _db()["orders"]


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


# ---------- constants ----------

PACKAGES = {
    "memory-film": {"name": "Memory Film", "price": 700, "max_revisions": 2},
}

Status = Literal["awaiting_intake", "in_production", "in_review", "changes_requested", "approved", "delivered"]
Ending = Literal["ascension", "sunset", "starfield", "favorite-place", "none"]
Tone = Literal["celebratory", "gentle", "reverent", "lighthearted"]


# ---------- models ----------

class OrderCreate(BaseModel):
    package_id: Literal["memory-film"] = "memory-film"
    deceased_name: str = Field(min_length=1, max_length=120)
    family_name: str = Field(min_length=1, max_length=120)
    family_email: str = Field(default="", max_length=200)
    family_phone: str = Field(default="", max_length=40)
    funeral_home: str = Field(default="", max_length=160)
    service_date: str = Field(default="", max_length=10)  # YYYY-MM-DD

    @field_validator("family_email")
    @classmethod
    def email_shape(cls, v: str) -> str:
        v = v.strip()
        if v and not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", v):
            raise ValueError("Enter a valid email address.")
        return v


class Consent(BaseModel):
    signer_name: str = Field(min_length=2, max_length=120)
    relationship: str = Field(min_length=1, max_length=60)
    is_next_of_kin: bool
    ai_scenes_ok: bool
    likeness_animation_ok: bool = False
    voice_clone_ok: bool = False

    @field_validator("is_next_of_kin")
    @classmethod
    def must_be_authorized(cls, v: bool) -> bool:
        if not v:
            raise ValueError("Consent must come from the next of kin or someone they authorized.")
        return v

    @field_validator("ai_scenes_ok")
    @classmethod
    def must_allow_ai(cls, v: bool) -> bool:
        if not v:
            raise ValueError("The Memory Film uses AI to create scenes from your photos and stories.")
        return v


class IntakeSubmit(BaseModel):
    tone: Tone = "gentle"
    ending: Ending = "sunset"
    music: str = Field(default="", max_length=300)
    must_include: str = Field(default="", max_length=2000)
    avoid: str = Field(default="", max_length=2000)
    notes: str = Field(default="", max_length=2000)
    consent: Consent


class LinkMemorial(BaseModel):
    memorial_id: str = Field(min_length=1, max_length=64)


class CommentIn(BaseModel):
    name: str = Field(default="", max_length=120)
    text: str = Field(min_length=1, max_length=2000)
    story_id: Optional[str] = Field(default=None, max_length=64)


class ChangesIn(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    note: str = Field(min_length=3, max_length=2000)


class ApproveIn(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    confirm: bool

    @field_validator("confirm")
    @classmethod
    def must_confirm(cls, v: bool) -> bool:
        if not v:
            raise ValueError("Please confirm you approve the final Memory Film.")
        return v


# ---------- helpers ----------

def _clean(doc: dict) -> dict:
    doc.pop("_id", None)
    return doc


def _event(status: str, note: str = "") -> dict:
    return {"at": now(), "status": status, "note": note}


async def _get_by(field: str, value: str) -> dict:
    doc = await orders().find_one({field: value})
    if not doc:
        raise HTTPException(404, "This link is no longer valid." if field != "id" else "Order not found.")
    return _clean(doc)


async def _save(doc: dict, set_fields: dict, push: Optional[dict] = None) -> dict:
    set_fields["updated_at"] = now()
    update: dict = {"$set": set_fields}
    if push:
        update["$push"] = push
    await orders().update_one({"id": doc["id"]}, update)
    return await _get_by("id", doc["id"])


def _comment(author: Literal["family", "studio"], body: CommentIn, rnd: int) -> dict:
    return {
        "id": str(uuid.uuid4()),
        "author": author,
        "name": body.name.strip() or ("Afterlight" if author == "studio" else "Family"),
        "text": body.text.strip(),
        "story_id": body.story_id,
        "round": rnd,
        "created_at": now(),
    }


def _family_intake_view(o: dict) -> dict:
    return {
        "deceased_name": o["deceased_name"],
        "family_name": o["family_name"],
        "service_date": o["service_date"],
        "package_name": PACKAGES[o["package_id"]]["name"],
        "status": o["status"],
        "memorial_id": o["memorial_id"],
        "submitted": o["intake"] is not None,
    }


def _family_review_view(o: dict) -> dict:
    used = o["changes_requested_count"]
    return {
        "deceased_name": o["deceased_name"],
        "family_name": o["family_name"],
        "service_date": o["service_date"],
        "package_name": PACKAGES[o["package_id"]]["name"],
        "status": o["status"],
        "memorial_id": o["memorial_id"],
        "review_round": o["review_round"],
        "revisions_left": max(0, o["max_revisions"] - used),
        "comments": o["comments"],
        "approval": o["approval"],
        "ending": (o["intake"] or {}).get("ending"),
    }


# ---------- staff: order desk ----------

@router.post("/orders", dependencies=[Depends(require_staff)])
async def create_order(body: OrderCreate) -> dict:
    pkg = PACKAGES[body.package_id]
    doc = {
        "id": str(uuid.uuid4()),
        **body.model_dump(),
        "price": pkg["price"],
        "max_revisions": pkg["max_revisions"],
        "status": "awaiting_intake",
        "intake_token": secrets.token_urlsafe(18),
        "review_token": secrets.token_urlsafe(18),
        "memorial_id": None,
        "intake": None,
        "consent": None,
        "comments": [],
        "review_round": 0,
        "changes_requested_count": 0,
        "approval": None,
        "history": [_event("awaiting_intake", "Order created")],
        "created_at": now(),
        "updated_at": now(),
    }
    await orders().insert_one(dict(doc))
    return doc


@router.get("/orders", dependencies=[Depends(require_staff)])
async def list_orders() -> list[dict]:
    cur = orders().find({}, {"_id": 0}).sort("created_at", -1)
    return await cur.to_list(500)


@router.get("/orders/{order_id}", dependencies=[Depends(require_staff)])
async def get_order(order_id: str) -> dict:
    return await _get_by("id", order_id)


@router.post("/orders/{order_id}/send-for-review", dependencies=[Depends(require_staff)])
async def send_for_review(order_id: str) -> dict:
    o = await _get_by("id", order_id)
    if not o["memorial_id"]:
        raise HTTPException(400, "The family hasn't started intake yet.")
    if o["status"] not in ("in_production", "changes_requested"):
        raise HTTPException(400, f"Can't send for review while the order is {o['status'].replace('_', ' ')}.")
    rnd = o["review_round"] + 1
    return await _save(o, {"status": "in_review", "review_round": rnd}, {"history": _event("in_review", f"Review round {rnd} sent")})


@router.post("/orders/{order_id}/comments", dependencies=[Depends(require_staff)])
async def studio_comment(order_id: str, body: CommentIn) -> dict:
    o = await _get_by("id", order_id)
    return await _save(o, {}, {"comments": _comment("studio", body, o["review_round"])})


@router.post("/orders/{order_id}/deliver", dependencies=[Depends(require_staff)])
async def deliver(order_id: str) -> dict:
    o = await _get_by("id", order_id)
    if o["status"] != "approved":
        raise HTTPException(400, "Only approved orders can be delivered.")
    return await _save(o, {"status": "delivered"}, {"history": _event("delivered", "Marked delivered")})


@router.delete("/orders/{order_id}", dependencies=[Depends(require_staff)])
async def delete_order(order_id: str) -> dict:
    res = await orders().delete_one({"id": order_id})
    if not res.deleted_count:
        raise HTTPException(404, "Order not found.")
    return {"ok": True}


# ---------- family: intake ----------

@router.get("/intake/{token}")
async def get_intake(token: str) -> dict:
    return _family_intake_view(await _get_by("intake_token", token))


@router.post("/intake/{token}/memorial")
async def link_memorial(token: str, body: LinkMemorial) -> dict:
    o = await _get_by("intake_token", token)
    if o["intake"] is not None:
        raise HTTPException(400, "Intake has already been submitted.")
    if o["memorial_id"] and o["memorial_id"] != body.memorial_id:
        raise HTTPException(400, "A memorial is already linked to this order.")
    o = await _save(o, {"memorial_id": body.memorial_id})
    return _family_intake_view(o)


@router.post("/intake/{token}/submit")
async def submit_intake(token: str, body: IntakeSubmit) -> dict:
    o = await _get_by("intake_token", token)
    if o["intake"] is not None:
        raise HTTPException(400, "Intake has already been submitted.")
    if not o["memorial_id"]:
        raise HTTPException(400, "Please add their details, photos and memories first.")
    data = body.model_dump()
    consent = {**data.pop("consent"), "signed_at": now()}
    o = await _save(
        o,
        {"intake": {**data, "submitted_at": now()}, "consent": consent, "status": "in_production"},
        {"history": _event("in_production", f"Intake + consent signed by {consent['signer_name']}")},
    )
    return _family_intake_view(o)


# ---------- family: review & approval ----------

@router.get("/review/{token}")
async def get_review(token: str) -> dict:
    o = await _get_by("review_token", token)
    if o["review_round"] == 0:
        raise HTTPException(409, "The Memory Film isn't ready for review yet. We'll send you this link again when it is.")
    return _family_review_view(o)


@router.post("/review/{token}/comments")
async def family_comment(token: str, body: CommentIn) -> dict:
    o = await _get_by("review_token", token)
    if o["status"] != "in_review":
        raise HTTPException(400, "Comments are closed for this round.")
    o = await _save(o, {}, {"comments": _comment("family", body, o["review_round"])})
    return _family_review_view(o)


@router.post("/review/{token}/request-changes")
async def request_changes(token: str, body: ChangesIn) -> dict:
    o = await _get_by("review_token", token)
    if o["status"] != "in_review":
        raise HTTPException(400, "Changes can only be requested while the film is in review.")
    if o["changes_requested_count"] >= o["max_revisions"]:
        raise HTTPException(400, "All included revision rounds have been used. Please contact us for further changes.")
    c = _comment("family", CommentIn(name=body.name, text=f"Change request: {body.note}"), o["review_round"])
    o = await _save(
        o,
        {"status": "changes_requested", "changes_requested_count": o["changes_requested_count"] + 1},
        {"comments": c, "history": _event("changes_requested", f"Requested by {body.name}")},
    )
    return _family_review_view(o)


@router.post("/review/{token}/approve")
async def approve(token: str, body: ApproveIn) -> dict:
    o = await _get_by("review_token", token)
    if o["status"] != "in_review":
        raise HTTPException(400, "This film can't be approved right now.")
    approval = {"name": body.name.strip(), "approved_at": now(), "round": o["review_round"]}
    o = await _save(o, {"status": "approved", "approval": approval}, {"history": _event("approved", f"Approved by {approval['name']}")})
    return _family_review_view(o)
