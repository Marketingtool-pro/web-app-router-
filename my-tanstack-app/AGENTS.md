<!-- intent-skills:start -->
## Skill Loading

Before editing files for a substantial task:
- Run `pnpm dlx @tanstack/intent@latest list` from the workspace root to see available local skills.
- If a listed skill matches the task, run `pnpm dlx @tanstack/intent@latest load <package>#<skill>` before changing files.
- Use the loaded `SKILL.md` guidance while making the change.
- Monorepos: when working across packages, run the skill check from the workspace root and prefer the local skill for the package being changed.
- Multiple matches: prefer the most specific local skill for the package or concern you are changing; load additional skills only when the task spans multiple packages or concerns.
<!-- intent-skills:end -->

---

# my-tanstack-app — Project Context

A TanStack Start (React) application scaffolded with the TanStack CLI, demonstrating
the full TanStack ecosystem plus partner integrations (shadcn/ui, Neon, Drizzle).

> **Where this lives:** This app is a self-contained project in the
> `my-tanstack-app/` subdirectory of the `web-app-router-` repository. The
> repository root already contains an **unrelated** existing application (the
> "MarketingTool" React + Vite + MUI customer portal — see the root `CLAUDE.md`).
> Rather than overwrite that app, the complete TanStack CLI output was placed here
> intact. Run all commands below from inside `my-tanstack-app/`.

## Exact scaffold command

```bash
npx @tanstack/cli@latest create my-tanstack-app \
  --agent \
  --package-manager pnpm \
  --tailwind \
  --add-ons ai,shadcn,store,neon,drizzle,tanstack-query,table,form
```

Notes on the flags:
- `--tailwind` is **deprecated and ignored** by the current CLI — Tailwind (v4) is
  always enabled in TanStack Start scaffolds. It is kept here to match the requested command.
- Framework: **React**. Mode: **file-router**. TypeScript: **yes**.
- The CLI selected the **ai-chat** starter because the `ai` add-on was requested, and
  it pre-wired the example demo routes under `src/routes/demo/`.

## Follow-up TanStack Intent commands

```bash
npx @tanstack/intent@latest install   # wrote the intent-skills block at the top of this file
npx @tanstack/intent@latest list      # 11 intent-enabled packages, 43 skills
```

**Gotcha:** `intent install` *replaced* the richer CLI-generated `AGENTS.md` with just
the skill-loading block. The durable context below was authored by hand afterward.
Keep the `intent-skills` block at the very top so agents read it before task instructions.

Intent ships skills for these installed packages — **load the matching skill before
making library-specific changes instead of guessing**:
`@tanstack/ai` (10), `@tanstack/router-core` (10), `@tanstack/start-client-core` (7),
`@tanstack/devtools` (4), `@tanstack/devtools-event-client` (3), `@tanstack/react-start` (3),
`@tanstack/start-server-core`, `@tanstack/router-plugin`, `@tanstack/virtual-file-routes`,
`dotenv` (2). There are **no** Intent skills for DB / Hotkeys / Pacer / Virtual — those
demos were written against the installed packages' type definitions.

## Stack & integrations

| Area | Choice |
| --- | --- |
| Framework | TanStack Start + React 19 (file-based routing) |
| Build / toolchain | Vite 8, default CLI toolchain (esbuild), `@vitejs/plugin-react` |
| Styling | Tailwind CSS v4 (`@tailwindcss/vite`), shadcn/ui (`new-york`, base color `zinc`) |
| Routing | TanStack Router (`@tanstack/react-router`) + router plugin (route tree codegen) |
| Server data | TanStack Query (`@tanstack/react-query`) + `@tanstack/react-router-ssr-query` |
| Tables | TanStack Table (`@tanstack/react-table`) + match-sorter-utils |
| Forms | TanStack Form (`@tanstack/react-form`) |
| State | TanStack Store (`@tanstack/react-store`) |
| AI | TanStack AI (`@tanstack/ai*`) — Anthropic / OpenAI / Gemini / Ollama adapters |
| Database | Neon (serverless Postgres) + Drizzle ORM, drizzle-kit migrations |
| Devtools | `@tanstack/react-devtools` shell with Router / Store / Query panels |

### Additionally added (beyond the CLI add-ons) to demonstrate the full ecosystem

These were installed with `pnpm add` and each has a dedicated demo route:

| Library | Package | Demo route |
| --- | --- | --- |
| TanStack DB | `@tanstack/react-db` | `/demo/db` |
| TanStack Hotkeys | `@tanstack/react-hotkeys` | `/demo/hotkeys` |
| TanStack Pacer | `@tanstack/react-pacer` | `/demo/pacer` |
| TanStack Virtual | `@tanstack/react-virtual` | `/demo/virtual` |

TanStack CLI and TanStack Intent are **tooling** (used to scaffold/list skills), not
runtime dependencies.

## Project structure (key paths)

```
my-tanstack-app/
├─ src/
│  ├─ router.tsx              # getRouter() factory (+ Query SSR integration)
│  ├─ routes/
│  │  ├─ __root.tsx           # document shell, devtools, theme init
│  │  ├─ index.tsx, about.tsx
│  │  └─ demo/                # one route per integration
│  │     ├─ ai-chat.tsx, ai-image.tsx, ai-structured.tsx, api.ai.*.ts
│  │     ├─ store.tsx, table.tsx, tanstack-query.tsx
│  │     ├─ form.simple.tsx, form.address.tsx
│  │     ├─ neon.tsx, drizzle.tsx, guitars/
│  │     └─ db.tsx, hotkeys.tsx, pacer.tsx, virtual.tsx   # added libs
│  ├─ components/             # Header, Footer, ThemeToggle, ui/ (shadcn), demo-*
│  ├─ db.ts, db/index.ts, db/schema.ts   # Neon client + Drizzle
│  ├─ integrations/tanstack-query/        # query root provider + devtools
│  └─ lib/, hooks/, data/
├─ neon-vite-plugin.ts        # Neon Launchpad dev DB + db/init.sql seed
├─ drizzle.config.ts          # drizzle-kit config (reads DATABASE_URL)
├─ vite.config.ts             # devtools → neon → tailwind → tanstackStart → react
└─ routeTree.gen.ts           # GENERATED — do not edit (run `pnpm generate-routes`)
```

