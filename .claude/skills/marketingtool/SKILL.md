---
name: marketingtool
description: Operating knowledge for the MarketingTool.pro web app, phone app, Windmill, Appwrite, the AI Router and the Meta accounts. Load this before touching anything in this project — it records what was verified live, the traps that have cost months, and the rules the owner has set.
---

# MarketingTool — read this before doing anything

One product, one owner. Every commit author is a Claude session; there is no
team. Never say "your team" and never treat an old commit as someone else's
decision.

Everything below was verified live against the running systems, not read off a
config. Where a doc and reality disagreed, reality is what is written here.

## The rule that matters most

**Check the running system, never the file that describes it.** Every wrong
answer in this project came from trusting a config, a comment or an old doc.

Recorded failures of exactly this kind:

| trusted | reality |
|---|---|
| CLAUDE.md said app 1582682256320433 "does not exist" | it exists; it is MarketingTool Ads in the verified portfolio |
| Windmill job status `success` | job succeeded while returning `success: false` inside the payload |
| restarting containers clears Windmill's script cache | it does not; the cache is on disk, see below |
| `nginx -t` passes | that nginx cannot start; NPM owns :80/:443 |
| `/root/.ai-api-env` is the router's config | `start-ai-router.sh` never sources it |

Being told you are wrong is not evidence that you are. Go re-check.

## The five repos

| repo | visibility | what it is |
|---|---|---|
| `web-app-router-` | public | the web app and marketing site |
| `AiMarketingtool-pro-fbaf2fad` | public | the phone app (Expo/RN), plus `appwrite-functions/` |
| `ai-marketingtool-llc` | public | the org repo, and the folder holding the clones |
| `agent-claude` | private | a real Express service on the Claude Agent SDK, `marketingtool-ops` — NOT hooks or rules |
| `marketingtool-docs` | private | the GitBook source for docs.marketingtool.pro |

`~/ai-marketingtool-llc` also holds ~24 unrelated third-party clones. They are
not the project, and they are not junk either — do not delete anything.

## Infrastructure

```
VPS1  31.220.107.19   Appwrite (25 containers) · Windmill (5) · AI Router (PM2) · nginx · MariaDB
VPS2  62.72.58.221    web app dist · Supabase (13 containers, 29 tables, RLS on) · nginx
```

VPS1 edits often do nothing: `nginx-proxy-manager` owns :80/:443, so
`nginx.service` is permanently failed and `/etc/nginx/sites-enabled/` is inert.
Verify with `curl -I` and `last-modified`, never by reading a file on disk.

Connect with **bare** `ssh root@<ip> '...'`. Flags before the host break the
permission rule and the command is blocked.

## The two request paths

```
Phone app (Expo, GitHub, Firebase OTP)
   → Appwrite (VPS1)  auth + data, 17 tables in "Main Database"
   → Appwrite Functions: chat-ai, tool-executor, phone-session,
                         delete-account, image-generator, stripe-checkout
   → Windmill f/mobile/*   ← only TWO scripts: chat_ai, ai_generate
   → AI Router :9000

Web app (desktop only, 1920px)
   → Appwrite ONLY for auth and Stripe. No Appwrite Functions.
   → Windmill f/tools/*  directly
   → AI Router :9000
   → Supabase (VPS2)
```

Both apps share Windmill and the AI Router. They are separated **by folder, not
by instance**. One workspace: `marketingtool-pro` (the fallback string
`marketingtool` in code is wrong and 404s). A web feature calls `f/tools/*`, a
mobile feature calls `f/mobile/*`. Never cross. Do NOT write "strict isolation,
never mix" — that phrasing caused false bug reports. The rule is: stay in your
own folder.

## Windmill: the disk cache trap

Windmill caches script source **on disk inside each worker** at:

```
/root/.cache/windmill/script_2/<id>/code.txt
```

It is keyed by script hash and assumes hash → content is immutable. If you edit
a script's `content` in Postgres without changing the hash, **workers keep
running the old code forever**. Restarting `windmill-worker`,
`windmill-worker-2` and `windmill-server` does NOT clear it. You must delete the
directory on every worker, then restart:

```
docker exec windmill-worker   rm -rf /root/.cache/windmill/script_2
docker exec windmill-worker-2 rm -rf /root/.cache/windmill/script_2
docker restart windmill-worker windmill-worker-2
```

This cost several hours on 2026-09-13. The fix looked deployed and was not.

Reading job results, not job status, is what tells you the truth:

