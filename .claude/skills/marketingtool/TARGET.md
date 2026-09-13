# The target architecture — stated by the owner, NOT yet built

This is the design. It has been explained many times and re-explained because it
was never written down. It is not a proposal and it is not up for redesign.
Read it before suggesting any architecture change.

The 2026-09-11 audit confirms it does not exist yet: "The GCloud Agent Worker
track does not exist. `marketingtool-agent` is not deployed in project
`marketing-tool-484720`."

## The shape

```
Page (desktop 1920px)
  └── its own JS input/output layer  (src/utils/api/windmill/index.js)
        └── its own Windmill engine   (1 engine per page)
              └── its own GCloud Agent Worker
                    ├── calls Meta / Google / platform APIs   ← REAL DATA
                    └── hands that real data to the AI Router
                          └── AI Router analyses it and returns
                              the polished, rich, customer-facing result
```

Per page, roughly: **10 tools → 10 Python scripts → 1 engine → 1 router path →
1 worker**, plus JWT validation and a cron job.

## The rules that define it

**The worker and the AI Router are separate things. Never mix them.** A GCloud
Agent Worker behaves like a Windmill worker. Its job is to reach out to Meta,
Google and every other vendor API and bring back **real data**. It does not
produce the answer. It hands the real data to the AI Router, and the AI Router
produces the answer.

**The worker returns data, not results.** Results only ever come from the AI
Router, so that every customer-facing answer is analysed and polished the same
way.

**All ten models stay active.** The router's task table is frozen: each task
uses its own provider. Do not reroute Claude, Gemini or Llama through
OpenRouter to make a task "work" — that is the silent downgrade this whole
document exists to prevent. If a provider is down, that is an account fix, not
a routing change.

**Every page works the same way.** Same engine-router-worker shape, same JWT
check, same cron job, same rich output, and a download option on every page.

**Desktop only, 1920px.** No mobile. The phone app is a separate repo and a
separate stack.

**Everything is API based.** Know the API before writing the worker.

**Nothing gets dropped.** MUI 9 and MUI X Pro, TanStack, every paid package and
every licence key stays in play. Do not remove things because they look unused
without checking what imports them.

## What exists today versus this target

| piece | target | today |
|---|---|---|
| JS input/output per page | yes | exists, `src/utils/api/windmill/index.js` |
| Windmill engine per page | yes | exists, 908 scripts under `f/tools/`, 424 referenced by the frontend |
| GCloud Agent Worker per page | yes | **does not exist at all** — no Cloud Run service |
| AI Router produces the result | yes | yes, but 6 of 10 tasks silently downgrade |
| Real vendor data reaching the router | via the worker | today the engines call Meta directly, with one shared account token |
| Cron job per page | yes | only `cron-sync-platforms` and `campaign-scheduler` observed running |
| Download on every page | yes | not implemented |

So the gap is not the router and not the engines. It is the **worker layer**,
which was specified and never built, and the fact that engines currently do the
worker's job themselves using one shared Meta token instead of each customer's
own stored `ad_accounts.access_token`.

## The trap this design prevents

The router must never claim one provider while another answers. That is exactly
what happens today: five text tasks say Claude or Gemini and answer as a
cheaper model, because three provider accounts are failing and the fallback is
silent. "Ten models always active, not cheat here" is the requirement. Fixing
it means fixing the accounts, not the routing.