## Commands

```bash
pnpm install            # install deps
pnpm dev                # dev server on http://localhost:3000
pnpm build              # production build (Vite/esbuild — does NOT run tsc)
pnpm preview            # preview the production build
pnpm test               # vitest
pnpm generate-routes    # regenerate src/routeTree.gen.ts
# Drizzle:
pnpm db:generate | db:migrate | db:push | db:pull | db:studio
```

## Environment variables

Copy `.env.example` / `.env.local` and fill in as needed. `*.local` and `.env*` are
git-ignored; `.env.example` is committed as documentation.

| Variable | Required for | Notes |
| --- | --- | --- |
| `DATABASE_URL` | Neon + Drizzle (`/demo/neon`, `/demo/drizzle`) | Postgres connection string. In dev, the `vite-plugin-neon-new` plugin can auto-provision a free Neon Launchpad DB and seed it from `db/init.sql`. |
| `DATABASE_URL_POOLER` | Pooled connections (optional) | Present in `.env.example`. |
| `ANTHROPIC_API_KEY` | AI demos (default provider) | Claude adapter in `src/routes/demo/api.ai.chat.ts`. |
| `OPENAI_API_KEY` | AI image + OpenAI text/structured | `/demo/ai-image`, OpenAI adapter. |
| `GEMINI_API_KEY` | Gemini adapter (optional) | Alternative text provider. |
| `OLLAMA_HOST` | Local Ollama (optional) | Local model adapter. |

Without these the app still runs; only the corresponding demo routes degrade
(DB helpers return `undefined` when `DATABASE_URL` is unset; AI routes need a key).
Client-exposed values must be prefixed `VITE_` — none are required here.

## Deployment notes

- TanStack Start deploys to Cloudflare Workers, Netlify, Vercel, Node/Docker, Bun, or
  Railway. No deploy target is pinned; default output is a Node server (`pnpm build`
  emits `dist/client` + `dist/server`). See the `start-core/deployment` Intent skill.
- Set the env vars above in the host's dashboard. The Neon Launchpad dev convenience is
  dev-only — use a real `DATABASE_URL` in production.
- `db/init.sql` is the dev seed; production schema is managed via Drizzle migrations
  (`pnpm db:generate` → `pnpm db:migrate`).

## Key architectural decisions

- **Placed as a subdirectory** to avoid destroying the unrelated root app; the full CLI
  output is preserved intact (structure, deps, config, scripts).
- **Generated structure preserved.** Only additive changes were made: 4 new demo routes,
  4 nav links in `Header.tsx`, and 4 dependencies.
- **TanStack DB live queries are client-only.** `useLiveQuery` uses `useSyncExternalStore`
  without a server snapshot, so the `/demo/db` interactive list renders inside a
  `<ClientOnly fallback={…}>` boundary. The collection is `localOnlyCollectionOptions`
  (in-memory); swap for a query/electric/trailbase sync layer to make it durable.
- **Hotkeys** use the platform-adaptive `Mod` modifier (⌘ on macOS, Ctrl elsewhere).
  The `Hotkey` string type requires **uppercase** letter keys (`Mod+S`, not `Mod+s`).
- **Pacer** demo derives debounced + throttled values from one input and counts updates
  to show the rate reduction.

## Known gotchas

- **`tsc --noEmit` reports type errors in CLI-generated files** (it is not part of the
  build). The trivial dead-code findings flagged by the repo's code-quality gate were
  fixed (`src/router.tsx` unused imports, `src/routes/demo/ai-image.tsx` unused
  `useEffect`, a redundant `todos &&` guard in `src/routes/demo/neon.tsx`). ~6 remain in
  scaffold files (`drizzle.config.ts`, `src/lib/demo-store-devtools.tsx`,
  `src/routes/demo/api.ai.chat.ts`, `src/routes/demo/api.ai.image.ts`,
  `src/routes/demo/guitars/$guitarId.tsx`) — left as-is because fixing the AI-adapter ones
  risks behavior changes. `pnpm build` (esbuild, no type-check) passes and the app runs.
  The 4 added demo routes (`db/hotkeys/pacer/virtual`) are type-clean. There is no
  `typecheck` script by design.
- **Vite 8 peer warning:** `vite-plugin-neon-new` declares a peer of `vite@^6||^7` but the
  scaffold pins `vite@^8`. It is a warning only; build and dev both work.
- **Deprecation warnings** in dev for `createServerFn().inputValidator()` in `neon.tsx` /
  `drizzle.tsx` (use `.validator()`). Generated code; harmless.
- `routeTree.gen.ts` is generated — never hand-edit; re-run `pnpm generate-routes`.

## Next steps

- Provide a real `DATABASE_URL` (and run Drizzle migrations) to exercise the Neon/Drizzle demos.
- Add AI provider keys to use the chat/image/structured demos.
- Pick and configure a deploy target (Intent `start-core/deployment` skill).
- Optionally clean up the scaffold's pre-existing `tsc` errors and add a `typecheck` script + CI.
- Build real features under `src/routes/` using the Intent skills (`router-core`, `start-core`, `@tanstack/ai`).
