"""Afterlight API (FastAPI + MongoDB).

RECONSTRUCTED: Emergent's original server.py could not be exported, so this file was
rebuilt from the live API's responses (GET /api/memorials etc.), the frontend's typed
client (frontend/src/lib/api.ts, lib/types.ts) and the pages that call it. Route paths,
request bodies and response shapes match what the frontend expects; prompts and
internals are new. AI calls go through providers.py using your own API keys.
"""
from __future__ import annotations

import asyncio
import json
import logging
import mimetypes
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv

ROOT = Path(__file__).parent
load_dotenv(ROOT / ".env")

from fastapi import APIRouter, BackgroundTasks, Depends, FastAPI, File, HTTPException, Request, UploadFile  # noqa: E402
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402
from fastapi.responses import FileResponse, Response, StreamingResponse  # noqa: E402
from pydantic import BaseModel, Field  # noqa: E402

import orders as orders_mod  # noqa: E402
import providers as P  # noqa: E402
from orders import router as orders_router  # noqa: E402
from auth import is_staff, require_staff, router as auth_router  # noqa: E402

log = logging.getLogger("afterlight")
logging.basicConfig(level=logging.INFO)

# ---------------------------------------------------------------- db

def db():
    # Share one client with orders.py (it lazily creates its own if we don't).
    return orders_mod._db()


def memorials():
    return db()["memorials"]


def plans():
    return db()["plans"]


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


# ---------------------------------------------------------------- files
# Stored in Mongo by default (works on hosts with ephemeral disks, e.g. Render free).
# Set FILES_DIR to store on disk instead.

FILES_DIR = os.environ.get("FILES_DIR", "").strip()
MAX_UPLOAD = int(os.environ.get("MAX_UPLOAD_MB", "12")) * 1024 * 1024


async def save_file(data: bytes, mime: str) -> str:
    ext = mimetypes.guess_extension(mime or "") or ".bin"
    if ext == ".jpe":
        ext = ".jpg"
    name = f"{uuid.uuid4().hex}{ext}"
    if FILES_DIR:
        Path(FILES_DIR).mkdir(parents=True, exist_ok=True)
        (Path(FILES_DIR) / name).write_bytes(data)
    else:
        if len(data) > 15 * 1024 * 1024:
            raise P.ProviderError("File too large for Mongo storage (16 MB limit). Set FILES_DIR or use object storage.")
        await db()["files"].insert_one({"name": name, "mime": mime, "data": data, "created_at": now()})
    return f"/api/files/{name}"


async def load_file(url: str) -> Optional[tuple[bytes, str]]:
    if not url:
        return None
    if url.startswith("/api/files/"):
        name = url.rsplit("/", 1)[-1]
        if FILES_DIR and (Path(FILES_DIR) / name).exists():
            return (Path(FILES_DIR) / name).read_bytes(), mimetypes.guess_type(name)[0] or "image/png"
        doc = await db()["files"].find_one({"name": name})
        return (bytes(doc["data"]), doc["mime"]) if doc else None
    if url.startswith("http"):
        import httpx
        async with httpx.AsyncClient(timeout=60, follow_redirects=True) as c:
            r = await c.get(url)
            if r.status_code < 400:
                return r.content, r.headers.get("content-type", "image/jpeg").split(";")[0]
    return None


# ---------------------------------------------------------------- models

class MemorialCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    birth_date: str = Field(default="", max_length=10)
    death_date: str = Field(default="", max_length=10)
    epitaph: str = Field(default="", max_length=300)


class MemorialUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=120)
    birth_date: Optional[str] = Field(default=None, max_length=10)
    death_date: Optional[str] = Field(default=None, max_length=10)
    epitaph: Optional[str] = Field(default=None, max_length=300)


class StoryCreate(BaseModel):
    title: str = Field(min_length=1, max_length=160)
    text: str = Field(min_length=1, max_length=4000)
    photo_id: Optional[str] = None


class PlanRequest(BaseModel):
    city: str = Field(min_length=1, max_length=120)
    budget: float = Field(gt=0)
    goals: str = Field(min_length=1, max_length=4000)
    experience: str = Field(default="", max_length=4000)


def new_memorial(body: MemorialCreate) -> dict:
    return {
        "id": str(uuid.uuid4()),
        **body.model_dump(),
        "is_sample": False,
        "photos": [],
        "stories": [],
        "finale": {"image_url": None, "status": "idle", "error": None},
        "narration": {"intro": "", "finale": "", "status": "idle", "error": None},
        "created_at": now(),
    }


