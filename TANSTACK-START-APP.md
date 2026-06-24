# TanStack Start app — `my-tanstack-app/`

This repository's root contains the existing **MarketingTool** customer portal
(React + Vite + MUI — see `CLAUDE.md`). A separate, self-contained **TanStack Start**
application was scaffolded into the [`my-tanstack-app/`](./my-tanstack-app) subdirectory.

It was placed in a subdirectory (rather than overwriting the existing app) so the
complete TanStack CLI output — structure, dependencies, config, and scripts — is
preserved intact without disrupting the MarketingTool codebase.

## Quick start

```bash
cd my-tanstack-app
pnpm install
pnpm dev      # http://localhost:3000
```

## What it demonstrates

TanStack **Start, Router, Query, Table, Form, Store, DB, AI, Hotkeys, Pacer, Virtual**
(scaffolded/added via TanStack **CLI** + **Intent**), plus shadcn/ui, Neon, and Drizzle.
Each integration has a demo route under `my-tanstack-app/src/routes/demo/` and is linked
from the app header's "Demos" menu.

See [`my-tanstack-app/AGENTS.md`](./my-tanstack-app/AGENTS.md) for the exact scaffold
command, the TanStack Intent commands, the chosen stack, environment variables,
deployment notes, architectural decisions, known gotchas, and next steps.
