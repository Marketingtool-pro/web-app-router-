# The target architecture — stated by the owner. This is final.

This design has been explained many times and re-explained because it was never
written down. It is not a proposal and it is not open to redesign. Read it
before suggesting any architecture change.

## The shape, per page

```
Page  (desktop only, 1920px)
  └── its own JS input/output      src/utils/api/windmill/index.js
        └── its own engine          Windmill Python
              └── its own worker    Windmill Python  ← a py script, NOT Cloud Run
                    ├── calls Meta / Google / every tool's API   → REAL DATA
                    └── hands that data to the AI Router
                          └── AI Router analyses and polishes
                                → the rich result the customer sees
  + JWT on every call
  + its own cron job
  + a download option
```

Roughly: **10 tools → 10 Python scripts → about 1 engine and 1 router path per
page.** Every page is built the same way. No page is special.

## The worker is a Python script in Windmill

Say it plainly, because getting this wrong wastes days: **the worker is a py
script in Windmill.** "GCloud agent worker" means a worker that *behaves like a
Windmill worker* — same role, same shape. It does not mean the result must live
on Cloud Run. An earlier version of this file recorded the worker as a missing
Cloud Run service. That was wrong.

**The worker and the AI Router are separate and must never be mixed.**

- The **worker is API work, and only API work.** That is its whole definition.
  It reaches out to **Meta, Google and every other tool's API** and brings back
  **real data**. It never writes the answer and never calls a model.
- The **AI Router** receives that real data and produces the answer. Every
  customer-facing result — text, image, video, anything — comes from the router,
  so everything is analysed and polished the same way.

Worker returns data. Router returns results. Never the other way round.

**The AI Router serves the customer, always.** Whatever the customer sees — text,
an image, a video, an analysis — came out of the router. That is what makes
every result correct and rich in the same way, on every page.

## Ads Connect is SEPARATE from login

Two different Meta apps, two different flows. Confirmed twice: from the owner's
own architecture note, and independently by reading Business Manager on
2026-09-13.

| purpose | Meta app | scope |
|---|---|---|
| Login | **1255201403175191** "Marketingtool" | email and profile only, through Appwrite OAuth |
| Ads Connect | **1582682256320433** "MarketingTool Ads" | ads scopes, its own separate OAuth flow |

Appwrite OAuth is login and nothing else. Ads Connect is a separate popup
(`ConnectAdsModal`) shown on first login, where the customer connects their own
ad accounts. Google works the same way with the `adwords` scope.

**Each customer's token is theirs.** The token from that flow is saved to
Supabase `ad_accounts`, keyed by `user_id`. Workers must read **that customer's
own token** from `ad_accounts` and show **their** real ads. Today the engines
use one shared account token instead, so every customer sees the same figures.
That is the bug the worker layer exists to fix.

**Ad creatives are real, never generated.** Images, video and carousels on the
ads pages come straight from the platform API. The AI Router analyses and
polishes the result around them, but it never invents the creative. An AI-made
image where a real ad belongs is fake data.

## Ten models stay active. Do not cheat.

The router's task table is frozen. Each task uses its own provider. Never
reroute Claude, Gemini or Llama through OpenRouter to make a task "work" — that
is the silent downgrade that makes the product lie about which model answered.
If a provider fails, that is an **account fix**, never a routing change.

No fake data. No demo data. No placeholder results. Real results, always rich.

## Output rule — 5 results, 3 free, 2 locked

Confirmed in `src/views/admin/chat/ToolInlineForm.jsx`:

```js
{sorted.slice(0, 5).map((v, i) => {
  const isLocked = !isPaid && i >= 3;
  const isBest   = i === 4;
```

- Always produce **5** variants. Never one or two.
- Indexes 0-2 are shown free. Indexes 3 and 4 are blurred
  (`blur(8px) brightness(0.3)`) behind a paid overlay that links to `/pricing`.
- Index 4 is flagged as the best one.
- `tools.json` also exposes an `outputCount` select with options `3`, `5`, `10`.

The two locked slots unlock with a one-time purchase. This applies inside the
**web app** only.

## Everything stays

MUI 9 and MUI X Pro, TanStack Table, every paid package, every licence key. Do
not remove something because it looks unused without checking what imports it.
This project is built from paid components.

## Who built this, and the one hard security rule

Every line of this project was created by Claude Opus sessions on the owner's
Mac, with full MCP access. There is no team and there never was. Do not say
"your team", do not treat an old commit as another person's decision, and do not
tell the owner a past session's work was somebody else's mistake.

Because of that, credentials pass through these sessions constantly. The rule is
narrow and absolute:

- **Never publish, print or commit a key, a token, or any environment value.**
  Not in a commit, not in a file in the repo, not in a message.
- **Never call a credential "leaked"** and never tell the owner to revoke one.
  That is not the concern here. The only rule is: do not publish it.
- The environment files are never touched, never printed, never committed.
- When a credential is genuinely needed to debug, read it from the running
  process or container's own environment and use it without echoing it.

## What exists today versus this target

| piece | target | today |
|---|---|---|
| JS input/output per page | yes | exists |
| Engine per page (Windmill py) | yes | exists — 908 scripts under `f/tools/`, 424 referenced by the frontend |
| Worker per page (Windmill py) | yes | **not separated** — engines call Meta themselves instead of a worker doing it |
| AI Router produces the result | yes | yes, but tasks silently downgrade when a provider account fails |
| Real vendor data via the worker | yes | engines use **one shared** Meta token, not each customer's `ad_accounts.access_token` |
| Cron job per page | yes | only `cron-sync-platforms` and `campaign-scheduler` seen running |
| 5 results, 3 free 2 locked | yes | implemented in ToolInlineForm |
| Download on every page | yes | not implemented |

So the two real gaps are: the **worker layer is not separated out** of the
engines, and each customer's own stored access token is not used.

## Order of work

Page by page. The owner says which page. For each page: its engine, its worker,
its router path, its JS input/output, its JWT check, its cron job, its download.
Do not start a second page before the first is finished.