def new_story(body: StoryCreate) -> dict:
    return {
        "id": str(uuid.uuid4()), "title": body.title.strip(), "text": body.text.strip(), "photo_id": body.photo_id,
        "caption": "", "image_url": None, "image_status": "idle", "image_error": None,
        "video_url": None, "video_status": "idle", "video_error": None,
    }


# ---------------------------------------------------------------- helpers

async def get_mem(mid: str) -> dict:
    m = await memorials().find_one({"id": mid}, {"_id": 0})
    if not m:
        raise HTTPException(404, "Memorial not found.")
    return m


async def order_for(mid: str) -> Optional[dict]:
    """The Memory Film order linked to this memorial (if any) — carries the family's intake choices."""
    return await db()["orders"].find_one({"memorial_id": mid}, {"_id": 0})


async def with_order_info(m: dict) -> dict:
    o = await order_for(m["id"])
    intake = (o or {}).get("intake") or {}
    m["finale"]["ending"] = intake.get("ending")  # None = no order / classic ascension
    return m


async def put(m: dict) -> dict:
    await memorials().replace_one({"id": m["id"]}, m, upsert=True)
    return await with_order_info(await get_mem(m["id"]))


async def patch(mid: str, sets: dict) -> None:
    await memorials().update_one({"id": mid}, {"$set": sets})


def story_idx(m: dict, sid: str) -> int:
    for i, s in enumerate(m["stories"]):
        if s["id"] == sid:
            return i
    raise HTTPException(404, "Memory not found.")


def err_text(e: Exception) -> str:
    return str(e)[:400] or e.__class__.__name__


STYLE = ("Soft, luminous, cinematic memorial scene, like a gentle hologram of a cherished memory: warm glowing "
         "light, subtle bloom, shallow depth of field, painterly but photographic, dignified and peaceful. "
         "16:9 widescreen. No text, captions, watermarks or logos.")


def family_notes(o: Optional[dict]) -> str:
    it = (o or {}).get("intake") or {}
    bits = []
    if it.get("tone"):
        bits.append(f"Tone the family asked for: {it['tone']}.")
    if it.get("must_include"):
        bits.append(f"The family wants this included: {it['must_include']}")
    if it.get("avoid"):
        bits.append(f"The family asked to AVOID: {it['avoid']}")
    return "\n".join(bits)


ENDING_PROMPTS = {
    "ascension": "{name} rising gently toward heaven with large luminous feathered wings, ascending into radiant golden light breaking through soft clouds, serene and peaceful, seen from slightly below.",
    "sunset": "A warm, tranquil sunset fading to gold over a calm horizon, the silhouette of {name} standing peacefully and looking toward the light, long soft shadows, a sense of a beautiful day ending.",
    "starfield": "A calm, vast night sky full of soft stars and a faint milky way, the gentle silhouette of {name} drifting peacefully among the stars, quiet and infinite.",
    "favorite-place": "{name} at peace in their favorite place{place}, bathed in soft golden late-afternoon light, a final, gentle farewell scene.",
}
ENDING_NARRATION = {
    "ascension": "a winged ascension into golden light",
    "sunset": "a warm sunset fading to gold",
    "starfield": "drifting into a calm night sky full of stars",
    "favorite-place": "a final scene in their favorite place",
    "none": "a simple, gentle fade to black (do not mention wings or heaven)",
}


# ---------------------------------------------------------------- background jobs

async def job_scene(mid: str, sid: str) -> None:
    try:
        m = await get_mem(mid)
        s = m["stories"][story_idx(m, sid)]
        o = await order_for(mid)
        refs = []
        photo_ids = [s["photo_id"]] if s.get("photo_id") else [p["id"] for p in m["photos"]][:4]
        for p in m["photos"]:
            if p["id"] in photo_ids:
                f = await load_file(p["url"])
                if f:
                    refs.append(f)
        prompt = (f"{STYLE}\n\nThe memory: \"{s['title']}\" — {s['text']}\n"
                  + (f"The reference photos show {m['name']}; keep their likeness, age and features faithful.\n" if refs else "")
                  + family_notes(o))
        data, mime = await P.generate_image(prompt, refs)
        url = await save_file(data, mime)
        await memorials().update_one({"id": mid, "stories.id": sid}, {"$set": {"stories.$.image_url": url, "stories.$.image_status": "done", "stories.$.image_error": None}})
    except Exception as e:  # noqa: BLE001
        log.exception("scene failed")
        await memorials().update_one({"id": mid, "stories.id": sid}, {"$set": {"stories.$.image_status": "failed", "stories.$.image_error": err_text(e)}})


