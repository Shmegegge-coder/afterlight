"""Pluggable AI providers for Afterlight (RECONSTRUCTED — not Emergent's original code).

Default: Google Gemini for both text and images with one GEMINI_API_KEY.
  text   gemini-3.5-flash-lite   (cheap; free tier; gemini-2.5-flash is closed to new projects)
  images gemini-nano-banana-2.1  ("Nano Banana 2.1": ~$0.034 per 1K image, keeps likeness from up
                                  to 4 reference photos; gemini-2.5-flash-image shuts down 2027-03-15)
Model ids checked against ai.google.dev docs on 2026-11-09. Override with TEXT_MODEL / IMAGE_MODEL.

The original Emergent backend used Emergent's universal LLM key (emergentintegrations):
Claude for narration + advisor text, "Nano Banana Pro" (Google Gemini image) for scenes
and the finale, and Kling for optional video clips. That key only works inside Emergent,
so this module talks to the providers directly over HTTP with your own API keys.

Env vars (all optional; with none set, generation endpoints fail with a clear message):

  Text (narration, business advisor)
    TEXT_PROVIDER   auto | gemini | anthropic | openai | xai | openrouter | stub   (default auto)
    GEMINI_API_KEY / ANTHROPIC_API_KEY / OPENAI_API_KEY / XAI_API_KEY / OPENROUTER_API_KEY
    TEXT_MODEL      override the model id (defaults per provider below)

  Images (memory scenes, finale)
    IMAGE_PROVIDER  auto | gemini | openai | xai | stub   (default auto)
    GEMINI_API_KEY (or GOOGLE_API_KEY) / OPENAI_API_KEY / XAI_API_KEY
    IMAGE_MODEL     override the model id

  Video (optional animated clips)
    VIDEO_PROVIDER  auto | fal | stub   (default auto)
    FAL_KEY
    VIDEO_MODEL     fal model path (default fal-ai/kling-video/v2.1/standard/image-to-video)

"auto" picks the first provider whose key is present. "stub" returns placeholder output so
you can click through the whole flow for free.
"""
from __future__ import annotations

import asyncio
import base64
import json
import os
import struct
import zlib
from typing import AsyncIterator, Optional

import httpx


class ProviderError(RuntimeError):
    pass


def _env(name: str) -> str:
    return os.environ.get(name, "").strip()


# ---------------------------------------------------------------- text

GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta"
TEXT_DEFAULTS = {
    "gemini": "gemini-3.5-flash-lite",
    "anthropic": "claude-sonnet-4-5",
    "openai": "gpt-4.1-mini",
    "xai": "grok-4-fast",
    "openrouter": "anthropic/claude-sonnet-4.5",
}
OPENAI_COMPAT = {
    "openai": ("https://api.openai.com/v1", "OPENAI_API_KEY"),
    "xai": ("https://api.x.ai/v1", "XAI_API_KEY"),
    "openrouter": ("https://openrouter.ai/api/v1", "OPENROUTER_API_KEY"),
}


def _gemini_key() -> str:
    return _env("GEMINI_API_KEY") or _env("GOOGLE_API_KEY")


def text_provider() -> str:
    p = _env("TEXT_PROVIDER").lower() or "auto"
    if p != "auto":
        return p
    if _gemini_key():
        return "gemini"
    for name, key in (("anthropic", "ANTHROPIC_API_KEY"), ("openai", "OPENAI_API_KEY"), ("xai", "XAI_API_KEY"), ("openrouter", "OPENROUTER_API_KEY")):
        if _env(key):
            return name
    return "none"


def _no_text() -> ProviderError:
    return ProviderError("No text AI provider configured. Set GEMINI_API_KEY (or ANTHROPIC_API_KEY, OPENAI_API_KEY, XAI_API_KEY or OPENROUTER_API_KEY), or TEXT_PROVIDER=stub, on the backend.")