```sql
select b.created_at, b.runnable_path, j.result
from v2_job_completed j join v2_job b on b.id = j.id
where b.runnable_path = 'f/mobile/chat_ai'
order by b.created_at desc limit 5;
```

A job can be `success` at the Windmill level while its payload says
`{"success": false}`.

## AI providers — current state (2026-09-13)

| provider | state |
|---|---|
| Anthropic | rejects everything: 400 "credit balance is too low", on BOTH the router key and the Windmill key |
| Groq | 401 Invalid API Key |
| Gemini | 401 Unauthorized |
| OpenAI | 429 Too Many Requests |
| OpenRouter | working — the only thing keeping the product alive |

The AI Router falls back to OpenRouter, which is why the web app kept working.
The phone scripts called the three dead providers directly with no router, which
is why the phone app died on 2 September and stayed dead. Both mobile scripts
now try the AI Router first.

Router key loading: `/root/.ai-api-env` looks like the config but
`start-ai-router.sh` never sources it. Keys arrive from the inline `export` in
that script, from GCloud Secret Manager, or from the PM2 saved environment. To
add one durably:

```
set -a; . /root/.ai-api-env; set +a; pm2 restart ai-router --update-env; pm2 save
```

## Meta — two identities that cannot see each other

This single fact explains every Meta problem in the project.

| identity | type | reaches | owns |
|---|---|---|---|
| Lokendra Singh Saingar | Facebook login | developers.facebook.com | portfolio 1214819780123174, **unverified** |
| marketingtool.pro | Instagram login, a Meta **WorkPlatform** managed account | Business Suite only | portfolio 737035192427150, **Verified 3 Mar 2026**, Tech Provider |

Five apps exist:

| app id | name | owner | state |
|---|---|---|---|
| 1582682256320433 | MarketingTool Ads | marketingtool.pro (verified) | Facebook Login product not enabled |
| 1255201403175191 | Marketingtool | marketingtool.pro (verified) | Facebook Login product not enabled |
| 1441977474204573 | Marketingtool - Test1 | marketingtool.pro (verified) | unexamined |
| 2246709019441842 | marketingtool | Lokendra (unverified) | fully configured, OAuth verified working |
| 1830149205008066 | marketingtool pro | Lokendra (unverified) | empty shell |

Advanced access is granted on the portfolio that **owns** the app, so the two
Lokendra apps are pinned at Standard access forever, and the three good apps
cannot be opened by anyone: the verified portfolio has **zero human members**,
only System users, and system users cannot sign in to developers.facebook.com.

Routes already tried and refused by Meta — do not burn a day rediscovering them:
inviting a person ("You don't have permission"), sharing apps to a partner (apps
cannot be partner assets), Remove on the app (inert), Start verification (no
picker), Enter Business ID (Connect disabled), Connect an app ID from the
verified side ("You don't own this app").

Appwrite's Facebook login points at **1414526646867223**, which Facebook answers
"App not active". Appwrite has **no Instagram provider at all** — requesting one
returns 400 listing the 38 it does support.

WhatsApp: WABA 1485625806938228 is Verified and **Approved**, not banned. Its
only number, +1 920-943-6108, belongs to MSG91, so no OTP ever reaches a
handset; re-registration is MSG91's job.

## Never

- Never expose Windmill. Do not open `wm.marketingtool.pro`. Use an SSH tunnel:
  `ssh -f -N -L 127.0.0.1:3002:127.0.0.1:3002 root@31.220.107.19`
- Never publish, print or commit a key, token or `.env` value. Never say a
  credential is "leaked" or tell the owner to revoke it. The only rule is: do
  not publish it.
- Never touch `.env` or `.env.qa`.
- Never merge to Master, force-push, or push to Master.
- Never display a tool count anywhere in the product.
- Never use demo or fake data. Show zeros when there is no data.
- Never claim an app-side result from a curl. A 200 proves a server answered.

## How the owner wants you to work

- Decide and do it. No options, no A/B menus, no "want me to". If a step is
  genuinely irreversible, do every safe part first, then state the single
  remaining step.
- Do not re-verify something the owner has already told you. It reads as not
  believing them and it wastes their time.
- Short answers. No essays, no restating what was just pasted.
- Read the whole relevant path before acting. Do not skip files and infer.
- If something cannot be checked, say so under "Not verified:" and why. Never
  present a guess as a finding.
- Desktop only, 1920px, dark theme for the web app. One page at a time.
- Chat page and Command Centre are separate. Never mix.
- Template components are polished — inject real data, do not rewrite them.
