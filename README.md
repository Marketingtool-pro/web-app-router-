# MarketingTool — Web App (customer portal)

Customer portal served at `app.marketingtool.pro` from VPS 2. Desktop only (1920px), dark theme.
Read `CLAUDE.md` before changing anything — it records what is actually running.

## Stack

- React 19 + Vite 8, routed by `react-router-dom` 7 (`src/routes/`).
- UI: the **SaaSAble** template (paid, one-time purchase, ships source — no licence key) on
  **MUI Material 9**.
- **MUI X Pro 9** (`@mui/x-charts-pro`, `@mui/x-date-pickers-pro`, `@mui/x-data-grid-pro`) — paid
  annual licence. `src/config/muiLicense.js` reads `VITE_MUI_X_LICENSE_KEY` (or
  `VITE_APP_MUI_X_LICENSE_KEY`) from `.env`; without it every Pro component shows the
  "MUI X Missing license key" watermark. The key is never committed.
- Tables: `@tanstack/react-table` — the only TanStack package in use.
- Auth: Appwrite (`https://api.marketingtool.pro/v1`). Backend logic: Windmill `f/tools/*`
  through the VPS 2 proxy. Data: Supabase on VPS 2, reached only by Windmill.

## Commands

Node 22 and pnpm 11 (pinned by `.nvmrc` / `packageManager`).

```bash
pnpm install
pnpm dev        # local dev server
pnpm test       # vitest
pnpm lint       # eslint
pnpm build      # production bundle in dist/
```

## Build and deploy

A build needs the gitignored `.env` in the repo root (variable names are listed in `CLAUDE.md`).
Without it the bundle falls back to `localhost` for Appwrite and **nobody can log in**. Follow the
deploy procedure and its must-be-present / must-be-absent checks in `CLAUDE.md`.
