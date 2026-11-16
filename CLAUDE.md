# MarketingTool — Web App (Customer Portal)

> Every fact here was verified live on **2026-09-11** by SSH into both VPS, live HTTP
> probes, direct Postgres/MariaDB queries, and live calls to the AI Router. Where reality
> differs from the design docs, reality wins and the gap is called out. Do not "correct"
> this file back to the aspirational version.
>
> The design intent lives in the owner's architecture spec. This file records what is
> **actually running**. When the two disagree, that disagreement is the point of this file.

## THE CUSTOMER JOURNEY (owner, 2026-11-16). THIS IS FINAL.

```
1. marketingtool.pro            customer clicks "Get Started"  →  app.marketingtool.pro/login
                                ("Join Now" → /register)
2. Login                        Google or Facebook, through Appwrite OAuth (createOAuth2Session).
                                Login app = Meta app 1830149205008066. No Instagram login.
3. Hard Connect-Ads pop-up      shown on EVERY page, EVERY visit, until the customer has a
                                connected ad account. No close button, no Escape — only
                                "Connect Facebook & Instagram Ads", "Connect Google Ads", or Logout.
                                Ads app = Meta app 2246709019441842.
4. Connected                    the pop-up disappears only after the SERVER confirms the account
                                was saved (ad_accounts rows, or google-ads-connect success:true).
                                Then the full app opens; every page follows the final flow below.
```

Where it lives: `src/layouts/AdminLayout/index.jsx` (decides when), `src/components/ConnectAdsModal.jsx`
(the pop-up), `src/utils/adsConnection.js` (`hasAnyAdsConnection`, `hasServerAdsConnection`,
`connectGoogleAds`). Admin accounts skip the pop-up.

Checked 2026-11-16: homepage "Get Started" → `/login` and "Join Now" → `/register` (live HTML);
login uses Appwrite Google + Facebook (source). Fixed: all three Google connect paths (pop-up,
`/oauth/google-ads` callback, Settings) marked Google "connected" BEFORE the server answered and
ignored failures, so a failed connect closed the hard pop-up with nothing connected. Now only a
server-confirmed `success: true` counts. The pop-up also claimed "Read-only access — we never
modify your ads" while requesting `ads_management`; corrected.

Still open on this journey:
- **Meta App Review never submitted** — the pop-up asks Facebook for ads permissions the app does
  not hold, so real customers' Facebook connect is refused until review passes (see META APP REVIEW).
- **Pricing "Get Started" buttons on marketingtool.pro go to `buy.stripe.com` links** — external
  payment links, against the "direct integration only" rule. That page is the Django site on VPS 1,
  not this repo.
- The pop-up shows a hard-coded "4.8 Rating" with five stars that is not backed by any data.
- Production still serves the 12 Sep build; these fixes go live only after a rebuild + deploy,
  which needs `.env` restored (see deploy section).

## REAL AD DATA — WHY IT STOPPED, AND WHAT RUNS NOW (checked live 2026-11-16)

Supabase (VPS 2, all 13 containers healthy) — newest row per table: `campaign_metrics` and
`daily_summary` **2026-03-19**; `ad_accounts`, `campaigns`, `workflow_runs` **2026-04-08**;
`generations`, `credit_usage`, `webhook_logs` today. AI tool runs are saved; ad data is not.

Why: the 10-minute sync `f/tools/cron-sync-platforms` (1) used one shared admin token from the
old Meta app `1582682256320433`, which Meta now rejects ("user has not authorized application");
(2) wrote columns that do not exist in `campaign_metrics`, `daily_summary` and `sync_logs`;
(3) swallowed every error and returned `success: true` with 0 accounts. The 282 existing
`campaign_metrics` rows have `ad_account_id` NULL — they belong to no customer.

Now: `f/tools/cron-sync-meta` (source `windmill/f/tools/cron-sync-platforms.py`), schedule
`f/tools/cron-sync-meta-schedule`, every 10 min. It uses each customer's own token from
`ad_accounts`, upserts `campaign_metrics` on (`ad_account_id`, `campaign_id`, `date`) and writes
every account's result — including errors — to `sync_logs`. Old schedule
`f/tools/cron-sync-schedule` is paused (not deleted) for rollback.

The connected accounts themselves are dead, checked one by one:

| platform | rows | working | why not |
|---|---|---|---|
| Meta | 89 (5 customers; 60 = testuser) | **0** | 76 issued to the old app `1582682256320433`; 13 logged out / invalidated; 18 have a malformed `account_id` (not `act_…`) |
| Google | 25 (5 customers) | **0** | `f/tools/google_client_secret` is rejected by Google ("invalid_client") for client `911925145433-lnqjvdu44j…` — this also breaks **Connect Google Ads** in the hard pop-up for every new customer |

Google Ads developer token: stored 2026-11-16 as Windmill secret
`f/tools/google_ads_developer_token` (Basic access — 15,000 operations/day, production; the value
lives only in Windmill). `f/tools/fb_ads_app_id` / `fb_ads_app_secret` still describe the old app
`1582682256320433`; the ads app is `2246709019441842` (owner confirmed both apps 2026-11-16).

To get real ad data flowing: (1) put the correct client secret for `911925145433-lnqjvdu44j…`
into `f/tools/google_client_secret`; (2) pass Meta App Review for app `2246709019441842`;
(3) customers reconnect once through the hard pop-up. The sync then fills `campaign_metrics`.

AI media quality, checked by eye 2026-11-16: `image_gen` (GPT Image 2) and `stable_image`
(SD 3.5) both return 1024×1024 photoreal, ad-ready PNGs; GPT Image 2 follows the prompt more
closely (theme, empty space for headline). `video_gen` (FAL Kling) returns a sharp 5 s
1920×1080 H.264 MP4; on-screen text inside the video is garbled, as with all AI video — fine for
b-roll, not for text-critical shots.

## HOW THE WEB APP WORKS — FINAL FLOW (owner, 2026-11-16). THIS IS FINAL.

Every page is built from the same unit. No page is built any other way.

