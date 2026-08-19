# MarketingTool — Web App (Customer Portal)

> Every fact here was verified live on 2026-08-10 by SSH into both VPS, live HTTP probes,
> and direct Postgres queries. Where reality differs from the old design docs, reality wins
> and the gap is called out. Do not "correct" this file back to the aspirational version.

## THIS IS A CUSTOMER PORTAL, NOT ADMIN

- Web App = desktop only (1920px), dark theme. React + Vite + MUI 9 (paid SaasAble template).
- Phone App = separate repo, separate stack. `/Users/loken/ai-marketingtool-llc/AiMarketingtool-pro-fbaf2fad`

## Real infrastructure (verified)

| | VPS 1 | VPS 2 |
|---|---|---|
| IP | `31.220.107.19` | `62.72.58.221` |
| Hostinger | `srv1073584`, KVM 8 — 8 vCPU / 32 GB / 400 GB | `srv1350977`, KVM 2 — 2 vCPU / 8 GB / 100 GB |
| Runs | Appwrite (25 containers), Windmill (5), AI Router (PM2), nginx, MariaDB | Web app dist, Supabase (13 containers), nginx |
| DNS | `marketingtool.pro`, `auth.`, `wm.`, `api.`, `media.` | `app.marketingtool.pro` |

There is **no Hostinger cloud firewall** on either box. VPS 1 has no UFW; protection is
hand-written iptables rules that DROP `:9000` externally and allow it from localhost +
Docker nets. Everything else bound to `0.0.0.0` is publicly reachable.

## Request path — INTENDED vs ACTUAL

