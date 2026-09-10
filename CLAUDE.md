# MarketingTool — Web App (Customer Portal)

> Every fact here was verified live on **2026-09-11** by SSH into both VPS, live HTTP
> probes, direct Postgres/MariaDB queries, and live calls to the AI Router. Where reality
> differs from the design docs, reality wins and the gap is called out. Do not "correct"
> this file back to the aspirational version.
>
> The design intent lives in the owner's architecture spec. This file records what is
> **actually running**. When the two disagree, that disagreement is the point of this file.

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

## AI Router — READ THIS FIRST, HALF OF IT IS SILENTLY DOWNGRADED

The router is up (PM2 `ai-router`, uvicorn on `:9000`) and **correctly firewalled** —
iptables accepts 9000 only from localhost and Docker nets and DROPs the rest. Verified
refused from the public internet.

The routing **code is correct**: each task tries its own model first and treats OpenRouter
as an error path. But three provider accounts are failing, and `_first_ok()` swallows the
exception without logging, so every failure is invisible and answers arrive as
`gpt-4o-mini`.

Verified by live call on 2026-09-11:

| task | intended | what actually answers | why |
|---|---|---|---|
| creative | claude-sonnet-4-5 | **gpt-4o-mini** | Anthropic: credit balance too low |
| coding | claude-sonnet-4-5 | **gpt-4o-mini** | Anthropic: credit balance too low |
| default | claude-sonnet-4-5 | **gpt-4o-mini** | Anthropic: credit balance too low |
| research | gemini-2.5-flash | **gpt-4o-mini** | Gemini: "API key not valid" |
| automation | llama-3.3-70b-versatile | **gpt-4o-mini** | Groq: 401 "Invalid API Key" |
| image_gen | dall-e-3 | dall-e-3 | healthy |
| stable_image | sd3.5-large | sd3.5-large | healthy |
| video_gen | FAL / Kling | FAL | healthy |
| vision_analysis | `openai/gpt-4o` | works | healthy |
| ocr | `qwen/qwen-2.5-vl-72b-instruct` | works | healthy |

So **five of ten task names — every text task — silently answer from the cheapest model.**
Keys are all present in the process environment with plausible lengths; the SDKs are
current (anthropic 0.84.0, google-genai 1.66.0, openai 2.26.0); all provider hosts are
reachable from the box. The failures are account-side: one billing, two bad keys.

To see a swallowed provider error without adding logging, force both providers to fail by
sending an over-long prompt — the 502 then contains both error strings:

```
curl -s -X POST http://127.0.0.1:9000/generate -H 'Content-Type: application/json' \
  -d "{\"task\":\"creative\",\"prompt\":\"$(python3 -c 'print("x"*900000)')\"}"
```

The `/` endpoint still prints three **stale labels** — "Claude Sonnet 4" (it is 4.5),
"Stable Diffusion 3" (3.5-large), "Qwen3 VL 8B" (Qwen2.5-VL-72B). Cosmetic, but it is what
callers are told.

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

### Source is fixed; production is not

`src/utils/api/windmill/index.js` defaults to `https://app.marketingtool.pro`, holds **no**
Windmill token, and sends only the Appwrite JWT. All five call sites use that same default.
`grep -rn WINDMILL_TOKEN src/` returns nothing.

**The deployed bundle predates that fix.** `/root/web-app/dist` on VPS 2 is dated
**12 Apr 2026** and the repo is **272 commits ahead** of it. The April bundle still points
at `wm.marketingtool.pro` and still carries the Windmill token in five JS chunks.
Deploying the current build closes both the token exposure and the proxy bypass with no
code to write. There is **no deploy script on the box** — dist copies are manual, and the
stale ones plus two 1.6 GB tarballs account for 9.1 GB under `/root/web-app`.

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

## Component roles

- **React Web App** — UI only. Desktop 1920px. Holds no secrets (verified in source).
- **Appwrite** (VPS 1) — auth only: JWT, OAuth Google/Facebook/Apple, email+password, plus
  Stripe. **212 registered users**, 179 sessions, 102 OAuth identities, 16,665 function
  executions. Six functions, all enabled, all node-16.0 v5: `tool-executor`, `chat-ai`,
  `Stripe Checkout`, `Phone Session`, `delete-account`, `image-generator`.
  Appwrite's own database (`database_1`) holds live collections with the **same names** as
  the Supabase tables — `generations`, `credit_usage`, `subscriptions`, `tool_runs`,
  `tool_results`, `users`, `chat_sessions` and more. That is where real rows exist today.
- **Supabase** (VPS 2) — Postgres only. **29 tables** (the spec says 28), RLS enabled on all
  29, but **12 carry zero policies** — which is deny-all for ordinary roles, safe rather
  than broken, and reachable only by the service role Windmill uses.
  **Every one of the 29 tables has zero rows.**
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

## Known broken — do not assume these work

- **Five of ten AI Router tasks silently downgrade to gpt-4o-mini** (see table above).
- **`marketingtool-agent` Cloud Run service does not exist** — the web app's designated
  tool engine per the spec has never been deployed.
- **Production runs a 12 Apr 2026 build, 272 commits behind**, with the Windmill token in
  the public bundle.
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
- **Facebook App ID `1582682256320433`** is hardcoded in `ProfileLoginService.jsx`,
  `connect-ads/index.jsx` and `ConnectAdsModal.jsx` (verified 2026-09-11) and ships in the
  bundle, but it matches **neither** app in the Meta account. The two real apps, read live
  from the Meta developer API on 2026-09-11, are `2246709019441842` ("marketingtool") and
  `1830149205008066` ("marketingtool pro"), both admin-role and active.
  The prior file named `925198393533156` and `1414526646867223` — those were also wrong.
- **Google Ads developer token now has BASIC ACCESS** (owner-confirmed 2026-09-11). The
  prior "test access only" note is obsolete. The token value is held with the other
  credentials and is deliberately not recorded in this file.
- **`reports/` and `chart/` views contain no backend call** despite being listed as done.

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
