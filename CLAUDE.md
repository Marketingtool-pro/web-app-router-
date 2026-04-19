# MarketingTool Web App — Customer Portal

## THIS IS A CUSTOMER PORTAL, NOT ADMIN

- Customers use this to manage their marketing
- Phone app is SEPARATE (different codebase, different platform)
- Web app is DESKTOP ONLY (1920px) — no mobile, no responsive
- User tells which page to work on — work ONE page at a time

## Architecture (LOCKED)

```
Web App → Appwrite (auth login + Stripe ONLY)
              ↓
       Windmill (JWT validation + logic) ← NEVER exposed
              ↓
       Supabase (Postgres database ONLY)
```

- Customer NEVER talks to Windmill or Supabase directly
- Phone app uses Appwrite for EVERYTHING (separate from web app)

## Stack

- React + Vite + MUI 7 (SaasAble template base)
- Appwrite = Auth login ONLY (JWT, OAuth: Google/Facebook/Apple, Email/Password) + Stripe payment
- Windmill = ALL backend logic (Python). Validates JWT, queries Supabase
- AI Router = localhost:9000 on VPS 1. Engines pass prompt, AI Router picks model, returns result
- Supabase = Postgres ONLY (28 tables, RLS on ALL 28). Auth DISABLED. Frontend NEVER queries
- Dark theme only, DESKTOP ONLY (1920px)

## How It Works (per tool)

1. Customer picks tool, fills input (JS — src/utils/api/windmill/index.js)
2. JS sends to Windmill engine (Python) with Appwrite JWT
3. Engine validates JWT → checks subscription/credits → builds prompt
4. Engine passes prompt to AI Router (localhost:9000) with task name
5. AI Router picks model (Claude/Gemini/Llama/DALL-E/Qwen) → returns raw result
6. Engine parses, scores, saves to Supabase (generations, credit_usage, billing_transactions)
7. Customer sees rich formatted result on 1920px UI

## Critical Rules

- **DESKTOP ONLY** — no mobile responsive. Phone app is separate.
- **Never touch .env or .env.qa** — contains secrets.
- **Chat page ≠ Command Centre** — completely separate, never mix.
- **Work ONE page at a time** — user tells which page.
- **No tool count numbers** — never show "207+" or any tool count anywhere.
- **No demo/fake data** — show zeros when no data.
- **Read files before changing** — always.
- **Template components are POLISHED** — inject real data, don't rewrite.
- **NOT just Facebook** — ALL ad platforms (Google, Meta, TikTok, any).
- Dev server: `npm run start -- --port 3001`

## Page Status

### WORKING (Done + Tested)

- `src/views/admin/dashboard/` — Dashboard (MUI 9 Pro)
- `src/views/admin/chat/` — Chat page (36 AI tools, 3 engines)
- `src/views/admin/command-centre/` — Command Centre (10 workflows)
- `src/views/admin/settings/` — Settings (Google, Meta, Instagram connected)
- `src/views/admin/analytics/` — Analytics (Rich Glass Morphism design)
- `src/views/admin/reports/` — Reports (3-tab Rich Builder UI)
- `src/views/admin/chart/` — Charts (Full Pro Gallery)

### PENDING (Not started yet — user will tell when to work)

- `src/views/admin/tools/` — Tools catalogue
- `src/views/admin/campaigns/` — Campaigns
- Meta Audit, Ad Library — not wired yet
- Stripe billing integration
- Platform page gating (7 platforms, 1 free tool each)

### PUBLIC PAGES (No auth, for Google/legal compliance)

- `src/views/legal/` — Privacy Policy, Terms, Cookie Policy, Trust & Verification, Delete Account

## AI Router (FastAPI — VPS 1 port 9000, PM2: ai-router)

**PM2, 10 models, server-side only, not exposed to internet**

Windmill calls `POST http://localhost:9000/generate` with `{"task": "...", "prompt": "..."}`.
Frozen task names — use these exactly in frontend, Windmill, API docs:

