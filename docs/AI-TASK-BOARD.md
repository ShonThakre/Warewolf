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

Last updated: 11 November 2026. Phases 0 to 7, WEB-07, WW-604, WW-801, WW-802, WW-901, and WW-902 are complete. Claude's session stopped during WW-803a. Cursor has U20-ENG and U20-UI. OD-74 is in review for the product owner.

---

## Completed

| Id | Work | Agent |
|---|---|---|
| ART-01, WW-305 | Art pipeline (`pnpm art:check`, WebP at build time, typed art index) and avatar choice in the API | Claude |
| WW-301 to WW-303, WEB-01, WW-304a | Phase 3 engineering: lobby tables, lobby and configuration API, catalog routes, Redux Toolkit store, API client, session, lobby hooks | Claude |
| WW-304b | Home and lobby screens: create, join, seats, pack summary | Cursor |
| WEB-03 | Visual system: tokens, Nunito, purple and gold buttons, scene washes | Cursor |
| WW-404b | Reveal screen and the lobby Start control | Cursor |
| WEB-04 | `GameLayout` stylesheet and the lobby on that shell | Cursor |
| WEB-05 | Playwright viewport projects for the fixture shell | Cursor |
| ART-02 | Art in the screens, the role catalog, and the lobby avatar picker | Cursor |
| WW-1201 | Configuration browser: steps, counts, warnings, locked Infection Core | Cursor |
| OD-73-impl | Neutral survive victory, and `chaos-15` can be seated | Cursor |
| WEB-06 | Phase banner, countdown, and host close button on the table route | Cursor |
| WW-604 | Generic action panel bound to ability prompts | Cursor |
| WW-501 to WW-503 | Phase 5: phase machine, `GET /state`, host phase close, deadlines, timer and boot recovery, config-fixed night windows, client state hooks | Claude |
| WW-601 to WW-603 | Phase 6 engineering: capability registry, target rules, availability and use consumption, `night_actions` and idempotency tables, `POST /actions`, `GET /me/actions`, window locking on close | Claude |
| WW-701 to WW-703 | Phase 7: `resolveNight` for Infection Edition and Classic, wolf anonymity checks, Infection Edition as the create default | Claude |
| WW-801, WW-802 | Phase 8: the full night pipeline (blocks, traps, Bodyguard, Immortal, Cursed, copies, inheritance, Avenger, every information kind, delayed poison, Blacksmith item), golden fixtures, and night resolution committed in the phase close | Claude |
| WW-901, WW-902 | Phase 9 engineering: ballots, revote, day close, victory records. A tie does not eliminate. Parity is a wolf win. A Jester win does not end the game | Cursor |
| WEB-07 | Client action data layer: `useMyActions`, `useSubmitAction`, `actionPrompts`, action fixtures | Claude |
| WEB-02 | `GameLayout` structure, `layoutMode`, stage modes, lobby and table fixtures, `/dev/layout` preview | Claude |
| WW-401 to WW-403, WW-404a | Phase 4 engineering: assignment tables, CSPRNG deal and start route, `/me` and host roster, client start and role hooks | Claude |
| WW-000 to WW-105 | Repository audit and Phase 1 skeleton: pnpm workspace, PostgreSQL in Compose, `games` migration with rollback, domain types, health and version routes, web shell with route placeholders | Claude |
| WW-201 to WW-205, WW-1006 | Phase 2: 37-role catalog, Doctor, Assassin, and Blacksmith profiles, `validateConfiguration`, nine role packs, blocking-decision acknowledgements | Claude |

---

## Board

| Id | Task | Agent | Status | Depends on |
|---|---|---|---|---|
| WW-301 | Lobby tables: players, tokens, drafts | Claude | COMPLETED | — |
| WEB-01 | Client state foundation: Redux Toolkit, API client, session | Claude | COMPLETED | — |
| WEB-02 | `GameLayout` architecture and layout-mode logic | Claude | COMPLETED | — |
| WEB-03 | Visual system pass against the mockups | Cursor | COMPLETED | — |
| WW-302 | Lobby API: create, join, leave, kick, transfer, cancel | Claude | COMPLETED | WW-301 |
| WW-303 | Save and validate configuration drafts | Claude | COMPLETED | WW-302 |
| WEB-04 | `GameLayout` responsive styling, and the lobby moved onto it | Cursor | COMPLETED | WEB-02, WEB-03 |
| WEB-05 | Playwright with the seven viewport projects | Cursor | COMPLETED | WEB-04 |
| WW-304a | Lobby data layer in the client | Claude | COMPLETED | WW-302, WEB-01 |
| WW-304b | Home and lobby screens | Cursor | COMPLETED | WW-304a, WEB-04 |
| ART-01 | Art pipeline: check generated files, build-time WebP, typed art index | Claude | COMPLETED | — |
| WW-305 | Avatar choice in the API | Claude | COMPLETED | — |
| ART-02 | Use the art in components and build the lobby avatar picker | Cursor | COMPLETED | WEB-04 |
| WW-401 | Assignment and ability-instance tables | Claude | COMPLETED | WW-301 |
| WW-402 | Fisher-Yates deal inside the start transaction | Claude | COMPLETED | WW-401, WW-205 |
| WW-403 | Player and host role projections: `/me`, `/host/roster` | Claude | COMPLETED | WW-402 |
| WW-404a | Reveal data layer in the client: start, own role, host roster | Claude | COMPLETED | WW-403, WW-304a |
| WW-404b | Reveal screen, role modal, and lobby Start control | Cursor | COMPLETED | WW-404a |
| WW-1201 | Configuration browser: steps, counts, warnings, locked Infection Core | Cursor | COMPLETED | WW-304, WW-303 |
| OD-73 | Decide how a Neutral role without an individual win can be seated | Product owner | COMPLETED | — |
| OD-72-rules | Decide the chat rules listed under OD-72 | Product owner | COMPLETED | — |
| OD-73-impl | Neutral roles with no individual win get a survive victory, and `chaos-15` unblocks | Cursor | COMPLETED | OD-73 |
| WW-501 | Persist phase, round, version, and deadlines. Illegal transitions return 409 | Claude | COMPLETED | WW-301 |
| WW-502 | Host-paced close and timed auto-advance, including after a restart | Claude | COMPLETED | WW-501 |
| WW-503 | Conditional host-confirm and Doctor-reaction windows | Claude | COMPLETED | WW-502, OD-01, OD-02 |
| WEB-06 | Phase banner, countdown, and host close button on the table route | Cursor | COMPLETED | WW-501 to WW-503 |
| WW-601 | Night action table, idempotency, and `POST /actions` | Claude | COMPLETED | WW-501, WW-401 |
| WW-602 | Capability handler registry and target rules | Claude | COMPLETED | WW-201 |
| WW-603 | Charge, cooldown, and consecutive-target checks | Claude | COMPLETED | WW-602 |
| WEB-07 | Client data layer for actions: submit mutation and `useMyActions` | Claude | COMPLETED | WW-601, WEB-06 |
| WW-701 | Infection Edition rules: infect, wolf kill, Seeker, Guard, Doctor profiles, Witch, Villager | Claude | COMPLETED | WW-602, OD-01, OD-02, OD-03 |
| WW-702 | Anonymity projections for wolves | Claude | COMPLETED | WW-403, WW-701 |
| WW-703 | Infection Core preset as the create-game default | Claude | COMPLETED | WW-204, WW-701 |
| WW-604 | Generic action panel bound to ability prompts | Cursor | COMPLETED | WEB-07 |
| WW-801 | Pure `resolveNight`: every step in the documented order, golden same-night fixtures | Claude | COMPLETED | WW-701 |
| WW-802 | Night resolution in the phase close: transaction, records, `resolution_run` | Claude | COMPLETED | WW-801, WW-501 |
| WW-901 | Ballots, weights, abstain, replace, close, revote | Cursor | COMPLETED | WW-501 |
| WW-902 | Victory evaluator with team and individual records | Cursor | COMPLETED | WW-801 |
| WW-803a | Host kill target: storage, API, close guard, the informed Doctor's target, client data layer | Claude | IN_PROGRESS | WW-802, WW-503 |
| WW-803b | Host kill-target picker and the Doctor's target line on the table | Cursor | BACKLOG | WW-803a |
| OD-74 | Confirm that night windows are fixed by the configuration | Product owner | REVIEW | — |
| U20-ENG | Ultimate 20 mode: catalog, pack, lock, submission rules, day tally, victory evaluator, resolver steps, API submit, web data layer, art manifest, docs | Cursor | COMPLETED | WW-802 |
| U20-UI | Ultimate 20 screens and copy: locked setup copy, hint field, exclusive-choice note, Mind Controller day prompt, portraits | Cursor | COMPLETED | U20-ENG |

---

## Task details

### U20-ENG — Ultimate 20 mode (engineering)

