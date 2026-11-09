# AI Task Board

Shared by Claude Code and Cursor Agent. Read [AI-WORKFLOW.md](./AI-WORKFLOW.md) for the rules. In short:

1. Read this board and `git status` before changing files.
2. Do not start a task whose files overlap an `IN_PROGRESS` task.
3. Claim a task by setting **Status** to `IN_PROGRESS` and **Agent** to yourself.
4. Change only the files the task lists. Add a file to the list if the task truly needs it.
5. Move to `COMPLETED` only after the acceptance criteria and tests pass. Use `REVIEW` when the other agent should check it.
6. Write handoffs under the task.

Statuses: `BACKLOG` (dependencies open), `READY` (can start), `IN_PROGRESS`, `BLOCKED` (waiting on a decision or person), `REVIEW`, `COMPLETED`.

Ids starting with `WW-` match [werewolf/implementation-checklist.md](./werewolf/implementation-checklist.md). A checklist task split between agents gets a letter suffix. `WEB-` ids are client foundation tasks added by this board.

Last updated: 9 November 2026.

---

## Completed

| Id | Work | Agent |
|---|---|---|
| WW-000 to WW-105 | Repository audit and Phase 1 skeleton: pnpm workspace, PostgreSQL in Compose, `games` migration with rollback, domain types, health and version routes, web shell with route placeholders | Claude |
| WW-201 to WW-205, WW-1006 | Phase 2: 37-role catalog, Doctor, Assassin, and Blacksmith profiles, `validateConfiguration`, nine role packs, blocking-decision acknowledgements | Claude |

---

## Board

| Id | Task | Agent | Status | Depends on |
|---|---|---|---|---|
| WW-301 | Lobby tables: players, tokens, drafts | Claude | READY | — |
| WEB-01 | Client state foundation: Redux Toolkit, API client, session | Claude | READY | — |
| WEB-02 | `GameLayout` architecture and layout-mode logic | Claude | READY | — |
| WEB-03 | Visual system pass against the mockups | Cursor | READY | — |
| WW-302 | Lobby API: create, join, leave, kick, transfer, cancel | Claude | BACKLOG | WW-301 |
| WW-303 | Save and validate configuration drafts | Claude | BACKLOG | WW-302 |
| WEB-04 | `GameLayout` responsive styling | Cursor | BACKLOG | WEB-02, WEB-03 |
| WEB-05 | Playwright with the seven viewport projects | Cursor | BACKLOG | WEB-04 |
| WW-304a | Lobby data layer in the client | Claude | BACKLOG | WW-302, WEB-01 |
| WW-304b | Home and lobby screens | Cursor | BACKLOG | WW-304a, WEB-04 |
| OD-73 | Decide how a Neutral role without an individual win can be seated | Product owner | BLOCKED | — |
| OD-72-rules | Decide the chat rules listed under OD-72 | Product owner | BLOCKED | — |

---

## Task details

### WW-301 — Lobby tables

- **Agent:** Claude
- **Status:** READY
- **Description:** Add `game_players` with seat tokens and the configuration draft columns from `docs/werewolf/data-model.md`. Add the deferred foreign key from `games.host_player_id`.
- **Files:** `apps/api/src/db/schema.ts`, `apps/api/drizzle/0001_*.sql`, `apps/api/drizzle/down/0001_*.sql`, `apps/api/drizzle/meta/*`, `apps/api/test/migrations.integration.test.ts`, `apps/api/test/schema-drift.test.ts`
- **Depends on:** —
- **Acceptance:** Display name and seat number are unique per game. Only a token hash is stored. The host foreign key can be satisfied when a game and its host seat are created in one transaction. The migration rolls back cleanly.
- **Tests:** `pnpm test`, `pnpm test:integration`.

### WEB-01 — Client state foundation

- **Agent:** Claude
- **Status:** READY
- **Description:** Add Redux Toolkit with a typed store and hooks, an RTK Query API slice whose request and response types come from `@warewolf/contracts`, and a session token adapter (sessionStorage on web, ready for Capacitor Preferences in WW-1603). Socket.IO client wiring waits for Phase 11.
- **Files:** `apps/web/package.json`, `apps/web/src/app/**`, `apps/web/src/api/**`, `apps/web/src/session/**`, `apps/web/src/main.tsx` (provider only), `apps/web/test/**` for these modules
- **Depends on:** —
- **Acceptance:** The store provider wraps the router. A typed `getHealth` query parses its response with the contract schema. The session adapter survives a reload on web and fails safe when storage is unavailable. No component outside `src/app`, `src/api`, and `src/session` changes.
- **Tests:** `pnpm typecheck`, unit tests for the store, API slice, and session adapter.

### WEB-02 — `GameLayout` architecture

- **Agent:** Claude
- **Status:** READY
- **Description:** Build the structure of the shared shell from `docs/werewolf/ui-ux-plan.md`, sections 3, 4, and 6:
  - A pure `layoutMode(width, height)` function for the six modes in section 3, and a `useLayoutMode` hook.
  - `GameLayout` with named regions (nav, status, stage, rail, action) and slot props.
  - The stage-mode mapping from phase to scene, foreground, and action row.
  - Fixture projections taken from the API examples.

  Markup is structural only: grid areas and accessible region names, with no visual styling.