| Task            | Model              | Provider     | Use Case                                  |
| --------------- | ------------------ | ------------ | ----------------------------------------- |
| creative        | Claude Sonnet 4    | Anthropic    | Ads, blogs, captions, emails              |
| research        | Gemini 2.5 Flash   | Google       | SEO, competitors, analysis, reports       |
| coding          | Claude Sonnet 4    | Anthropic    | JSON, APIs, scripts, data pipelines       |
| image_gen       | DALL-E 3           | OpenAI       | Create images (logos, banners, ad images) |
| stable_image    | Stable Diffusion 3 | Stability AI | High-fidelity static images               |
| video_gen       | FAL.ai Video       | FAL          | AI-generated ad videos                    |
| vision_analysis | GPT-4o Vision      | OpenRouter   | Analyze images (ad creatives, UX)         |
| ocr             | Qwen3 VL 8B        | OpenRouter   | Read text from images/dashboards          |
| automation      | Llama 3.3 70B      | Groq         | Bulk tagging, classification, cheap jobs  |
| default         | Claude Sonnet 4    | Anthropic    | Everything else                           |

- vision_analysis and ocr require `image_url` or `image_urls` field
- Unknown tasks return 400 with valid task list
- Provider errors return 502 with clean error message
- AI Router is fully active and connected to engines server-side

## Windmill Scripts (VPS 1)

### Chat Page — 3 Routes, 3 Engines, 36 Tools

| Route                | Engine Script               | Tools                                  | AI Router Task       |
| -------------------- | --------------------------- | -------------------------------------- | -------------------- |
| `/chat/create-email` | `f/tools/engine-creative`   | 12 creative tools (emails, ads, blogs) | `creative` → Claude  |
| `/chat/automate`     | `f/tools/engine-automation` | 12 automation tools (campaigns, bids)  | `automation` → Llama |
| `/chat/insights`     | `f/tools/engine-insight`    | 12 insight tools (KPIs, analytics)     | `research` → Gemini  |
| Router               | `f/tools/ai-generate`       | Delegates to correct engine            | —                    |
| Chat AI              | `f/mobile/chat_ai`          | AI conversation                        | `default` → Claude   |

### Command Centre — 10 Workers (SEPARATE from chat)

| Script                              | Purpose                                    |
| ----------------------------------- | ------------------------------------------ |
| f/tools/run-workflow-api            | CC router — creates run, dispatches worker |
| f/tools/get-run-status              | Poll workflow run status                   |
| f/tools/worker-launch-google        | Google Search campaign                     |
| f/tools/worker-launch-meta          | Meta campaign                              |
| f/tools/worker-ab-test              | A/B test generator                         |
| f/tools/worker-bid-optimise         | Bid optimization                           |
| f/tools/worker-creative-refresh     | Creative fatigue detector                  |
| f/tools/worker-audience-expand      | Audience expansion                         |
| f/tools/worker-scale-winners        | Top performer scaler                       |
| f/tools/worker-kill-underperformers | Wasted spend killer                        |
| f/tools/worker-retargeting          | Retargeting funnel                         |
| f/tools/worker-cross-report         | Cross-platform report                      |

## Project Structure

- `src/views/admin/` — main app pages
- `src/views/legal/` — public legal pages (no auth)
- `src/sections/` — Reusable page sections (auth, billing, settings)
- `src/layouts/AdminLayout/` — Main layout with sidebar
- `src/menu/` — Sidebar navigation config
- `src/themes/` — MUI theme (palette, typography, overrides)
- `public/images/` — Media assets

## Deploy

- Build: `npm run build`
- Upload: `sshpass -p 'Clothvastr@123' rsync -avz dist/ root@62.72.58.221:/root/web-app/dist/`
- Domain: app.marketingtool.pro (VPS 2, nginx, SSL)

## Key Patterns

- MUI `sx` prop for styling
- Glass morphism: `rgba(248,248,248,0.04)` bg with `blur(50px)`
- Accent color: `#805AF5`
- Git: https://github.com/Lokeninfinitypoint/rrecot-MUi-local-docker-.git

## Pricing Plans

| Plan         | Monthly | Yearly  |
| ------------ | ------- | ------- |
| Starter      | $49/mo  | $199/yr |
| Professional | $99/mo  | $499/yr |
| All Tools    | $150/mo | $999/yr |
| Agency       | Custom  | Custom  |

## Trial & Gating Logic

- **7-day free trial**, **3 generations/day** during trial
- **36 chat tools** visible to all, gated by daily limit
- **Paid plans unlock**: unlimited generation, real data, automation
- Windmill checks `subscriptions` + `credit_usage` tables before every generation
- Tiers: `free`, `starter`, `pro`, `alltools`, `enterprise`/`agency`