- **Agent:** Cursor (picked up 11 November 2026 after Claude's session limit)
- **Status:** COMPLETED
- **Description:** Add the selectable `ULTIMATE_20` mode from `docs/werewolf/ultimate-20-rules.md` and the two reference images. It has 20 seats: 15 special roles and 5 Villagers. Infection Edition does not change. Scope, as the product owner decided on 11 November 2026: engine-complete. The mode, preset, lock, roles, resolver steps, a pure day tally, and a pure victory evaluator are built and tested. The ballot API (WW-901) and the victory wiring (WW-902) call them later.
- **Files:**
  - **Phase A:**
    - Domain: `packages/domain/src/catalog/**` (new `definitions/ultimate.ts`), `roles.ts`, `game.ts`, `config/{modes,packs,types,validate}.ts`, `action/submission.ts`, new `day/tally.ts` and `victory/evaluate.ts`, and `index.ts`.
    - Contracts: `packages/contracts/src/assignment.ts`.
    - API: `apps/api/src/action/action.service.ts`.
    - Web: `apps/web/src/game/setup/setupDraft.ts`, `apps/web/src/game/state/actions.ts`, `apps/web/src/game/components/{actionDraft,actionCopy,lobbyCopy}.ts` (logic and the mode label only), `apps/web/src/game/fixtures/**`.
    - Art: `art/manifest.json`, `docs/ART-PROMPTS.md`, and the art count tests.
    - Docs: `docs/werewolf/*`.
    - Tests for all of the above.
  - **Phase B, after WW-803a releases them:** `packages/domain/src/night/{types,resolve,information}.ts`, `action/registry.ts`, `test/support/night.ts`, `apps/api/src/db/schema.ts`, a new migration, and `apps/api/src/night/night-resolution.service.ts`.
- **Depends on:** WW-802 (done). Phase B waits for WW-803a's night and schema files.
- **Note from WW-901 and WW-902 (Cursor, 11 November 2026):** Do not recreate `day/tally.ts` or `victory/evaluate.ts`. The ballot close calls `tallyDay`, and both night and day closes call `evaluateVictory`. Vote weight is 1 plus each modifier's extra (`weight - 1`), so Elder and Mayor together count as 3. `evaluateVictory` applies `victoryForSeat`. Migration `0008_votes` adds `votes` and `victory_records` and widens the checks for enum values already in the domain, including `ULTIMATE_20`. A later migration should add columns. It should not replace `0008`. Night resolution now sets `gameOver` from `applyVictory`.

### WW-901 — Ballots

- **Agent:** Cursor
- **Status:** COMPLETED
- **Description:** `POST /games/:gameId/votes` stores the caller's own ballot. A later vote on the same ballot supersedes the earlier one. Abstain is a null target. The host phase close tallies the ballot. A tie opens one revote. A second tie eliminates nobody.
- **Files:** `packages/domain/src/day/tally.ts`, `packages/contracts/src/vote.ts`, `apps/api/src/day/day-resolution.service.ts`, `apps/api/src/day/vote.service.ts`, `apps/api/src/day/vote.controller.ts`, `apps/api/src/db/schema.ts`, `apps/api/drizzle/0008_votes.sql`, `apps/api/drizzle/down/0008_votes.sql`, `apps/api/test/vote.integration.test.ts`
- **Depends on:** WW-501
- **Acceptance:** A tie fixture matches OD-40. Checked in `packages/domain/test/day-victory.test.ts` and `apps/api/test/vote.integration.test.ts`.
- **Handoff to WW-903:** Weights are copied onto the vote rows at close. The response of `POST /votes` is only `{ ballot, targetPlayerId, supersedes }`. There is no public tally route yet. A day close also applies poison due that day, lets Immortal spend a charge to survive, queues an Avenger's revenge for the next night when one voter is the unique leader, hands a dead Doctor's abilities to a living Healer Assistant, and seals infection when the Alpha dies.

### WW-902 — Victory

- **Agent:** Cursor
- **Status:** COMPLETED
- **Description:** `evaluateVictory` decides the team and individual outcomes. The night close and the day close write `victory_records`, update `individual_victory`, and store `games.winner_summary` when the game ends. A night that ends the game does not open the day.
- **Files:** `packages/domain/src/victory/evaluate.ts`, `apps/api/src/victory/apply-victory.ts`, `apps/api/src/night/night-resolution.service.ts`, `apps/api/src/phase/resolution.ts`, `victory_records` in migration `0008_votes`
- **Depends on:** WW-801
- **Acceptance:** Two wolves and two others is a wolf win. A Jester eliminated by the day vote is recorded and the game continues. A night death does not win the Jester. An empty table is a draw.
- **Handoff to WW-903:** `winner_summary` is `{ team, draw, individuals: [{ playerId, roleId }] }` when the game ends. Chaos Demon success counts are not stored yet, so that individual win is not persisted across closes.

### U20-UI — Ultimate 20 screens and copy

- **Agent:** Cursor
- **Status:** COMPLETED
- **Depends on:** U20-ENG
- **Files:** `apps/web/src/routes/Setup.tsx` and the setup step components (`SetupMode`, `SetupRoles`, `SetupSettings`), `apps/web/src/routes/Table.tsx`, `NightActionPanel`, `apps/web/src/routes/Home.tsx` (`FALLBACK_MODES`), portraits after they exist.
- **Handoff (11 November 2026):** Cursor took U20-ENG as well after Claude's session stopped. The locked setup copy, hint field, exclusive-choice note, Mind Controller prompt, Chaos wording, and `FALLBACK_MODES` are in the screens. Fourteen portraits are listed in the manifest and are not generated.
- **Still unwired:** persist rewinds, the chaos draw and counter, used chaos kinds, revivals, silences, and hints; call `drawChaos` with a CSPRNG. Phase close already calls `tallyDay` and `evaluateVictory`, and that call does not yet receive `revivedBy`, `chaosSuccesses`, or `chaosAchieved`.

### WW-301 — Lobby tables

- **Agent:** Claude
- **Status:** COMPLETED
- **Description:** Add `game_players` with seat tokens and the configuration draft columns from `docs/werewolf/data-model.md`. Add the deferred foreign key from `games.host_player_id`.
- **Files:** `apps/api/src/db/schema.ts`, `apps/api/drizzle/0001_*.sql`, `apps/api/drizzle/down/0001_*.sql`, `apps/api/drizzle/meta/*`, `apps/api/test/migrations.integration.test.ts`, `apps/api/test/schema-drift.test.ts`
- **Depends on:** —
- **Acceptance:** Display name and seat number are unique per game. Only a token hash is stored. The host foreign key can be satisfied when a game and its host seat are created in one transaction. The migration rolls back cleanly.
- **Tests:** `pnpm test`, `pnpm test:integration`.

### WEB-01 — Client state foundation

- **Agent:** Claude
- **Status:** COMPLETED
- **Description:** Add Redux Toolkit with a typed store and hooks, an RTK Query API slice whose request and response types come from `@warewolf/contracts`, and a session token adapter (sessionStorage on web, ready for Capacitor Preferences in WW-1603). Socket.IO client wiring waits for Phase 11.
- **Files:** `apps/web/package.json`, `apps/web/src/app/**`, `apps/web/src/api/**`, `apps/web/src/session/**`, `apps/web/src/main.tsx` (provider only), `apps/web/test/**` for these modules
- **Depends on:** —
- **Acceptance:** The store provider wraps the router. A typed `getHealth` query parses its response with the contract schema. The session adapter survives a reload on web and fails safe when storage is unavailable. No component outside `src/app`, `src/api`, and `src/session` changes.
- **Tests:** `pnpm typecheck`, unit tests for the store, API slice, and session adapter.

### WEB-02 — `GameLayout` architecture

- **Agent:** Claude
- **Status:** COMPLETED
- **Description:** Build the structure of the shared shell from `docs/werewolf/ui-ux-plan.md`, sections 3, 4, and 6:
  - A pure `layoutMode(width, height)` function for the six modes in section 3, and a `useLayoutMode` hook.
  - `GameLayout` with named regions (nav, status, stage, rail, action) and slot props.
  - The stage-mode mapping from phase to scene, foreground, and action row.
  - Fixture projections taken from the API examples.

  Markup is structural only: grid areas and accessible region names, with no visual styling.
- **Files:** `apps/web/src/game/layout/**`, `apps/web/src/game/fixtures/lobby.ts`, `apps/web/src/routes.tsx` (dev preview route only), `apps/web/test/game/**`, `docs/werewolf/ui-ux-plan.md` (as-built notes in sections 3 and 4)
- **Depends on:** —
- **Acceptance:** `layoutMode` returns the documented mode for all seven priority viewports and for 568×320. `GameLayout` renders each region with an accessible name in every mode. Props are typed so screens pass content, not layout. No colors, sizes, or tokens are added.
- **Tests:** `pnpm typecheck`, unit tests for `layoutMode` and the region rendering.
- **Acceptance (met):** `layoutMode` returns the documented mode for all seven priority viewports and 568×320, plus the section 3 boundaries. Every region has an accessible name in every mode and stage: 8 viewports × 7 stages. The action row is present in all of them. No colors, sizes, tokens, or stylesheets were added. The production build leaves out the dev preview.
- **Tests:** `pnpm --filter @warewolf/web test` (123 new, in `test/game/`), `pnpm typecheck`, `vite build`.
- **Handoff to Cursor (9 November 2026), for WEB-04:**
  - **What exists:** `apps/web/src/game/layout/`. Import from `src/game/layout` (index):
    - `GameLayout`
    - `layoutMode` and `layoutInfo`
    - `useLayoutMode()`
    - `stageModeFor(phase)` and `STAGE_SPECS`
    - `PRIORITY_VIEWPORTS` and `NARROW_LANDSCAPE_CHECK`, which list the seven Playwright projects with the expected mode for each
  - **Not added:** no stylesheet, no tokens, no `sx`. The regions render as plain stacked blocks until WEB-04 styles them.
  - **Preview:** `/dev/layout` lists the stages, and `/dev/layout/<stage>` renders one stage with 20 fixture seats, two of them dead. The stages are `lobby`, `reveal`, `night`, `night-results`, `day`, `voting`, and `results`. This works in the dev server only. Use it for styling and for WEB-05. The copy on it is placeholder.
  - **Props:**
    ```ts
    <GameLayout
      stage={stageModeFor(phase)}   // 'lobby' | 'reveal' | 'night' | 'night-results' | 'day' | 'voting' | 'results'
      status={…}                    // GameStatusBar content
      scene={…}                     // VillageScene, decorative
      foreground={…}                // avatars, PlayerGrid, result card, or victory banner
      rail={…}                      // DiscussionPanel
      action={…}                    // PlayerInteraction row
      labels={{ rail: 'Discussion' }} // optional. Defaults: Game status, Village, Room, Actions, Players
    />
    ```
    Screens pass content only. `layout={layoutInfo(w, h)}` forces a size for tests and stories; screens leave it out.
  - **DOM to style.** The root is `.ww-game-layout`, with these attributes:
    - `data-layout`: `full`, `compact`, `tablet`, `phone-landscape`, `narrow-landscape`, or `portrait`
    - `data-status-row`: `true` gives the status line its own row. `false` makes it share one compact bar with the nav, which happens under 700px tall and in portrait.
    - `data-stage`
    - `data-wash`: `night` or `day`. Map it to `--bg-night` and `--bg-day`.
    - `data-foreground`: `avatars`, `player-grid`, `result-card`, or `victory`
    - `data-rail-open`: narrow landscape only, `true` or `false`
    - `data-panel`: portrait with a grid only, `players` or `rail`
  - **Regions.** Give each one the grid area named here:
    - `.ww-game-status`, named "Game status". It holds the rail toggle `.ww-game-rail-toggle` in narrow landscape.
    - `.ww-game-stage`, named "Village". It contains `.ww-game-scene` and `.ww-game-foreground`; layer them in one cell.
    - `.ww-game-switch`, portrait only. These are MUI `Tabs`.
    - `.ww-game-players`, portrait only: a tabpanel named "Players".
    - `.ww-game-rail`, named "Room" by default.
    - `.ww-game-action`, named "Actions".
  - **Grid areas.** Suggested `grid-template-areas`:
    - Three-area modes: `"status status" "stage rail" "action rail"`. This is the lobby's current template.
    - Portrait: `"status" "stage" "switch" "middle" "action"`. Put `.ww-game-players` and `.ww-game-rail` both in `middle`; only one is visible at a time.
    - Narrow landscape: `"status" "stage" "action"`. With `data-rail-open="true"`, put `.ww-game-rail` in the `stage` area above the scene.
    - Rail widths per mode are in `ui-ux-plan.md`, section 3.
  - **Hidden regions.** Behaviour is done in code. A collapsed or switched-away region has the `hidden` attribute. Do not show or hide regions with CSS display rules, but do make sure nothing in the stylesheet overrides `[hidden]`. Escape closes the open rail and returns focus to the toggle.
  - **Move the lobby onto GameLayout** (part of WEB-04, because `Lobby.tsx` and `lobby-screen.css` are your files):
    - Render `GameLayout stage="lobby"`.
    - Map `.ww-status` to `status`, `.ww-scene` to `scene` with the seats as `foreground`, `.ww-rail` to `rail`, and `.ww-action` to `action`.
    - Remove the lobby's own `railOpen` state and toggle button. `GameLayout` owns them now.
    - Move the grid rules from `lobby-screen.css` into the `GameLayout` stylesheet, keyed by `data-layout`. The region names stay the same, so the screen tests should keep passing.
  - **Not built here:** `GameStatusBar`, `VillageScene`, `PlayerGrid`, and `DiscussionPanel`. They are the slot contents, built with the night and day screens.

### WEB-03 — Visual system pass

- **Agent:** Cursor
- **Status:** COMPLETED
- **Description:** Compare `apps/web/src/theme/tokens.ts` and `theme.ts` with the two mockup grids in `docs/werewolf/`. Settle typography, button variants (primary purple, accent gold), card and panel surfaces, the day and night scene washes, team indicator styles, and the avatar monogram placeholder. All art stays original (`.cursor/rules/design-system.mdc`).
- **Files:** `apps/web/src/theme/**`, `apps/web/index.html` (Nunito only), `apps/web/test/theme-contrast.test.ts`, `apps/web/src/game/components/PackSummary.tsx` and `lobbyCopy.ts` (team classes only)
- **Depends on:** —
- **Acceptance:** Every visual value is a token. Text and controls meet WCAG AA contrast on both scene washes. The MUI palette still derives from the tokens.
- **Tests:** `pnpm typecheck`, `pnpm --filter @warewolf/web test` (contrast test included). Browser check on home and lobby: Nunito, purple Create, gold Start and Return, outlined Join, team words, monogram ring.
- **Handoff:** The day wash is `#2a1844` to `#3a2214`, darker than the plan's starting brown, so the purple button and the wolf word stay AA on the scene. Wolf is `#ff5c78`. Team words use `.ww-team-wolf`, `.ww-team-village`, `.ww-team-neutral`, and `.ww-team-independent`. The monogram frame is `.ww-avatar` in `theme/visual.css`.

### WW-302 — Lobby API

- **Agent:** Claude
- **Status:** COMPLETED
- **Description:** Lobby routes from `docs/werewolf/api-design.md` section 1, with Zod contracts, hashed seat tokens shown once, and generic errors.
- **Files:** `apps/api/src/lobby/**`, `apps/api/src/db/**`, `packages/contracts/src/lobby.ts`, `apps/api/test/lobby*.ts`
- **Depends on:** WW-301
- **Acceptance:** Tests cover a full room, a started game, a name clash, and a cross-game token, which returns 404.
- **Tests:** `pnpm test`, `pnpm test:integration`.

### WW-303 — Configuration drafts

- **Agent:** Claude
- **Status:** COMPLETED
- **Description:** `GET` and `PUT /games/:id/configuration`, validated by `validateConfiguration` from `@warewolf/domain`. A 422 response carries errors and warnings.
- **Files:** `apps/api/src/configuration/**`, `packages/contracts/src/configuration.ts`, tests
- **Depends on:** WW-302
- **Acceptance:** An invalid draft saves and start stays closed. Only the host can edit, and only in the lobby.
- **Tests:** `pnpm test`, `pnpm test:integration`.

### WEB-04 — `GameLayout` responsive styling

- **Agent:** Cursor
- **Status:** COMPLETED
- **Description:** Style the WEB-02 shell: grid templates for each layout mode, safe-area insets, the scene aspect ratio, the action row, and the collapsible rail in narrow landscape. Then move the lobby onto `GameLayout` (see the WEB-02 handoff).
- **Files:** `apps/web/src/game/layout/game-layout.css`, `apps/web/src/game/layout/GameLayout.tsx` (stylesheet import only), `apps/web/src/routes/Lobby.tsx`, `apps/web/src/game/components/lobby-screen.css`, `apps/web/src/shell/AppShell.tsx` (classes so a short status line can share the top bar)
- **Depends on:** WEB-02, WEB-03
- **Acceptance:** At all seven viewports there is no horizontal page scroll, and the action row is visible and clears the safe area. Desktop and landscape show the same regions.
- **Tests:** `pnpm --filter @warewolf/web typecheck` and `pnpm --filter @warewolf/web test` (211). Browser check on `/dev/layout/lobby` and a live lobby at the seven viewports plus 568×320.
- **Handoff to Cursor (9 November 2026), for WEB-05:**
  - **Stylesheet:** `apps/web/src/game/layout/game-layout.css`, keyed by `data-layout`. Rail widths match section 3: full `clamp(18rem, 22vw, 24rem)`, compact `clamp(16rem, 24vw, 20rem)` plus a tighter `--space`, tablet `clamp(14rem, 30vw, 18rem)`, phone-landscape `clamp(11rem, 32vw, 16rem)`. Full and compact scenes use `aspect-ratio: 16 / 9`. Shorter modes keep a `4.5rem` scene minimum so the action row stays on screen.
  - **Modes measured:** 1920×1080 and 1440×900 are `full` (height 900 stays in the full band). 1024×768 is `compact`. 915×412, 844×390, and 667×375 are `phone-landscape`. 390×844 is `portrait`. 568×320 is `narrow-landscape`.
  - **Portrait lobby keeps the seats on the scene** and the room under it (`status / stage / rail / action`). Night and voting set `data-panel` and use `status / stage / switch / middle / action`. Assert the switch on `/dev/layout/night`.
  - **Narrow landscape:** the rail is hidden until `.ww-game-rail-toggle` ("Room") is pressed. Open, it covers the stage (`grid-area: stage`) and the action row stays put. Escape closes it and focuses the toggle. The pack strip (`.ww-status-pack`) shows in the status line only while that rail is closed.
  - **Short status:** `data-status-row="false"` drops the nav's bottom border so the nav and status read as one bar, and the status stays one line.
  - **Lobby:** `Lobby.tsx` renders `GameLayout stage="lobby"`. It no longer owns a rail toggle. Dialogs stay outside the grid.
  - **Hidden regions:** `[hidden] { display: none !important }`. Do not override that.

### WEB-05 — Playwright viewport projects

- **Agent:** Cursor
- **Status:** COMPLETED
- **Description:** Set up `@playwright/test` with the seven projects and the layout assertions in `docs/werewolf/ui-ux-plan.md` section 12, using fixture projections.
- **Files:** `apps/web/playwright.config.ts`, `apps/web/e2e/layout.spec.ts`, `apps/web/package.json`
- **Depends on:** WEB-04
- **Acceptance:** All seven projects pass the shell assertions on the fixture lobby and night screens.
- **Tests:** `pnpm --filter @warewolf/web e2e` (14 passed: lobby and night at each of the seven viewports). The narrow-landscape rail check runs inside `phone-land-sm`.
- **Handoff:** Projects come from `PRIORITY_VIEWPORTS`, so a new size is one row there and one Playwright project. 1440×900 is `full`. Portrait lobby keeps the room under the scene. The Players | Room switch is on `/dev/layout/night`. `pnpm --filter @warewolf/web exec playwright install chromium` once per machine, then `pnpm --filter @warewolf/web e2e`.

### WW-304a — Lobby data layer

- **Agent:** Claude
- **Status:** COMPLETED
- **Description:** RTK Query endpoints for create, join, and lobby state, session persistence after join, and polling until Phase 11 adds sockets.
- **Files:** `apps/web/src/api/lobby.ts`, `apps/web/src/game/state/**`, tests
- **Depends on:** WW-302, WEB-01
- **Acceptance:** Hooks expose typed lobby state and mutations that Cursor's screens can call without touching fetch code.
- **Tests:** Unit tests with a mocked API.
- **Handoff to Cursor (9 November 2026), for WW-304b:**
  - **What exists:** a Redux Toolkit store with RTK Query, a seat session kept in sessionStorage, and lobby hooks. No visual components were added or changed.
  - **Files:** `src/app/store.ts`, `src/app/hooks.ts`, `src/api/api.ts`, `src/api/lobby.ts`, `src/session/storage.ts`, `src/session/sessionSlice.ts`, `src/game/state/lobby.ts`, and `src/main.tsx` (the store `Provider` only).
  - **Read hooks** (`src/game/state/lobby.ts`):
    - `useSeat()` returns `SeatCredentials | null`. It becomes null after leave, after a kick, or when the server rejects the token.
    - `useLobby()` returns `{ lobby, isLoading, error, refetch }`. It polls every 2 seconds while the tab is focused and stops once the game leaves the lobby.
  - **Mutation hooks** (`src/api/lobby.ts`): `useCreateGameMutation({ displayName, mode })` and `useJoinGameMutation({ roomCode, displayName })` seat the caller automatically. Also `useLeaveGameMutation({ gameId, hostPlayerId? })`, `useKickPlayerMutation({ gameId, playerId })`, `useTransferHostMutation({ gameId, playerId })`, `useCancelGameMutation({ gameId })`, `useGetRolePacksQuery()`, `useGetConfigurationQuery(gameId)`, `useSaveConfigurationMutation({ gameId, draft })`, and `useCheckConfigurationMutation({ gameId, draft })`.
  - **Errors:** `apiErrorOf(result.error)` returns `{ status, code, message, issues }`. Codes the lobby screens should handle: `DISPLAY_NAME_TAKEN`, `ROOM_FULL`, `GAME_STARTED`, `NOT_FOUND` (unknown room code), `VALIDATION_FAILED` (with `issues[].path` set to `displayName` or `roomCode`), `NOT_HOST`, and `NETWORK_ERROR`. `message` is safe to show as is.
  - **Lobby data** (`LobbyProjection` in `@warewolf/contracts`): `roomCode`, `mode`, `rolePackId`, `playerCount`, `players[]` (name, seat number, host flag), `you`, `configuration.summary` (faction counts, wolf cap), and `start` (`ready`, `blockers`, `requiresWarningAcknowledgement`). Blockers are `SEATS_OPEN`, `SEATS_OVER`, `CONFIG_INVALID`, and `NOT_LOBBY`. A cancelled room has `status: 'CANCELLED'`.
  - **Form validation:** use `displayNameSchema` and `roomCodeSchema` from `@warewolf/contracts`. They are the same rules the server applies.
  - **Routing:** after create or join, go to `/lobby/:gameId` using `seat.gameId`. When `useSeat()` becomes null, return home.
  - **Not built yet:** the start route is WW-402 (Phase 4). Show the Start control disabled, with the blockers, until then.
  - **Styling:** none was done. Use the tokens.

### WW-304b — Home and lobby screens

- **Agent:** Cursor
- **Status:** COMPLETED
- **Description:** Home and lobby on the section 4 grid, using the WW-304a hooks: create game, join by code, seat list, pack summary. `GameLayout` (WEB-02) is not built yet, so this screen owns that grid until WEB-02 extracts it. No second mobile screen.
- **Files:** `apps/web/src/routes/Home.tsx`, `apps/web/src/routes/Lobby.tsx`, `apps/web/src/routes.tsx`, `apps/web/src/game/components/**`, `apps/web/src/shell/AppShell.tsx` (Play target, seated monogram, fill height), `apps/web/src/index.css` (viewport lock), `apps/web/src/theme/tokens.ts` (`--avatar-nav` only), `apps/web/test/screens/**`, `apps/web/test/routes.test.tsx`, `apps/web/test/render.tsx`
- **Depends on:** WW-304a, WEB-04. Started before WEB-04 because the product owner asked for WW-304.
- **Acceptance:** Two browsers join one room. Matches the mockup direction at all seven viewports.
- **Tests:** `pnpm --filter @warewolf/web test` and `typecheck`. Browser check: one tab created an Infection Edition room, a second tab joined it, and the host list updated to both seats. Layout checked at 1920×1080, 1440×900, 1024×768, 915×412, 667×375, 390×844, and 568×320 (rail collapses and overlays the village; the action row stays on screen). No horizontal page scroll. Playwright remains WEB-05.
- **Handoff to Claude (9 November 2026):** WEB-02 can extract the lobby grid into `GameLayout`. Regions, with accessible names: Game status, Village, Room, Actions. The shell nav stays in `AppShell` (wordmark, Play, How to Play, Roles, seated monogram). Play goes to `/lobby/:gameId` when `useSeat()` is set. Screens call the WW-304a hooks only. Start is always disabled; the action row explains blockers, and a ready room says start opens when roles can be dealt (WW-402). Host leave without a successor cancels the room. The log composer is a disabled slot until OD-72.

### ART-01 — Art pipeline

- **Agent:** Claude
- **Status:** COMPLETED
- **Description:**
  - **Art folder:** generated PNGs live in `art/<category>/` and are committed.
  - **Checker:** `pnpm art:check` (`tools/art`) compares them with `art/manifest.json`. It errors on wrong names, shapes, sizes, and fake transparency, and reports coverage for missing files.
  - **Web build:** `vite-imagetools` converts each PNG to WebP at the width the game needs, in dev and in the build. The originals never ship.
  - **Art index:** `apps/web/src/assets/art.ts` finds the files by name.
- **Files:** `art/**`, `tools/art/**`, `apps/web/src/assets/art.ts`, `apps/web/src/assets/art-index.ts`, `apps/web/vite.config.ts`, `apps/web/test/assets/art.test.ts`
- **Acceptance (met):**
  - Every catalog role id is in the manifest.
  - `art:check` fails on bad files and passes on the real images.
  - A role portrait goes from about 2 MB to 45–70 KB of WebP.
  - A lookup returns a URL exactly when its file exists.
- **Tests:** `tools/art` (13), `apps/web/test/assets` (11).

### WW-305 — Avatar choice in the API

- **Agent:** Claude
- **Status:** COMPLETED
- **Description:** Players pick one of 36 avatars in the lobby. Add `avatar_id` (1–36) to `game_players`, unique within a game. Create and join accept an optional `avatarId`; without one, the server assigns the lowest unused id. Add `PUT /games/:gameId/me/avatar` (lobby only, 409 when taken). Include `avatarId` on each player in the lobby projection, and add the RTK Query mutation in `apps/web/src/api/lobby.ts`.
- **Files:** `apps/api/src/db/schema.ts`, `apps/api/drizzle/0002_*`, `apps/api/src/lobby/**`, `packages/contracts/src/lobby.ts`, `apps/web/src/api/lobby.ts`, tests
- **Depends on:** —
- **Acceptance:** Two players cannot hold the same avatar in one game, including when they join at the same moment. A kicked player's avatar becomes free again.
- **Tests:** `pnpm test`, `pnpm test:integration`.

### ART-02 — Art in the components, and the avatar picker

- **Agent:** Cursor
- **Status:** COMPLETED
- **Description:** Use the art index from ART-01 in `VillageScene` (scene by phase and stage mode), `PlayerAvatar` (avatar image, or initials and `mystery_avatar` for empty seats), `RoleCard` (role portrait on a team-colored panel, `card_back` for the flip), the role catalog cards, and the results screen (victory scene, plus the ribbon when present). Build the lobby avatar picker on the WW-305 mutation, with taken avatars disabled.
- **Files:** `apps/web/src/game/components/**` (`VillageScene`, `PlayerAvatar`, `PlayerCard`, `RoleCard`, `AvatarPicker`, `VictoryBanner`, `scene-art.css`), `apps/web/src/routes/Lobby.tsx`, `apps/web/src/routes/Home.tsx`, `apps/web/src/routes/Roles.tsx`, `apps/web/src/routes/Results.tsx`, `apps/web/src/routes.tsx`, `apps/web/src/shell/AppShell.tsx` (emblem and seated avatar), `apps/web/src/theme/visual.css` (avatar image fit), `apps/web/test/screens/**`
- **Depends on:** WEB-04 (ART-01 and WW-305 are done)
- **Acceptance:** Every screen still works with no art present. With art present, the screens match the mockup direction at all seven viewports. Images have alt text, or are marked decorative.
- **Tests:** `pnpm --filter @warewolf/web typecheck` and `pnpm --filter @warewolf/web test` (218). Browser: catalog filter and role dialog, home scene and emblem, live lobby avatar change to avatar 4, results shell. Portrait and short landscape checked for overflow.
- **Handoff to Claude (9 November 2026), for WW-1203:**
  - `VictoryBanner` takes `outcome` (`village`, `wolves`, `lone-wolf`, `neutral`, `draw`), `title`, and `reason`. With an outcome it paints the matching scene and ribbon. The ribbon is decorative; the title stays text. A missing file leaves the text.
  - `/game/:gameId/results` is that shell today, on `GameLayout`, with the dusk plate and "Waiting for the result". It does not invent a winner. Pass the real outcome into `VictoryBanner` when the results projection exists. A cancelled game should keep roles hidden.
  - Avatars 6–36 are not on disk yet. `PlayerAvatar` shows initials until the file arrives. Empty seats use `mystery_avatar`.
  - The public catalog is `/roles`, read from `DEFAULT_CATALOG`. Unresolved roles stay disabled with their decision ids.

### WW-401 — Assignment tables

- **Agent:** Claude
- **Status:** COMPLETED
- **Description:** Migration for role assignments and ability instances from `docs/werewolf/data-model.md`. The original role column has no update path in the repository layer.
- **Files:** `apps/api/src/db/schema.ts`, `apps/api/drizzle/0003_assignments.sql`, `apps/api/drizzle/down/0003_assignments.sql`, `apps/api/drizzle/meta/*`, `apps/api/src/assignment/assignment.repository.ts`, `apps/api/test/migrations.integration.test.ts`, `apps/api/test/schema-drift.test.ts`, `packages/domain/src/snapshot.ts`
- **Depends on:** WW-301
- **Acceptance (met):** `changeAssignment` writes only the current fields and drops a smuggled `originalRoleId`. A trigger rejects any UPDATE of `original_role_id`, `original_profile_id`, `original_faction`, `game_id`, or `player_id` with `23001`. The migration rolls back cleanly, one step at a time. Two columns were added to the documented table: `original_profile_id` and `current_profile_id`, because Doctor has two profiles and the reveal card describes the dealt one.
- **Tests:** `pnpm test`, `pnpm test:integration`.

### WW-402 — Start deal

- **Agent:** Claude
- **Status:** COMPLETED
- **Description:** `POST /games/:gameId/start` from `docs/werewolf/api-design.md`. Host only, lobby only. Body `{ acknowledgeWarnings: true }`. Inside one transaction, validate the draft again, refuse unless every seat is filled and warnings are acknowledged when required, shuffle the role multiset with a CSPRNG Fisher-Yates, write assignment rows, and move the game to `ROLE_REVEAL`. Do not store the seed. Tests inject the shuffle. Production does not accept a client seed. Socket events wait for Phase 11.
- **Files:** `packages/domain/src/assignment/{shuffle,deal}.ts`, `packages/contracts/src/{assignment,errors}.ts`, `apps/api/src/assignment/{start.service,assignment.controller}.ts`, `apps/api/src/app.module.ts`, `apps/api/src/app.ts`, `apps/api/src/http/{api-error,error.filter}.ts`, tests in `packages/domain/test/deal.test.ts`, `packages/contracts/test/assignment.test.ts`, `apps/api/test/assignment.integration.test.ts`
- **Depends on:** WW-401, WW-205
- **Acceptance (met):** A 20-player Infection Edition deal has the exact pack counts (1 Alpha Wolf, 2 Seekers, 1 Guard, 1 Doctor, 1 Witch, 14 Villagers). An invalid draft is 422 `CONFIG_INVALID`. Open seats are 409 `SEAT_COUNT_MISMATCH`. A second or racing start is 409 `GAME_STARTED`, and a race deals once. Unacknowledged warnings are 422 `WARNINGS_UNACKNOWLEDGED`. A body with `seed` is 422. A seeded test shows each permutation and each Alpha seat is equally likely. The deal written to the database equals the domain deal for an injected source. Also checked against the built server on a scratch database.
- **Tests:** `pnpm test`, `pnpm test:integration`.
- **Handoff from Cursor (9 November 2026):** The product owner asked for this in the Cursor session. It is Claude's. The lobby Start control in `apps/web/src/routes/Lobby.tsx` stays disabled and explains the blockers. After this route exists, Cursor enables that button for the host and sends `acknowledgeWarnings` when `start.requiresWarningAcknowledgement` is set.

### WW-403 — Player and host role projections

- **Agent:** Claude
- **Status:** COMPLETED
- **Description:** `GET /games/:gameId/me` (the caller's own role) and `GET /games/:gameId/host/roster` (every role, host only), built by pure functions so privacy is unit-testable.
- **Files:** `apps/api/src/assignment/{projections,role-view.service}.ts`, `packages/contracts/src/assignment.ts`, `apps/api/test/projections.test.ts`, `apps/api/test/assignment.integration.test.ts`
- **Depends on:** WW-402
- **Acceptance (met):** For all 20 Infection Edition seats, the `/me` JSON names no role id but the caller's own. Classic Pack Wolves see each other by seat and name, never by role. The roster is 403 `NOT_HOST` for others and 409 `PHASE_CONFLICT` before the deal. Responses are parsed through their contracts before they leave, so unnamed fields are dropped. WW-702 later hardens wolf anonymity on top of this.
- **Tests:** `pnpm test`, `pnpm test:integration`.

### WW-404a — Reveal data layer in the client

- **Agent:** Claude
- **Status:** COMPLETED
- **Description:** RTK Query endpoints and hooks for start, the caller's role, and the host roster, plus a route helper, a "tonight" helper, and fixture projections.
- **Files:** `apps/web/src/api/api.ts` (tag types only), `apps/web/src/api/game.ts`, `apps/web/src/game/state/role.ts`, `apps/web/src/game/fixtures/role.ts`, `apps/web/test/state/role.test.tsx`
- **Depends on:** WW-403, WW-304a
- **Acceptance (met):** Screens can start, read their role, and read the roster without fetch code. A non-host never requests the roster. The private role leaves the cache once nothing shows it or the seat is cleared. Every fixture parses with its contract.
- **Tests:** `pnpm --filter @warewolf/web test` (26 new), `pnpm typecheck`.

### WW-404b — Reveal screen, role modal, and lobby Start control

- **Agent:** Cursor
- **Status:** COMPLETED
- **Description:** Enable Start in the lobby for the host, send everyone to the reveal once the game starts, and build the reveal scene and the private role modal from `docs/werewolf/ui-ux-plan.md`, section 7E. Like WW-304b, this can go ahead before WEB-04: the reveal is a private scene of its own, not the public rail.
- **Files:** `apps/web/src/routes/Lobby.tsx`, a new `apps/web/src/routes/Reveal.tsx`, `apps/web/src/routes.tsx` (swap the reveal placeholder), presentational components under `apps/web/src/game/components/**` (`RoleCard`, `RoleBadge`, the role modal), `apps/web/test/screens/**`
- **Depends on:** WW-404a
- **Acceptance:** A second browser does not see the first browser's role. The host starts a full room from the lobby; every seat lands on the reveal. Matches the mockup direction at all seven viewports. `prefers-reduced-motion` shows the final card at once.
- **Tests:** `pnpm --filter @warewolf/web test` and `typecheck`. Two-browser check. Browser check at the seven viewports.
- **Handoff from Claude (9 November 2026):**
  - **What exists:** the start route, `GET /me`, and `GET /host/roster` in the API, and client hooks for all three. No visual components were added or changed.
  - **Start** (`useStartGameMutation` from `src/api/game.ts`): call `startGame({ gameId, acknowledgeWarnings })`.
    - Enable Start for the host when `lobby.start.ready` is true.
    - When `lobby.start.requiresWarningAcknowledgement` is true, show the warnings first. They come from `useGetConfigurationQuery(gameId)`, under `validation.warnings[].message`. Send `acknowledgeWarnings: true` only after the host confirms.
    - Refusals, read with `apiErrorOf(result.error)`: `NOT_HOST`, `GAME_STARTED`, `CONFIG_INVALID`, `SEAT_COUNT_MISMATCH`, `WARNINGS_UNACKNOWLEDGED`. Each `message` is safe to show as is. The lobby refetches after any start attempt, so its blockers stay current.
  - **Leaving the lobby:** guests learn about the start through the 2-second lobby poll, which stops once `status` is `ACTIVE`. In `Lobby.tsx`, when `lobby.status !== 'LOBBY'`, navigate to `gamePath(gameId, lobby.status, lobby.phase)` from `src/game/state/role.ts`. It returns `/game/:id/reveal` during `ROLE_REVEAL`, `/game/:id` after, `/game/:id/results` when finished, and `null` for a cancelled room, which keeps today's cancelled view.
  - **Own role** (`useMyRole()` from `src/game/state/role.ts`) returns `{ role, isLoading, error, refetch }`. `role` is a `MyRole`:
    - `originalRole` and `currentRole`: `{ id, profileId, name, faction }`. Get the description from the catalog: `DEFAULT_CATALOG.byId.get(id)` from `@warewolf/domain`, then `.profiles[profileId].description`, or the role's own `description`. Show the original role only when it differs from the current one.
    - `abilities[]`: `{ abilityId, capability, timing, status, usesRemaining, usesPerPhase, cooldownNights, availableFromRound, onlyRound, expiresRound, target }`. Write the sentences from these fields. `usesRemaining: null` means unlimited. `timing` is `NIGHT`, `NIGHT_REACTION` (the Infection Doctor), `DAY`, or `PASSIVE`.
    - `teammatesVisible` and `teammates[]` (`{ playerId, displayName, seatNumber }`): show the teammate block only when `teammatesVisible` is true. Infection Edition never sets it. When it is true with an empty list, the player is the only wolf.
    - **"Tonight" line:** `nightAbilitiesForRound(role, 1)` lists what the player can do on night 1. Empty means "You have no night action."
    - **Errors:** `PHASE_CONFLICT` means the game has not started, so go to the lobby.
  - **Host roster** (`useHostRoster()`): returns `{ roster, ... }`. It is null for anyone but the host, and a non-host never sends the request. It belongs on the host route (WW-1202), not on the reveal.
  - **Privacy:** do not copy the role into component state, storage, or the URL. The hooks refetch on mount and on focus, and the role leaves memory once no screen shows it. Keep the role out of anything rendered beside the public log.
  - **Fixtures** (`src/game/fixtures/role.ts`): `ROLE_FIXTURES` has `villager`, `seeker`, `doctor`, `witchPoisonUsed`, `alphaWolf`, `packWolf` (one teammate), and `infected` (original Seeker, now Infected Wolf). Also `ownRoleFixture(roleId, options)` and `hostRosterFixture()`. They are built from the real catalog and match the contracts.
  - **Not built yet:** leaving `ROLE_REVEAL` is the phase machine (WW-501). Until then the table route stays a placeholder, and "I understand" can go to `/game/:id`. Art for the reveal is `reveal_wolf`, `reveal_village`, `reveal_neutral`, or `reveal_independent` by faction, and `card_back` (see the ART-02 handoff).

### WW-1201 — Configuration browser

- **Agent:** Cursor
- **Status:** COMPLETED
- **Description:** Host setup inside the lobby flow, from `docs/werewolf/ui-ux-plan.md` section 7B. A step rail on landscape and desktop. One step and a pinned count strip in portrait. Infection Edition stays locked. Players see the same summary and a waiting state.
- **Files:** `apps/web/src/game/setup/**`, `apps/web/src/routes/Setup.tsx`, `apps/web/src/routes.tsx`, `apps/web/src/routes/Lobby.tsx` (entry only), `apps/web/test/screens/setup*.test.*`
- **Depends on:** WW-304, WW-303
- **Acceptance:** An invalid setup keeps Start disabled. The summary counts stay visible at 1024×768 and at 390×844.
- **Tests:** `pnpm --filter @warewolf/web typecheck` and `pnpm --filter @warewolf/web test` (227). Browser: created an Infection Edition room, opened Game setup, confirmed the lock, the disabled Start, and the counts at 1024×768 (rail) and 390×844 (one step, no horizontal scroll). Switched to Classic, saved, and the counts became Village 8 and Wolf 2. Restored Infection Edition. Start stayed disabled with open seats and with an empty Custom draft.
- **Handoff to Claude (9 November 2026):**
  - The screen is `/lobby/:gameId/setup`, linked from the lobby action row. It uses `useGetConfigurationQuery`, `useSaveConfigurationMutation`, and `useStartGameMutation`. No API or store files changed.
  - Infection Edition (`mode === 'INFECTION'`) cannot change its role list, player count, or settings. Choosing another mode loads that mode's default pack. A later edit sets `rolePackId` to `custom` and keeps the mode.
  - An invalid draft can be saved. Start stays disabled until the local validation is valid, the draft is saved, and `lobby.start.ready` is true. Warnings still open the acknowledge dialog before start.
  - Guests see the same summary and "Waiting for the host". They do not get Save or Start.

### OD-73 — Neutral roles without an individual win

- **Owner:** Product owner
- **Status:** COMPLETED
- **Description:** Choose one of the options in `docs/werewolf/open-decisions.md`, OD-73. The `chaos-15` pack cannot start until this is decided.
- **Decision (11 November 2026):** Option 1. A role seated as Neutral or Independent with no individual victory wins if it is alive when the game ends, alongside the winning team. It does not end the game itself. Implemented by OD-73-impl.

### OD-72-rules — Chat rules

- **Owner:** Product owner
- **Status:** COMPLETED
- **Description:** Answer the chat questions listed under OD-72: night chat, dead players, a wolf channel, moderation, limits, and storage. These block WW-1104 and WW-1206.
- **Decision (11 November 2026):** The full table is in `docs/werewolf/open-decisions.md`, OD-72. In short: living players post during day discussion and voting only. Dead players read only. No wolf channel in version 1. The host can delete a message and mute a seat. 280 characters, 5 messages per 10 seconds per seat. A separate chat table, deleted when the game finishes or is cancelled. The recap does not show chat. WW-1104 and WW-1206 are no longer blocked by this.

### OD-73-impl — Survive victory for Neutral roles

- **Agent:** Cursor
- **Status:** COMPLETED
- **Description:** Apply OD-73. When a role whose victory is the team victory is seated as Neutral or Independent, its victory becomes "alive at the end of the game", recorded as an individual win next to the winning team. The validator stops raising `NEUTRAL_VICTORY_MISSING` for those seats. Unresolved roles still cannot be seated. Move `chaos-15` from BLOCKED to a seatable status.
- **Files:** `packages/domain/src/catalog/types.ts`, `packages/domain/src/config/resolve.ts`, `packages/domain/src/config/validate.ts`, `packages/domain/src/config/packs.ts`, `packages/domain/test/validate.test.ts`, `apps/api/test/lobby.integration.test.ts`, `docs/werewolf/role-catalog.md`, `docs/werewolf/game-rules.md`, `docs/werewolf/role-configuration.md`, `docs/werewolf/open-decisions.md`
- **Depends on:** OD-73
- **Acceptance:** A Neutral Shapeshifter validates. `chaos-15` validates with no errors and sums to 15. A Neutral role with no ability profile that is UNRESOLVED is still rejected. The victory checker itself (WW-902) reads this condition when it is built.
- **Tests:** `pnpm --filter @warewolf/domain test` (190) and typecheck. `pnpm --filter @warewolf/api exec vitest run --config vitest.integration.config.ts test/lobby.integration.test.ts` (32).
- **Handoff to Claude (11 November 2026), for WW-902:** Read `ResolvedEntry.victory`. A team-victory profile seated as Neutral or Independent is `SURVIVE_VICTORY`: individual trigger `ALIVE_AT_GAME_END`, `endGameOnWin: false`, `revealOnWin: false`. Jester, Assassin, and Lone Wolf keep their own triggers. The catalog profile itself stays `TEAM`. `chaos-15` is `RECOMMENDED` with `blockedBy: []`. Lobby tests that mark a game active now also set `round_number = 1`, which the phase-machine check requires.

### WW-501 to WW-503 — Phase machine

- **Agent:** Claude
- **Status:** COMPLETED
- **Description:** Phase 5 from `docs/werewolf/implementation-plan.md`. Persist phase, round, version, and deadlines. One close path for the host and the timer, with the version guard. Timed auto-advance that survives a restart. Host-confirm and Doctor-reaction windows only when the configuration needs them.
- **Files:**
  - Domain: `packages/domain/src/phase/machine.ts` (new), one export line in `packages/domain/src/index.ts`, `packages/domain/test/phase.test.ts` (new).
  - Contracts: `packages/contracts/src/phase.ts` (new), one export line in `packages/contracts/src/index.ts`, `packages/contracts/test/phase.test.ts` (new).
  - API: `apps/api/src/phase/**` (new), `apps/api/src/app.module.ts`, `apps/api/src/db/schema.ts`, `apps/api/drizzle/0004_phase_machine.sql` with its down file and snapshot, `apps/api/test/phase.integration.test.ts` (new), `apps/api/test/migrations.integration.test.ts`.
  - Web data layer: `apps/web/src/api/api.ts` (`GameState` tag), `apps/web/src/api/game.ts`, `apps/web/src/api/lobby.ts` (cancel and transfer refresh the game state), `apps/web/src/game/state/phase.ts` (new), `apps/web/src/game/fixtures/phase.ts` (new), `apps/web/test/state/phase.test.tsx` (new).
  - Docs: `api-design.md`, `data-model.md`, `implementation-plan.md`, `night-resolution.md`, `implementation-checklist.md`, `open-decisions.md` (OD-74).
- **Acceptance:** Illegal transitions return 409. A passed deadline advances a Classic game after a restart. Classic skips both windows and Infection Edition opens both.
- **Tests:** `pnpm typecheck` clean. `pnpm test`: domain 190, contracts 70, art 13, API 31, web 248. `pnpm test:integration`: 102, including 21 phase tests: the full Infection round, Classic skipping both windows, check order, two racing closes (one 200, one 409), a failing resolver leaving the phase unchanged, a night that ends the game, a tie then a revote, deadlines per phase, the timer firing early and on time, host transfer and cancel during a timed phase, retry after a failed timed close, and a restart with real timers. The dev database is migrated to `0004_phase_machine`.
- **Decisions made here:**
  - **OD-74 (needs product-owner confirmation):** the night windows are fixed by the frozen configuration, not by who is alive. Otherwise the table would see the reaction window disappear the night the Doctor is silently infected. A Doctor who cannot act counts as a decline, and the host closes the window.
  - Only night submission, day discussion, and each ballot have timers (the three configured timers, OD-43). Role reveal, the day announcement, host confirm, and the reaction window wait for the host in every game.
  - Until WW-802 and WW-901, resolutions are stand-ins: a night kills nobody and a ballot eliminates nobody. The phase machine runs end to end on them. The round cap draw (OD-52) belongs to WW-902.
- **Handoff to Claude, for later phases:**
  - WW-802 and WW-901 implement `PhaseResolvers` in `apps/api/src/phase/resolution.ts` and bind it to `PHASE_RESOLVERS` in `app.module.ts`. Each resolver runs inside the close transaction under the game lock and returns `{ gameOver }` or `{ gameOver, tied }`.
  - WW-803 must make closing `NIGHT_HOST_CONFIRM` require a chosen target or `noKill`. Today the host can close it with nothing chosen.
  - `resolve-night` and `voting/close` should call the same `PhaseService` close, not a second path.
- **Handoff to Cursor (WEB-06):**
  - Hooks in `apps/web/src/game/state/phase.ts`:
    - `useGameState()` returns `{ state, clockOffsetMs, isLoading, error, refetch }`. It polls every 2 seconds and stops once the game is finished or cancelled.
    - `useSecondsLeft(view)` returns whole seconds on the server's clock, or null when the phase has no deadline.
    - `useClosePhase(state)` returns `{ canClose, close, isClosing, error, closePhase }`.
  - `state` is the `GameState` contract: `status`, `phase`, `roundNumber`, `stateVersion`, `pacing`, `phaseStartedAt`, `phaseEndsAt`, `serverNow`, `close`, `players[]` (`playerId`, `displayName`, `seatNumber`, `avatarId`, `isHost`, `lifeStatus`), and `you` (`playerId`, `isHost`, `lifeStatus`).
  - `close` says what the host's button does: `{ next: 'NIGHT_HOST_CONFIRM', resolves: null }` moves to that phase, and `{ next: null, resolves: 'NIGHT' | 'DAY' }` runs a resolution. It is null when nothing can close. Use it for the button label.
  - `canClose` is true only for the host while the game runs. `closePhase()` sends the version on screen. A PHASE_CONFLICT error means the screen was stale; the state has already refetched, so show the new phase and a short "The game moved on" note.
  - Fixtures: `gameStateFixture({ phase, roundNumber, you, dead, secondsLeft })` and `INFECTION_CLOSES` in `apps/web/src/game/fixtures/phase.ts`.

### WEB-06 — Phase banner, countdown, and host close button

- **Agent:** Cursor
- **Status:** COMPLETED
- **Description:** The table route (`/game/:id`) from `docs/werewolf/ui-ux-plan.md`: the stage follows `stageModeFor(state.phase)`, the status line shows the phase and round, `CountdownTimer` shows `useSecondsLeft` when a deadline exists and "Waiting for host" when it does not, and the host gets a phase button labelled from `state.close`. Leaving `ROLE_REVEAL` now works: the host closes it, and every seat's poll moves them to the table. Action panels, results, and votes are later tasks.
- **Files:** `apps/web/src/game/components/phaseCopy.ts`, `apps/web/src/game/components/CountdownTimer.tsx`, `apps/web/src/game/components/GameStatusBar.tsx`, `apps/web/src/game/components/PhaseCloseButton.tsx`, `apps/web/src/game/components/table-screen.css`, `apps/web/src/routes/Table.tsx`, `apps/web/src/routes.tsx`, `apps/web/src/routes/Reveal.tsx`, `apps/web/src/game/components/reveal-screen.css`, `apps/web/test/screens/table.test.tsx`, `apps/web/test/screens/phase-copy.test.ts`, `apps/web/test/routes.test.tsx`, `apps/web/test/screens/art-screens.test.tsx`, `apps/web/e2e/table.spec.ts`. Read state only through `src/game/state/phase.ts`; do not fetch in screens.
- **Depends on:** WW-501 to WW-503
- **Acceptance (met):** Two sessions move from role reveal to night on the host close: the host immediately, the guest on the next poll. The host button is absent for guests. A timed Classic night shows `1:30`, and a deadline already at 0 is replaced by the next phase. The status line and host button stay inside the viewport at all seven projects, including 1024×768, 844×390, and 390×844. A cancelled game stays on the table and does not reveal roles.
- **Tests:** `pnpm --filter @warewolf/web typecheck`. `pnpm --filter @warewolf/web test`. `pnpm --filter @warewolf/web exec playwright test e2e/table.spec.ts` (8 passed: the phase bar at all seven viewports, and the clock reaching 0 at 1024×768). The earlier `GameStatusBar` type error is fixed. The avatar test expected portrait 36 to be missing; that file is on disk, so the initials case now uses a seat with no avatar id.
- **Handoff to Claude (WEB-07):** The table does not submit actions. Screens still read phase only through `src/game/state/phase.ts`. `WEB-07` can add `src/game/state/actions.ts` and the action endpoints. Do not put fetch calls in `Table.tsx` or `Reveal.tsx`.
- **Handoff for WW-604:** The action row is only the host's phase button, or "Waiting for host" / "The timer closes this phase." Night targets, votes, and the morning report's facts are not built. The stage already follows `stageModeFor`, so the panel replaces the waiting line in that row. Seats are public: name, life word (Alive or Eliminated), host, and you. No role is rendered on the table.

### WW-601 to WW-603 — Ability execution (engineering)

- **Agent:** Claude
- **Status:** COMPLETED
- **Description:** Phase 6 from `docs/werewolf/implementation-plan.md`. One submit path for every capability, with a handler registry, target rules, charges, cooldowns, and idempotency.
- **Files:**
  - Domain: `packages/domain/src/action/registry.ts`, `packages/domain/src/action/submission.ts` (new), export lines in `packages/domain/src/index.ts`, `packages/domain/test/action.test.ts` (new).
  - Contracts: `packages/contracts/src/action.ts` (new), an export line in `src/index.ts`, `packages/contracts/test/action.test.ts` (new), `packages/contracts/vitest.config.ts`. The config now resolves the domain's source; before, these tests silently ran against the domain's last `dist` build.
  - API: `apps/api/src/action/**` (new), `apps/api/src/app.module.ts`, `apps/api/src/db/schema.ts`, `apps/api/drizzle/0005_night_actions.sql` with its down file and snapshot, `apps/api/src/http/api-error.ts`, `apps/api/src/http/error.filter.ts`, `apps/api/src/phase/phase.service.ts` (closing a window locks its actions), `apps/api/test/action.integration.test.ts` (new), `apps/api/test/migrations.integration.test.ts`, `apps/api/test/schema-drift.test.ts`.
  - Docs: `api-design.md` (section 6), `data-model.md`, `implementation-checklist.md`.
- **Acceptance:** Duplicate key replays. A locked window conflicts. Adding a capability is a registry entry, not a role id switch. The Guard cannot repeat a target. Witch potions stop at one.
- **Tests:** `pnpm test`: domain 221, contracts 75, art 13, API 33, all passing. `pnpm test:integration`: 119, including 14 action tests. They cover the window, replay and conflict, per-seat keys, replace, a race, locking on close, the informed Doctor, ownership and other-game 404s, a dead actor, a revoked ability, a spent potion, target rules, the Guard's repeat rule across rounds, and a cancelled game. Domain, contracts, and API typecheck clean. The dev database is migrated to `0005_night_actions`.
  - Web, at hand-off: `apps/web` typecheck fails in `GameStatusBar.tsx`, and two web tests fail (`table.test.tsx`, `art-screens.test.tsx`). All three files are Cursor's WEB-06 work in progress; this task did not touch `apps/web`. WEB-06 completed those afterwards.
- **Decisions made here:**
  - Submission checks read only what the actor already knows: phase, public life status, their own seat, their own ability. Rules that depend on a target's role or team (a wolf cannot be infected, friendly fire, the infection cap) belong to the resolver, which applies them silently. Otherwise an error code would answer "is that player a wolf?"
  - Idempotency keys are scoped per seat, not only per game (`data-model.md` said per game).
  - A replaced choice is cancelled and a new row inserted, so the host dashboard and audit keep every choice.
- **Handoff to Claude, for later phases:**
  - WW-801 adds each capability's resolution step to the registry entries in `packages/domain/src/action/registry.ts`.
  - WW-802 reads `LOCKED` actions for the round, moves them to `RESOLVED` or `REJECTED`, and writes `consumeUse(...)` onto each ability that spent a use, including redundant protections (OD-48).
  - WW-803 stores the host's confirmed target. The informed Doctor's action has no targets; the resolver uses the confirmed one.
- **Handoff to Cursor (WW-604, after WEB-07):** the panel's data is `GET /games/:gameId/me/actions` (contract `myActionsSchema`). Each ability is `{ abilityInstanceId, abilityId, availability, action }`.
  - `availability` is `OPEN` when it can be submitted now. Otherwise it is one of `PASSIVE`, `REVOKED`, `DEAD`, `NOT_THIS_PHASE`, `NOT_YET`, `EXPIRED`, `NO_USES`, or `COOLDOWN`, for the disabled-state copy.
  - `action` is the current choice, `PENDING` (changeable) or `LOCKED`.
  - Target rules come from `/me` `abilities[].target`. `FINAL_WOLF_TARGET`, `OWN_RESULT`, and `NONE` take no player. `QUESTION` takes a question from the list.
  - A 422 `ACTION_TARGET_ILLEGAL` carries `issues[0].message` written for the player.
  - WEB-07 will add `useSubmitAction` and `useMyActions` in `apps/web/src/game/state/actions.ts`.

### WW-604 — Generic action panel

- **Agent:** Cursor
- **Status:** COMPLETED
- **Description:** One night action panel and one player grid, driven by `actionPrompts`. Seeker and Guard render from fixtures. No Seeker, Guard, or Witch page. The host phase button from WEB-06 stays.
- **Files:** `apps/web/src/game/components/actionCopy.ts`, `apps/web/src/game/components/actionDraft.ts`, `apps/web/src/game/components/NightActionPanel.tsx`, `apps/web/src/game/components/PlayerGrid.tsx`, `apps/web/src/game/components/table-screen.css`, `apps/web/src/routes/Table.tsx`, `apps/web/test/screens/action-copy.test.ts`, `apps/web/test/screens/action-panel.test.tsx`, `apps/web/test/screens/table.test.tsx`, `apps/web/e2e/table.spec.ts`, `docs/werewolf/implementation-checklist.md` (WW-604 status cell only), `docs/AI-TASK-BOARD.md`. Reads actions only through `src/game/state/actions.ts` and `src/game/state/role.ts`.
- **Depends on:** WEB-07
- **Acceptance (met):** Seeker and Guard both render from fixtures on `/game/:id`, with no role page. The Witch sees two controls. Submit stays disabled until the selection is legal. After a successful submit the row reads "Submitted", and another seat can be chosen until the server locks the window. A locked choice cannot be changed. PASSIVE rows are hidden. Other availability reasons get a disabled sentence. The private role name sits in the panel; Hide role collapses it to "Your role". It is not in the discussion rail. Dead seats stay visible and are not selectable when the rule wants the living. The host phase button stays.
- **Tests:** `pnpm --filter @warewolf/web typecheck`. `pnpm --filter @warewolf/web test` (22 files, 274 tests). `pnpm --filter @warewolf/web exec playwright test e2e/table.spec.ts`: the phase bar stays on screen at all seven viewports, and a Seeker picks, submits, changes the pick, and hides the role at 1024×768, 844×390, and 390×844. Submit stays inside the viewport. No horizontal page scroll.
- **Handoff:** The action row replaces the waiting line when the night has an open ability, and says "Waiting for night to end" when it does not. `notSameAsLastRound` is named in the panel ("Not the same player as last night.") and still enforced by the server, because the projection does not include last round's target. A 422 shows `issues[0].message`. Votes, the morning report's facts, and day ballots are still later tasks. Screens still do not fetch; they call `useMyRole`, `useMyActions(state.stateVersion)`, `actionPrompts`, and `useSubmitAction`.

### WEB-07 — Client data layer for actions

- **Agent:** Claude
- **Status:** READY
- **Description:** RTK Query endpoints for `POST /actions` (it generates a UUID `Idempotency-Key` per user choice and reuses it on retry) and `GET /me/actions` (polled with the game state, refetched after submit and on phase change), and hooks in `apps/web/src/game/state/actions.ts`. WEB-06 is done, so this can use `apps/web/src/api` and `src/game/state`.
- **Depends on:** WW-601, WEB-06

### WW-701 to WW-703 — Infection Edition rules

- **Agent:** Claude
- **Status:** COMPLETED
- **Description:** Phase 7. The pure night resolver for the Infection Edition and Classic roles, wolf anonymity, and Infection Edition as the default.
- **Files:**
  - Domain: `packages/domain/src/night/resolve.ts` (new), an export line in `packages/domain/src/index.ts`, `packages/domain/test/night.test.ts` (new).
  - API tests: `apps/api/test/anonymity.integration.test.ts` (new), `apps/api/test/lobby.integration.test.ts` (the default test now asserts mode, pack, and 20 players).
  - Docs: `implementation-checklist.md`, `night-resolution.md`.
- **What `resolveNight` does:**
  - It takes the start-of-night state, the locked actions, the host's kill decision, and the infection counter. It returns deaths with causes, saves with every saver, Seeker results, the infection outcome with its failure reason, conversions, ability grants, ability updates (uses spent and abilities revoked), action outcomes, the new infection counter and seal, and public facts.
  - It covers host-select, majority, and Alpha-priority aggregation, friendly fire, Guard and Shieldbearer protection, the informed, limited, and blind Doctor, the Witch's save and poison, and infection. Infection follows the OD-03 survival rule, the 4-success and 5-wolf caps, eligibility, the Alpha's seal (C-09), revocation, and the next-night kill grant.
  - It covers the testing plan's matrix for these roles and every same-night example in section 8 that uses them.
- **Tests:** domain 258, contracts 75, art 13, API 33, web 258. Integration: 123, including 4 anonymity tests. Typecheck is clean in every package.
- **Decisions made here:**
  - Under `ALPHA_PRIORITY`, when the Alpha sent no kill, the other wolves' submissions are counted by majority. This was not specified.
  - With `grantKillNextNight: false`, a converted player gets no kill.
  - Both are written in `night-resolution.md`.
- **Handoff to Claude, for later phases:**
  - WW-802 calls `resolveNight` in the phase close (`PhaseResolvers.resolveNight`) and writes the result:
    - elimination, infection, investigation, and conversion records, and `changeAssignment` for each conversion;
    - an ability update or insert for each patch and grant;
    - each action's status;
    - a `resolution_run`.
  - WW-802 must also persist the infection counter and seal, which today exist only in the result.
  - WW-801 adds the steps that return `NOT_IMPLEMENTED` today, and must land before an Expanded pack's special roles do anything at night.
  - WW-803 supplies `hostDecision`.
- **Files:** `apps/web/src/api/actions.ts` (new), `apps/web/src/api/api.ts` (`MyActions` tag), `apps/web/src/api/game.ts` (a phase close refetches actions), `apps/web/src/game/state/actions.ts` (new), `apps/web/src/game/fixtures/actions.ts` (new), `apps/web/test/state/actions.test.tsx` (new).
- **Tests:** web 264 and typecheck clean. Six new tests cover the fixtures against the contract, joining the prompts, the request keys, key reuse for the same choice and a new key for a new choice, a refusal's message, and the refetch when the phase moves.
- **Handoff to Cursor (WW-604):**
  - `useMyActions(state?.stateVersion)` returns `{ actions, isLoading, error, refetch }`. It refetches when the phase moves. Pass the version from `useGameState`.
  - `actionPrompts(role, actions)` joins `useMyRole().role` with `actions` and returns one row per ability, in card order, as `{ abilityInstanceId, abilityId, availability, action, ability }`. `ability.target` is the target rule:
    - `PLAYERS` with `count`, `life`, `self`, and `notSameAsLastRound`;
    - `FINAL_WOLF_TARGET`, `OWN_RESULT`, or `NONE`, which take no player;
    - `QUESTION` with its `questions` list.
  - `availability` is `OPEN`, or a reason it is not: `PASSIVE` (hide the row), `REVOKED`, `DEAD`, `NOT_THIS_PHASE`, `NOT_YET`, `EXPIRED`, `NO_USES`, or `COOLDOWN`. `action` is the current choice: `PENDING` can still change, and `LOCKED` cannot.
  - `useSubmitAction()` returns `{ submit, isSubmitting, error }`. Call `submit({ abilityInstanceId, targetPlayerIds, payload })`. It picks the `Idempotency-Key`. Show `error.issues[0]?.message` for `ACTION_TARGET_ILLEGAL`; it is written for the player.
  - Fixtures: `myActionsFixture(role, { phase, roundNumber, availability, chosen })` in `src/game/fixtures/actions.ts`, built from the `ROLE_FIXTURES` roles. Seeker and Guard both render from these.

### WW-801 and WW-802 — Night resolver and its commit

- **Agent:** Claude
- **Status:** COMPLETED
- **Description:** Phase 8 from `docs/werewolf/implementation-plan.md`. WW-801 finishes the pure `resolveNight` with every step in `night-resolution.md`, section 2. WW-802 runs it inside the phase close and writes the result in the same transaction.
- **Files:**
  - Domain: `packages/domain/src/night/resolve.ts` (rewritten as the full pipeline), `night/types.ts` and `night/information.ts` (new), `action/registry.ts` (`nightStep` on each entry), `catalog/definitions/investigation.ts` (Prophet `packSizeAtLeast: 3`), `catalog/definitions/support.ts` (Blacksmith `holdUntilBlocked: true`), `index.ts` (exports `canonicalJson`).
  - Domain tests: `test/support/night.ts` (shared builders, new), `test/night.test.ts` (uses them), `test/night-expanded.test.ts` and `test/night-golden.test.ts` (new), `test/action.test.ts` (registry entries carry `nightStep`).
  - API: `apps/api/src/night/night-resolution.service.ts` (new), `src/phase/resolution.ts` (`phaseResolvers`), `src/app.module.ts`, `src/db/schema.ts`, `drizzle/0006_night_resolution.sql` with its down file and snapshot, `test/night.integration.test.ts` (new), `test/action.integration.test.ts` (a closed reaction window now resolves), `test/migrations.integration.test.ts`, `test/schema-drift.test.ts`.
  - Docs: `night-resolution.md`, `data-model.md`, `implementation-checklist.md`.
- **Acceptance (met):** Golden fixtures compare the whole `NightResult` for every same-night example in section 8. Double resolve is one commit: two racing closes give one 200 and one 409; a second resolve of the same night, even with the phase forced back, is a 409 that changes nothing; the unique `(game_id, round_number, phase_kind)` key rejects a duplicate run; a write that fails halfway rolls the close back with the phase, seats, and actions untouched, and the retry commits.
- **Tests:** `pnpm typecheck` clean. `pnpm test`: domain 319, contracts 75, art 13, API 43, web 274. `pnpm test:integration`: 130, including 7 night tests (a Classic kill with its elimination, investigation, actions, ability use, and run; an Infection conversion with its assignment, revoked and granted abilities, conversion and infection records, and counter; an Avenger's revenge queued on night 1 and landing on night 2 in `chaos-15`; and the four commit tests above). The dev database is migrated to `0006_night_resolution`.
- **Decisions made here:** the engineering defaults are listed in `night-resolution.md`, section 2. The ones a product owner may want to look at:
  - A Bodyguard does not take a hit that a heal on the protectee is about to cancel. OD-14 says so, but heals are a later step than redirects, so the step order alone would have killed the Bodyguard.
  - Blocks land together, so a blocked Disruptor's own block still stands.
  - Cursed conversion follows any surviving wolf attack, the Lone Wolf's included, and does not count toward the 4 infection successes.
  - The Spy's count includes the Lone Wolf's kill.
  - The Prophet's threshold defaults to 3 living pack members. OD-26 says only "a configured integer".
  - The Blacksmith item now stays on its holder until it blocks (OD-16). Before, it lasted one night.
- **Handoff to Claude, for later phases:**
  - **WW-803** stores the host's confirmed target and passes it as `hostDecision` in `NightResolutionService.load`. Until then it is null, so a host-select night (Infection Edition) kills nobody. Check that the target is among the locked wolf submissions.
  - **WW-804** writes `game_events` from the stored rows after commit: investigation results to the actor and the host, `ROLE_CONVERTED` to the converted player, and public deaths from `elimination_records.revealed_publicly`. `NightResult.blocks[].informTarget` says whether a blocked player is told. `resolution_runs.result` holds the whole result for the host.
  - **WW-901** must, in the day resolution: apply `scheduled_effects` of kind `POISON` with `due_phase = 'DAY'` and `due_round` equal to the round, and close them; run Immortal, Jester, and Avenger on a day elimination (queue revenge as a `REVENGE` effect due the next night, as step 16 does); hand a Doctor's save to a Healer Assistant when the Doctor is voted out; and set `games.infection_sealed` when the Alpha is voted out.
  - **WW-902** evaluates victory on the result. `NightResolution.gameOver` is always false until then.
  - Rows written per night: `resolution_runs`, `elimination_records`, `infection_records`, `investigation_records`, `role_conversion_records`, `scheduled_effects`, `role_assignments` through `changeAssignment`, `ability_instances` (patches and grants, with `source` COPY or INHERITED and `source_player_id`), `night_actions.status` and `rejected_reason`, `game_players.life_status` and `died_round`, and `games.infection_successes` and `infection_sealed`.
- **Handoff to Cursor (WW-604):** no contract changed. One behavior to know: once a night resolves, its actions are `RESOLVED` or `REJECTED`, and `GET /me/actions` returns only `PENDING` and `LOCKED` choices, so from the day announcement on each row's `action` is null. Show the ability's availability, not "Submitted". A dead seat's abilities read `DEAD`.