- **Files:** `apps/web/src/game/layout/**`, `apps/web/src/game/fixtures/**`, `apps/web/test/game/**`
- **Depends on:** —
- **Acceptance:** `layoutMode` returns the documented mode for all seven priority viewports and for 568×320. `GameLayout` renders each region with an accessible name in every mode. Props are typed so screens pass content, not layout. No colors, sizes, or tokens are added.
- **Tests:** `pnpm typecheck`, unit tests for `layoutMode` and the region rendering.
- **Handoff to Cursor:** required before WEB-04. It lists the component tree, props, region names, and mode classes to style.

### WEB-03 — Visual system pass

- **Agent:** Cursor
- **Status:** READY
- **Description:** Compare `apps/web/src/theme/tokens.ts` and `theme.ts` with the two mockup grids in `docs/werewolf/`. Settle typography, button variants (primary purple, accent gold), card and panel surfaces, the day and night scene washes, team indicator styles, and the avatar monogram placeholder. All art stays original (`.cursor/rules/design-system.mdc`).
- **Files:** `apps/web/src/theme/**`, `apps/web/src/assets/**`, `apps/web/index.html` (fonts only)
- **Depends on:** —
- **Acceptance:** Every visual value is a token. Text and controls meet WCAG AA contrast on both scene washes. The MUI palette still derives from the tokens.
- **Tests:** `pnpm typecheck`, `pnpm --filter @warewolf/web test`. Visual check in the browser.

### WW-302 — Lobby API

- **Agent:** Claude
- **Status:** BACKLOG
- **Description:** Lobby routes from `docs/werewolf/api-design.md` section 1, with Zod contracts, hashed seat tokens shown once, and generic errors.
- **Files:** `apps/api/src/lobby/**`, `apps/api/src/db/**`, `packages/contracts/src/lobby.ts`, `apps/api/test/lobby*.ts`
- **Depends on:** WW-301
- **Acceptance:** Tests cover a full room, a started game, a name clash, and a cross-game token, which returns 404.
- **Tests:** `pnpm test`, `pnpm test:integration`.

### WW-303 — Configuration drafts

- **Agent:** Claude
- **Status:** BACKLOG
- **Description:** `GET` and `PUT /games/:id/configuration`, validated by `validateConfiguration` from `@warewolf/domain`. A 422 response carries errors and warnings.
- **Files:** `apps/api/src/configuration/**`, `packages/contracts/src/configuration.ts`, tests
- **Depends on:** WW-302
- **Acceptance:** An invalid draft saves and start stays closed. Only the host can edit, and only in the lobby.
- **Tests:** `pnpm test`, `pnpm test:integration`.

### WEB-04 — `GameLayout` responsive styling

- **Agent:** Cursor
- **Status:** BACKLOG
- **Description:** Style the WEB-02 shell: grid templates for each layout mode, safe-area insets, the scene aspect ratio, the action row, and the collapsible rail in narrow landscape.
- **Files:** Style files inside `apps/web/src/game/layout/` named in the WEB-02 handoff
- **Depends on:** WEB-02, WEB-03
- **Acceptance:** At all seven viewports there is no horizontal page scroll, and the action row is visible and clears the safe area. Desktop and landscape show the same regions.
- **Tests:** Browser check at each viewport. Automated in WEB-05.

### WEB-05 — Playwright viewport projects

- **Agent:** Cursor
- **Status:** BACKLOG
- **Description:** Set up `@playwright/test` with the seven projects and the layout assertions in `docs/werewolf/ui-ux-plan.md` section 12, using fixture projections.
- **Files:** `apps/web/playwright.config.ts`, `apps/web/e2e/**`, `apps/web/package.json`
- **Depends on:** WEB-04
- **Acceptance:** All seven projects pass the shell assertions on the fixture lobby and night screens.
- **Tests:** `pnpm --filter @warewolf/web exec playwright test`.

### WW-304a — Lobby data layer

- **Agent:** Claude
- **Status:** BACKLOG
- **Description:** RTK Query endpoints for create, join, and lobby state, session persistence after join, and polling until Phase 11 adds sockets.
- **Files:** `apps/web/src/api/lobby.ts`, `apps/web/src/game/state/**`, tests
- **Depends on:** WW-302, WEB-01
- **Acceptance:** Hooks expose typed lobby state and mutations that Cursor's screens can call without touching fetch code.
- **Tests:** Unit tests with a mocked API.
- **Handoff to Cursor:** hook names, returned shapes, loading and error states.

### WW-304b — Home and lobby screens

- **Agent:** Cursor
- **Status:** BACKLOG
- **Description:** Home and lobby on `GameLayout`, using the WW-304a hooks: create game, join by code, seat list, pack summary.
- **Files:** `apps/web/src/routes/**` for home and lobby, presentational components under `apps/web/src/game/components/**`
- **Depends on:** WW-304a, WEB-04
- **Acceptance:** Two browsers join one room. Matches the mockup direction at all seven viewports.
- **Tests:** Browser check, then a Playwright flow in WEB-05's setup.

### OD-73 — Neutral roles without an individual win

- **Owner:** Product owner
- **Status:** BLOCKED
- **Description:** Choose one of the options in `docs/werewolf/open-decisions.md`, OD-73. The `chaos-15` pack cannot start until this is decided.

### OD-72-rules — Chat rules

- **Owner:** Product owner
- **Status:** BLOCKED
- **Description:** Answer the chat questions listed under OD-72: night chat, dead players, a wolf channel, moderation, limits, and storage. These block WW-1104 and WW-1206.