async def job_video(mid: str, sid: str) -> None:
    try:
        m = await get_mem(mid)
        s = m["stories"][story_idx(m, sid)]
        img = await load_file(s["image_url"] or "")
        if not img:
            raise P.ProviderError("Generate the scene image first.")
        o = await order_for(mid)
        consent = (o or {}).get("consent") or {}
        motion = "Subtle, slow camera push-in, gentle ambient motion (light, leaves, water, particles)."
        if o and not consent.get("likeness_animation_ok"):
            motion += " Keep any people's faces still; do not animate faces or mouths."
        data, mime = await P.generate_video(f"{motion} {s['title']}: {s['text'][:400]}", img)
        url = await save_file(data, mime)
        await memorials().update_one({"id": mid, "stories.id": sid}, {"$set": {"stories.$.video_url": url, "stories.$.video_status": "done", "stories.$.video_error": None}})
    except Exception as e:  # noqa: BLE001
        log.exception("video failed")
        await memorials().update_one({"id": mid, "stories.id": sid}, {"$set": {"stories.$.video_status": "failed", "stories.$.video_error": err_text(e)}})


async def job_finale(mid: str) -> None:
    try:
        m = await get_mem(mid)
        o = await order_for(mid)
        ending = ((o or {}).get("intake") or {}).get("ending") or "ascension"
        place = ""
        if ending == "favorite-place":
            extra = " ".join(filter(None, [((o or {}).get("intake") or {}).get(k, "") for k in ("must_include", "notes")]))
            place = f" (family notes: {extra[:300]})" if extra else ""
        refs = []
        for p in m["photos"][:3]:
            f = await load_file(p["url"])
            if f:
                refs.append(f)
        prompt = (f"{STYLE}\n\nFinale: " + ENDING_PROMPTS[ending].format(name=m["name"], place=place)
                  + ("\nThe reference photos show " + m["name"] + "; keep a respectful likeness." if refs else "")
                  + "\n" + family_notes(o))
        data, mime = await P.generate_image(prompt, refs)
        url = await save_file(data, mime)
        await patch(mid, {"finale": {"image_url": url, "status": "done", "error": None}})
    except Exception as e:  # noqa: BLE001
        log.exception("finale failed")
        await patch(mid, {"finale.status": "failed", "finale.error": err_text(e)})


async def job_narration(mid: str) -> None:
    try:
        m = await get_mem(mid)
        o = await order_for(mid)
        ending = ((o or {}).get("intake") or {}).get("ending") or "ascension"
        first = m["name"].split(" ")[0]
        system = ("You write narration for Afterlight holographic memorial shows: warm, dignified, specific, never "
                  "saccharine. Speak to the gathered family and friends. Plain spoken English, no stage directions.")
        stories = [{"id": s["id"], "title": s["title"], "text": s["text"]} for s in m["stories"]]
        user = (f"Person: {m['name']} ({m['birth_date'][:4]}–{m['death_date'][:4]}). Epitaph: {m['epitaph'] or '—'}\n"
                f"{family_notes(o)}\nThe show ends with {ENDING_NARRATION[ending]}.\n\n"
                f"Memories (JSON): {json.dumps(stories)}\n\n"
                'Return JSON: {"intro": "2-3 sentence welcome", "captions": {"<story id>": "1-2 sentence spoken caption"}, '
                '"finale": "1-2 sentence closing line that fits the ending"}')
        try:
            out = await P.complete_json(system, user)
        except P.ProviderError as e:
            if str(e) != "stub":
                raise
            out = {"intro": f"Welcome, and thank you for being here to remember {m['name']}.",
                   "captions": {s["id"]: s["text"][:200] for s in m["stories"]},
                   "finale": f"Rest gently, {first}." if ending != "ascension" else f"Fly high, {first}. Into the light."}
        caps = out.get("captions") or {}
        m = await get_mem(mid)
        for s in m["stories"]:
            if caps.get(s["id"]):
                s["caption"] = str(caps[s["id"]]).strip()
        m["narration"] = {"intro": str(out.get("intro", "")).strip(), "finale": str(out.get("finale", "")).strip(), "status": "done", "error": None}
        await memorials().replace_one({"id": mid}, m)
    except Exception as e:  # noqa: BLE001
        log.exception("narration failed")
        await patch(mid, {"narration.status": "failed", "narration.error": err_text(e)})


