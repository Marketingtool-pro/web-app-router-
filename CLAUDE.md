# MarketingTool — Web App (Customer Portal)

> Every fact below was verified on 2026-09-12 against the running systems: SSH into
> both VPS, live HTTP probes, direct Postgres queries, and reading the shipped bundle.
> Anything that could NOT be verified is under "Not verified" at the end.
> Reality wins over older design docs. Do not "correct" this back to the aspirational
> version, and do not add a fact you have not just checked.
>
> NO SECRETS IN THIS FILE. Earlier versions carried a Windmill token, a Google client
> secret and three server passwords in plaintext. Never do that again. Reference
> credentials by where they live, never by value.

## The one rule that matters

**Check the running system, not the file that describes it.**

Verified failures of exactly this kind, all found in one night:

| trusted | reality |
|---|---|
| old doc: AI Router exposed, UFW inactive | firewalled; rules existed but matched the wrong port |
| old doc: ad_accounts 43 rows, campaigns 31 | 114 and 34 |
| grep of the main JS chunk: "no Appwrite in the April build" | Appwrite was in three separate appwrite-*.js chunks |
| engine-cc-meta looked broken, no AI Router call | its own comment says raw data only, by design |
| pnpm install exits clean | left simplebar-react unlinked; app would not boot |
| firewall rules present and correct-looking | 0 packets; Docker DNATs the port before filtering |

## Architecture (verified)

```
Customer -> React web app (UI only, no secrets)
   | Appwrite JWT in Authorization header
VPS 2 nginx (app.marketingtool.pro)
   | forwards customer JWT as X-Appwrite-JWT
   | injects the Windmill token server-side
   | 403s every admin path (variables, users, workers, workspaces, ...)
VPS 1 Windmill (31.220.107.19:3002, not public)
   | validates the JWT, queries Supabase with the service_role key
   | calls the AI Router
AI Router (127.0.0.1:9000 on VPS 1, never public)
```

Verified: nginx really does inject the token and 403 the admin paths.
/api/w/.../users/whoami returns 403 through app.marketingtool.pro.

### Infrastructure

| | VPS 1 | VPS 2 |
|---|---|---|
| IP | 31.220.107.19 | 62.72.58.221 |
| Runs | Appwrite (25 containers), Windmill (5), AI Router (PM2), nginx-proxy-manager, postfix | web app dist, Supabase (13 containers), nginx |
| DNS | marketingtool.pro, auth., wm., api., media. | app.marketingtool.pro |

**Appwrite endpoint is https://api.marketingtool.pro/v1** — not auth. Both hostnames serve
Appwrite, but only the api. callback is registered with Google. Changing this to auth.
breaks Google sign-in with redirect_uri_mismatch. Broken and fixed 2026-09-12. Do not
change it again.

### Ports — closed 2026-09-12

Only 80 and 443 are open on either box. These were all public and are now closed:
Windmill 3002, Appwrite API 8080, Appwrite Console 8081, proxy-manager admin 81,
Appwrite Traefik 8082 and 8443, Supabase gateway 8000 and 8443 on VPS 2, inbound SMTP 25.

**Why the old rules did nothing:** Docker DNATs a published port to the container's
internal port before the filter chain runs, so a rule matching --dport 3002 never matched
anything. Every such rule sat at zero packets. The working form matches the pre-DNAT port
with conntrack, using the ctorigdstport match. Rules are saved on both boxes and
netfilter-persistent is enabled.

wm.marketingtool.pro stays reachable so the owner can log into Windmill.
VPS 2 must reach VPS 1 on 3002, and VPS 1 must reach VPS 2 on 8000. Both are explicit
allow rules. Removing either breaks the app.

## AI Router

FastAPI under PM2 as ai-router, uvicorn on 127.0.0.1:9000, source at /root/app.py.

**It is not an agent.** One endpoint, POST /generate, takes a task and a prompt, makes one
provider call, returns the model and response. No memory, no loop, no tool use. Its only
logic: if the primary provider fails, retry the same prompt on OpenRouter and label the
response with whichever model answered.

Ten frozen task names, eight distinct models. creative, coding and default all map to Claude.

| task | model | provider |
|---|---|---|
| creative, coding, default | claude-sonnet-4-5 | Anthropic |
| research | gemini-2.5-flash | Google |
| image_gen | dall-e-3 | OpenAI |
| stable_image | sd3.5-large | Stability |
| video_gen | Kling | FAL.ai |
| vision_analysis | openai/gpt-4o | OpenRouter |
| ocr | qwen/qwen3-vl-8b-instruct | OpenRouter |
| automation | llama-3.3-70b-versatile | Groq |

vision_analysis and ocr require image_url or image_urls or they return 400.
Unknown task returns 400 with the valid list. Provider failure returns 502.
All ten verified answering on 2026-09-12. video_gen takes 5 to 6 minutes; a timeout
shorter than 400 seconds makes it look like a failure.

**Provider accounts:** Anthropic and OpenAI report no credits. Gemini and Groq keys are
rejected. The primaries therefore fail and OpenRouter serves the correct model family
instead. Fix the accounts, not the code.

