# MarketingTool — full reference

Everything verified about this project. Read alongside `SKILL.md`.

## The stack (all paid — nothing here is junk)

React 19.3 · Vite 8.3 · MUI 9.4 (paid SaasAble template) · MUI X Pro 9.13 ·
Tailwind 4.3 · react-router-dom v7 · pnpm workspaces.

TanStack **Table** is used, in 17 files. TanStack **Router** is installed but
currently unmounted — 4 `.tsx` files nothing imports. Routing today is
react-router-dom.

**Do not delete the TanStack packages.** Everything in this project is paid,
including all of TanStack, MUI and MUI X Pro, npm packages, Docker, and even the
icons, images and GIFs. The only things here that are not paid are **Tailwind,
Vite and react-router-dom**. An earlier version of this file called the TanStack
Router scaffold "safe to delete" — that was wrong, and acting on it would throw
away something the owner paid for. Unused today does not mean disposable.

Composer and `composer.phar` are real and used (Laravel Forge SDK, phpdoc).
The root `pyproject.toml` belongs to **node-gyp**, not to us; it declared
packages that do not exist and did not parse at all until fixed.

## The one bug pattern that explains most of this project

**Correct code, empty environment, output discarded.** Five separate instances:

1. `src/config/muiLicense.js` read only env vars that were never set, so the
   paid MUI X Pro licence never applied. Now falls back to the embedded key.
2. Appwrite endpoint pointed at `auth.` instead of `api.`, which broke Google
   sign-in. It must be `https://api.marketingtool.pro/v1`.
3. `VITE_WINDMILL_URL` override removed; `API_BASE` in
   `src/utils/api/windmill/index.js` is hardcoded to
   `https://app.marketingtool.pro` so the VPS2 proxy is actually in the path.
4. `fetchAnalyticsOverview` generated `aiAnalysis`, `aiRecommendations`,
   `aiForecast` and `automationRules` that **no page ever rendered**. Now shown
   by `src/sections/dashboard/analytics/AiInsights.jsx`.
5. Connected accounts were read from a browser flag
   `localStorage("fb_ads_connected")` instead of the database. Now
   `fetchConnectedAccounts({ userId })`.

Before writing new code, check whether the thing already exists and is simply
not wired up. `checkSubscription` and `LockedPageOverlay` both existed unused;
`src/components/PlanGate.jsx` now uses them.

## Frontend to Windmill wiring (audited)

417 script paths are called from the frontend; **414 exist**. The three misses
are two dead exports with zero callers and one template-literal artefact. Do not
"fix" those without checking callers first.

Engine scoping sweep: **60 of 61** Supabase-touching engines scope their queries
by user. The one that does not, `engine-ad-library`, defines `supabase_req` and
never calls it.

Supabase is reached only by Windmill, using the **service_role** key, which
bypasses row level security entirely. Per-query user scoping is therefore
mandatory. The pattern used across engines:

```python
if not userId:
    return {"hasData": False, "error": "Authentication required"}
scope = "user_id=eq." + str(userId) + "&"
```

## Invented data that was removed — do not reintroduce

- `SAMPLE_ADS` in `src/views/admin/ad-library`: 1100 lines of fake advertisers
  and a fake $185,000 spend. Deleted; the file went 2588 to 1493 lines.
- `f/tools/dashboard-summary` computed revenue as `total_conv * 45` in three
  places. Replaced with real `total_revenue` sums.
- `f/tools/engine-meta-audit` invented `financialImpact`, `wastedSpend`,
  `currentROAS` and `savingsEstimate` when no Meta data existed. Now guarded
  with `NO_ACCOUNT_DATA`.
- `f/tools/engine-ad-library` merged invented ads into real `ads`. They are now
  separated into `aiConcepts`.
- `f/tools/meta-webhook` used `except: pass`, hiding a 404 against a
  `webhook_logs` table that does not exist, and still returned `success: true`.
  It now counts `stored`, `failed` and `errors`. It also does no
  `X-Hub-Signature-256` verification.

The owner's rule: **no demo data, no fake data, show zeros.**

## Release pipeline

The GitHub org policy allows only actions owned by `Marketingtool-pro`. Any
workflow with `uses:` referencing `actions/checkout`, `actions/setup-node` or
`expo/expo-github-action` dies at `startup_failure` before a step runs. The
workflows that work have **zero `uses:` lines**:

```
android-deploy-selfcontained.yml   uses=0   build + submit
ios-deploy-selfcontained.yml       uses=0
windmill-deploy.yml                uses=0   needs a Windmill credential it does not have
```

`codeql.yml` and `laravel.yml` are remote-only, unpinned, and failing.

EAS also builds on **any branch push** through its GitHub integration. That path
builds but never submits, and it spends the owner's build minutes. Do not push
branches casually.

`expo-updates` OTA ships JavaScript only. A native manifest change (intent
filters, ABIs) **requires a new build** and can never go out as an OTA.

Two related traps already hit: `eas.json` says `appVersionSource: local` but EAS
assigns build numbers remotely, and `eas submit` reads
`expo.android.versionCode` from `app.json`, not from `eas.json`.

## Known broken — do not assume these work