def spawn(bg: BackgroundTasks, coro_fn, *args) -> None:
    bg.add_task(coro_fn, *args)


# ---------------------------------------------------------------- access control
# Staff: signed session cookie (auth.py). Families: the order token from their link, sent by the
# frontend as the X-Afterlight-Token header. Intake tokens may edit their own memorial until the
# intake is submitted; review tokens are read-only. Sample memorials are public to view.

STAFF = [Depends(require_staff)]


async def family_order(req: Request) -> tuple[Optional[dict], str]:
    tok = req.headers.get("x-afterlight-token", "").strip()
    if not tok or len(tok) > 64:
        return None, ""
    o = await db()["orders"].find_one({"$or": [{"intake_token": tok}, {"review_token": tok}]}, {"_id": 0})
    if not o:
        return None, ""
    return o, ("intake" if o["intake_token"] == tok else "review")


async def ensure_read(req: Request, m: dict) -> None:
    if m.get("is_sample") or is_staff(req):
        return
    o, _ = await family_order(req)
    if o and o.get("memorial_id") == m["id"]:
        return
    raise HTTPException(401 if not req.headers.get("x-afterlight-token") else 403, "Please log in.")


async def ensure_write(req: Request, mid: str) -> None:
    if is_staff(req):
        return
    o, kind = await family_order(req)
    if o and kind == "intake" and o.get("memorial_id") == mid and o.get("intake") is None:
        return
    raise HTTPException(403 if o else 401, "You can't change this memorial." if o else "Please log in.")


# ---------------------------------------------------------------- routes

api = APIRouter(prefix="/api")


@api.get("/")
async def root():
    return {"message": "Afterlight API"}


@api.get("/ai/status", dependencies=STAFF)
async def ai_status():
    """Which provider each generation step will use (no secrets returned)."""
    return P.status()


@api.get("/files/{name}")
async def get_file(name: str):
    if "/" in name or ".." in name:
        raise HTTPException(400, "Bad file name.")
    if FILES_DIR and (Path(FILES_DIR) / name).exists():
        return FileResponse(Path(FILES_DIR) / name)
    doc = await db()["files"].find_one({"name": name})
    if not doc:
        raise HTTPException(404, "File not found.")
    return Response(bytes(doc["data"]), media_type=doc["mime"], headers={"Cache-Control": "public, max-age=31536000, immutable"})


# memorials

@api.get("/memorials", dependencies=STAFF)
async def list_memorials():
    items = await memorials().find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    items.sort(key=lambda m: (not m.get("is_sample"), ), reverse=True)  # samples last
    return [await with_order_info(m) for m in items]


@api.post("/memorials")
async def create_memorial(body: MemorialCreate, req: Request):
    if not is_staff(req):
        o, kind = await family_order(req)
        if not (o and kind == "intake" and not o.get("memorial_id") and o.get("intake") is None):
            raise HTTPException(401, "Please log in.")
    m = new_memorial(body)
    await memorials().insert_one(dict(m))
    return await with_order_info(await get_mem(m["id"]))


@api.get("/memorials/{mid}")
async def read_memorial(mid: str, req: Request):
    m = await get_mem(mid)
    await ensure_read(req, m)
    return await with_order_info(m)


@api.patch("/memorials/{mid}")
async def update_memorial(mid: str, body: MemorialUpdate, req: Request):
    await get_mem(mid)
    await ensure_write(req, mid)
    sets = {k: v for k, v in body.model_dump().items() if v is not None}
    if sets:
        await patch(mid, sets)
    return await with_order_info(await get_mem(mid))


@api.delete("/memorials/{mid}", dependencies=STAFF)
async def delete_memorial(mid: str):
    res = await memorials().delete_one({"id": mid})
    if not res.deleted_count:
        raise HTTPException(404, "Memorial not found.")
    return {"ok": True}


@api.post("/memorials/{mid}/photos")
async def upload_photos(mid: str, req: Request, files: list[UploadFile] = File(...)):
    m = await get_mem(mid)
    await ensure_write(req, mid)
    for f in files:
        mime = (f.content_type or "").split(";")[0]
        if mime not in ("image/jpeg", "image/png", "image/webp"):
            raise HTTPException(400, f"{f.filename}: only JPEG, PNG or WebP photos are supported.")
        data = await f.read()
        if len(data) > MAX_UPLOAD:
            raise HTTPException(400, f"{f.filename} is larger than {MAX_UPLOAD // (1024 * 1024)} MB.")
        url = await save_file(data, mime)
        m["photos"].append({"id": str(uuid.uuid4()), "url": url})
    return await put(m)