async def stream_text(system: str, user: str, max_tokens: int = 4000, json_mode: bool = False) -> AsyncIterator[str]:
    """Yield text deltas."""
    p = text_provider()
    model = _env("TEXT_MODEL") or TEXT_DEFAULTS.get(p, "")
    if p == "none":
        raise _no_text()
    if p == "stub":
        demo = f"## Draft (stub provider)\n\nNo AI key is configured, so this is placeholder text.\n\n**Request:**\n\n{user[:1500]}\n"
        for i in range(0, len(demo), 40):
            yield demo[i:i + 40]
            await asyncio.sleep(0.01)
        return
    async with httpx.AsyncClient(timeout=httpx.Timeout(180, connect=20)) as c:
        if p == "gemini":
            key = _gemini_key()
            if not key:
                raise _no_text()
            body = {"systemInstruction": {"parts": [{"text": system}]},
                    "contents": [{"role": "user", "parts": [{"text": user}]}],
                    "generationConfig": {"maxOutputTokens": max_tokens, **({"responseMimeType": "application/json"} if json_mode else {})}}
            async with c.stream("POST", f"{GEMINI_BASE}/models/{model}:streamGenerateContent", params={"alt": "sse"},
                                json=body, headers={"x-goog-api-key": key}) as r:
                if r.status_code >= 400:
                    raise ProviderError(f"Gemini error {r.status_code}: {(await r.aread())[:300].decode(errors='replace')}")
                async for line in r.aiter_lines():
                    if not line.startswith("data:"):
                        continue
                    ev = json.loads(line[5:].strip() or "{}")
                    for cand in ev.get("candidates", []):
                        for part in (cand.get("content") or {}).get("parts", []):
                            if part.get("text") and not part.get("thought"):
                                yield part["text"]
            return
        if p == "anthropic":
            key = _env("ANTHROPIC_API_KEY")
            if not key:
                raise _no_text()
            body = {"model": model, "max_tokens": max_tokens, "system": system, "stream": True,
                    "messages": [{"role": "user", "content": user}]}
            headers = {"x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json"}
            async with c.stream("POST", "https://api.anthropic.com/v1/messages", json=body, headers=headers) as r:
                if r.status_code >= 400:
                    raise ProviderError(f"Anthropic error {r.status_code}: {(await r.aread())[:300].decode(errors='replace')}")
                async for line in r.aiter_lines():
                    if not line.startswith("data:"):
                        continue
                    ev = json.loads(line[5:].strip() or "{}")
                    if ev.get("type") == "content_block_delta" and ev.get("delta", {}).get("type") == "text_delta":
                        yield ev["delta"]["text"]
            return
        if p in OPENAI_COMPAT:
            base, keyname = OPENAI_COMPAT[p]
            base = _env("TEXT_BASE_URL") or base
            key = _env(keyname)
            if not key:
                raise _no_text()
            body = {"model": model, "stream": True, "max_tokens": max_tokens,
                    "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}]}
            async with c.stream("POST", f"{base}/chat/completions", json=body, headers={"Authorization": f"Bearer {key}"}) as r:
                if r.status_code >= 400:
                    raise ProviderError(f"{p} error {r.status_code}: {(await r.aread())[:300].decode(errors='replace')}")
                async for line in r.aiter_lines():
                    if not line.startswith("data:"):
                        continue
                    data = line[5:].strip()
                    if data == "[DONE]":
                        break
                    ev = json.loads(data)
                    for ch in ev.get("choices", []):
                        t = (ch.get("delta") or {}).get("content")
                        if t:
                            yield t
            return
    raise ProviderError(f"Unknown TEXT_PROVIDER '{p}'")


async def complete_text(system: str, user: str, max_tokens: int = 2000, json_mode: bool = False) -> str:
    out = []
    async for t in stream_text(system, user, max_tokens, json_mode):
        out.append(t)
    return "".join(out)


async def complete_json(system: str, user: str, max_tokens: int = 2000) -> dict:
    if text_provider() == "stub":
        raise ProviderError("stub")  # caller supplies its own stub JSON
    raw = await complete_text(system + "\nRespond with a single JSON object only, no prose, no code fences.", user, max_tokens, json_mode=True)
    s = raw.strip()
    if s.startswith("```"):
        s = s.strip("`")
        s = s[s.find("{"):]
    start, end = s.find("{"), s.rfind("}")
    if start < 0 or end < 0:
        raise ProviderError("The text model did not return JSON.")
    return json.loads(s[start:end + 1])


# ---------------------------------------------------------------- images

IMAGE_DEFAULTS = {"gemini": "gemini-nano-banana-2.1", "openai": "gpt-image-1", "xai": "grok-2-image"}


def image_provider() -> str:
    p = _env("IMAGE_PROVIDER").lower() or "auto"
    if p != "auto":
        return p
    if _gemini_key():
        return "gemini"
    if _env("OPENAI_API_KEY"):
        return "openai"
    if _env("XAI_API_KEY"):
        return "xai"
    return "none"


def placeholder_png(w: int = 64, h: int = 36, rgb=(40, 70, 120)) -> bytes:
    """Tiny gradient PNG (no Pillow needed)."""
    rows = b""
    for y in range(h):
        rows += b"\x00" + bytes(
            c for x in range(w) for c in (min(255, rgb[0] + y * 2), min(255, rgb[1] + x), min(255, rgb[2] + y * 3)))
    def chunk(t, d):
        return struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xFFFFFFFF)
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0)) + chunk(b"IDAT", zlib.compress(rows)) + chunk(b"IEND", b"")