Intended (and VPS 2's nginx really does implement it):

```
Browser → app.marketingtool.pro (VPS 2 nginx)
            ├ 403 on variables|users|workers|workspaces|groups|resources|schedules|settings|configs|oidc
            ├ injects Windmill token server-side
            └ forwards customer JWT as X-Appwrite-JWT
          → 31.220.107.19:3002 (Windmill) → AI Router 127.0.0.1:9000 → Supabase
```

Actual, today:

```
Browser → wm.marketingtool.pro (VPS 1) → 127.0.0.1:3002
          no path allowlist, no token injection
          browser sends the Windmill token itself, compiled into the public JS bundle
```

`VITE_WINDMILL_URL` points at `wm.marketingtool.pro`, so the VPS 2 proxy is never in the
path. To close this: set `VITE_WINDMILL_URL=https://app.marketingtool.pro`, remove
`VITE_WINDMILL_TOKEN` from the build, rebuild. Also note `scripts` is missing from the
403 list, and VPS 1 `:3002` is directly reachable so the proxy stays bypassable until
that port is firewalled.

## Component roles

- **React Web App** — UI only. Desktop 1920px. Must hold no secrets.
- **Appwrite** (VPS 1) — auth only: JWT, OAuth Google/Facebook/Apple, email+password. Plus Stripe.
- **Supabase** (VPS 2) — Postgres only. **29 tables, RLS verified ON for all 29.** Supabase Auth disabled. Frontend never queries it directly; only Windmill does, with the service_role key.
- **Windmill** (VPS 1) — all backend logic in Python. Validates the Appwrite JWT, resolves user/tenant, queries Supabase, calls the AI Router. Workspace is **`marketingtool-pro`** (the code's fallback string `marketingtool` is wrong and would 404 if the env var is ever unset).
- **AI Router** (VPS 1) — FastAPI under PM2 as `ai-router`, uvicorn on `:9000`, reached at `127.0.0.1:9000` or `172.17.0.1:9000` from Docker. Never exposed.

## AI Router — 10 tasks, 8 distinct models

Both "10 models" and "8 models" appear in old docs. Both were right about different
things: there are **10 task names** mapping to **8 distinct models**, because creative,
coding and default all route to Claude.

| task | model actually called | provider |
|---|---|---|
| creative · coding · default | `claude-sonnet-4-5` | Anthropic |
| research | `gemini-2.5-flash` | Google |
| image_gen | `dall-e-3` | OpenAI |
| stable_image | `sd3.5-large` | Stability |
| video_gen | Kling video | FAL.ai |
| vision_analysis | `openai/gpt-4o` | OpenRouter |
| ocr | `qwen/qwen-2.5-vl-72b-instruct` | OpenRouter |
| automation | `llama-3.3-70b-versatile` | Groq |

`TASK_MAP` in `/root/app.py` still shows three stale labels — "Claude Sonnet 4" (it's 4.5),
"Stable Diffusion 3" (it's 3.5-large), "Qwen3 VL 8B" (it's Qwen2.5-VL-72B). Cosmetic, but
the `/` endpoint reports them to callers.

Contract: Windmill POSTs `{"task": "...", "prompt": "..."}` to `http://localhost:9000/generate`.
`vision_analysis` and `ocr` also need `image_url` or `image_urls`. Unknown task → 400 with
the valid list. Provider failure → 502 with a clean message.

### Key loading — READ THIS BEFORE DEBUGGING THE ROUTER

`/root/.ai-api-env` looks like the config file but **`start-ai-router.sh` never sources it**.
Editing that file alone does nothing. Keys reach the process either from the inline `export`
in `start-ai-router.sh`, from GCloud Secret Manager via `get_secret(...)`, or from the PM2
saved environment. Current live env is correct and persisted in `/root/.pm2/dump.pm2`, with
`pm2-root` enabled at boot. To add a key durably:

```
set -a; . /root/.ai-api-env; set +a; pm2 restart ai-router --update-env; pm2 save
```

## Known broken — do not assume these work

- **VPS 1 public ports**: `3002` Windmill, `8081` Appwrite Console, `81` nginx-proxy-manager admin, `8080`, `8082`, `8443`, `25`. Only `9000` is firewalled.
- **Windmill token ships in the public bundle** at `/assets/index-*.js`.
- **`/api/tools/`** on VPS 2 proxies to VPS 1 `:3001` — nothing listens there. Always 502.
- **Google Ads Agent proxy** (`/api/google/` → Cloud Run) is commented out in the nginx config.
- **`web-app.bak`** is still in `sites-enabled`, so nginx warns about a conflicting `app.marketingtool.pro` server name on :80 and :443.
- **`f/tools/meta-webhook`** writes to a `webhook_logs` table that does not exist (0 rows in `pg_tables`); `except: pass` hides the 404 and it returns `success: true`. It also does no `X-Hub-Signature-256` verification, and posts the service_role key over plaintext HTTP to `62.72.58.221:8000`.
- **Facebook App ID `1582682256320433`** is hardcoded in `ProfileLoginService.jsx`, `connect-ads/index.jsx`, `ConnectAdsModal.jsx` and shipped in the bundle, but it is neither of the two apps in the Meta account (`925198393533156` Live, `1414526646867223` In development).
- **Google Ads developer token is TEST ACCESS ONLY** — Basic Access still pending, so the `adwords` scope cannot touch real accounts regardless of OAuth verification.

## Google OAuth verification status

Requested scopes were trimmed from 9 to 5 in `ProfileLoginService.jsx` and
`ConnectAdsModal.jsx`: `adwords`, `adsense.readonly`, `analytics.readonly`,
`adsdartsearch`, `doubleclicksearch`, plus `email profile`. Removed: `adsense` (write),
`analytics.manage.users`, `adsdatahub`, `realtime-bidding`, `service.management`.
The Google Cloud console Data Access page still lists ~27 scopes and must be trimmed to
match. Console edits do not restart review — you must reply to the Trust and Safety email.

## Critical rules

- Desktop only, 1920px. No mobile responsive here; the phone app is separate.
- Never touch `.env` or `.env.qa`.
- Chat page and Command Centre are separate. Never mix.
- One page at a time — the user says which.
- Never display a tool count anywhere.
- No demo or fake data. Show zeros when there is no data.
- Read files before changing them.
- Template components are polished — inject real data, do not rewrite them.
- **Both apps use Windmill and the AI Router.** They are separated by folder, not by
  instance. Confirmed by the owner and verified in the database:
  - Phone app → Appwrite Functions (`tool-executor`, `chat-ai`) → `f/mobile/*` → AI Router
  - Web app → `/jobs/run_wait_result/` → `f/tools/*` → AI Router
  One Windmill workspace: `marketingtool-pro`. Appwrite is the login for both.
  Do NOT write "strict isolation, never mix" — that phrasing was wrong and causes
  false bug reports. The real rule is: **stay in your own folder.** A web feature must
  call `f/tools/*`, never `f/mobile/*`, and vice versa.
