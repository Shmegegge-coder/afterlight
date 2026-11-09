# Afterlight Holo

A website for a holographic memorial service. It has marketing pages, a business plan, an AI advisor, a memorial studio, and the Memory Film order flow (an order desk, plus intake and review pages for families).
Stack: React 19 + Vite 8 + TypeScript (`frontend/`), FastAPI + MongoDB (`backend/`). It needs nothing from Emergent.

## Where the code came from
| Part | Source |
|---|---|
| `frontend/src/**` (the live pages, components, ui, lib) | **Original.** Copied byte for byte from the Emergent preview's Vite dev server. The untouched copy is in `original-live-snapshot/src`. |
| `package.json`, `tsconfig*.json`, `components.json`, favicons | **Original.** The Emergent-only dev packages were removed, and `yarn.lock` was regenerated without them. |
| `vite.config.ts`, `index.html` | Simplified: the Emergent preview plugins and scripts were removed. |
| Memory Film pages, `backend/orders.py` | The Memory Film handoff (an earlier package of new pages and backend code). |
| `backend/server.py`, `providers.py`, `auth.py` | **Rebuilt.** Emergent doesn't expose its backend source. The routes and response shapes match the live API. |

## Who can access what
| Who | How | Access |
|---|---|---|
| Public | none | Home, Technology, Budget, Pricing, Pitch, `/login`, the sample memorial's show |
| Staff | `/login`. One admin account set in env vars. The session is a signed JWT in an httpOnly, Secure, SameSite=Lax cookie that lasts 7 days. | The Orders desk, Memorials and the studio, the AI Advisor, every generation endpoint, and all staff `/api/orders/*` routes |
| Family | The token in their link, sent as `X-Afterlight-Token`. No login. | `/intake/:token` can create and edit **their own** memorial until intake is submitted. `/review/:token` is read-only and allows comments and approval. Watching the film from the review page works. |

Login is rate-limited to 5 failed attempts per IP per 15 minutes (it returns 429 after that). Uploaded and generated images at `/api/files/<random>.ext` are public to anyone who has the URL, the same as before.

## Run locally
```bash
# MongoDB: a local mongod (or Docker: docker run -p 27017:27017 mongo:8)
cd backend
python3 -m venv .venv && .venv/bin/pip install -r requirements-dev.txt
cp .env.example .env && .venv/bin/python hash_password.py     # paste ADMIN_PASSWORD_HASH and JWT_SECRET into .env
.venv/bin/uvicorn server:app --port 8001 --reload
# (no Mongo? .venv/bin/python dev_mock_db.py uses an in-memory DB)

cd ../frontend
npx yarn@1 install --frozen-lockfile
npx vite                                                         # http://localhost:3000 (proxies /api to :8001)
```

## Tests
```bash
cd backend
.venv/bin/python test_orders.py      # order flow (mongomock); add TEST_MONGO_URL=mongodb://127.0.0.1:27017 for real Mongo
.venv/bin/python test_auth.py        # login, cookie flags, forged JWT, family token scopes, rate limit
# Browser end to end: start the backend with TEXT_PROVIDER=stub IMAGE_PROVIDER=stub and the frontend, then
E2E_ADMIN_PASSWORD=... .venv/bin/python ../e2e/e2e.py   # needs: pip install playwright && playwright install chromium
```

## AI providers
One `GEMINI_API_KEY` covers both text and images. Model ids were checked against ai.google.dev on 2026-11-09.
- **Text** (narration, advisor): `gemini-3.5-flash-lite`. It's cheap and has a free tier. `gemini-2.5-flash` is closed to new projects.
- **Images** (scenes, finale): `gemini-nano-banana-2.1`, about $0.034 per 1K image, and it uses up to 4 reference photos to keep the person's likeness. **Gemini image models have no free tier, so the key's Google project needs billing turned on.**
- **Video**: off. Set `FAL_KEY` to turn on Kling clips through fal.ai.
- You can override the models with `TEXT_MODEL` / `IMAGE_MODEL`. Other supported providers: `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `XAI_API_KEY`, `OPENROUTER_API_KEY`. `*_PROVIDER=stub` gives free placeholder output.
- `GET /api/ai/status` (staff only) shows which provider each step will use.

## Deploy on free tiers (same-origin, so the login cookie is first-party)
Browser → **Vercel** (frontend; `/api/*` is rewritten to Render) → **Render** (FastAPI) → **MongoDB Atlas M0**.

1. **Atlas.** Create a free M0 cluster and a database user. Under Network Access, allow `0.0.0.0/0`, because Render free has no fixed IPs. Copy the `mongodb+srv://…` URL.
2. **Render.** Choose New → Blueprint, pick this repo, and it reads `render.yaml`. Fill in the env vars that have no value yet. Note the service URL (normally `https://afterlight-api.onrender.com`).
3. **Vercel.** Import the repo with **Root Directory = `frontend`**. If your Render URL is different, edit the destination in `frontend/vercel.json`. No env vars are needed.
4. Open the Vercel URL, go to `/login`, and sign in.

### Env vars
| Service | Var | Value |
|---|---|---|
| Render | `MONGO_URL` | Atlas `mongodb+srv://user:pass@cluster.../?retryWrites=true&w=majority` |
| Render | `DB_NAME` | `afterlight` |
| Render | `ADMIN_EMAIL` | the staff login email |
| Render | `ADMIN_PASSWORD_HASH` | the output of `python backend/hash_password.py` |
| Render | `JWT_SECRET` | generated automatically by the Blueprint, or 48 random chars. If you change it, everyone is logged out. |
| Render | `GEMINI_API_KEY` | Google AI Studio key (billing must be on for images) |
| Render | `COOKIE_SECURE` | `true` |
| Render (optional) | `FAL_KEY`, `TEXT_MODEL`, `IMAGE_MODEL`, `SESSION_DAYS`, `LOGIN_MAX_FAILS`, `MAX_UPLOAD_MB` | |
| Vercel | none | Only the rewrite destination in `vercel.json` |
| Atlas | none | Just the user and the network allow-list |

Free-tier limits to know about:
- Render free sleeps after about 15 minutes idle, and the first request then takes 30–60 s. Vercel waits up to 120 s for a response.
- The login rate limit and background generation jobs live in memory on the single Render instance. A restart clears the limiter and marks any in-flight job "interrupted, try again".
- Photos and generated images are stored in Mongo, and Atlas M0 holds 512 MB. That's roughly 300–500 scenes; move files to object storage (S3, R2, etc.) before you outgrow it.
- Anyone can still call the Render URL directly, bypassing Vercel. Auth still applies there.