@api.delete("/memorials/{mid}/photos/{pid}")
async def delete_photo(mid: str, pid: str, req: Request):
    m = await get_mem(mid)
    await ensure_write(req, mid)
    m["photos"] = [p for p in m["photos"] if p["id"] != pid]
    for s in m["stories"]:
        if s.get("photo_id") == pid:
            s["photo_id"] = None
    return await put(m)


@api.post("/memorials/{mid}/stories")
async def add_story(mid: str, body: StoryCreate, req: Request):
    m = await get_mem(mid)
    await ensure_write(req, mid)
    if body.photo_id and not any(p["id"] == body.photo_id for p in m["photos"]):
        raise HTTPException(400, "That photo doesn't belong to this memorial.")
    m["stories"].append(new_story(body))
    return await put(m)


@api.delete("/memorials/{mid}/stories/{sid}")
async def delete_story(mid: str, sid: str, req: Request):
    m = await get_mem(mid)
    await ensure_write(req, mid)
    m["stories"].pop(story_idx(m, sid))
    return await put(m)


@api.post("/memorials/{mid}/stories/{sid}/generate-image", dependencies=STAFF)
async def gen_image(mid: str, sid: str, bg: BackgroundTasks):
    m = await get_mem(mid)
    s = m["stories"][story_idx(m, sid)]
    if s["image_status"] == "generating":
        raise HTTPException(409, "This scene is already being generated.")
    if P.image_provider() == "none":
        raise HTTPException(503, "No image AI provider configured on the server (set GEMINI_API_KEY).")
    await memorials().update_one({"id": mid, "stories.id": sid}, {"$set": {"stories.$.image_status": "generating", "stories.$.image_error": None}})
    spawn(bg, job_scene, mid, sid)
    return await with_order_info(await get_mem(mid))


@api.post("/memorials/{mid}/stories/{sid}/generate-video", dependencies=STAFF)
async def gen_video(mid: str, sid: str, bg: BackgroundTasks):
    m = await get_mem(mid)
    s = m["stories"][story_idx(m, sid)]
    if not s.get("image_url"):
        raise HTTPException(400, "Generate the scene image first.")
    if s["video_status"] == "generating":
        raise HTTPException(409, "This clip is already being animated.")
    if P.video_provider() == "none":
        raise HTTPException(503, "No video provider configured on the server (set FAL_KEY). Clips are optional.")
    await memorials().update_one({"id": mid, "stories.id": sid}, {"$set": {"stories.$.video_status": "generating", "stories.$.video_error": None}})
    spawn(bg, job_video, mid, sid)
    return await with_order_info(await get_mem(mid))


@api.post("/memorials/{mid}/finale/generate", dependencies=STAFF)
async def gen_finale(mid: str, bg: BackgroundTasks):
    m = await get_mem(mid)
    o = await order_for(mid)
    if ((o or {}).get("intake") or {}).get("ending") == "none":
        raise HTTPException(400, "The family chose a simple fade, so there's no finale scene to generate.")
    if m["finale"]["status"] == "generating":
        raise HTTPException(409, "The finale is already being generated.")
    if P.image_provider() == "none":
        raise HTTPException(503, "No image AI provider configured on the server (set GEMINI_API_KEY).")
    await patch(mid, {"finale.status": "generating", "finale.error": None})
    spawn(bg, job_finale, mid)
    return await with_order_info(await get_mem(mid))


@api.post("/memorials/{mid}/narration/generate", dependencies=STAFF)
async def gen_narration(mid: str, bg: BackgroundTasks):
    m = await get_mem(mid)
    if not m["stories"]:
        raise HTTPException(400, "Add at least one memory first.")
    if m["narration"]["status"] == "generating":
        raise HTTPException(409, "Narration is already being written.")
    if P.text_provider() == "none":
        raise HTTPException(503, "No text AI provider configured on the server (set GEMINI_API_KEY).")
    await patch(mid, {"narration.status": "generating", "narration.error": None})
    spawn(bg, job_narration, mid)
    return await with_order_info(await get_mem(mid))


# advisor

