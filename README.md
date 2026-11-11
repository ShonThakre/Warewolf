# Warewolf

A multiplayer **Werewolf** game. The default mode is Werewolf – Infection Edition at 20 players. Classic, Expanded, and Custom games run on the same engine through configuration.

The design lives in [docs/werewolf](docs/werewolf/implementation-plan.md). Task status is in the [implementation checklist](docs/werewolf/implementation-checklist.md).

Claude Code and Cursor Agent work on this repository together. Read [docs/AI-WORKFLOW.md](docs/AI-WORKFLOW.md) and claim work on [docs/AI-TASK-BOARD.md](docs/AI-TASK-BOARD.md) before changing files.

## Layout

| Path | Contents |
|---|---|
| `packages/domain` | Pure game rules and types. No framework, database, or network imports. A test enforces this |
| `packages/contracts` | Zod schemas shared by the API and the web client |
| `apps/api` | NestJS HTTP adapter, Drizzle schema, and migrations for PostgreSQL |
| `apps/web` | React and Vite client |
| `art` | Generated illustrations (PNG). The web build serves them as WebP. See [art/README.md](art/README.md) |
| `tools/art` | The `art:check` script |

## Requirements

- Node 22.12 or later
- pnpm 10
- Docker, for PostgreSQL

## Getting started

```sh
pnpm install
cp .env.example .env
pnpm db:up          # PostgreSQL 17 on localhost:5433
pnpm build          # domain and contracts must be built before the API runs
pnpm db:migrate
pnpm dev:api        # http://localhost:3000/api/v1/health
pnpm dev:web        # http://localhost:5173, proxies /api to the API
```

Compose maps PostgreSQL to port 5433 so it does not clash with a local server on 5432.

## Commands

| Command | Does |
|---|---|
| `pnpm build` | Builds every package in dependency order |
| `pnpm typecheck` | Type-checks every package |
| `pnpm test` | Unit tests. No database needed |
| `pnpm test:integration` | Migration tests against the PostgreSQL in `DATABASE_URL`. Each run creates and drops its own database |
| `pnpm db:migrate` / `pnpm db:rollback` | Applies all pending migrations, or reverts the latest one |
| `pnpm --filter @warewolf/api db:generate` | Generates a migration from `apps/api/src/db/schema.ts` |
| `pnpm art:check` | Checks the images in `art/` against `art/manifest.json` and shows what is still missing |

Drizzle has no down migrations. Each `apps/api/drizzle/<tag>.sql` needs a hand-written `apps/api/drizzle/down/<tag>.sql`, and a unit test fails without one.

## Conventions

- Workspace packages export TypeScript source under the `source` export condition. Vitest, Vite, and `tsc` read the source directly. Node reads `dist`.
- API routes live under `/api/v1`. Errors use `{ "error": { "code", "message" } }` with generic messages. Exception text is logged and never returned.
- Database `CHECK` constraints are generated from the domain enumerations. If you change an enumeration, run `db:generate`. A drift test fails until you do.