```
~10 tools  =  10 python worker scripts (1 per tool)  =  1 engine  =  1 AI Router

browser page (React, 1920 desktop, dark)
   │  JS input  +  Appwrite JWT  (src/utils/api/windmill/index.js → Bearer <jwt>)
   ▼
VPS 2 nginx proxy (adds the Windmill token server-side, allows only /jobs/run_wait_result/)
   ▼
page's own Windmill ENGINE          f/tools/engine-<page>     validates JWT, scopes user_id
   ▼  fans out to its WORKERS        f/tools/worker-<tool>     one python script per tool
WORKERS call the REAL vendor APIs with the customer's own connected token:
   Meta Marketing API · Google Ads / Analytics · Shopify Admin · AWS · every other tool's API
CRON JOBS keep the source data fresh (Windmill schedules, see below)
   ▼  worker HANDS OVER the real data
AI ROUTER  (VPS 1 :9000, from containers http://172.17.0.1:9000/generate)
   10 tasks, each answered by ITS OWN model, always active, never silently swapped
   returns rich output: text, tables, chart data, images (PNG), video (MP4)
   ▼
ENGINE returns JSON  →  JS output  →  page renders the RICH RESULT at 1920
                                      + DOWNLOAD on every page: PDF · CSV · PNG · MP4 · TXT
```

Rules that follow from it:

- **Ads are API-based both ways, on the real platform (owner, 2026-11-16).** Meta, Google and every
  other ad/social platform: workers READ the customer's real data through the platform API, and
  PUBLISH back to the real platform through the same API — create, edit, pause, resume, launch
  campaigns, ads and posts on the customer's own connected account. Never a simulated or
  "draft only" publish presented as live. The worker returns the platform's real object id (and
  link) so the page can show what was published.
- **All API-based, real results only.** A worker never returns sample, placeholder or invented
  data. No connected account → show zeros / the connect prompt, never fake numbers. The single
  exception stays `/ad-library` (intentional demo page, see Critical rules).
- **The router analyses, it does not invent.** Real data goes in; the router turns it into rich
  results. If a task's own model fails, the response says so — it is never answered by another
  model under the same label.
- **MCP connectors** (Meta, Google, AWS, Shopify, Appwrite, Windmill, Supabase …) are what we use
  to build, test and verify each worker against the live service. At runtime the worker calls the
  vendor API directly.
- **GCloud Agent Worker** = the same role as a Windmill worker (one per page). It is never placed
  inside or in front of the AI Router. (Not deployed yet — see "Request path".)
- **Web stays in `f/tools/*`, phone stays in `f/mobile/*`.** Same workspace `marketingtool-pro`.
- **One page at a time**, in the order the owner names. A page is done when: its engine checks
  the JWT and scopes by user, every tool has a worker, a live run returns real data through the
  router, the result renders rich at 1920, and every download button produces a real file.

What already exists in Windmill (2026-11-16): ~60 `f/tools/engine-*` scripts (chat creative /
automation / insight, analytics, meta-audit, ad-library, campaign meta/google, command-centre
meta/google, reports, platform overview …) and ~90 `f/tools/worker-*` scripts (36 chat tool
workers, campaign meta/google CRUD, command-centre actions, audience/bid/creative workers).
The chat page already follows the unit exactly: 36 tools = 3 engines × 12
(`src/views/admin/chat/ToolInlineForm.jsx` `SLUG_TO_ENGINE`).

Cron jobs (Windmill schedules, all enabled):

| schedule | runs | script |
|---|---|---|
| `f/tools/cron-sync-schedule` | every 10 min (Asia/Kolkata) | `f/tools/cron-sync-platforms` |
| `f/schedules/campaign-scheduler` | hourly (UTC) | `f/tools/campaign-scheduler` |
| `f/schedules/daily-sync` | 00:00 UTC | `f/tools/cron-daily-sync` |
| `u/admin/health_monitor` | every 5 min | `u/admin/health_check` |

## THIS IS A CUSTOMER PORTAL, NOT ADMIN

- Web App = desktop only (1920px), dark theme. React + Vite + MUI 9 (paid SaasAble template).
- Phone App = separate repo, separate stack (Appwrite + Firebase). Not this project.
  `/Users/loken/ai-marketingtool-llc/AiMarketingtool-pro-fbaf2fad`
- Everything here is being moved to **real API** work. No mock data anywhere.

## Real infrastructure (verified 2026-09-11)

| | VPS 1 | VPS 2 |
|---|---|---|
| IP | `31.220.107.19` | `62.72.58.221` |
| Hostinger | `srv1073584`, KVM 8 — 8 vCPU / 32 GB / 400 GB | `srv1350977`, KVM 2 — 2 vCPU / 8 GB / 100 GB |
| Disk | 88G / 387G used (23%) | 42G / 96G used (44%) |
| Containers | 33 total: Appwrite (25), Windmill (5), NPM, openruntimes-executor, root-server-admin | 15 total: Supabase (13) + 2 unrelated |
| Also runs | AI Router under PM2, MariaDB (shared with a NocoDB install) | web app dist, nginx 1.24 |
| DNS | `marketingtool.pro`, `auth.`, `wm.`, `api.`, `media.` | `app.marketingtool.pro` |

`media.marketingtool.pro` resolves to VPS 1 but **has no proxy host defined**, so it fails
the TLS handshake with `unrecognized name`. Only three proxy hosts exist: apex+www,
api+auth, and wm.

VPS 1 `nginx.service` is **failed but enabled** — nginx-proxy-manager owns 80/443/81, so
everything in `/etc/nginx/sites-enabled/` there is inert. The apex is **not a static
docroot**: `/var/www/aiwave/` is a Django app on SQLite.

## AI Router — 10 tasks, each its own model (verified live 2026-11-16)

The router is up (PM2 `ai-router`, uvicorn on `:9000`, code `/root/app.py`, started by
`/root/start-ai-router.sh`) and **correctly firewalled** — iptables accepts 9000 only from
localhost and Docker nets. From a Windmill container use `http://172.17.0.1:9000`.

Every task routes to its own model first. A fallback, where one exists, is printed as
`[AI-ROUTER] provider FAILED ...` and the response `model` field names the model that really
answered. Unknown task → 400 with the valid list. `vision_analysis`/`ocr` without an image → 400.

All ten tasks were called one by one on 2026-11-16 and the real response read:

