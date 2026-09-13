---
name: run-web-app-router
description: Build, run, screenshot and drive the MarketingTool web app locally. Use when asked to run the web app, start the dev server, take a screenshot of a page, smoke-test routes, click something in the UI, or reproduce a bug locally before deploying.
---

# Run the MarketingTool web app

React 19 + Vite 8 + MUI 9, desktop only. Driven headlessly through
`.claude/skills/run-web-app-router/driver.mjs`, which starts Vite if needed and
then talks to Chrome over the DevTools Protocol to navigate, read text, click by
label and screenshot.

All paths below are relative to the repo root (`web-app-router-/`).

## Prerequisites

Node **24**. `package.json` requires `>=22.13.0`, but `mise.toml` in this repo
pins **20.20.2**, so `node -v` gives you the wrong one and the driver fails with
`WebSocket is not defined`. Use the mise install directly:

```bash
/Users/loken/.local/share/mise/installs/node/24.21.0/bin/node -v   # v24.21.0
```

Chrome must be running with remote debugging on 9222. This machine already has
one on a dedicated profile; Chrome 153 refuses `--remote-debugging-port` on the
default profile, so a separate profile is required:

```bash
lsof -nP -iTCP:9222 -sTCP:LISTEN     # expect one Google Chrome LISTEN row
```

Dependencies are installed with pnpm 11 at the repo root. In a **git worktree**
there is no `node_modules`; symlink the main checkout's:

```bash
ln -sfn ../../../node_modules node_modules
```

## Run: the driver (agent path)

```bash
NODE=/Users/loken/.local/share/mise/installs/node/24.21.0/bin/node

$NODE .claude/skills/run-web-app-router/driver.mjs smoke
$NODE .claude/skills/run-web-app-router/driver.mjs text  /login
$NODE .claude/skills/run-web-app-router/driver.mjs shot  /register /tmp/register.png
$NODE .claude/skills/run-web-app-router/driver.mjs click /login "Sign in with Facebook"
```

`smoke` output from this session:

```
[driver] dev server already up at http://localhost:5173
  OK   /login                   Sign In Welcome back! Select the method of login. Sign in with Google...
  OK   /register                Sign Up Sign Up for free. No credit card required. or continue with email...
  OK   /dashboard/analytics     Sign In Welcome back! Select the method of login...
  OK   /tools                   Sign In Welcome back! Select the method of login...
  OK   /chat                    Sign In Welcome back! Select the method of login...

all routes rendered
```

The driver starts Vite itself if the port is free, so you normally do not start
the server by hand. Override with `PORT`, `HOST` or `CDP` env vars.

## Run: by hand (human path)

```bash
node_modules/.bin/vite dev --port 5173 --strictPort
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:5173/     # 200
```

`pnpm dev` uses port 3000, which is usually already taken on this machine.

## Build

```bash
node_modules/.bin/vite build     # "✓ built in 3.35s", output in dist/
```

## Gotchas

**Use `localhost`, never `127.0.0.1`.** They are not interchangeable here.
Appwrite has `localhost` registered as a Web platform and does not have
`127.0.0.1`, so every OAuth attempt from `127.0.0.1` dies before it reaches the
provider:

```
Error 400
Invalid `success` param: Invalid URI. Register your new client (127.0.0.1)
as a new Web platform on your project console dashboard
```

Verified by probing the Appwrite OAuth endpoint: `http://localhost:5173`,
`http://localhost:3000` and `https://app.marketingtool.pro` are all accepted;
`http://127.0.0.1:5173` is rejected.

**Every protected route silently renders the login page.** `/dashboard/analytics`,
`/tools` and `/chat` all report `OK` in `smoke` while showing "Sign In", because
`AuthGuard` swaps the tree without changing the URL. A route "rendering" is not
evidence the page works. Log in first, or assert on page text rather than status.

**Port 3000 is usually occupied** by another Node process, and `pnpm dev` hard-codes
it. Vite then exits with `Port 3000 is already in use`. Use 5173.

**In a worktree, fonts 404.** With `node_modules` symlinked out of the tree, Vite
refuses to serve files outside its allow list:

```
The request id ".../@fontsource/sora/files/sora-latin-400-normal.woff2"
is outside of Vite serving allow list.
```

The app still renders; only webfonts fall back. Run from the main checkout if
that matters.

**MUI buttons ignore `element.click()`.** The driver synthesises real
`Input.dispatchMouseEvent` sequences with a `mouseMoved` first. Without the
hover event, some MUI and Meta Business Suite controls never fire.

**Clicking Facebook on the local login page leaves you on `/login`.** That is
correct behaviour today, not a driver bug: Appwrite's Facebook provider points at
Meta app `1414526646867223`, which Facebook answers "App not active", so the flow
bounces back to the failure URL. Google reaches the real Google account chooser.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `WebSocket is not defined` | You ran the driver on Node 20. Use the Node 24 path above. |
| `no CDP page target` | Chrome is not listening on 9222. Start it with a separate profile and `--remote-debugging-port=9222`. |
| `Port 3000 is already in use` | Use `--port 5173`, or `lsof -nP -iTCP:3000 -sTCP:LISTEN` and stop the other process. |
| `Invalid success param ... 127.0.0.1` | Navigate to `localhost`, not `127.0.0.1`. |
| `page did not render` | Vite is up but the bundle threw. Read the dev-server log; a stale `optimizeDeps` cache is the usual cause. |

## Related

The `marketingtool` skill holds the architecture, the Meta account state and the
auth findings. Read it before changing anything that touches login, Windmill or
the AI Router.
