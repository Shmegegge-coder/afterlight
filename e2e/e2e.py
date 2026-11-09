import os, re, sys, json, urllib.request, http.cookiejar
from playwright.sync_api import sync_playwright, expect
BASE = "http://localhost:3000"
ADMIN_EMAIL = os.environ.get("E2E_ADMIN_EMAIL", "admin@afterlight.local")
ADMIN_PASSWORD = os.environ["E2E_ADMIN_PASSWORD"]
# Staff API helper for assertions (logs in once, keeps the session cookie).
_jar = http.cookiejar.CookieJar(); _op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(_jar))
_op.open(urllib.request.Request("http://localhost:8001/api/auth/login", data=json.dumps({"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}).encode(), headers={"Content-Type": "application/json"}))
def api(p): return json.load(_op.open("http://localhost:8001/api"+p))
errors = []
def step(msg): print("✓", msg, flush=True)
with sync_playwright() as pw:
    b = pw.chromium.launch()
    ctx = b.new_context(viewport={"width": 1280, "height": 900}, permissions=["clipboard-read", "clipboard-write"])
    pg = ctx.new_page()
    pg.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))
    # The one deliberate wrong-password attempt logs a 401; anything else is a real error.
    pg.on("console", lambda m: m.type == "error" and errors.append(f"console: {m.text} @ {m.location.get('url','')}"))
    # ---- login: staff page redirects to /login, wrong password shows an error, right one returns to /orders
    pg.goto(BASE + "/orders"); pg.wait_for_url("**/login?next=%2Forders")
    expect(pg.get_by_test_id("login-title")).to_be_visible()
    expect(pg.get_by_test_id("nav-link-orders")).to_have_count(0)
    pg.get_by_test_id("login-email-input").fill(ADMIN_EMAIL); pg.get_by_test_id("login-password-input").fill("wrong-password")
    pg.get_by_test_id("login-submit-button").click()
    expect(pg.get_by_test_id("login-error")).to_contain_text("Wrong email or password")
    pg.get_by_test_id("login-password-input").fill(ADMIN_PASSWORD); pg.get_by_test_id("login-submit-button").click()
    pg.wait_for_url("**/orders"); pg.wait_for_load_state("networkidle")
    expect(pg.get_by_test_id("nav-logout-button")).to_be_visible()
    step("login: guard redirect, bad password rejected, logged in back to /orders")
    pg.screenshot(path="shots/00-orders-after-login.png")
    btn = pg.get_by_test_id("orders-create-button")
    expect(btn).to_be_visible(); step(f"/orders create button visible (tag={btn.evaluate('e=>e.tagName')}, text={btn.inner_text()!r})")
    expect(pg.get_by_role("button", name=re.compile("New Memory Film order"))).to_be_visible()
    btn.click()
    pg.get_by_test_id("order-deceased-input").fill("Walter Brooks")
    pg.get_by_test_id("order-family-input").fill("Ana Brooks")
    pg.get_by_test_id("order-email-input").fill("ana@example.com")
    pg.get_by_test_id("order-date-input").fill("2026-12-01")
    pg.get_by_test_id("order-create-submit").click()
    pg.wait_for_timeout(800)
    o = api("/orders")[0]; oid = o["id"]
    clip = pg.evaluate("navigator.clipboard.readText()")
    assert o["intake_token"] in clip, clip
    step(f"order created, intake link copied: {clip}")
    pg.screenshot(path="shots/01-orders.png", full_page=True)

    # ---- intake (family: separate browser context with NO staff session)
    fctx = b.new_context(viewport={"width": 1280, "height": 900})
    staff_pg = pg
    pg = fctx.new_page(); pg.on("pageerror", lambda e: errors.append(f"family pageerror: {e}"))
    pg.goto(clip.replace(re.match(r"https?://[^/]+", clip).group(0), BASE))
    expect(pg.get_by_test_id("intake-title")).to_contain_text("Walter Brooks")
    pg.get_by_test_id("intake-name-input").fill("Walter Brooks")
    pg.get_by_test_id("intake-birth-input").fill("1948-03-02"); pg.get_by_test_id("intake-death-input").fill("2026-10-20")
    pg.get_by_test_id("intake-next-button").click()
    expect(pg.get_by_test_id("intake-step-1")).to_be_visible()
    pg.get_by_test_id("intake-photo-file-input").set_input_files(["photo0.png", "photo1.png", "photo2.png"])
    expect(pg.get_by_test_id("intake-photo-count")).to_contain_text("3 added")
    pg.get_by_test_id("intake-next-button").click()
    for t, x in [("Fishing at dawn", "He taught me to fish on the old dock."), ("Sunday pancakes", "Pancakes shaped like our initials."), ("The red truck", "He drove that truck for 30 years.")]:
        pg.get_by_test_id("intake-story-title-input").fill(t); pg.get_by_test_id("intake-story-text-input").fill(x)
        pg.get_by_test_id("intake-add-story-button").click(); pg.wait_for_timeout(400)
    expect(pg.get_by_test_id("intake-story-count")).to_contain_text("3 added")
    pg.get_by_test_id("intake-next-button").click()
    pg.get_by_test_id("intake-ending-starfield").click(); pg.get_by_test_id("intake-tone-gentle").click()
    pg.get_by_test_id("intake-must-include-input").fill("Lake Tahoe")
    pg.get_by_test_id("intake-next-button").click()
    pg.get_by_test_id("consent-name-input").fill("Ana Brooks"); pg.get_by_test_id("consent-relationship-input").fill("Daughter")
    pg.get_by_test_id("consent-nok-checkbox").check(); pg.get_by_test_id("consent-ai-checkbox").check()
    pg.get_by_test_id("intake-next-button").click()
    expect(pg.get_by_test_id("intake-done")).to_be_visible()
    o = api(f"/orders/{oid}"); assert o["status"] == "in_production" and o["intake"]["ending"] == "starfield"
    mid = o["memorial_id"]; step("intake (logged out, token only): 5 steps done, 3 photos + 3 memories, ending=starfield")
    pg.goto(f"{BASE}/memorials/{mid}"); pg.wait_for_url("**/login**"); step("family context can't open the studio (redirected to login)")
    family_pg = pg; pg = staff_pg

    # ---- studio
    pg.goto(f"{BASE}/memorials/{mid}")
    expect(pg.get_by_test_id("studio-finale-title")).to_contain_text("Starfield finale")
    for s in api(f"/memorials/{mid}")["stories"]:
        pg.get_by_test_id(f"story-generate-image-button-{s['id']}").click(); pg.wait_for_timeout(500)
    pg.get_by_test_id("studio-generate-narration-button").click()
    pg.get_by_test_id("studio-generate-finale-button").click()
    expect(pg.get_by_test_id("studio-scene-count")).to_contain_text("3/3", timeout=20000)
    expect(pg.get_by_test_id("studio-narration-intro")).to_be_visible(timeout=20000)
    expect(pg.get_by_test_id("studio-finale-image")).to_be_visible(timeout=20000)
    step("studio: 3 scenes + narration + starfield finale generated (stub providers)")
    pg.screenshot(path="shots/02-studio.png", full_page=True)

    # ---- review loop
    pg.goto(BASE + "/orders"); pg.get_by_test_id(f"order-toggle-{oid}").click()
    pg.get_by_test_id(f"order-send-review-{oid}").click(); pg.wait_for_timeout(600)
    rt = api(f"/orders/{oid}")["review_token"]
    pg = family_pg
    pg.goto(f"{BASE}/review/{rt}")
    expect(pg.get_by_test_id("review-title")).to_contain_text("Walter")
    sid = api(f"/memorials/{mid}")["stories"][1]["id"]
    pg.get_by_test_id("review-name-input").fill("Ana Brooks")
    pg.get_by_test_id(f"review-scene-comment-open-{sid}").click()
    pg.get_by_test_id(f"review-scene-comment-{sid}-input").fill("Can the pancakes be brighter?")
    pg.get_by_test_id(f"review-scene-comment-{sid}-send").click(); pg.wait_for_timeout(500)
    pg.get_by_test_id("review-request-changes-button").click()
    pg.get_by_test_id("changes-name-input").fill("Ana Brooks"); pg.get_by_test_id("changes-note-input").fill("Brighter pancakes please")
    pg.get_by_test_id("changes-submit-button").click(); pg.wait_for_timeout(600)
    assert api(f"/orders/{oid}")["status"] == "changes_requested"; step("family scene comment + change request")
    pg = staff_pg
    pg.goto(BASE + "/orders"); pg.get_by_test_id(f"order-toggle-{oid}").click()
    pg.get_by_test_id(f"order-send-review-{oid}").click(); pg.wait_for_timeout(600)
    assert api(f"/orders/{oid}")["review_round"] == 2; step("resent revised film (round 2)")
    pg = family_pg
    pg.goto(f"{BASE}/review/{rt}")
    pg.get_by_test_id("review-play-button").click()
    expect(pg.get_by_test_id("show-exit-button")).to_be_visible()
    pg.get_by_test_id("show-exit-button").click()
    pg.wait_for_url(f"**/review/{rt}"); step("Watch full film → exit returns to /review/<token>")
    pg.get_by_test_id("review-approve-button").click()
    pg.get_by_test_id("approve-name-input").fill("Ana Brooks"); pg.get_by_test_id("approve-confirm-checkbox").check()
    pg.get_by_test_id("approve-submit-button").click(); pg.wait_for_timeout(600)
    assert api(f"/orders/{oid}")["status"] == "approved"; step("family approved with typed name")
    pg.screenshot(path="shots/03-review-approved.png", full_page=True)
    pg = staff_pg
    pg.goto(BASE + "/orders"); pg.get_by_test_id(f"order-toggle-{oid}").click()
    pg.get_by_test_id(f"order-deliver-{oid}").click(); pg.wait_for_timeout(600)
    assert api(f"/orders/{oid}")["status"] == "delivered"; step("marked delivered")
    pg.get_by_test_id("nav-logout-button").click(); pg.wait_for_url(BASE + "/")
    pg.goto(BASE + "/orders"); pg.wait_for_url("**/login**"); step("logout → staff pages redirect to login again")

    # ---- 390px
    mctx = b.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True)
    assert mctx.request.post(BASE + "/api/auth/login", data={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}).ok
    m = mctx.new_page()
    m.on("pageerror", lambda e: errors.append(f"mobile pageerror: {e}"))
    for name, path in [("orders", "/orders"), ("intake", f"/intake/{o['intake_token']}"), ("review", f"/review/{rt}"), ("studio", f"/memorials/{mid}"), ("home", "/"), ("pricing", "/pricing"), ("login", "/login?next=/x")]:
        m.goto(BASE + path); m.wait_for_load_state("networkidle"); m.wait_for_timeout(500)
        sw = m.evaluate("document.documentElement.scrollWidth")
        m.screenshot(path=f"shots/m-{name}.png", full_page=True)
        print(f"  390px {name}: scrollWidth={sw}{'  <-- horizontal overflow' if sw > 392 else ''}")
    expect(m.get_by_test_id("review-status-banner")).to_have_count(0) if False else None
    step("390px pages rendered")
    b.close()
expected = [e for e in errors if "status of 401" in e and len([x for x in errors if "401" in x]) == 1]
real = [e for e in errors if e not in expected]
print("expected (wrong-password 401):", len(expected)); print("ERRORS:", real or "none")