| # | task | its own model | answered today | state |
|---|---|---|---|---|
| 1 | creative | Claude Sonnet 4.5 (`claude-sonnet-4-5`) | Claude Sonnet 4.5 | **WORKS** |
| 2 | coding | Claude Sonnet 4.5 | Claude Sonnet 4.5 | **WORKS** |
| 3 | default | Claude Sonnet 4.5 | Claude Sonnet 4.5 | **WORKS** |
| 4 | research | Gemini 2.5 Flash | Gemini 2.5 Flash | **WORKS** |
| 5 | automation | GPT-OSS-120B on Groq | GPT-OSS-120B (Groq), real answers | **WORKS** |
| 6 | image_gen | GPT Image 2 (OpenAI), Stability fallback | GPT Image 2, real PNG | **WORKS** |
| 7 | stable_image | Stable Diffusion 3.5 Large | SD 3.5, real PNG | **WORKS** |
| 8 | video_gen | FAL.ai Kling (text/image-to-video) | FAL.ai Kling — real 5 s 1920×1080 H.264 MP4 | **WORKS** |
| 9 | vision_analysis | GPT-4o Vision (OpenAI direct) | GPT-4o Vision | **WORKS** |
| 10 | ocr | GPT-4o OCR (OpenAI direct — owner decision, no OpenRouter cost) | GPT-4o OCR, read test text exactly | **WORKS** |

The 10 tasks use 7 providers (Claude serves creative, coding and default; OpenAI serves image_gen,
vision_analysis and ocr). OpenRouter is no longer on any route. The task
table is frozen — do not reroute a task to another provider to make it "work".

**Groq (resolved 2026-11-16).** New key in `/root/.ai-api-env` and Windmill `f/tools/groq_api_key`.
Groq org setting "Allowed Models" must include `openai/gpt-oss-120b` — it does now. Note: the org
allowlist also names `llama-3.3-70b-versatile` and `qwen/qwen3-32b`, but Groq does not offer those
on this account ("does not exist"), so do not switch automation to them. `gpt-oss-120b` is an
open-weight model run on Groq's hardware; it is billed by Groq, not the OpenAI account.

**OCR decision (owner, 2026-11-16):** OCR uses GPT-4o on the OpenAI key already paid for, not Qwen
through OpenRouter. The ~290 engines/workers that call `ocr` and `vision_analysis` send text only,
no image, so the router rejects them with "image required" and they add nothing to the result.
Fix per page: send a real image (ad creative, screenshot, upload) or skip the call.

**Timeout:** `video_gen` takes minutes. Any engine that calls it needs its own long timeout
(≥ 300 s); the default 30 s in `call_ai_router` will always fail.

**Image URLs must be publicly fetchable** by the provider for `vision_analysis`/`ocr`.
`https://app.marketingtool.pro/...` works; some hosts (e.g. Wikipedia) are refused.

Changed 2026-11-16 on VPS 1 (backups `/root/app.py.bak-ocr-labels-20261116-160641`,
`/root/app.py.bak-ocr-openai-*`, `/root/.ai-api-env.bak-groq-*`): `ocr` is GPT-4o via OpenAI
direct, the new Groq key is installed, and every label now names the real model — `/` used to claim DALL-E 3, SD 3 and "Claude Sonnet 4", and Groq answers were labelled
"Llama-3.3-70B" while `gpt-oss-120b` ran.

Re-check any time:

```
for t in creative coding default research automation image_gen stable_image; do
  curl -s -X POST http://127.0.0.1:9000/generate -H 'Content-Type: application/json' \
    -d "{\"task\":\"$t\",\"prompt\":\"Reply OK\"}" | head -c 120; echo; done
pm2 logs ai-router --nostream | grep "provider FAILED" | tail
```

### Provider failures are now LOGGED (patched 2026-09-11)

`_first_ok()` used to catch every provider exception into a string and only surface it if
*all* candidates failed. Since OpenRouter always succeeded, primary-provider failures were
completely invisible. It now prints each failure before falling through:

```
[AI-ROUTER] provider FAILED name=claude (primary) err=...
```

Check with `pm2 logs ai-router --nostream | grep AI-ROUTER`. Backup of the previous file is
at `/root/app.py.bak-*`. This is how the Anthropic message was confirmed verbatim:
*"Your credit balance is too low to access the Anthropic API."*

### WHERE THE KEYS ACTUALLY LIVE — FOUR STORES, NOT ONE

Checked 2026-09-11. Provider keys are scattered across four places, and the AI Router reads
only one of them.

**1. Windmill variables — the richest store.** It already holds keys for the exact providers
that are failing in the router:

| Windmill path | provider |
|---|---|
| `f/tools/groq_api_key` | **Groq** — the router's Groq key is invalid |
| `u/admin/gemini_api_key` | **Gemini** — the router's Gemini key is invalid |
| `f/tools/anthropic_api_key` | Anthropic |
| `u/admin/dauntless_anthropic` | Anthropic |
| `u/admin/groundbreaking_anthropic` | Anthropic |
| `f/mobile/believable_anthropic` | Anthropic |
| `u/admin/first_in_class_openai` | OpenAI |
| `u/admin/redeeming_openai` | OpenAI |
| `f/tools/openrouter_api_key` | OpenRouter |

**Four separate Anthropic keys and two OpenAI keys exist.** The router holds one of each.
If any of the others sits on a funded account, that is the fix — no purchase needed.

**2. The AI Router's own env files on VPS 1.** The only store the router reads. Its Groq and
Gemini keys are rejected; its Anthropic and OpenAI keys are valid but out of credit.

**3. GCloud Secret Manager.** Contains only `anthropic-api-key` (a single version from
2026-04-25) and `GOOGLE_GENAI_API_KEY`. Two problems make it useless today:

- **No gcloud account is authenticated on VPS 1** (`gcloud auth list` returns nothing), so
  `get_secret()`'s Secret Manager fallback always fails.
- **Name mismatch:** `app.py` looks up `gemini-api-key`, but the secret is called
  `GOOGLE_GENAI_API_KEY`. It would never be found even with working auth.

There are no `groq-api-key`, `openai-api-key`, `stability-api-key`, `fal-api-key` or
`openrouter-api-key` secrets at all.

**4. Appwrite project variables.** Holds `ANTHROPIC_API_KEY` and `GEMINI_API_KEY` for the
Appwrite Functions (phone path). No `GROQ_API_KEY`.

**So the first thing to try before buying anything:** open the Windmill UI, read
`f/tools/groq_api_key` and `u/admin/gemini_api_key`, and put those into the router's env.
Then try each of the four Anthropic keys and two OpenAI keys to find one with credit.

### THERE ARE TWO SEPARATE KEY STORES — THIS IS THE TRAP