**Keys:** the env file at /root looks like the config, but the live values come from the
PM2 saved environment. Editing that file alone does nothing, proven by removing a key from
it and finding the process still had it. To change a key durably: load the env file into
the shell with auto-export on, restart the PM2 process with the update-env flag, then
pm2 save.

## Page architecture

One engine and one router per page section, workers named by action, plus cron.
Roughly 10 tools per page, about 1 engine and 1 router each. Verified in Windmill:
65 engines, 38 routers, 40 chat workers, 2 cron jobs, all under f/tools/.

**Workers never produce the customer-facing answer.** A worker calls Meta's or Google's
API and returns raw data. The engine builds the prompt, hands it to the AI Router, then
parses, scores and saves. The GCloud agent is a worker in this sense too. It is not part
of the AI Router.

Folder rule: a web feature calls f/tools/*, a mobile feature calls f/mobile/*.
One workspace, marketingtool-pro. The fallback string marketingtool in code is wrong and
404s. The web Chat page used to call f/mobile/chat_ai. Fixed; the web app now contains no
reference to f/mobile at all.

### Every engine must

1. Validate the Appwrite JWT.
2. **Scope every Supabase query to the caller.** Windmill uses the service_role key,
   which bypasses RLS completely. RLS being on for all tables protects nothing here.
   dashboard-summary took a userId and never used it, so every customer saw every other
   customer's rows. Fixed 2026-09-12. Assume other engines have the same hole.
3. Call the AI Router for anything generated.
4. Write to generations, credit_usage, execution_logs.

Twelve of 65 engines do not write credit usage. Four of those also skip the JWT check.

## Stack — what is actually used

React 19.3, Vite 8.3, MUI 9.4 (paid SaasAble template), MUI X Pro 9.13, Tailwind 4.3.

Router is **react-router-dom v7**, mounted in App.jsx, used in 27 files.

TanStack: **Table only**, 17 files. TanStack Router is installed and appears in four .tsx
files that are never mounted, dead scaffolding from an abandoned migration, along with six
other unused TanStack packages. TanStack API keys are for their hosted services and are
not needed by this app.

Two vite.config files (.mjs is the live one) and two routes/index files exist for the same
reason. Confusing, not broken.

**MUI X Pro licence** is applied in src/config/muiLicense.js with an in-source fallback.
MUI validates it client-side so it ships in the bundle either way. It previously read only
env vars that do not exist, so setLicenseKey never ran and every Pro component was
watermarked despite the licence being paid for.

## Local development

```
docker compose -f local-stack/docker-compose.yml up -d
pnpm install
npx vite dev --port 3000 --mode qa
```

Windmill UI on 127.0.0.1:8000, app Postgres on 5433.
**Use 127.0.0.1, not localhost.** localhost does not resolve in some shells here and makes
a working server look dead.

Local Windmill starts empty. It has none of the f/tools scripts. Local runs against the
real Appwrite and the real Windmill by default.

vite.config.mjs pins optimizeDeps.entries and build.rollupOptions.input to index.html.
The repo contains around 210 stray .html files from unrelated tooling dumped into it
(buck2, direnv, pcre2, a vite playground). Vite treats each as an entry, the dependency
scan failed on them, and pre-bundling was skipped entirely. Do not remove those pins.

If the app will not boot with a missing-module error, the pnpm link tree is corrupt.
pnpm install will exit clean without fixing it. Move node_modules aside and reinstall.

## Deployment

The live web app is /root/web-app/dist on VPS 2. There is no git repo there, only a dist.
Deploy is a build, then a mirroring sync of the local dist folder into that path.

Before 2026-09-12 the live bundle was built on 12 April 2026 and was 274 commits behind.
Most of what looked unbuilt was built and never shipped.

Always back up the live dist first. Always verify Google sign-in afterwards, in a browser.

## Critical rules

- Desktop only, 1920px. No mobile responsive. The phone app is a separate repo.
- **Never touch the env files.**
- **Never put a secret in this file, in code, or in a commit.**
- Chat page and Command Centre are separate. Never mix.
- One page at a time. The owner says which.
- Never display a tool count anywhere.
- No demo or fake data. Show zeros when there is none. Ad Library shipped 1100 lines of
  invented ads with fake spend figures. Removed 2026-09-12.
- Read files before changing them. Grep one chunk of a bundle and you will conclude the
  wrong thing.
- Template components are polished. Inject real data, do not rewrite them.
- A 200 from curl proves a server answered, nothing more. Check the page in a browser.
- Do not offer options or ask "want me to". Decide, do it, report what changed.

## The recurring failure

Correct code, empty environment, output discarded. It appeared five times in one night:
the Appwrite endpoint, the Windmill URL, the MUI licence, the dashboard AI output that was
generated and thrown away, and the connected-accounts check that read a browser flag
instead of the database. The pages are further along than they look. The gap is wiring.

## Not verified

- No Google or Facebook sign-in completed end to end. That needs real credentials.
- f/tools/engine-chat is deployed with the right dependency lock but has never executed.
  It needs a browser call carrying a real JWT.
- Whether the Appwrite callback URLs are registered in the Google and Meta consoles.
  Only Google's rejection was observed, not the console contents.
- Supabase table count and per-table RLS were not re-counted on 2026-09-12.
- The other 11 engines missing credit-usage writes were listed, not read.