ADVISOR_SYSTEM = (
    "You are a pragmatic small-business advisor for Afterlight, a holographic memorial services business: life "
    "memories are projected around the room at funerals and celebrations of life (holographic fan displays / "
    "projection, AI-generated memory scenes from family photos and stories, narration), ending in a finale such as a "
    "winged ascension. Write a concrete launch plan in Markdown for the user's city and budget with these sections: "
    "1) Software and hardware (specific products, rent vs buy), 2) Budget table (markdown table, totals within budget), "
    "3) Pricing (packages incl. a content-only Memory Film around $700), 4) Break-even (services/month), "
    "5) Who to pitch locally (types of funeral homes, churches, venues, grief groups; how to approach), "
    "6) 90-day roadmap (week by week or by phase), 7) A 60-second pitch script. Be specific, realistic and concise."
)


@api.get("/advisor/plans", dependencies=STAFF)
async def list_plans():
    return await plans().find({}, {"_id": 0}).sort("created_at", -1).to_list(200)


@api.delete("/advisor/plans/{pid}", dependencies=STAFF)
async def delete_plan(pid: str):
    res = await plans().delete_one({"id": pid})
    if not res.deleted_count:
        raise HTTPException(404, "Plan not found.")
    return {"ok": True}


@api.post("/advisor/plans/stream", dependencies=STAFF)
async def stream_plan(body: PlanRequest):
    user = (f"City/market: {body.city}\nStartup budget: ${body.budget:,.0f}\nGoals: {body.goals}\n"
            f"My experience: {body.experience or 'not specified'}")

    async def gen():
        content = []
        try:
            async for t in P.stream_text(ADVISOR_SYSTEM, user, 6000):
                content.append(t)
                yield f"data: {json.dumps({'type': 'delta', 'content': t})}\n\n"
            plan = {"id": str(uuid.uuid4()), **body.model_dump(), "content": "".join(content), "created_at": now()}
            await plans().insert_one(dict(plan))
            yield f"data: {json.dumps({'type': 'done', 'id': plan['id']})}\n\n"
        except Exception as e:  # noqa: BLE001
            log.exception("advisor failed")
            yield f"data: {json.dumps({'type': 'error', 'message': err_text(e)})}\n\n"

    return StreamingResponse(gen(), media_type="text/event-stream", headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


# ---------------------------------------------------------------- app

app = FastAPI(title="Afterlight API")
app.include_router(api)
app.include_router(auth_router)
app.include_router(orders_router)

@app.middleware("http")
async def no_store(request: Request, call_next):
    # Vercel's CDN honors upstream cache headers on rewrites; make sure per-user API
    # responses are never cached (uploaded/generated files keep their immutable headers).
    resp = await call_next(request)
    if request.url.path.startswith("/api/") and not request.url.path.startswith("/api/files/"):
        resp.headers.setdefault("Cache-Control", "no-store")
    return resp


app.add_middleware(
    CORSMiddleware,
    # Preferred deploy is same-origin (Vercel rewrites /api to Render), so CORS is unused.
    # For a cross-site frontend, list its exact origin(s); cookies then also need SameSite=None.
    allow_origins=[o.strip() for o in os.environ.get("CORS_ORIGINS", "").split(",") if o.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    # Reset jobs that were interrupted by a restart so the UI doesn't spin forever.
    async for m in memorials().find({}, {"_id": 0}):
        changed = False
        for s in m["stories"]:
            for k in ("image", "video"):
                if s.get(f"{k}_status") == "generating":
                    s[f"{k}_status"], s[f"{k}_error"], changed = "failed", "Interrupted by a server restart; try again.", True
        for k in ("finale", "narration"):
            if m[k].get("status") == "generating":
                m[k]["status"], m[k]["error"], changed = "failed", "Interrupted by a server restart; try again.", True
        if changed:
            await memorials().replace_one({"id": m["id"]}, m)
    # Seed the sample memorial on an empty database.
    seed = ROOT / "seed" / "memorials.json"
    if os.environ.get("SEED_SAMPLES", "true").lower() != "false" and seed.exists() and await memorials().count_documents({}) == 0:
        for m in json.loads(seed.read_text()):
            if m.get("is_sample"):
                m.get("finale", {}).pop("ending", None)
                await memorials().insert_one(m)
    log.info("AI providers: %s", P.status())


# Optional: serve the built frontend from the same origin (SERVE_FRONTEND=path/to/dist).
_dist = os.environ.get("SERVE_FRONTEND", "").strip()
if _dist and Path(_dist).is_dir():
    from fastapi.staticfiles import StaticFiles

    app.mount("/assets", StaticFiles(directory=Path(_dist) / "assets"), name="assets")

    @app.get("/{path:path}")
    async def spa(path: str):
        f = Path(_dist) / path
        return FileResponse(f if path and f.is_file() else Path(_dist) / "index.html")