Fixing an API key in **Appwrite does not reach the AI Router.** They are different stores
serving different paths:

| store | who reads it | holds |
|---|---|---|
| Appwrite project variables | Appwrite Functions (`tool-executor`, `chat-ai`, phone path) | `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `FB_APP_ID`, `FB_ADS_APP_ID`, `STRIPE_*`, `MSG91_*`, `BIRD_*`, `WINDMILL_TOKEN` |
| VPS 1 root env files + PM2 saved env | the AI Router process on `:9000` | its own copy of every provider key |

Verified 2026-09-11: the Appwrite variable list was updated and the router still returned
the **identical** three errors, because the router never reads Appwrite. Note also that
**`GROQ_API_KEY` does not exist in Appwrite at all.**

Fixing the router is a VPS 1 operation, not an Appwrite one:

```
set -a; . /root/.ai-api-env; set +a; pm2 restart ai-router --update-env; pm2 save
```

And the Anthropic failure is **billing, not a key** — no key change will clear
"credit balance too low". That needs credit on the Anthropic account.

### Key loading — corrected

`start-ai-router.sh` **does** source `/root/.ai-api-env` (line 5, inside `set -a`), and
sources `/root/ai-router-keys.env` after it. An older note in this file said it never
sources that file; that was wrong. GCloud Secret Manager access from the box currently
fails, so `get_secret()` falls back to the environment. To add a key durably:

```
set -a; . /root/.ai-api-env; set +a; pm2 restart ai-router --update-env; pm2 save
```

## Request path — INTENDED vs ACTUAL

Intended (owner's spec): browser → VPS 2 nginx (injects Windmill token, allows only
`/jobs/run_wait_result/`) → per-page GCloud Agent Worker on Cloud Run → AI Router.

Actual today:

- **The GCloud Agent Worker track does not exist.** `marketingtool-agent` is not deployed
  in project `marketing-tool-484720`; the only Cloud Run services are
  `aimarketingtool-pro-fbaf2fad-git` and `phone`, both phone-side. Its nginx route on VPS 2
  is commented out, and `src/` contains **zero** references to it or any `run.app` host.
- The frontend calls Windmill `f/tools/*` through the VPS 2 proxy.

### WARNING: `origin/main` still contains the vulnerable client

Verified 2026-09-11: `origin/main`'s `src/utils/api/windmill/index.js` still reads
`VITE_WINDMILL_TOKEN`, defaults `API_BASE` to `http://localhost:8000` and defaults the
workspace to the wrong `marketingtool`. **The Zero Trust fix exists only in the local
`main` checkout and was never pushed.** It is now also on the branch
`worktree-claude-md-refresh`, so it is no longer one disk failure from being lost.
Merge that branch before doing any fresh clone or CI build, or you will rebuild the
vulnerable bundle.

### Source is fixed; production is not (RESOLVED — deployed 2026-09-11)

`src/utils/api/windmill/index.js` defaults to `https://app.marketingtool.pro`, holds **no**
Windmill token, and sends only the Appwrite JWT. All five call sites use that same default.
`grep -rn WINDMILL_TOKEN src/` returns nothing.

The bundle live since **12 Apr 2026** carries the Windmill token in five JS chunks and
calls `wm.marketingtool.pro` directly, bypassing the proxy. **It is still what production
serves**, because the redeploy attempted on 2026-09-11 had to be rolled back.

### YOU CANNOT REBUILD THIS APP RIGHT NOW — `.env` IS MISSING

`test -f .env` in the repo root returns false. The file does not exist in the working copy.
Vite therefore falls back on every variable, and the resulting bundle **cannot log anyone
in**: the Appwrite client falls back to `http://localhost/v1` with an empty project id, so
the Google OAuth URL becomes

```
http://localhost/v1/account/sessions/oauth2/google?...&project=
```

which the browser refuses. Firebase, Supabase and the MUI X Pro licence are lost the same
way. Restore `.env` before any build. The variables the source reads (names only, 24 of
them; note there is **no** `VITE_WINDMILL_TOKEN` — the source is token-free):

```
VITE_APPWRITE_ENDPOINT              VITE_APPWRITE_PROJECT_ID
VITE_WINDMILL_URL                   VITE_WINDMILL_WORKSPACE
VITE_APP_SUPABASE_URL               VITE_APP_SUPABASE_ANON_KEY
VITE_APP_FIREBASE_API_KEY           VITE_APP_FIREBASE_APP_ID
VITE_APP_FIREBASE_AUTH_DOMAIN       VITE_APP_FIREBASE_PROJECT_ID
VITE_APP_FIREBASE_STORAGE_BUCKET    VITE_APP_FIREBASE_MESSAGING_SENDER_ID
VITE_APP_FIREBASE_MEASUREMENT_ID    VITE_APP_MUI_X_LICENSE_KEY
VITE_MUI_X_LICENSE_KEY              VITE_APP_BASE_URL
VITE_APP_API_HOST                   VITE_APP_VERSION
VITE_APP_ANALYTICS_ID               VITE_APP_CLARITY_ID
VITE_APP_NOTIFY_ID                  VITE_APP_AWS_REGION
VITE_APP_AWS_USER_POOL_ID           VITE_APP_AWS_USER_POOL_WEB_CLIENT_ID
```

Known public values: the Appwrite endpoint is `https://api.marketingtool.pro/v1` and the
Appwrite project id is `6952c8a0002d3365625d` (project name "MarketingTool", read from the
Appwrite database). `VITE_WINDMILL_URL` must be `https://app.marketingtool.pro` so the
proxy is used.

### Deploy procedure, and the check that must not be skipped

```
cd <repo root, WITH .env present>     # not `npm --prefix` — Vite reads .env from cwd
npm run build
# VERIFY BEFORE UPLOAD — absence checks alone are not enough:
grep -l "api.marketingtool.pro/v1" dist/assets/*.js   # MUST match something
grep -l "localhost/v1"             dist/assets/*.js   # MUST match nothing
grep -l "wm.marketingtool.pro"     dist/assets/*.js   # MUST match nothing
rsync -az --delete dist/assets/ root@62.72.58.221:/root/web-app/dist/assets/
rsync -az dist/index.html dist/manifest.json dist/robots.txt dist/favicon.* \
      dist/logo192.png dist/logo512.png root@62.72.58.221:/root/web-app/dist/
```

Only `assets/` plus the root files need shipping (~11 MB); `images/` and `videos/` are
static media already on the server.

### Incident 2026-09-11 — deploy broke login, rolled back

A rebuild was deployed and it took Google OAuth down, because the build ran via
`npm --prefix <dir>`, which leaves the working directory elsewhere, and because `.env` was
missing anyway. The pre-deploy verification only checked that the Windmill token was
**absent** and never checked that the Appwrite endpoint was **present**, so a bundle that
could not authenticate passed as clean.

Rolled back from `/root/web-app/dist-backup-predeploy-20260910-195358`; login restored and
verified (the `appwrite-*.js` chunk again carries the real endpoint and no localhost
fallback). **Lesson: every deploy check needs a MUST-BE-PRESENT list, not just a
MUST-BE-ABSENT list.** Three stale 1.6 GB tarballs were removed during the attempt, taking
the box from 42 GB to 37 GB used.

### Proxy allowlist — gap found and FIXED 2026-09-11

`scripts` was missing from the 403 list, so an unauthenticated request returned 200 and the
full script inventory (nginx attaches its own admin token, so the caller needed nothing).

Fixed on VPS 2 and verified live. The block list is now:

```
variables|users|workers|workspaces|groups|resources|schedules|settings|configs|oidc|
scripts|flows|apps|folders|audit|acls|capture|http_triggers|websocket_triggers
```

Verified after reload: scripts/flows/apps/folders all return 403, the execution path
`jobs/run_wait_result` still works (404 for a nonexistent script, unchanged), and the app
still serves 200. Previous config backed up under `/root/nginx-backups/`.

**Still open:** VPS 1 `:3002` is directly reachable from the internet, so the proxy stays
bypassable until that port is firewalled.

## The real frontend stack (verified in source 2026-09-11)

Declared versions, not guesses: React 19, react-router-dom 7, Vite 8, MUI Material 9,
MUI X date-pickers 9, Tailwind 4, Appwrite SDK 26, Firebase 12. 52 dependencies and
26 dev dependencies.

**Two routers are installed. Only one runs.**

| package | files importing it | verdict |
|---|---|---|
| `react-router-dom` | 26 | the real router — `src/routes/MainRoutes.jsx` |
| `@tanstack/react-table` | 17 | genuinely used, keep |
| `@tanstack/react-router` | 4 | **dead** |
| `@tanstack/react-start` | 0 | **dead** |

The entry point is `index.html` → `/src/main.jsx` → `App.jsx` → react-router-dom. **Nothing
imports `src/router.tsx`**, so the whole TanStack Start scaffold is unreachable:
`src/router.tsx`, `src/routes/index.tsx`, `src/routes/about.tsx`, `src/components/Header.tsx`,
plus a second `vite.config.ts` that never wins over `vite.config.mjs`.

Proven against a real build, not inferred:

| grepped in `dist/assets/*.js` | files |
|---|---|
| `createFileRoute` / `createRootRoute` / `TanStackRouterDevtools` | **0** |
| `useReactTable` / `getCoreRowModel` | 3 |
| `createBrowserRouter` / `RouterProvider` / `useNavigate` | 1 |

`src/routeTree.gen.*` does not exist either, so the TanStack router plugin has **never
run**. TanStack Router and Start ship nothing. TanStack Table really does ship.

**The TanStack API keys in the owner's account are unused by this repo.** Nothing in `src/`
references a TanStack key, there is no such environment variable, and the only file
mentioning TanStack devtools is the dead `vite.config.ts`. One key dates from 8 Apr 2026,
the same period as the scaffold.

That scaffold is why the stack looks confusing. It is a starter template that landed in the
repo and was never removed. Safe to delete along with `@tanstack/react-start`,
`@tanstack/router-plugin`, `@tanstack/react-router-ssr-query`, `@tanstack/react-router-devtools`
and `@tanstack/devtools-vite`. Keep `@tanstack/react-table` — 17 files depend on it.

### Licences: SaasAble needs no key, MUI X Pro does

`src/config/muiLicense.js` is the **only** runtime licence gate in the entire app. A grep
for any SaasAble licence check across `src/` returns nothing. SaasAble is a one-time
template purchase that ships source; there is no key to install and nothing watermarks.
MUI X Pro is the opposite: a runtime key, checked on every render.

### MUI X Pro is required, and the key is currently unset

This is not optional MUI X. The project imports the **Pro** packages, which watermark
themselves without a licence:

| package | files importing it |
|---|---|
| `@mui/x-charts-pro` | 19 |
| `@mui/x-date-pickers-pro` | 18 |
| `@mui/x-date-pickers` (community) | 10 |
| `@mui/x-data-grid-pro` | declared |

`src/config/muiLicense.js` reads `VITE_MUI_X_LICENSE_KEY`, falls back to
`VITE_APP_MUI_X_LICENSE_KEY`, and calls `LicenseInfo.setLicenseKey` **only if one is
non-empty**. With the config file missing, both are empty, the call never runs, and every
Pro chart, grid and date picker renders the "Missing license key" watermark with a console
error. That is customer-visible across roughly 37 files.

Enforcement confirmed by reading the installed `@mui/x-license@9.8.0`: it ships a
`Watermark` component whose rendered strings include "MUI X Missing license key",
"MUI X Expired package version" and "MUI X License key plan mismatch", plus the console
error "MUI X: Missing license key." Installed versions are all v9 (`x-charts-pro` 9.11.1,
`x-date-pickers-pro` 9.11.0).

The owner holds two MUI X Pro annual licence keys, both valid to 18 Mar 2027. Their encoded
payloads carry the **same** plan, term and package-version fields; they differ only in order
id and expiry timestamp. So either will license this v9 install — an earlier note here
claiming only one would work was wrong. The keys themselves are deliberately not recorded
in this file.

### Tailwind is installed and produces NOTHING — verified in the built CSS

`@tailwindcss/vite@4.3.3` is installed, and both `src/index.css` and `src/styles.css` open
with `@import "tailwindcss"` (plus `@plugin "@tailwindcss/typography"` in styles.css). But
the plugin is **commented out** in `vite.config.mjs` ("enable only if actually used"), and
there is **no `postcss.config.*` and no `tailwind.config.*`** in the repo. In Tailwind 4 the
Vite plugin is what compiles that import, so nothing compiles it.

Proven against a real build of `dist/assets/index-*.css` (100 KB total):

| check | result |
|---|---|
| Tailwind runtime variables (`--tw-`) present | **0 files** |
| unresolved `tailwindcss` import left behind | 0 files |

So **every Tailwind class written in a component is inert.** Either enable the plugin in
`vite.config.mjs` or drop Tailwind and the two `@import` lines. Do not write Tailwind
classes expecting them to work today.

**`src/utils/auth-client/supabase.js` creates a Supabase client with the anon key.** It is
SaasAble template scaffolding for a provider this project does not use — `AUTH_PROVIDER` is
`AuthType.APPWRITE`. It does not query tables, but it would put the anon key in the bundle
if that variable were set. The rule "frontend never queries Supabase" still holds in
practice; this file is the only thing that could break it.

## Component roles

- **React Web App** — UI only. Desktop 1920px. Holds no secrets (verified in source).
- **Appwrite** (VPS 1) — auth only: JWT, OAuth Google/Facebook/Apple, email+password, plus
  Stripe. **212 registered users**, 179 sessions, 102 OAuth identities, 16,665 function
  executions. Six functions, all enabled, all node-16.0 v5: `tool-executor`, `chat-ai`,
  `Stripe Checkout`, `Phone Session`, `delete-account`, `image-generator`.
  Appwrite's own database (`database_1`) holds live collections with the **same names** as
  the Supabase tables — `generations`, `credit_usage`, `subscriptions`, `tool_runs`,
  `tool_results`, `users`, `chat_sessions` and more. **Both stores hold real rows** — the
  phone path writes here, the web path writes to Supabase. They are parallel, not a
  duplicate waiting to be filled.
- **Supabase** (VPS 2) — Postgres only. **29 tables** (the spec says 28), RLS enabled on all
  29. **15 carry zero policies**, which is deny-all for ordinary roles: safe rather than
  broken, and reachable only by the service role Windmill uses.

### Row counts — COUNT THEM PROPERLY (exact, 2026-09-11)

> **Never use `pg_stat_user_tables.n_live_tup` for this.** It is a statistics estimate and
> reads **0** for every table when the stats collector has been reset, which is what a
> recent container restart does. An earlier pass in this project did exactly that and
> reported "all 29 tables are empty", which was false and led to wrong conclusions about
> the product being unused. Use `count(*)`.

| table | rows | policies |
|---|---|---|
| campaign_metrics | 282 | 1 |
| daily_summary | 142 | 1 |
| tool_registry | 128 | 0 |
| ad_accounts | 114 | 1 |
| generations | 66 | 0 |
| billing_transactions | 65 | 0 |
| credit_usage | 65 | 0 |
| workflow_runs | 47 | 2 |
| campaigns | 34 | 0 |
| subscriptions | 8 | 0 |
| tenants | 1 | 1 |

The other 18 tables are genuinely empty: accounts, ai_decision_memory, ai_router_logs,
automation_logs, campaigns_v2, chat_messages, chat_sessions, engine_performance,
execution_logs, favorites, insights, integrations, kpi_snapshots, mt_users,
performance_daily, ratings, shares, sync_logs.

**This product has real usage.** Customers have connected 114 ad accounts, 282 campaign
metric rows and 142 daily summaries have synced from the platforms, and 66 AI generations
with 65 credit-usage and 65 billing rows have been recorded against 8 subscriptions.
Compared with the March 2026 reference snapshot, ad_accounts grew 43 → 114, campaigns
31 → 34 and workflow_runs 46 → 47, so the pipeline is live and still moving.

Note `mt_users` is empty while `ad_accounts` holds 114 rows, so accounts are keyed by the
Appwrite user id directly rather than through a local users table.
- **Windmill** (VPS 1) — all backend logic in Python. Workspace `marketingtool-pro`. The
  old warning about a wrong `marketingtool` fallback string is **stale** — all three call
  sites now default to `marketingtool-pro`, verified 2026-09-11.
- **AI Router** (VPS 1) — FastAPI under PM2, uvicorn `:9000`, never exposed. See above.

### Windmill inventory — most of it has never run

| | count |
|---|---|
| scripts under `f/tools/` | 908 |
| of those, ever executed | **9** |
| distinct `f/tools/*` referenced by the frontend | 424 |
| scripts under `f/mobile/` | 2 |
| scripts under `f/admin/` | 12 |
| jobs all time | 286,333 |

Job volume is dominated by something that is not a customer feature:
`u/admin/github_webhook_handler_final` accounts for **207,377** of those jobs and fired
34,723 times on 9 Sep alone. With `f/tools/fetch-connected-accounts` at 60,250, those two
are ~93% of all Windmill work ever done here. Real tool runs are in single digits.

### JWT validation

Real, not decorative: scripts call Appwrite `/account` with the customer's JWT and compare
the returned `$id` against the claimed `userId`. **546 of 908** tools scripts carry that
check; 362 do not. The weakness is inside the check — it builds an SSL context with
`check_hostname = False` and `verify_mode = CERT_NONE`, so that hop trusts any certificate.

## DASHBOARD — CROSS-TENANT DATA LEAK (found 2026-09-11, fix committed, NOT yet pushed)

The dashboard is the first page a customer sees, and it shows **every customer's data**.

`f/tools/dashboard-summary` accepts `userId` and then never uses it. All four Supabase
reads run unfiltered under the **service_role** key, which bypasses RLS:

```python
_q("ad_accounts",      "order=created_at.desc&limit=20")
_q("campaigns",        "status=neq.archived&order=created_at.desc&limit=50")
_q("campaign_metrics", "order=date.desc&limit=100")
_q("daily_summary",    "order=date.desc&limit=30")
```

A grep for `user_id=eq` in that script returns **0**. Measured impact: `ad_accounts` holds
**114 rows across 7 distinct customers**, so each customer's dashboard renders a blend of
all seven. It also does **no JWT validation**.

Corrected script committed at `windmill/f/tools/dashboard-summary.py`: validates the
Appwrite JWT first, derives the id from the token rather than the caller-supplied `userId`,
and scopes all four reads with `user_id=eq.`. Push it through the Windmill UI.

**Still open in that script:** `call_meta_api` uses the global variables
`f/tools/fb_ads_access_token` and `f/tools/fb_ads_app_secret`, so the live Meta figures come
from one shared account rather than each customer's stored `ad_accounts.access_token`.
Fixing that is a design change, not a one-line patch.

### The dashboard also refuses to load for most customers

`src/hooks/useDashboardData.js` only calls the API when `localStorage.fb_ads_connected ===
'true'`, and only `src/views/admin/fb-connect-callback.jsx` ever sets that flag. So:

- a customer who connected on another browser or device sees an empty dashboard
- a Google-Ads-only customer never sets the flag, so the dashboard never loads at all
- clearing site data re-triggers the connect popup forever

`src/layouts/AdminLayout/index.jsx` gates the hard connect-ads popup on the same flag.
Both should ask the server whether this user has `ad_accounts` rows, not the browser.

### Dashboard routes — the URLs

The live routes are `/dashboard/analytics/:tab`, where tab is `overview`, `user-behavior`
or `performance`. `/dashboard` redirects to `analytics/overview`. **`/dashboard/overview`
is not a route** and falls through to the `path: "*"` catch-all in `src/routes/index.jsx`,
rendering `NotFoundCatch`. The tab labels are Overview, Campaign Performance and
Finance & Revenue, fed from `data.overview`, `data.campaigns` and `data.finance`.

## THE CHAT PAGE BUG — two scripts point at the wrong host

**Symptom:** the chat UI replies *"AI is temporarily busy, please try again."*

**Cause:** Windmill workers run in Docker. Inside a worker container `localhost` is the
container, and nothing listens on `:9000` there. The AI Router runs on the VPS 1 **host**,
reachable from a container as `172.17.0.1:9000`. Proven from inside `windmill-worker`:

| target from inside the worker | result |
|---|---|
| `http://localhost:9000/` | unreachable |
| `http://172.17.0.1:9000/` | 200 |

Exactly **two** live scripts get this wrong, and they are the worst two to lose:

- `f/tools/engine-creative` — backs all 12 Creative tools on the chat page
- `f/tools/ai-generate` — the fallback for any slug missing from `SLUG_TO_ENGINE`

The other **510** scripts referencing the router already use `172.17.0.1`. So this is a
two-line fix, not a refactor. In each script replace

```python
AI_ROUTER_URL = "http://localhost:9000/generate"
```

with the pattern the working engines use:

```python
try:
    _BASE = wmill.get_variable("f/tools/ai_router_url") or "http://172.17.0.1:9000"
except Exception:
    _BASE = "http://172.17.0.1:9000"
AI_ROUTER_URL = _BASE.rstrip("/") + "/generate"
```

Note `f/tools/engine-creative` and `f/tools/ai-generate` are near-identical 107-line
scripts. Do not try to reproduce them from a `psql` text dump — the export mangles the
escaped quotes inside the f-string prompt and the result will not compile. Edit the one
line in the Windmill UI.

## The three chat engines (verified 2026-09-11)

`/chat`, `/chat/create-email`, `/chat/automate` and `/chat/insights` all render from the
same `SECTIONS` list, and each tool's slug maps through `SLUG_TO_ENGINE` to one of three
engines. `executeGeneration` then POSTs to `/jobs/run_wait_result/p/<engine>`.

| engine | lines | AI Router tasks it fires | real vendor data | state |
|---|---|---|---|---|
| `f/tools/engine-automation` | 550 | 6 in parallel: automation, creative, research, coding, image_gen, vision_analysis | yes, live Meta insights + campaigns | works, but 4 of its 6 tasks are downgraded |
| `f/tools/engine-insight` | 561 | 8: adds default and ocr | yes | same |
| `f/tools/engine-creative` | 107 | 1 (creative) | none | **cannot reach the router at all** |

All three validate the Appwrite JWT. The automation and insight engines also check credits,
load the customer's connected accounts, metrics and daily numbers, call the Meta Marketing
API for real insights and campaigns, then save to `generations` and `credit_usage`.

`_build_tool_prompts` does **not** branch per slug: every tool in a section gets the same
prompt shape with the tool name and user input interpolated.

Because the automation and insight engines fan out across many tasks at once, the three
broken provider accounts hit them hard — a single Post Scheduler run makes four calls that
currently answer as `gpt-4o-mini`.

## The signup → ads-connect flow (verified 2026-09-11)

```
marketingtool.pro  →  "Get Started"  →  app.marketingtool.pro/login and /register
                   →  Appwrite auth  →  web app  →  ads-connect popup  →  full app
```

The apex links are correct: both `/login` and `/register` on the app domain. The popup calls
three Windmill scripts. Their live state:

| script called by the UI | exists in Windmill | validates the Appwrite JWT |
|---|---|---|
| `f/tools/google-ads-connect` | yes | **yes** |
| `f/tools/fb-ads-connect` | yes | **NO** |
| `f/tools/instagram-connect` | **NO — does not exist at all** | n/a |

Two real defects in the flow the customer actually walks:

1. **Instagram connect is dead.** `src/views/admin/ig-connect-callback.jsx` calls
   `f/tools/instagram-connect`, and no script by that name exists, archived or not. Every
   other `instagram-*` script in the workspace is archived.
2. **`f/tools/fb-ads-connect` does no JWT validation**, unlike its Google counterpart. It
   accepts whatever user id it is handed.

## Known broken — do not assume these work

- ~~AI Router tasks down~~ — **10 of 10 live, each on its own model** (verified 2026-11-16).
- **`marketingtool-agent` Cloud Run service does not exist** — the web app's designated
  tool engine per the spec has never been deployed.
- **Production still runs the 12 Apr 2026 build with the Windmill token in the public
  bundle.** A redeploy on 2026-09-11 broke login and was rolled back. It cannot be retried
  until `.env` is restored — see the deploy section.
- **`.env` is missing from the working copy**, so nobody can build a working bundle today.
- **`origin/main` still holds the vulnerable client** — the fix is unmerged. See above.
- ~~`scripts` missing from the proxy 403 list~~ — **FIXED 2026-09-11**, verified 403.
- **`/api/tools/`** on VPS 2 proxies to VPS 1 `:3001` — nothing listens there. Returns
  **504** (connection timeout), not 502.
- **Google Ads Agent proxy** (`/api/google/` → Cloud Run) is commented out in the nginx config.
- **`media.marketingtool.pro`** has no proxy host — TLS `unrecognized name`.
- **VPS 1 public ports**: `3002` Windmill and `81` nginx-proxy-manager admin both answer
  publicly; `8080`/`8081`/`8082` redirect, `8443` 404s. Only `9000` is firewalled.
- **VPS 2 public ports**: Supabase Kong on `8000`/`8443` is bound to all interfaces (401s,
  so the key gate holds). Two unrelated containers serve publicly on `32768` (Harness CI)
  and `32769` (Super Productivity).
- **`f/tools/meta-webhook`** writes to a `webhook_logs` table that does not exist; `except:
  pass` hides the 404 and it returns `success: true`. No `X-Hub-Signature-256` verification.
- ~~**Facebook App ID `1582682256320433`** hardcoded in the ads connect code~~ — **FIXED in
  source by #149 (2026-11-04)**: all three files now use `META_APP_ID = '2246709019441842'`
  from `src/config.js`. Production still serves the 12 Sep 2026 build with the old ID until
  `main` is rebuilt and deployed.
- **Google Ads developer token now has BASIC ACCESS** (owner-confirmed 2026-09-11). The
  prior "test access only" note is obsolete. The token value is held with the other
  credentials and is deliberately not recorded in this file.
- **`reports/` and `chart/` views contain no backend call** despite being listed as done.

## META APPS — WHICH ONE DOES WHAT (decided by the owner, 2026-11-04)

Both apps sit in business portfolio `1214819780123174`. This split is final; do not mix them.

| app | id | used for |
|---|---|---|
| marketingtool | `2246709019441842` | **All ads, everywhere** — web app and phone app, Facebook + Instagram ads connect, the force-connect popup, Settings → Ad Connections (incl. the web-only Instagram connect), and **all webhooks** (→ `wm.marketingtool.pro`) |
| marketingtool pro | `1830149205008066` | **Login only, everywhere** — the Appwrite Facebook OAuth provider for the phone app and the web app. Nothing else. |

`1582682256320433` ("MarketingTool Ads", older portfolio `737035192427150`) and
`1255201403175191` are **not used**. The web app has no "Sign in with Instagram": the Appwrite
SDK has no Instagram OAuth provider (that button produced `Missing required parameter:
"provider"`), so login is Google + Facebook only.

## META APP REVIEW — NOTHING WAS EVER SUBMITTED (read live 2026-09-11)

Re-read live on 2026-11-05: unchanged. `2246709019441842` still holds only `openid`,
`public_profile` and `email`; the draft is still `UNSUBMITTED`.

The owner believed Meta App Review had been pending for nine months. It has not. Read
straight from the Meta developer API:

| app | id | submission | privileges held |
|---|---|---|---|
| marketingtool | `2246709019441842` | **NO_SUBMISSION / UNSUBMITTED** — a draft exists (`2246714072774670`), `submitted_time` is null | openid, public_profile, email |
| marketingtool pro | `1830149205008066` | **NO_SUBMISSION**, never submitted | **none at all** |

Nothing sits in a review queue. `is_pending` is `false` on both.

**Compliance is clean** on the main app: `overall_status: compliant`, zero required actions,
zero open violations. So nothing is blocking a submission either. It simply was not sent.

### The ads permissions were never requested

This is the deeper problem. The main app holds only **login-level** permissions. There is
no `ads_read`, no `ads_management`, no `business_management`, no `pages_show_list`.

`f/tools/fb-ads-connect` calls `GET /me/adaccounts`, which requires `ads_read` or
`ads_management`. With only `public_profile`, `email` and `openid`, that call cannot return
a customer's ad accounts. **The Meta ads connect flow cannot work on either of these apps
as configured**, regardless of the code being correct.

Three privileges are rejected on the main app: `gaming_profile`, `gaming_user_picture`, and
`instagram_business_manage_messages`. The last one is the only item in the draft submission,
so the one submission being prepared is for an Instagram messaging permission that has
already been rejected — not for ads at all.

### And the hardcoded App ID is a third app

`ProfileLoginService.jsx`, `connect-ads/index.jsx` and `ConnectAdsModal.jsx` hardcode
`1582682256320433`, which is **neither** app above. Whatever that ID is, it is not in the
set this account grants, so it cannot be inspected or reviewed from here.

**Order of work to make Meta ads real:** ~~decide which app is the product, point the
frontend at that ID~~ (done: `2246709019441842`, see "META APPS" above), request `ads_read` plus `ads_management` (and `business_management`
for account discovery), complete Data Use Checkup, then actually submit. Until submission
happens, waiting achieves nothing.

## Google OAuth verification status

Requested scopes were trimmed from 9 to 5 in `ProfileLoginService.jsx` and
`ConnectAdsModal.jsx`: `adwords`, `adsense.readonly`, `analytics.readonly`,
`adsdartsearch`, `doubleclicksearch`, plus `email profile`. Removed: `adsense` (write),
`analytics.manage.users`, `adsdatahub`, `realtime-bidding`, `service.management`.
The five scopes were re-verified in source on 2026-09-11. The claim that the Google Cloud
console Data Access page still lists ~27 scopes is **carried from the prior file and NOT
re-verified** — it needs a console check. Console edits do not restart review — you must
reply to the Trust and Safety email.

## Critical rules

- Desktop only, 1920px. No mobile responsive here; the phone app is separate.
- Never touch `.env` or `.env.qa`.
- Chat page and Command Centre are separate. Never mix.
- One page at a time — the user says which.
- Never display a tool count anywhere in the product.
- No demo or fake data. Show zeros when there is no data.
  **The single exception is `/ad-library`.** It is the one intentional demo page: script
  based, sample ads, no vendor API. `src/views/admin/ad-library/index.jsx` imports
  `searchAdLibrary` but falls back to sample ads with the notice "Ad Library search is not
  configured yet. Showing sample ads below." That is by design. Do **not** report it as
  fake data, and do not "fix" it by wiring a live API unless the owner asks.
- Read files before changing them.
- Template components are polished — inject real data, do not rewrite them.
- No external payment links — direct integration only, for compliance.
- **Both apps use Windmill and the AI Router**, separated **by folder, not by instance**.
  One workspace: `marketingtool-pro`. A web feature calls `f/tools/*`, a mobile feature
  calls `f/mobile/*`. Never cross. Do NOT write "strict isolation, never mix" — that
  phrasing caused false bug reports. The real rule is: **stay in your own folder.**

## Verify, never trust a config

Every wrong answer in this project came from trusting a file instead of the running system.
Before claiming anything works: `curl` the live URL, `ssh` the box, query the database, or
call the router. A green config proves nothing. Being told you are wrong is not evidence
that you are — go re-check.