async def generate_image(prompt: str, refs: list[tuple[bytes, str]] | None = None) -> tuple[bytes, str]:
    """Return (bytes, mime). refs = [(bytes, mime)] reference photos for likeness."""
    refs = refs or []
    p = image_provider()
    model = _env("IMAGE_MODEL") or IMAGE_DEFAULTS.get(p, "")
    if p == "none":
        raise ProviderError("No image AI provider configured. Set GEMINI_API_KEY (or OPENAI_API_KEY or XAI_API_KEY), or IMAGE_PROVIDER=stub, on the backend.")
    if p == "stub":
        if refs:
            return refs[0]
        return placeholder_png(), "image/png"
    async with httpx.AsyncClient(timeout=httpx.Timeout(240, connect=20)) as c:
        if p == "gemini":
            key = _gemini_key()
            parts: list[dict] = [{"text": prompt}]
            for b, mime in refs[:4]:  # Nano Banana 2.1 keeps likeness for up to 4 character refs
                parts.append({"inline_data": {"mime_type": mime, "data": base64.b64encode(b).decode()}})
            body = {"contents": [{"role": "user", "parts": parts}],
                    "generationConfig": {"responseModalities": ["IMAGE"], "imageConfig": {"aspectRatio": "16:9", "imageSize": _env("IMAGE_SIZE") or "1K"}}}
            r = await c.post(f"{GEMINI_BASE}/models/{model}:generateContent", headers={"x-goog-api-key": key}, json=body)
            if r.status_code == 429 and "free_tier" in r.text and "limit: 0" in r.text:
                raise ProviderError(f"Gemini image models ({model}) have no free tier. Enable billing on the Google AI Studio project for this GEMINI_API_KEY, or set IMAGE_PROVIDER=stub.")
            if r.status_code >= 400:
                raise ProviderError(f"Gemini error {r.status_code}: {r.text[:300]}")
            final = None  # skip interim "thought" images; keep the last real one
            for cand in r.json().get("candidates", []):
                for part in (cand.get("content") or {}).get("parts", []):
                    d = part.get("inline_data") or part.get("inlineData")
                    if d and d.get("data") and not part.get("thought"):
                        final = (base64.b64decode(d["data"]), d.get("mime_type") or d.get("mimeType") or "image/png")
            if final:
                return final
            raise ProviderError("Gemini returned no image (it may have been blocked by a safety filter).")
        if p == "openai":
            key = _env("OPENAI_API_KEY")
            hdr = {"Authorization": f"Bearer {key}"}
            if refs:
                files = [("image[]", (f"ref{i}.png", b, mime)) for i, (b, mime) in enumerate(refs[:4])]
                r = await c.post("https://api.openai.com/v1/images/edits", headers=hdr, files=files,
                                 data={"model": model, "prompt": prompt, "size": "1536x1024"})
            else:
                r = await c.post("https://api.openai.com/v1/images/generations", headers=hdr,
                                 json={"model": model, "prompt": prompt, "size": "1536x1024"})
            if r.status_code >= 400:
                raise ProviderError(f"OpenAI image error {r.status_code}: {r.text[:300]}")
            d = r.json()["data"][0]
            if d.get("b64_json"):
                return base64.b64decode(d["b64_json"]), "image/png"
            img = await c.get(d["url"])
            return img.content, img.headers.get("content-type", "image/png")
        if p == "xai":
            key = _env("XAI_API_KEY")
            # xAI image generation is text-only (no reference photos).
            r = await c.post("https://api.x.ai/v1/images/generations", headers={"Authorization": f"Bearer {key}"},
                             json={"model": model, "prompt": prompt[:1000], "response_format": "b64_json"})
            if r.status_code >= 400:
                raise ProviderError(f"xAI image error {r.status_code}: {r.text[:300]}")
            return base64.b64decode(r.json()["data"][0]["b64_json"]), "image/jpeg"
    raise ProviderError(f"Unknown IMAGE_PROVIDER '{p}'")


