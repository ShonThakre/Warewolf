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
pnpm dev:api        # http://localhost:3000/api/v1/health (liveness), /api/v1/health/ready (database reachable)
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
| `pnpm --filter @warewolf/web android:sync` | Builds the web client and copies it into the Android project in `apps/web/android` (Capacitor) |
| `pnpm --filter @warewolf/web android:apk` | Sync, then build `apps/web/android/app/build/outputs/apk/debug/app-debug.apk`. Needs a JDK 21 and the Android SDK; see "Android debug APK" below |

Drizzle has no down migrations. Each `apps/api/drizzle/<tag>.sql` needs a hand-written `apps/api/drizzle/down/<tag>.sql`, and a unit test fails without one.

## Conventions

- Workspace packages export TypeScript source under the `source` export condition. Vitest, Vite, and `tsc` read the source directly. Node reads `dist`.
- API routes live under `/api/v1`. Errors use `{ "error": { "code", "message" } }` with generic messages. Exception text is logged and never returned.
- Database `CHECK` constraints are generated from the domain enumerations. If you change an enumeration, run `db:generate`. A drift test fails until you do.

## Hosting on Render

`render.yaml` is a Render Blueprint: one Docker web service built from the root `Dockerfile`, and one PostgreSQL 17 database. The image builds the web client and the API, and the API serves the client (`WEB_DIST_DIR`), so pages, `/api`, and Socket.IO share one origin. Migrations run before the API listens. Render redeploys on every push to `main`.

1. In the Render dashboard choose **New > Blueprint**, connect GitHub, and pick this repository. Render reads `render.yaml`, shows the two resources and their monthly cost, and creates them on **Apply**.
2. When the first deploy is live, the game is at `https://warewolf-<suffix>.onrender.com`. `GET /api/v1/health/ready` should answer `{"status":"ok","database":"ok"}`.

Keep the service at one instance. Phase deadlines are in-process timers and Socket.IO rooms are in memory. Both resources use Render's free plans. The free web service sleeps after 15 idle minutes, and the first visit after that waits about a minute while it wakes. The free database expires 30 days after creation. For an always-on service with a database that stays, set the plans to `starter` and `basic-256mb` (about $13 a month).

To try the same image locally: `docker build -t warewolf .`, then run it with `-p 3000:3000 -e DATABASE_URL=...`. `compose.prod.yaml`, the two-container nginx stack, still works as before.

## Android debug APK

The APK is the same web client in a WebView (OD-71). A phone cannot reach `localhost` on your computer, so the build names the API by its address on your network.

1. Tools, once: `brew install openjdk@21` and `brew install --cask android-commandlinetools`, then `sdkmanager "platform-tools" "platforms;android-36" "build-tools;36.0.0"` and `yes | sdkmanager --licenses`. Put `sdk.dir=/opt/homebrew/share/android-commandlinetools` in `apps/web/android/local.properties` (ignored by git).
2. Start the API so the WebView may call it: `CORS_ORIGINS=http://localhost pnpm dev:api` for a LAN debug build, or `https://localhost` when the API is served over HTTPS.
3. Build: `JAVA_HOME=/opt/homebrew/opt/openjdk@21 VITE_API_ORIGIN=http://<your-lan-ip>:3000 pnpm --filter @warewolf/web android:apk`.
4. Install with `adb install -r apps/web/android/app/build/outputs/apk/debug/app-debug.apk`, or copy the file to the phone.

Plain HTTP works only in debug builds. A release build needs an `https://` origin and a keystore kept outside the repository.