- VPS1 public ports: 3002 (Windmill), 8081 (Appwrite Console), 81 (nginx proxy
  manager admin), 8080, 8082, 8443, 25. Only 9000 is firewalled.
- A Windmill credential ships inside the public JS bundle at `/assets/index-*.js`.
- `/api/tools/` on VPS2 proxies to VPS1 `:3001` — nothing listens there, always 502.
- The Google Ads Agent proxy (`/api/google/` to Cloud Run) is commented out in nginx.
- `web-app.bak` is still in `sites-enabled`, causing a duplicate server-name warning.
- Meta webhooks: zero subscriptions. `api.marketingtool.pro/webhook` returns 404.
  `f/tools/meta-webhook` exists and is active but Meta has never been told to
  call anything, and there is no public endpoint for it to reach.
- 11 engines never write to `credit_usage`, so their usage goes uncharged.

## Google side

The Google Ads developer token is now **Basic Access**; older notes saying Test
Access only are stale. Basic Access can reach real accounts.

Requested OAuth scopes were trimmed from 9 to 5: `adwords`,
`adsense.readonly`, `analytics.readonly`, `adsdartsearch`, `doubleclicksearch`,
plus `email profile`. Removed: `adsense` write, `analytics.manage.users`,
`adsdatahub`, `realtime-bidding`, `service.management`. The Google Cloud console
Data Access page still lists about 27 scopes and must be trimmed to match.
**Console edits do not restart review** — you must reply to the Trust and Safety
email.

Google sign-in uses client id `911925145433-...apps.googleusercontent.com` and
the Appwrite callback `https://api.marketingtool.pro/v1/account/sessions/oauth2/callback/google/6952c8a0002d3365625d`.

## Appwrite

Six functions, all enabled and live, all node-16.0: `chat-ai`, `tool-executor`,
`phone-session`, `delete-account`, `image-generator`, `stripe-checkout`.
The first five serve the **phone app**; only Stripe Checkout relates to the web
app. The web app uses Appwrite for **auth and Stripe only** — no functions.

Phone data lives in Appwrite "Main Database", 17 tables, including `otps`,
`chat_sessions`, `chat_messages`, `credit_usage`, `tool_runs`, `tool_outputs`,
`tools_catalog`, `subscriptions`, `user_entitlements`, `users`, `favorites`,
`generations`, `campaigns`.

Project id `6952c8a0002d3365625d`. Console at `api.marketingtool.pro/console`.
Provider settings need the `projects.write` scope, which is console-only; an
Appwrite API key cannot change them. `oAuthProviders` is encrypted at rest, so
reading the database tells you nothing — probe the live OAuth endpoint instead.

## Local development

`local-stack/docker-compose.yml` brings up Windmill (server, worker, database)
plus a Postgres standing in for Supabase:

```
docker compose -f local-stack/docker-compose.yml up -d
# Windmill UI  http://localhost:8000
# App Postgres localhost:5433
```

Both databases use trust auth, so there are no passwords in the file and nothing
in it is safe to expose beyond the machine.

`vite.config.mjs` pins `optimizeDeps.entries` and `build.rollupOptions.input` to
`index.html`, because about 210 stray `.html` files in the repo broke dependency
scanning.

`.qlty/qlty.toml` carries about 39 exclude patterns for the foreign tool
directories. Without them qlty lints thousands of unrelated files and its eslint
and prettier plugins die on their configs.

## Verified working end to end

- Smart Dashboard: 18 seconds, AI rendered, user-scoped, real data.
- Web AI Chat: its own engine `f/tools/engine-chat`, JWT validated, a `chat` row
  confirmed in `credit_usage`.
- Meta ads-connect via app 2246709019441842: 15 of 15 scopes granted, 3 real ad
  accounts returned, one with 7193 INR of spend.
- Phone chat after the 2026-09-13 fix: `success: true`, `provider: ai-router`.

## Still pending

Page-by-page work has not been done on Campaigns, 360 Meta Audit, Analytics,
Reports, Chart, and the 7 platform pages. The owner's estimate is 70% remaining.

## Mistakes made in past sessions — do not repeat

- Claimed `/opt/homebrew` was not a Homebrew prefix, from a stale comment. It is.
- Verified `.zshrc` under Apple's zsh when the shell is MacPorts zsh 5.9.2.
- Concluded three servers were dead because `localhost` does not resolve in that
  shell; `127.0.0.1` does.
- Grepped only the main JS chunk and concluded the bundle had no Appwrite. It
  was in three `appwrite-*.js` chunks. That wrong reading produced a false claim
  that Appwrite login had never worked in production.
- Broke Google sign-in by hardcoding `auth.marketingtool.pro/v1`.
- Deployed before reading a message asking to verify locally first.
- Closed port 8000 and broke VPS1 to VPS2 Supabase.
- Disabled `wm.marketingtool.pro`, which the live app depends on, then had to
  restore it.
- Reported three AI Router tasks as broken when the failures were the test's own
  fault: an undownloadable image, a transient rate limit, and a timeout set
  shorter than the real generation time.
- Changed `FB_APP_ID` away from `1582682256320433`, which was correct all along.
- Called about 35 third-party directories "junk". They are paid tools.
- Edited a Windmill script in the database without clearing the on-disk worker
  cache, then reported it as deployed three times while the old code ran.