# ---------------------------------------------------------------- video

def video_provider() -> str:
    p = _env("VIDEO_PROVIDER").lower() or "auto"
    if p != "auto":
        return p
    return "fal" if _env("FAL_KEY") else "none"


async def generate_video(prompt: str, image: tuple[bytes, str]) -> tuple[bytes, str]:
    p = video_provider()
    if p == "none":
        raise ProviderError("No video provider configured. Set FAL_KEY (Kling via fal.ai) on the backend. Clips are optional; the show works with still scenes.")
    if p == "stub":
        raise ProviderError("Video stub: no clip generated (set FAL_KEY for real clips).")
    if p != "fal":
        raise ProviderError(f"Unknown VIDEO_PROVIDER '{p}'")
    model = _env("VIDEO_MODEL") or "fal-ai/kling-video/v2.1/standard/image-to-video"
    hdr = {"Authorization": f"Key {_env('FAL_KEY')}"}
    data_uri = f"data:{image[1]};base64,{base64.b64encode(image[0]).decode()}"
    async with httpx.AsyncClient(timeout=httpx.Timeout(120, connect=20)) as c:
        r = await c.post(f"https://queue.fal.run/{model}", headers=hdr,
                         json={"prompt": prompt, "image_url": data_uri, "duration": "5"})
        if r.status_code >= 400:
            raise ProviderError(f"fal error {r.status_code}: {r.text[:300]}")
        job = r.json()
        status_url, response_url = job["status_url"], job["response_url"]
        for _ in range(120):  # up to ~10 min
            await asyncio.sleep(5)
            s = (await c.get(status_url, headers=hdr)).json()
            if s.get("status") == "COMPLETED":
                break
            if s.get("status") in ("FAILED", "ERROR"):
                raise ProviderError(f"Video generation failed: {s}")
        else:
            raise ProviderError("Video generation timed out.")
        res = (await c.get(response_url, headers=hdr)).json()
        url = (res.get("video") or {}).get("url")
        if not url:
            raise ProviderError("fal returned no video URL.")
        v = await c.get(url, timeout=300)
        return v.content, v.headers.get("content-type", "video/mp4")


def status() -> dict:
    return {"text": text_provider(), "image": image_provider(), "video": video_provider()}
