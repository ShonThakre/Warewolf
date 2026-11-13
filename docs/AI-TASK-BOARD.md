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

Last updated: 12 November 2026. Every open decision is settled (DEC-ROLES, DEC-ALL): all presets except the Pack 2 reconstruction are CONFIRMED; Hermit, Priest, Confuser, and Bard stay out of version 1. The role catalog status column matches that, and the art test checks a fake role id.

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
| WEB-08 | Day ballot on the table: living seats, abstain, confirm, replace until close | Cursor |
| WW-1204 | `GameLayout` viewport pass for reveal, night results, day, voting, and results | Cursor |
| WEB-07 | Client action data layer: `useMyActions`, `useSubmitAction`, `actionPrompts`, action fixtures | Claude |
| WEB-02 | `GameLayout` structure, `layoutMode`, stage modes, lobby and table fixtures, `/dev/layout` preview | Claude |
| WW-401 to WW-403, WW-404a | Phase 4 engineering: assignment tables, CSPRNG deal and start route, `/me` and host roster, client start and role hooks | Claude |
| WW-000 to WW-105 | Repository audit and Phase 1 skeleton: pnpm workspace, PostgreSQL in Compose, `games` migration with rollback, domain types, health and version routes, web shell with route placeholders | Claude |
| WW-201 to WW-205, WW-1006 | Phase 2: 37-role catalog, Doctor, Assassin, and Blacksmith profiles, `validateConfiguration`, nine role packs, blocking-decision acknowledgements | Claude |
| WW-804 | Private night-result events written after the night commit | Cursor |
| WW-1101 | Socket authentication and seat rooms on `/play` | Cursor |
| WW-1301 | Token hashing, generic errors, and join rate limits | Cursor |
| WW-1302 | Boot recovery after a resolved night | Cursor |
| WW-1401 | Seeded Infection simulator, 1,000 games | Cursor |
| WW-803b | Host kill-target picker and the Doctor's target line on the table | Cursor |
| WW-1206 | Live composer in the discussion rail, with the host moderation controls | Cursor |
| WW-903 | Public results screen: original and final roles, cancelled seats and reason, no tally | Cursor |
| WW-1403 | Deal-count tests for the five presets | Cursor |
| UX-03 | Home screen matched to `01-home.png` | Cursor |
| VOTE-CFG | Voting flags on public game state, wired into the table ballot | Cursor |
| CREATE-SETUP | Create Game opens Game setup | Cursor |

---

## Board

| Id | Task | Agent | Status | Depends on |
|---|---|---|---|---|
| ROLE-FIX | Role-power gaps from audit: day PlayerGrid (Sniper/Mind Controller), Elder OD-33 penalty, Trapper ATTACKER_IDS note, hardening tests | Cursor | COMPLETED | — |
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
| WW-803a | Host kill target: storage, API, close guard, the informed Doctor's target, client data layer | Cursor | COMPLETED | WW-802, WW-503 |
| WW-803b | Host kill-target picker and the Doctor's target line on the table | Cursor | COMPLETED | WW-803a |
| WW-1104 | Chat: message contract, storage, send endpoint, socket fan-out, host moderation, client data layer | Claude | COMPLETED | WW-1102, OD-72 |
| WW-1206 | Live composer in the discussion rail, with the host moderation controls | Cursor | COMPLETED | WW-1104, WW-1204 |
| WW-1601 | Capacitor in `apps/web`, Vite build synced into `apps/web/android` | Claude | COMPLETED | WW-1204 |
| WW-1603 | Seat token in Capacitor Preferences in the APK, sessionStorage on web | Claude | COMPLETED | WW-1601 |
| WW-1602 | Sideload `app-debug.apk`: INTERNET only, build-time API origin, LAN debug | Claude | COMPLETED | WW-1601, WW-1501 |
| WW-1402 | 10,000 Infection games on the approved Doctor mode, report under docs | Claude | COMPLETED | WW-1401, OD-02 |
| WW-1604 | Install smoke test: open APK, create or join, restore session after restart | Claude | COMPLETED | WW-1602, WW-1603 |
| WW-1605 | Installable web app (manifest, home-screen icons, full screen) and an APK against the Render server with the app icon | Claude | BLOCKED | WW-1602, HOST-01 |
| OD-74 | Confirm that night windows are fixed by the configuration | Product owner | COMPLETED | — |
| WEB-08 | Day ballot on the table: living seats, abstain, confirm, replace until close | Cursor | COMPLETED | WW-901, WW-604 |
| WW-1204 | `GameLayout` viewport pass for reveal, night results, day, voting, and results | Cursor | COMPLETED | WW-1201, WW-604 |
| WW-903 | Public tally and results screen | Cursor | COMPLETED | WW-901, WW-902, WW-903a |
| WW-903a | Results projection: `GET /games/:gameId/results`, contract, client data layer | Claude | COMPLETED | WW-902 |
| WW-1202a | Host dashboard projection: `GET /games/:gameId/host/dashboard`, contract, client data layer | Claude | COMPLETED | WW-1103, WW-803 |
| WW-1202 | Host dashboard screen on `ResponsiveSidebar` | Cursor | COMPLETED | WW-1202a |
| WW-1203 | Results recap viewport pass, including 568×320 | Cursor | COMPLETED | WW-903 |
| WEB-09 | One shared `/play` socket for the phase signal and chat | Claude | COMPLETED | WW-1104, WW-1206 |
| WW-1503 | Request ids in logs and a readiness check | Claude | COMPLETED | WW-1501 |
| WW-904 | Public vote tally after each ballot closes (OD-85): storage, event, route, recap, client data layer | Claude | COMPLETED | WW-901 |
| WW-904b | Show the public tally on the table after each ballot, and in the results recap | Cursor | COMPLETED | WW-904 |
| WW-1003b | Sniper day shot (OD-29): resolution at the close of day discussion | Claude | COMPLETED | WW-904 |
| WW-1303 | Audit of every host route: guards, secrets, and a test per route | Claude | COMPLETED | WW-1202 |
| DEC-ROLES | Role decisions accepted (OD-05 to OD-38, OD-46, OD-48, OD-58): roles and six presets CONFIRMED | Claude | COMPLETED | Product owner |
| DEC-ALL | Remaining decisions accepted as built (OD-39 to OD-84); Ultimate 20 CONFIRMED; four powerless roles kept out | Claude | COMPLETED | Product owner |
| WW-1102 | Emit stored events after commit and support `afterSeq` | Cursor | COMPLETED | WW-804, WW-1101 |
| WW-1103 | Phase banners update from the public phase signal | Cursor | COMPLETED | WW-1102, WW-604 |
| WW-1205 | Playwright coverage for the seven viewports | Cursor | COMPLETED | WW-1204 |
| WW-1304 | Structured logs with ids only | Cursor | COMPLETED | WW-1301 |
| WW-1501 | Production Compose file for web, api, and PostgreSQL | Cursor | COMPLETED | WW-1302 |
| WW-1502 | Migrations on startup | Cursor | COMPLETED | WW-1501 |
| U20-ENG | Ultimate 20 mode: catalog, pack, lock, submission rules, day tally, victory evaluator, resolver steps, API submit, web data layer, art manifest, docs | Cursor | COMPLETED | WW-802 |
| U20-UI | Ultimate 20 screens and copy: locked setup copy, hint field, exclusive-choice note, Mind Controller day prompt, portraits | Cursor | COMPLETED | U20-ENG |
| U20-PLAY | Playable image rules: mark timeline, Vampire team kill-or-mark, private promotion, Chaos pool, victory | Cursor | COMPLETED | U20-ENG |
| WW-804 | Private result events after the night commit | Cursor | COMPLETED | WW-802 |
| WW-1101 | Socket authentication and rooms | Cursor | COMPLETED | WW-403 |
| WW-1301 | Token hashing, generic errors, rate limits | Cursor | COMPLETED | WW-302, WW-601 |
| WW-1302 | Boot recovery after night resolution | Cursor | COMPLETED | WW-502, WW-802 |
| WW-1403 | Deal tests for 10, 15, 20, 24, and 30 seats | Cursor | COMPLETED | WW-402 |
| WW-1401 | Seeded simulator, 1,000 Infection games | Cursor | COMPLETED | WW-902 |
| SETUP-CAP | Custom setup raises the wolf cap to the starting pack | Cursor | COMPLETED | — |
| UX-01 | End-to-end UX pass: role portraits and fallback, catalog cards, home, lobby, setup, reveal, table action states, host, results | Cursor | COMPLETED | — |
| UX-02 | Address UX-01 leftovers: restart stale Vite, honest vote copy + handoff for voting flags on state, Results polish; note OD-75–84 accepted as built | Cursor | COMPLETED | UX-01 |
| UX-03 | Home screen matched to `01-home.png` at 1586×992 | Cursor | COMPLETED | UX-02 |
| UX-04 | Lobby screen matched to `02-lobby.png` at 1586×992 | Cursor | COMPLETED | UX-03 |
| VOTE-CFG | Expose `voting.abstain` and `voting.changeUntilClose` on GameState (or a public seat projection) so the table can hide abstain and lock changes | Cursor | COMPLETED | UX-02 |
| UX-05 | Game setup matched to `03-setup.png` at 1586×992 | Cursor | COMPLETED | UX-04 |
| CREATE-SETUP | After Create Game, open Game setup instead of the lobby | Cursor | COMPLETED | UX-05 |
| UX-06 | Role reveal matched to `04-role-reveal.png` at 1586×992 | Cursor | COMPLETED | UX-05 |
| UX-07 | Night action matched to `05-night.png` at 1586×992 | Cursor | COMPLETED | UX-06 |
| UX-08 | Night resolution / host reaction matched to `06-night-resolution.png` at 1586×992 | Cursor | COMPLETED | UX-07 |
| UX-09 | Morning results matched to `07-morning-results.png` at 1586×992 | Cursor | COMPLETED | UX-08 |
| UX-10 | Day discussion matched to `08-day-discussion.png` at 1586×992 | Cursor | COMPLETED | UX-09 |
| HOST-01 | Host on Render (free plans): one Docker web service where the API serves the built client (`WEB_DIST_DIR`), plus Render Postgres. Merged to `main` (PR #2, then 0fb9894 for the free plans). Blueprint applied; Render redeploys on every push to `main`, so `main` must pass `pnpm typecheck`. Files: `Dockerfile`, `render.yaml`, `apps/api/src/{app,config}.ts`, `apps/api/src/http/web-client.ts`, `apps/api/test/static-web.test.ts`, `README.md`, `.env.example` | Claude | IN_PROGRESS | WW-1501 |
| E2E-01 | Black-box game driver package `tools/e2e` (`@warewolf/e2e-tools`): HTTP driver, scripted policies, per-phase invariants, socket listener | Claude | COMPLETED | — |
| E2E-02 | Every pack played to a result through the API (35 scenarios): `apps/api/test/modes.integration.test.ts`, `pnpm e2e:api` | Claude | COMPLETED | E2E-01 |
| E2E-03 | Browser flows against the real API (Classic journey, Infection host confirm, tie, reload, How to Play, cancel × desktop-fhd and phone-land): `apps/web/playwright.live.config.ts`, `apps/web/e2e-live/**`, `e2e:live` | Cursor | COMPLETED | E2E-01 |
| E2E-04 | E2E report with the mode × scenario matrix and every defect: `docs/werewolf/e2e-report.md` | Claude | COMPLETED | E2E-02, E2E-03 |
| HOWTO-01 | How to Play page replaces the placeholder; same text in `docs/werewolf/how-to-play.md`. Functional styling done; visual pass is Cursor's | Cursor | COMPLETED | — |
| GAP-01 | Seeker publishes a stored result in day discussion: refused without a result, public `RESULT_PUBLISHED`, table note. Migration 0014 | Claude | COMPLETED | — |
| GAP-02 | In-game Cancel game and Make host buttons on the Host dashboard (API and `useCancelGameMutation` already exist). Leaving a started game waits on a product decision | Cursor | COMPLETED | — |
| GAP-03 | Ultimate 20 deliveries: `GHOST_HINT`, `PLAYER_RETURNED`, `SILENCED` (chat refuses the seat), `REWIND_RESULT`, `ABILITY_COPIED`, `CHAOS_EVENT`, table notes | Claude | COMPLETED | — |
| GAP-04 | Play again clears the old seat (done). The unreachable Table play-again and cancelled stage are left for Cursor's next `Table.tsx` pass | Claude | COMPLETED | — |
| GAP-05 | Stale copy: Lobby "Chat is not open in this version.", old Phase 11 comments | Cursor | COMPLETED | — |
| GAP-06 | Connection indicator on the table (hook by Claude, visual by Cursor) | Claude + Cursor | READY | — |
| PLAY-FIX-01 | Playtest fixes: the infected seat's role card and picture refresh without a reload; Seeker results always reach the table (socket events plus a delayed refetch after the night commit); Seeker gains a once-per-game role card (`seeker_see_role`, exclusive with the Wolf check). Files: `packages/domain/src/catalog/definitions/core.ts`, `packages/domain/test/*`, `apps/web/src/game/state/{realtime,role,tableNotes}.ts`, `apps/web/src/game/components/{actionCopy,tableNotes}.ts`, `apps/web/src/routes/Table.tsx`, web tests | Claude, then Cursor | REVIEW | — |
| GAP-07 | Coverage: Servant `WITH_VAMPIRE` win was already tested (`victory.test.ts`); 10,000-game simulations for `classic-10`, `chaos-15`, `ultimate-20` | Claude | COMPLETED | — |
| UX-11 | Voting matched to `09-voting.png` at 1586×992 | Cursor | COMPLETED | UX-10 |
| UX-12 | Revote matched to `10-revote.png` at 1586×992 | Cursor | COMPLETED | UX-11 |
| APK-01 | The APK loads the deployed site (`server.url`), so every Render deploy reaches installed apps on their next launch without a new APK. A bundled offline page (`server.errorPath`) shows when the site cannot load and reopens the game once the server answers. Files: `apps/web/capacitor.config.ts`, `apps/web/native/offline.html`, `apps/web/vite.config.ts` (writes `dist/offline.html` with the URL), `apps/web/test/android/android-project.test.ts`, `render.yaml` (comment), `README.md`, `docs/werewolf/ui-ux-plan.md` section 11. Checked on the emulator: home screen from the live site, Preferences bridge works, offline page with network off, auto-return when it comes back. Old bundled APKs still need `CORS_ORIGINS=https://localhost` until reinstalled. Handoff to Cursor: visual pass on `native/offline.html` (static page, colors copied from tokens) | Claude | COMPLETED | WW-1605 |
| UX-13 to UX-14 | Mockups 11–12: host overview, game results | Cursor | COMPLETED | UX-12 |
| BUG-01 | A Custom setup with no wolf could start. New validation error `NO_WOLVES` | Claude | COMPLETED | — |
| BUG-02 | `events.integration.test.ts` was red on `main` (it predates `PHASE_CHANGED`). Assertion fixed | Claude | COMPLETED | — |
| BUG-03 | **High.** Phone landscape 844×390: ballot seat buttons cannot be brought into view (or sit under the header), so nobody can vote by tapping a seat; End the day is cut off. See `docs/werewolf/e2e-report.md` | Cursor | COMPLETED | — |
| UX-R1 | Results banner: stat row and subtitle unreadable over the scene; empty ribbon (fold into UX-14) | Cursor | COMPLETED | — |
| UX-MOBILE | Mobile-native full journey: phone session chrome (hide marketing nav), densify Home→Host for portrait + phone/narrow landscape | Cursor | COMPLETED | — |
| UX-PHONE | Portrait phone screens matched to `*-phone.png` mockups (Phase 0 shared tokens/primitives, then Home→Results 01–12) | Claude | COMPLETED | UX-MOBILE |
| SETUP-MODE | Setup: confirm before a mode or preset replaces edited roles, Custom starts from the current roles, edited-preset card with reset | Claude | COMPLETED | — |
| SETUP-INFECTION | Setup: turning Infection on settles OD-03 inline, offers to seat an Alpha Wolf, and the summary shows each issue once in plain words | Claude | COMPLETED | SETUP-MODE |
| HOME-DEV | Home screen developer tag: Milind Somnathe | Cursor | COMPLETED | — |
| PLAY-FIX-02 | Playtest fixes: Vampire mark converts the same night, Witch save cancels Vampire and Sniper kills, selected ability highlighted | Claude | REVIEW | PLAY-FIX-01 |

---

## Task details

### HOME-DEV — Home developer tag

- **Agent:** Cursor
- **Status:** COMPLETED
- **Description:** Small "Developed by · Milind Somnathe" tag at the bottom of the home page, outside the card: bottom-right over the scene on desktop, bottom-left in short landscape, centered at the end of the page when stacked (phone). Label and placement changed by Claude at user request; checked in Chrome at 1440×900, 844×390, and 390×844. Uses existing border/surface/text tokens; sits under resume so it does not compete with the brand or Infection Edition badge.
- **Files:** `apps/web/src/routes/Home.tsx`, `apps/web/src/game/components/home-scene.css`, `apps/web/test/screens/home.test.tsx`, `docs/AI-TASK-BOARD.md`.
- **Tests:** `pnpm --filter @warewolf/web exec vitest run test/screens/home.test.tsx` (5 passed).

---

### PLAY-FIX-02 — Playtest fixes: Vampire timing, Witch save, selected option

- **Agent:** Claude (engineering and the highlight, at user request), Cursor (visual review)
- **Status:** REVIEW
- **Description:** (1) A Vampire mark converts the target to a Vampire Servant at dawn of the same night, like the Alpha's infection, if both are alive (user decision, changes the guide-image two-night rule). Stored marks from running games still promote through the due-effect loop. (2) `witch_save` cancels `WOLF_KILL`, `VAMPIRE`, and `SNIPER` (not poison, not infection). New games only: the config is copied at the deal. (3) The ability switch and question buttons, and the table kill candidates, show the pressed state; an ability whose choice is already sent shows a check.
- **Files:** `packages/domain/src/night/resolve.ts`, `packages/domain/src/catalog/definitions/{core,ultimate}.ts`, `packages/domain/src/roles.ts`, `packages/domain/test/{night-ultimate,night-golden}.test.ts`, `apps/api/test/ultimate.integration.test.ts`, `apps/web/src/game/components/{NightActionPanel.tsx,table-screen.css}`, `apps/web/test/screens/action-panel.test.tsx`, `docs/werewolf/{ultimate-20-rules,role-catalog,open-decisions}.md`, `docs/AI-TASK-BOARD.md`.
- **Interfaces:** No contract, API, or client state change. `resolveNight` no longer creates `VAMPIRE_MARK` effects; it returns the `VAMPIRE` conversion in the same result, so the existing `ROLE_CONVERTED` and `VAMPIRE_TEAM_JOIN` events fire at that dawn. `NightActionPanel` switch buttons carry `data-sent="true"` plus a check icon and ", sent" for screen readers when their choice is pending.
- **Tests:** `pnpm typecheck`; domain 417/417; web 411/411; `pnpm test:integration` 299/299. Chrome with mocked API at 1440×900, 844×390, 390×844: the potion in use is filled purple, a sent potion keeps a gold check.
- **Handoff to Cursor:** Please review the pressed (`.ww-prompts .MuiButton-root[aria-pressed='true']`), sent (`.ww-prompt-sent`), and table kill-candidate pressed styles in `table-screen.css`. Separate, older issue seen during the check: at 844×390 the night action dock covers most of the seat grid.

### PLAY-FIX-01 — Playtest fixes: infected role card, Seeker results, Seeker role card

- **Agent:** Claude (engineering), Cursor (visual review)
- **Status:** REVIEW
- **Description:** Three playtest reports. (1) An infected player kept seeing their old role and picture: the server converted them, but `useMyRole` refetched only on focus. It now refetches when `stateVersion` moves and on the seat's own `ROLE_CONVERTED` / `INFECTION_OCCURRED` socket events, so `RoleCard` and the action panel portrait switch to Infected Wolf. The server already counts the infected seat as a wolf for the vote reveal, parity, and results (parity stays the wolf win). (2) Seeker results could go missing: night events are written just after the night commit, and a poll that landed in between fetched the report too early. The report now also refetches on the seat's private socket events, and once more 1.5 s after a phase change. (3) New Seeker ability `seeker_see_role`: once per game, see one player's current role card, in place of that night's Wolf check (`exclusiveGroup: 'seeker_choice'`, result `ROLE_ID`, lost on infection). New games only.
- **Files:** `packages/domain/src/catalog/definitions/core.ts`; `packages/domain/test/{catalog,night,night-golden,simulate,victory}.test.ts`; `apps/web/src/game/state/{realtime,role,tableNotes}.ts`; `apps/web/src/game/components/{actionCopy,tableNotes}.ts`, `SeenRoleCards.tsx`, `table-screen.css` (`.ww-seen-role*`); `apps/web/src/routes/Table.tsx`; `apps/web/src/game/howto/howToPlayCopy.ts`; web tests `state/realtime`, `state/role`, `state/actions`, `screens/{table,table-notes,action-copy,action-panel}`; API tests `night.integration`, `modes.integration`.
- **Tests:** `pnpm typecheck`, `pnpm test` (domain 414, web 410), `pnpm test:integration` (299). Two integration tests are already flaky on the random deal and not touched here: "lists the named players with their wolves, to the host only" fails when the host is dealt the Alpha, and "the Vampire marks a player…" fails when the host is the Vampire (the host copy doubles the count).
- **Handoff to Cursor:** `SeenRoleCards` (`{ cards: readonly SeenRole[] }`, from `useTableNotes(...).seenRoles`) renders under the report on the table and in the morning card. It reuses `RolePortrait size="thumb"`, the catalog name, and the team word, with layout-only CSS on existing tokens. Please give it the final card look and check it at the seven viewports. The prompt label is "See a player's role card (once per game)".


### SETUP-INFECTION — Turning Infection on in an editable mode

- **Agent:** Claude
- **Status:** COMPLETED (12 November 2026)
- **Description:** Turning Infection on (Classic, Expanded, Custom) no longer raises "OD-03 needs an acknowledgement". The survival rule is one inline choice under Infection, defaulting to the Infection Edition rule, and picking it writes the OD-03 acknowledgement. With no Alpha Wolf seated, a hint offers "Add an Alpha Wolf", which takes one Villager's seat. Issue text is plain language, and the summary shows each issue once.
- **Files:** `apps/web/src/game/setup/{setupDraft.ts,setupCopy.ts,SetupSettings.tsx,ConfigSummary.tsx,setup-layout.css}`, `apps/web/src/game/components/lobbyCopy.ts`, `apps/web/test/screens/{setup-draft.test.ts,setup.test.tsx,lobby-copy.test.ts}`.
- **Interfaces:** `setInfectionEnabled` writes or drops `rulesetAcknowledgments['OD-03']`. `setRequiresSurvival` always records it while infection is on. New `seatAlphaWolf`. `explainIssue` covers `DECISION_UNSET`, `DECISION_MISMATCH`, and `INFECTION_WITHOUT_ALPHA`. No domain or server change.
- **Checked:** `pnpm --filter @warewolf/web typecheck`. `pnpm --filter @warewolf/web test` 404/404. Live API in Chrome at 1440×900 and 390×844: Classic → Infection on shows the inline choice and the Alpha Wolf hint, with no OD-03 text. After adding the Alpha Wolf and choosing "turn into a wolf", the saved configuration has no server errors or warnings, and OD-03 is `CONVERT_BEFORE_DEATH`.

### SETUP-MODE — Mode and preset switching on Game setup

- **Agent:** Claude
- **Status:** COMPLETED (12 November 2026)
- **Description:** Picking a mode or preset no longer silently replaces a hand-edited role list. Re-clicking the current mode does nothing. Custom starts from the current roles and rules. An edited setup shows a highlighted "Custom, based on <preset>" card with a role summary and "Reset to <preset>".
- **Files:** `apps/web/src/game/setup/{setupDraft.ts,setupCopy.ts,SetupMode.tsx,setup-layout.css}`, `apps/web/src/routes/Setup.tsx`, `apps/web/test/screens/{setup-draft.test.ts,setup.test.tsx}`.
- **Interfaces:** `setupDraft.ts` adds `toCustom`, `hasHandEdits`, `basePackOf` (infers the preset of a saved custom draft by role overlap), and `roleSummary`. `applyMode` is a no-op for the current mode and calls `toCustom` for CUSTOM. `SetupMode` takes `basePackId`, which `Setup.tsx` keeps in state. No domain, contract, or server change.
- **Checked:** `pnpm --filter @warewolf/web typecheck`. `pnpm --filter @warewolf/web test` 400/400. Live API in Chrome at 1440×900 and 390×844: edit Classic → edited card and summary; Expanded asks first and Keep editing leaves the list; save and reload still names Classic; Custom carries the roles without asking.

### UX-PHONE — Portrait phone mockup pass

- **Agent:** Claude (taken over from Cursor at user request, 12 Nov 2026)
- **Status:** COMPLETED (12 November 2026)
- **Description:** Implement `docs/werewolf/ux-mockups/PHONE-IMPLEMENTATION-PLAN.md`. Phase 0: `--phone-*` tokens and shared presentation primitives under `apps/web/src/game/layout/phone/`. Then match screens 01–12 to the portrait references at 390×844 while preserving AppShell, GameLayout, SetupLayout, HostShell, routes, Redux, and server contracts. No second mobile app.
- **Files:** `apps/web/src/theme/tokens.ts`, `apps/web/src/game/layout/phone/**`, `apps/web/src/game/components/GameIcon.tsx`, `apps/web/src/shell/{AppShell.tsx,app-shell.css}`, `apps/web/src/game/layout/game-layout.css`, `apps/web/src/game/components/{home-scene,lobby-screen,reveal-screen,table-screen,results-screen}.css`, `apps/web/src/game/setup/{SetupLayout.tsx,SetupRoles.tsx,setup-layout.css}`, `apps/web/src/game/host/{HostShell.tsx,host-screen.css}`, `apps/web/src/routes/{Home,Lobby,Setup,Reveal,Table,Host,Results}.tsx`, related screen tests / layout e2e, `docs/AI-TASK-BOARD.md`, phone mockups under `docs/werewolf/ux-mockups/`
- **Avoid:** HOST-01 deploy files; do not overwrite uncommitted ROLE-FIX logic in `Table.tsx` / domain / api day files — presentation/CSS only where those overlap.
- **Built:**
  - Phase 0 (Cursor): `--phone-*` tokens, `layout/phone/` primitives, GameIcon additions. The primitives are exported but no screen uses them yet; each screen styles its existing components instead.
  - `GameLayout` / `stageMode`: day discussion now uses the portrait Players / Discussion switch and opens on Discussion (`StageSpec.portraitPanel`); the switch resets to each stage's default when the stage changes.
  - Table portrait (05, 07–10): short scene band, two-column public seat cards, compact closed-discussion row, dawn result card over the scene, chat bubbles, compact night / ballot docks, revote rows.
  - Lobby (02) and Results (12): one scrolling column with a sticky action dock. Lobby facts split into label / value spans (`ww-lobby-fact-*`).
  - Setup (03): pinned step rail, role list before the summary, compact two-column summary, Back / Save / Start in one sticky row.
  - Reveal (04): private-role notice (portrait only), banner role art, sticky Hide role / I understand.
  - Host (06, 11): chip rail without icons that keeps the current section in view, submissions as stacked rows, full-width kill target rows, one action row.
  - Home (01): emblem and title on the scene, larger Create / Join.
- **Checked:** `pnpm --filter @warewolf/web typecheck`. `pnpm --filter @warewolf/web test` 392/392. Fixture Playwright `e2e/` 60 passed, 3 failed on tablet-land only (`results` cancelled-copy strict match, two `table` day-ballot tests). The same 3 fail on a clean checkout of `3f9f48f`, so they were already failing. A live Infection game screenshotted at 390×844 against each mockup, plus 360×800, 430×932, and 844×390 with no horizontal page scroll.
- **Known gaps:** desktop and landscape layouts are unchanged. The Setup Roles step keeps the count stepper under each role's text, not beside it.

### ROLE-FIX — Role-power gaps from the audit

- **Agent:** Cursor
- **Status:** COMPLETED
- **Description:** Close the three live gaps from the role-powers audit, plus hardening coverage.
  1. Day discussion mounts `PlayerGrid` when a `PLAYERS` day ability is open (Sniper, Mind Controller). Plain day discussion keeps the static UX-10 seat cards.
  2. OD-33 Elder wolf-kill penalty: village votes weight 1 and one phantom weight against the village plurality in `tallyDay`; day close detects a same-round night Elder death with `WOLF_KILL`.
  3. Trapper `ATTACKER_IDS` private table note.
  4. Shieldbearer night fixture, Assassin mark / Lone Wolf victory tests, Immortal day-vote and Poisoner day-poison API tests.
- **Files:** `apps/web/src/routes/Table.tsx`, `apps/web/src/game/components/tableNotes.ts`, `apps/web/test/screens/{action-panel,table-notes}.test.ts`, `packages/domain/src/day/tally.ts`, `packages/domain/test/{day-tally,victory,night-expanded}.test.ts`, `packages/domain/test/support/night.ts`, `apps/api/src/day/day-resolution.service.ts`, `apps/api/test/day-effects.integration.test.ts`, `docs/AI-TASK-BOARD.md`
- **Checked:** `pnpm --filter @warewolf/{domain,web,api} typecheck`. Domain day-tally/victory/night-expanded 75. Web action-panel + table-notes 13. `pnpm test:integration` 299/299.
- **Avoid:** HOST-01 deploy files.

### UX-MOBILE — Mobile-native full journey

- **Agent:** Cursor
- **Status:** COMPLETED
- **Description:** On phone layout modes (`portrait`, `phone-landscape`, `narrow-landscape`), replace the AppShell marketing nav with compact session chrome (emblem, wordmark → lobby/home, seat avatar, ⋯ menu for Lobby / How to Play / Roles). Densify Home, Lobby, Setup, Reveal, Table phases, Results, and Host so primaries stay on screen, hit targets meet 44px (40px short-landscape grids), and there is no horizontal page scroll. One `GameLayout` / one client — no second mobile UI.
- **Files:** `apps/web/src/shell/{AppShell.tsx,app-shell.css}`, `apps/web/src/game/layout/{game-layout.css,layoutMode.ts,index.ts}`, `apps/web/src/game/components/{home-scene,reveal-screen,table-screen,results-screen}.css`, `apps/web/src/game/setup/{SetupLayout.tsx,setup-layout.css}`, `apps/web/src/game/host/{HostShell.tsx,host-screen.css}`, `apps/web/src/routes/{Home,Reveal,Setup,Host}.tsx`, `apps/web/test/**`, `apps/web/e2e/layout.spec.ts`, `docs/werewolf/ui-ux-plan.md` §4, `docs/AI-TASK-BOARD.md`
- **Checked:** `pnpm --filter @warewolf/web typecheck`. `pnpm --filter @warewolf/web test` 389/389. `PW_CHANNEL=chrome` Playwright `e2e/layout.spec.ts` on desktop-fhd, phone-land, phone-portrait (9/9). Session chrome: `data-chrome=session` on phone modes; Menu opens Play/How to Play/Roles.
- **Avoid:** HOST-01 deploy files; GAP-06 connection indicator. WW-1605 APK status-bar theming still separate.



### Cursor handoff — BUG-03, GAP-02, HOWTO-01, UX-13/14, UX-R1, table notes, GAP-05, E2E-03 (12 November 2026)

- **Agent:** Cursor
- **Status:** COMPLETED (checks below)
- **BUG-03:** Phone/narrow landscape voting densifies seats (horizontal 2-col cards), shrinks nav/status/action chrome, and keeps the stage scrollable so every seat and "End the day" stay reachable at 844×390, 667×375, and 568×320. Removed `test.fail` from `classic-journey.spec.ts`. Classic live e2e green on desktop-fhd and phone-land.
- **GAP-02:** Host dashboard Cancel game (confirm: roles stay hidden) + Make host on living seats. Live `e2e-live/cancel.spec.ts` added.
- **HOWTO-01:** Restyled `/how-to-play` with mode card art, tokens only, MUI actions; optional How to play links on Reveal and Table (hidden on short status strips).
- **UX-13 / UX-14 / UX-R1:** Host Overview labeled fact rows; Results title sits in the ribbon; reason + stats on surface plates over the scene. Removed unreachable Table Play again / cancelled stage (GAP-04 leftover).
- **Table notes:** Report items tone `published` / `ghost` / `silenced`. Locked composer when `canPost` is false; MUTED copy is "You cannot post in the discussion."
- **GAP-05:** Lobby chat placeholder updated; Phase 11 comments cleared in `api/lobby.ts` and `game/state/lobby.ts`.
- **E2E-03 review (brittle spots):**
  1. `hostClose` falls back to "Begin the night" when the host-control group is missing — label drift breaks pacing.
  2. `appears(..., 1500)` for optional confirm/warn dialogs is short on a cold Vite/API.
  3. `seatButton` regex is tied to exact night (`N. Name`) vs ballot (`Seat N • Name`) copy.
  4. Classic journey hard-codes a small `ROLE_NAMES` map; Expanded/Ultimate roles would show raw ids.
  5. Parallel fixture + live Playwright both claim `:5173` and abort navigations — run them serially.
  6. Cancel spec role-name regex can false-positive if a display name matches a role word.
  7. `voteInBrowser(null)` used to click Abstain without Submit — failed when the host was the voted wolf. Fixed to always Submit after selecting.
- **Checked:** `pnpm typecheck`, `pnpm test`, fixture Playwright phone-land+desktop-fhd, `PW_CHANNEL=chrome e2e:live` 12/12 (no expected-fail).
- **Files (Cursor):** `game-layout.css`, `table-screen.css`, `Host.tsx`, `HostCanvas.tsx`, `host-screen.css`, `HowToPlay.tsx`, `how-to-play.css`, `VictoryBanner.tsx`, `scene-art.css`, `results-screen.css`, `Table.tsx`, `Reveal.tsx`, `DiscussionPanel.tsx`, `chatCopy.ts`, `Lobby.tsx`, `api/lobby.ts`, `game/state/lobby.ts`, `e2e-live/cancel.spec.ts`, `classic-journey.spec.ts`, fixture e2e host/table tweaks, `playwright.config.ts` (`PW_CHANNEL`), tests under `test/screens/{host,chat-copy}.test.*`, this board.
- **Do not commit Claude's uncommitted tree** (`tools/e2e`, API migration 0014, etc.). Commit Cursor files separately.

### E2E-01 to E2E-04, GAP-01, GAP-03, BUG-01, HOWTO-01 — End-to-end pass, fixes, and How to Play

- **Agent:** Claude
- **Status:** E2E-01, E2E-02, E2E-04, GAP-01, GAP-03, GAP-04, GAP-07, BUG-01, BUG-02 COMPLETED. E2E-03 and HOWTO-01 in REVIEW for Cursor.
- **Report:** `docs/werewolf/e2e-report.md` has the full matrix, every defect, and the plan to finish.
- **Checked:** `pnpm typecheck` clean. `pnpm test` all pass. `pnpm test:integration` 297/297. `pnpm e2e:api` 35/35 against the dev server. `e2e:live` 10/10 (phone-land Classic is an expected failure for BUG-03).
- **Files:**
  - Driver: `tools/e2e/**`.
  - API: `apps/api/test/modes.integration.test.ts`, `apps/api/src/day/publications.ts`, `apps/api/src/{action/action.service,chat/chat.service,events/event.service,events/night-events,phase/phase.service,db/schema}.ts`.
  - Migrations: `apps/api/drizzle/{0014_published_results.sql,down/0014_published_results.sql,meta/0013_snapshot.json,meta/0014_snapshot.json,meta/_journal.json}`.
  - Domain: `packages/domain/src/config/validate.ts`.
  - Web: `apps/web/src/game/components/tableNotes.ts`, `apps/web/src/routes/{HowToPlay,Results}.tsx`, `apps/web/src/game/howto/**`, `apps/web/src/routes.tsx` (`Placeholder.tsx` removed), `apps/web/playwright.live.config.ts`, `apps/web/e2e-live/**`.
  - Docs: `how-to-play.md`, `e2e-report.md`, `ultimate-20-rules.md`, `role-configuration.md`, `simulation/README.md` plus three reports.
- **Migration note:** `meta/0013_snapshot.json` was a copy of 0012 (same id and parent), so `db:generate` failed. It now has its own id. The 0014 snapshot is the full current schema. The 0014 SQL is only the `published_round` column.

**Handoff to Cursor**

- **BUG-03 (high).** At 844×390 the ballot grid has about one row of height, and seat buttons cannot be brought into view or sit under the app header. Repro: `PW_CHANNEL=chrome pnpm --filter @warewolf/web e2e:live --project=phone-land classic`. When it passes, remove the `test.fail` line in `apps/web/e2e-live/classic-journey.spec.ts`.
- **HOWTO-01 visual pass.**
  - Structure: `/how-to-play` renders `HowToPlay.tsx`. It has four step sections (`.ww-howto-section`, `.ww-howto-steps`) and a grid of mode cards (`.ww-howto-card`).
  - Starting roles sit under one `.ww-team-chip` per team. The chip always shows the team word.
  - All copy and every number come from `apps/web/src/game/howto/howToPlayCopy.ts` (`GOAL`, `ROUND`, `YOUR_ROLE`, `HOST`, `modeGuides()`). Keep the headings and the list labels, because the tests use them.
  - `how-to-play.css` uses only existing tokens; replace it freely.
  - Ideas: scene art per mode, a link from Reveal and Table.
- **New table notes.** `tableNotes.ts` now writes sentences for `RESULT_PUBLISHED` (public), `GHOST_HINT` (public), `PLAYER_RETURNED` (public), `SILENCED`, `REWIND_RESULT`, `ABILITY_COPIED`, and `CHAOS_EVENT` (private). They flow through the existing notes surface. Style them if they need a distinct look.
- **Silenced seat.** `GET /chat` returns `you.canPost: false` and posting returns 403 `CHAT_MUTED`, the same as a host mute. The composer already handles that.
- **GAP-02.** Add Cancel game (with a confirm) and Make host to the Host dashboard. Use `useCancelGameMutation` and the transfer mutation in `apps/web/src/api/lobby.ts`; both work during a game. Leaving a started game is refused by the API (`GAME_STARTED`) until the product owner decides what it means.
- **GAP-04 leftover.** `Table.tsx` still has a Play again button and a cancelled stage that cannot be reached, because the Table sends FINISHED and CANCELLED games to Results. Remove them on your next `Table.tsx` pass.
- **UX-R1.** On Results, the stat row and the subtitle over the scene are unreadable, and the ribbon is empty. Fold this into UX-14.
- **E2E-03 review.** Please review `apps/web/e2e-live/*` and add a `cancel` flow once GAP-02 lands.

### UX-12 — Revote pixel match

- **Agent:** Cursor
- **Status:** COMPLETED
- **Description:** Table `REVOTE` matches `10-revote.png` at 1586×992. Gold Day — Revote pill, Revote. headline, only tied horizontal cards (`Seat N — Name`, Alive), Selected nominee + Submit revote + long privacy note. Discussion notice explains the tie. No prior tallies on the board. Rail ~404px.
- **Checked:** table, vote-copy, phase-copy tests (34). Typecheck clean. Live Classic revote at 1586×992: two tied seats, rail 404px, no vote totals. Portrait 390×844 keeps Submit revote reachable with no horizontal overflow.
- **Files:** `apps/web/src/routes/Table.tsx`, `apps/web/src/game/components/{PlayerGrid,GameStatusBar,DiscussionPanel,voteCopy,table-screen.css}`, `apps/web/src/game/layout/game-layout.css`, `apps/web/test/screens/{table,vote-copy}.test.*`, `docs/AI-TASK-BOARD.md`.
- **Depends on:** UX-11

### UX-11 — Voting pixel match

- **Agent:** Cursor
- **Status:** COMPLETED
- **Description:** Table voting matches `09-voting.png` at 1586×992. Gold VOTING pill with sun, Day • Vote to eliminate a player. Four-column public cards (`Seat N • Name`, Living/Eliminated) with purple selected outline and check. Footer shows Selected nominee, Submit vote, and Your vote is private. Discussion rail ~399px. `square_dusk` scene.
- **Checked:** table, vote-copy, phase-copy, layout-mode tests (83). Typecheck clean. Live Classic voting at 1586×992: rail 399px, 4 columns, nominee footer, Submit vote. Portrait 390×844 keeps Submit reachable with no horizontal overflow.
- **Files:** `apps/web/src/routes/Table.tsx`, `apps/web/src/game/components/{PlayerGrid,GameStatusBar,voteCopy,phaseCopy,table-screen.css}`, `apps/web/src/game/layout/{game-layout.css,LayoutPreview.tsx}`, `apps/web/test/screens/{table,vote-copy}.test.*`, `apps/web/e2e/{layout,table}.spec.ts`, `docs/AI-TASK-BOARD.md`.
- **Depends on:** UX-10

### UX-10 — Day discussion pixel match

- **Agent:** Cursor
- **Status:** COMPLETED
- **Description:** Table `DAY_DISCUSSION` matches `08-day-discussion.png` at 1586×992. Status shows Day / Discussion with a sun pill. The stage uses `square_day` and public seat cards (`#N Name`, Alive). Discussion rail is ~459px with live messages, Type a message…, and Send. Action guide plus Continue to voting for the host. Night-only role panels stay off the day stage.
- **Checked:** Table, phase-copy, chat-copy, layout-mode tests (77). Typecheck clean. Browser at 1586×992 on a live Classic day: rail 459px, seat cards, chat message, Continue to voting. Portrait 390×844 keeps Continue reachable with no horizontal overflow.
- **Files:** `apps/web/src/routes/Table.tsx`, `apps/web/src/game/components/{DiscussionPanel,GameStatusBar,phaseCopy,table-screen.css}`, `apps/web/src/game/layout/{game-layout.css,LayoutPreview.tsx}`, `apps/web/test/screens/{table,phase-copy}.test.*`, `apps/web/e2e/layout.spec.ts`, `docs/AI-TASK-BOARD.md`.
- **Depends on:** UX-09

### UX-09 — Morning results pixel match

- **Agent:** Cursor
- **Status:** COMPLETED
- **Description:** Table `DAY_ANNOUNCE` matches `07-morning-results.png` at 1586×992. Status uses a Morning pill and “Night has ended…”. The stage uses `square_day` with a centered outcome card (public elimination line or nobody died, Survivors avatars). Discussion is locked with a padlock and “Discussion will open after you continue to day.” Host Continue to day stays in the action bar. Private investigation notes stay under the card as Your report.
- **Checked:** Morning-copy, chat-copy, table, phase-copy, and layout-mode tests (78). Typecheck clean. Browser at 1586×992 on a live Classic morning: card ~(263,352,712,325), day wash, locked discussion, Continue to day. Portrait 390×844 keeps Continue on screen with no horizontal overflow.
- **Files:** `apps/web/src/routes/Table.tsx`, `apps/web/src/game/components/{morningCopy,GameStatusBar,DiscussionPanel,chatCopy,phaseCopy,table-screen.css}`, `apps/web/src/game/layout/stageMode.ts`, `apps/web/test/screens/{morning-copy,chat-copy,table}.test.*`, `apps/web/test/game/layout-mode.test.ts`, `docs/AI-TASK-BOARD.md`.
- **Depends on:** UX-08

### UX-08 — Night resolution pixel match

- **Agent:** Cursor
- **Status:** COMPLETED
- **Description:** Host dashboard Night actions matches `06-night-resolution.png` at 1586×992. Night actions opens during night phases. Submitted actions are a host-only table with player avatars. The kill panel includes No kill and saves on pick. The bottom bar shows Consequence, Back to game, and the phase close (Resolve night when the close resolves night).
- **Checked:** Host, phase-copy, and table tests (29). Typecheck clean (ConfigSummary `errors[0]` guard). Browser at 1586×992 on a live Infection host confirm: rail 279px, strip 61px, action bar 91px, Night actions selected, kill picker with No kill, Back to game + Open reactions. Portrait 390×844 uses the one-step rail with no horizontal overflow.
- **Files:** `apps/web/src/routes/Host.tsx`, `apps/web/src/game/host/{HostShell,HostCanvas,host-screen.css,dashboardCopy}`, `apps/web/src/game/components/{KillTargetPanel,phaseCopy}`, `apps/web/src/game/setup/ConfigSummary.tsx`, `apps/web/test/screens/{host,phase-copy,table}.test.*`, `apps/web/e2e/{host,table}.spec.ts`, `docs/AI-TASK-BOARD.md`.
- **Depends on:** UX-07

### UX-07 — Night action pixel match

- **Agent:** Cursor
- **Status:** COMPLETED
- **Description:** Night on the table matches `05-night.png` at 1586×992. Status reads Night · Take your action with an In progress pill. The stage uses `square_night` behind a five-column public seat grid with purple selected outline and check. The action bar shows the private role portrait, ability line, Selected target field, and gold Submit. Discussion shows “Discussion is closed at night.” and hides the composer. Hide role still covers the private name and portrait.
- **Checked:** Action panel, table, chat copy, and phase copy tests. Browser at 1586×992 on a live Pack Wolf night: five seat columns, selected target “1. Host”, closed discussion rail, Submit in the bottom bar. Portrait 390×844 keeps Submit on screen with no horizontal overflow.
- **Files:** `apps/web/src/routes/Table.tsx`, `apps/web/src/game/components/{NightActionPanel,GameStatusBar,DiscussionPanel,PlayerGrid,actionCopy,phaseCopy,chatCopy,table-screen.css}`, `apps/web/src/game/layout/game-layout.css`, `apps/web/test/screens/{action-panel,table,chat-copy}.test.*`, `docs/AI-TASK-BOARD.md`.

### UX-06 — Role reveal pixel match

- **Agent:** Cursor
- **Status:** COMPLETED
- **Description:** Role reveal matches the centered card in `04-role-reveal.png` at 1586×992. The faction scene fills the page. The card shows the private portrait, role name, team, description, abilities, and tonight line. Teammates stay hidden unless the projection includes them. Hide role covers the portrait, the copy, and the faction scene. I understand still opens the table. The host close control stays when the game state loads.
- **Checked:** Reveal tests (7). Browser at 1586×992 on a live Classic Villager: card `(339,254,908,559)`, portrait `(371,294,296,401)`, Hide role and I understand in the card. Hide removes the name and the portrait. Portrait 390×844 stacks the portrait and keeps I understand on screen. Landscape 844×390 keeps both actions without horizontal overflow.
- **Files:** `apps/web/src/routes/Reveal.tsx`, `apps/web/src/game/components/{RoleCard,RolePortrait,reveal-screen.css}`, `docs/AI-TASK-BOARD.md`.

### CREATE-SETUP — Create Game opens setup

- **Agent:** Cursor
- **Status:** COMPLETED
- **Description:** A successful Create Game navigates to `/lobby/:gameId/setup`. Join Game still opens the lobby. Create dialog copy says setup opens next and the room code stays on the lobby.
- **Checked:** Home tests (363 web). Browser: Create Game landed on Setup Game – Mode and players; Back to the lobby showed room code YGARBY; Join Game for a guest landed on the lobby.
- **Files:** `apps/web/src/game/components/SeatDialogs.tsx`, `apps/web/test/screens/home.test.tsx`, `docs/AI-TASK-BOARD.md`.

### UX-05 — Game setup pixel match

- **Agent:** Cursor
- **Status:** COMPLETED
- **Description:** Setup matches `03-setup.png` at 1586×992. The four steps are a horizontal pill rail: Mode and players, Roles, Settings, Review. The Roles step shows a three-column card grid with role portraits, team chips, and the seat stepper. Current configuration sits in a side card bound to the live validation counts. Back to the lobby, Save setup, and Start game stay in the bottom bar. Ultimate 20 and Infection Edition stay locked. Search, team filters, and add/remove still work.
- **Checked:** Setup tests (5). Browser at 1586×992 on a live Infection Edition room: three card columns, summary on the right, action bar at the bottom, role details still open. Portrait 390×844 stacks the summary and keeps the actions on screen, with no horizontal overflow.
- **Files:** `apps/web/src/routes/Setup.tsx`, `apps/web/src/game/setup/{SetupLayout,SetupRoles,ConfigSummary,setupCopy,setup-layout.css}`, `apps/web/test/screens/setup.test.tsx`, `docs/AI-TASK-BOARD.md`.

### UX-04 — Lobby screen pixel match

- **Agent:** Cursor
- **Status:** COMPLETED
- **Description:** Match the current `02-lobby.png` for the lobby chrome. Participants sit in a card panel on the stage, not on the painted campfire seats. The scene stays behind the title. The rail is Players / Log / Room info. There is no ready flag, so the rail shows Here or Away from connection status.
- **Checked:** Lobby and home tests (13). Browser at 1586×992: five player cards and five open-seat tiles in a panel, no seats placed on the artwork. Portrait 390×760 uses two columns, keeps the room code and the bottom action, and does not overflow horizontally.
- **Files:** `apps/web/src/routes/Lobby.tsx`, `apps/web/src/game/components/lobby-screen.css`, `apps/web/src/game/components/lobbyCopy.ts`, `apps/web/src/game/components/PlayerCard.tsx`, `apps/web/src/game/layout/game-layout.css`, `apps/web/src/theme/tokens.ts`, `apps/web/test/screens/lobby.test.tsx`, `apps/web/test/screens/lobby-copy.test.ts`, `apps/web/test/screens/home.test.tsx`, `apps/web/test/screens/setup.test.tsx`, `docs/AI-TASK-BOARD.md`.

### UX-03 — Home screen pixel match

- **Agent:** Cursor
- **Status:** COMPLETED
- **Description:** Home matches the left panel in `01-home.png` at 1586×992. Navigation is 75px, with Play underlined in gold. The night village stays on the right. The panel holds the emblem, a white Werewolf title, the Infection Edition pill, the game promise, Create Game and Join Game side by side, and Game Modes / Role Library / How to Play. The resume row renders only when this tab has a seat, and it keeps the live room code and return label.
- **Checked:** Home tests (5). Browser at 1586×992: panel `(28,107,720,852)`, title at y=332, Create and Join side by side. Create still opens the host dialog. Portrait 390×760 stacks the actions. Landscape 844×390 keeps the scene on the left and both actions on screen. No horizontal overflow.
- **Files:** `apps/web/src/routes/Home.tsx`, `apps/web/src/game/components/home-scene.css`, `apps/web/src/theme/tokens.ts`, `docs/AI-TASK-BOARD.md`.

### UX-02 — UX-01 leftovers

- **Agent:** Cursor
- **Status:** COMPLETED
- **Description:** Restarted stale Vite on 5173 with the art watcher. Vote copy no longer promises change-until-close when the client does not know the room rules; abstain stays visible until the server flags arrive. Results status shows the outcome, cancelled games say roles stay hidden, individual wins get a recap block, reason repeats in the action row. OD-75–OD-84 were already accepted as built (12 November 2026).
- **Handoff to Claude (VOTE-CFG):** `GET .../configuration` refuses once the game has started. Add `voting: { abstain, changeUntilClose }` (booleans only) to the public `GameState` (or a tiny seat-readable projection). Web already accepts `VoteRules` via `UNKNOWN_VOTE_RULES` in `voteCopy.ts` / `Table.tsx` — wire those fields when present.
- **Files:** `apps/web/src/game/components/voteCopy.ts`, `apps/web/src/routes/Table.tsx`, `apps/web/src/routes/Results.tsx`, `apps/web/src/game/components/{ResultsRecap,resultsCopy,results-screen.css}`, tests under `apps/web/test/screens/{vote-copy,table,results,results-copy}.test.*`, `docs/AI-TASK-BOARD.md`. Vite restarted on port 5173.

### VOTE-CFG — Voting flags on public state

- **Agent:** Cursor
- **Status:** COMPLETED
- **Description:** Put `abstain` and `changeUntilClose` from the saved configuration onto the public game state so every seat can read them during VOTING/REVOTE. Configuration GET is lobby-only today.
- **Checked:** `gameStateSchema.voting` is those two booleans and drops anything else. `GET /state` copies them from the saved configuration for every seat, including after start when configuration GET is 409. The table hides Abstain when `abstain` is false, and locks the seats after a sent vote when `changeUntilClose` is false. Preset packs still allow both. Contracts tests (105), phase integration (22), web table/vote/phase tests (47), and typecheck for contracts, API, and web. Playwright on tablet landscape: a changeable ballot, and a locked ballot with no Abstain button.
- **Files:** `packages/contracts/src/phase.ts`, `packages/contracts/test/phase.test.ts`, `apps/api/src/phase/phase.service.ts`, `apps/api/test/phase.integration.test.ts`, `apps/web/src/routes/Table.tsx`, `apps/web/src/game/components/voteCopy.ts`, `apps/web/src/game/fixtures/phase.ts`, `apps/web/test/screens/table.test.tsx`, `apps/web/e2e/table.spec.ts`, `docs/werewolf/api-design.md`, `docs/AI-TASK-BOARD.md`.
- **Depends on:** UX-02

### UX-01 — End-to-end UX pass

- **Agent:** Cursor
- **Status:** COMPLETED
- **Description:** Usability, hierarchy, accessibility, and gameplay clarity across home, create/join, lobby, setup, catalog, reveal, table, host, and results. Preserve rules, hidden info, and server authority. Fix blank role portraits. Dark village direction and theme tokens stay.
- **Handoff (12 November 2026):** Portraits load through `roleArtUrl` with a crest fallback; Vite watches `art/` so new PNGs refresh the glob. Catalog cards are even height with team filters, search, and openable locked roles. Home sits on a readable panel with a return-to-seat callout and mode seat ranges. Create and Join keep values after errors, show Creating…/Joining…, and clean pasted room codes. Lobby shows a large room code with Copy/Share, seat and ready pills, and host identity. Setup adds step numbers, Next/Back, and Unsaved/Saving/Saved. Reveal covers/hides the role, lists abilities and teammates when allowed, and tells host vs guest what to do next. Table shows a phase guide, Selected check + word, selected-vs-submitted copy, revote limited to tied ids, abstain explained, Refresh on conflict, and host closes in a labelled group with confirm. Disabled gold buttons now look muted. Confirmation is tied to the phase that asked it. Action drafts reset per round and phase.
- **Inspected:** Live Classic 10 on `localhost:5181` (API 3000): create → lobby → Classic setup → start → reveal (Pack Wolf) → night kill (Ines) → morning → voting → night 2. Viewports: ~1024×820, phone portrait 390×760/844, landscape 844×390. `pnpm typecheck` and 361 web tests pass.
- **Limitations (superseded by UX-02):** Stale Vite on 5173/5174; voting abstain/changeUntilClose not on GameState; Results polish deferred. OD-75–OD-84 were accepted as built on 12 November 2026 (see open-decisions.md).
- **Files:** `apps/web/vite.config.ts`, `apps/web/src/assets` via art glob, `apps/web/src/game/components/{RolePortrait,RoleTile,RoleCard,RoleBadge,PlayerGrid,PhaseCloseButton,GameStatusBar,SeatDialogs,actionCopy,voteCopy,phaseCopy,roleCopy,roleFilters,actionDraft}.{tsx,ts}`, `apps/web/src/game/components/{scene-art,reveal-screen,table-screen,lobby-screen,home-scene}.css`, `apps/web/src/game/setup/{SetupLayout,SetupMode,SetupRoles,setup-layout.css}`, `apps/web/src/game/layout/game-layout.css`, `apps/web/src/routes/{Home,Lobby,Setup,Roles,Reveal,Table,Host}.tsx`, `apps/web/src/theme/{theme,visual}.css` and `theme.ts`, tests under `apps/web/test/screens/*`, `docs/AI-TASK-BOARD.md`.

### SETUP-CAP — Wolf cap follows the starting pack

- **Agent:** Cursor
- **Status:** COMPLETED
- **Description:** A custom list starts with wolf cap 0. Seating a wolf left that cap below the starting pack, so start showed `WOLF_CAP`. Editing roles now raises the cap to the wolves dealt at the start, and the settings field cannot be set lower than that. A higher cap is kept, so a Cursed Villager can still have a free slot. The lobby and setup screens say what to change, instead of a generic setup-problem line or a validator code.
- **Files:** `apps/web/src/game/setup/setupDraft.ts`, `apps/web/src/game/setup/SetupSettings.tsx`, `apps/web/src/game/setup/ConfigSummary.tsx`, `apps/web/src/game/components/lobbyCopy.ts`, `apps/web/src/routes/Setup.tsx`, `apps/web/src/routes/Lobby.tsx`, `apps/web/test/screens/setup-draft.test.ts`, `apps/web/test/screens/lobby-copy.test.ts`, `apps/web/test/screens/setup.test.tsx`

### U20-PLAY — Playable Ultimate 20 image rules

- **Agent:** Cursor
- **Status:** COMPLETED
- **Description:** Make the image-described Ultimate 20 rules playable. Infection Edition stays as it is. The Vampire mark promotes at dawn after the next night. The Vampire team chooses kill or mark, not both. Promotion and teammates stay private. Chaos uses the six image events and counts a success only when the effect changes state. Mind Controller's win stays unresolved (OD-76). Whether a Servant keeps the original ability stays the current conversion rule (OD-79).
- **Handoff (12 November 2026):** A mark placed on night N is due night N+1 and promotes only if both players are still alive. The team submits one kill or one mark; the Vampire's choice wins, otherwise the lowest player id. Promotion is a private `ROLE_CONVERTED` for the new Servant and a private `VAMPIRE_TEAM_JOIN` for the other living team members. `GET /me` lists living Vampire-team teammates. Chaos is drawn with `crypto.randomInt`, remembered when the Demon's action resolves, and counted only when the effect changes the night or the ballot. Migration `0013_ultimate_play` stores the counters and revival ids. There is no Vampire faction and no extra chat channel (OD-72). Image rules that stay unresolved: OD-75, OD-76, OD-77's draw procedure, OD-78, OD-79, OD-80, OD-81, OD-82, OD-83, OD-84. Fourteen Ultimate portraits are still listed and not generated.
- **Tests:** Domain `night-ultimate`, `victory`, `day-tally`, catalog, night, and night-golden. API `night-events`, `schema-drift`, `ultimate.integration`, `vote.integration`, `migrations.integration`. `tsc --noEmit` for domain, API, and web. Web `test/screens/ultimate-copy.test.ts` checks the locked setup sentence and the night exclusive-choice note. The live setup screen and a seated night were not opened: the API watcher exited with EMFILE, and the night note needs a seated Ultimate night.
- **Files:** `packages/domain/src/catalog/definitions/ultimate.ts`, `packages/domain/src/catalog/types.ts`, `packages/domain/src/night/{resolve,chaos,types}.ts`, `packages/domain/src/day/tally.ts`, `packages/domain/src/victory/evaluate.ts`, `packages/domain/src/index.ts`, `packages/domain/test/{night-ultimate,victory,day-tally,ultimate}.test.ts`, `apps/api/src/db/schema.ts`, `apps/api/drizzle/0013_ultimate_play.sql` and its down file and snapshot, `apps/api/src/night/{night-resolution.service,night-input}.ts`, `apps/api/src/day/day-resolution.service.ts`, `apps/api/src/victory/apply-victory.ts`, `apps/api/src/events/{night-events,event.service}.ts`, `apps/api/src/assignment/{projections,role-view.service}.ts`, `apps/api/test/{ultimate.integration,night-events,migrations.integration}.test.ts`, `apps/web/src/game/components/{actionCopy,NightActionPanel}.tsx` and `setupCopy.ts`, `apps/web/test/screens/ultimate-copy.test.ts`, `docs/werewolf/{ultimate-20-rules,night-resolution,open-decisions,data-model,api-design,role-catalog}.md`, `docs/AI-TASK-BOARD.md`.
- **Avoid:** WW-1303 is complete. Do not edit the host-route audit test except if a new route appears. This task adds no route.

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
- **Still unwired at the time of this handoff:** persist rewinds, the chaos draw and counter, used chaos kinds, revivals, silences, and hints; call `drawChaos` with a CSPRNG. Phase close already calls `tallyDay` and `evaluateVictory`, and that call does not yet receive `revivedBy`, `chaosSuccesses`, or `chaosAchieved`. U20-PLAY later stored the Chaos draw, the success count, and revival ids, and passes them into victory. Silences and hints stay on the night result.

### WEB-08 — Day ballot on the table

- **Agent:** Cursor
- **Status:** COMPLETED
- **Description:** The voting and revote stages on `/game/:id`. A living player chooses one living seat or abstains, confirms, and can replace that choice until the phase closes. Dead players see the seats and cannot vote. The host's phase button stays.
- **Files:** `apps/web/src/api/votes.ts`, `apps/web/src/game/state/votes.ts`, `apps/web/src/game/components/voteCopy.ts`, `apps/web/src/game/components/table-screen.css`, `apps/web/src/routes/Table.tsx`, `apps/web/test/screens/table.test.tsx`, `apps/web/test/screens/vote-copy.test.ts`, `apps/web/e2e/table.spec.ts`
- **Depends on:** WW-901, WW-604
- **Acceptance (met):** Confirm stays disabled until a choice is legal. A successful cast reads "Submitted", and another seat or abstain can be sent until the phase changes. A dead seat has no confirm button. The host can still end the day. A refused vote shows the server message and does not read "Submitted".
- **Tests:** `pnpm --filter @warewolf/web test` (280). `pnpm --filter @warewolf/web exec playwright test e2e/table.spec.ts`: a living player picks, confirms, and switches to abstain at 1024×768, 844×390, and 390×844. Confirm stays inside the viewport. No horizontal page scroll. Portrait keeps the Players tab.
- **Handoff to Claude:** `POST /votes` is the only ballot route. The client cannot restore a choice after reload, and a revote cannot list only the tied players, until the public state includes the caller's current target and the revote's eligible ids. Until then a revote shows every living seat, and a target outside the tie is refused with "That vote is not allowed."

### WW-1204 — GameLayout viewport pass

- **Agent:** Cursor
- **Status:** COMPLETED
- **Description:** The fixture shell already carries lobby and night (WEB-04, WEB-05). This pass checks reveal, night results, day, voting, and results at the seven viewports: same regions, the primary button on screen, no horizontal page scroll. The live reveal stays a private scene (ui-ux-plan section 7E). It is not moved onto the public rail.
- **Files:** `apps/web/e2e/layout.spec.ts`, `docs/werewolf/implementation-checklist.md`
- **Depends on:** WW-1201, WW-604
- **Acceptance (met):** At all seven viewports, reveal, night results, day, voting, and results keep Game status, Village, and Actions on screen, with the primary button inside the viewport and no horizontal page scroll. Portrait voting uses the Players | Room switch. The 568×320 check keeps Confirm vote on screen. Safe-area padding was already on `.ww-game-layout` and the action row.
- **Tests:** `pnpm --filter @warewolf/web exec playwright test e2e/layout.spec.ts` (21 passed, including the new stage pass at each viewport).

### WW-903 — Public tally and results screen

- **Agent:** Cursor
- **Status:** COMPLETED
- **Description:** The results route binds `VictoryBanner` and the recap to `useResults`. A finished game shows catalog names for the original and final roles, the winning team or a draw or individual wins, infections, and deaths. A cancelled game shows seats and the reason only. There is no public vote tally and no invented duration.
- **Files:** `apps/web/src/routes/Results.tsx`, `apps/web/src/game/components/ResultsRecap.tsx`, `apps/web/src/game/components/resultsCopy.ts`, `apps/web/src/game/components/results-screen.css`, `apps/web/src/routes/Table.tsx` (finished and cancelled leave for the results route), `apps/web/src/game/state/results.ts` (`refetch` only), `apps/web/src/game/state/role.ts` (`gamePath` sends a cancelled game here), `apps/web/test/screens/results.test.tsx`, `apps/web/test/screens/results-copy.test.ts`, `apps/web/test/screens/table.test.tsx`, `apps/web/test/routes.test.tsx`, `apps/web/test/state/role.test.tsx`, `apps/web/e2e/results.spec.ts`, `docs/werewolf/implementation-checklist.md`, `docs/AI-TASK-BOARD.md`.
- **Depends on:** WW-901, WW-902, WW-903a
- **Acceptance (met):** A finished game shows original and final roles by catalog name, never a role id. A cancelled game shows seats and "The host cancelled the game." and no role. A results error shows the server message and does not invent a winner. Chat is not mounted. Team colour comes with Wolf, Village, Neutral, or Independent.
- **Tests:** `pnpm --filter @warewolf/web typecheck`. `pnpm --filter @warewolf/web test` (326). `pnpm --filter @warewolf/web exec playwright test e2e/results.spec.ts`: Wolf wins, the recap, and Play again stay on screen at 1920×1080, 1024×768, and 390×844. A cancelled game at 1024×768 lists seats and no role id. No horizontal page scroll.
- **Handoff to WW-1203 (Cursor):** The stat row (Rounds, Infections, Eliminations) sits under the banner on the stage. The recap is the rail, labelled Recap. A village win uses `square_day`; every other finish uses `square_dusk`. `useResults` now returns `refetch`. WW-1203 still owns the dedicated seven-viewport pass, including 568×320. No ballot tally was added.

### DEC-ALL — Every open decision settled (12 November 2026)

- **Agent:** Claude (decisions by the product owner)
- **Status:** COMPLETED
- **Decisions:** OD-39 to OD-42, OD-45, OD-47, OD-49 to OD-57, OD-59, OD-61 to OD-70 accepted as built. Ultimate 20, OD-75 to OD-84, accepted as built: the Joker's win continues the game, the Mind Controller wins if alive at the end, the Chaos events are a shuffled deck, conversions follow `lostOnInfection`, the Necromancer may return a player twice. Hermit, Priest, Confuser, and Bard (OD-11, OD-17, OD-18, OD-20) are kept out of version 1. Every entry in `open-decisions.md` now has a dated decision line; none is open.
- **Code:** every Ultimate 20 role and the profiles `alpha_ultimate` and `oracle_alignment` are CONFIRMED, and so is the `ultimate-20` preset. No role is RECOMMENDED any more; only the four powerless roles are UNRESOLVED, and `expanded-infection-20` stays a RECONSTRUCTION (OD-61). No behaviour changed: every rule was already built this way.
- **Files:** `docs/werewolf/open-decisions.md`, `packages/domain/src/catalog/definitions/{ultimate,core,investigation}.ts`, `packages/domain/src/config/packs.ts`, `packages/domain/test/{confirmed-presets,validate,ultimate}.test.ts`, `apps/api/test/lobby.integration.test.ts`.
- **Tests:** Domain 406, API unit 59, `pnpm typecheck` clean. API integration 259 passed; failures were the known stale `events.integration.test.ts` line 129, and `event-replay.integration.test.ts`, which passed 3 of 3 runs alone (a timing flake under the parallel run). Web 346 passed; `test/assets/art.test.ts` fails because new art landed (`art/roles/vampire.png` and others, untracked) and the test still expects the Vampire to have none.
- **For Cursor:** `role-catalog.md` still shows RECOMMENDED in its status column; every role there except Hermit, Priest, Confuser, and Bard is now CONFIRMED. The art test needs the new role art reflected. The Ultimate setup copy can drop any "recommended rules" wording.

### DEC-ROLES — Role decisions accepted (12 November 2026)

- **Agent:** Claude (decisions by the product owner)
- **Status:** COMPLETED
- **Decisions accepted as recommended:** OD-05 to OD-10, OD-12 to OD-16, OD-19, OD-21 to OD-28, OD-30 to OD-38, OD-46, OD-48, OD-58. OD-09 is variant A (mark) only; OD-16 is variant B (item). Hermit, Priest, Confuser, and Bard (OD-11, OD-17, OD-18, OD-20) stay out of every preset. Ultimate 20 (OD-75 to OD-84) is not part of this.
- **Code:** 24 roles move from RECOMMENDED to CONFIRMED (Pack Wolf, Assassin, Cursed Villager, Lone Wolf, Immortal, Avenger, the eight investigators, Bodyguard, Shieldbearer, Trapper, Poisoner, Disruptor, Shapeshifter, Spy, Blacksmith, Elder, Mayor, Healer Assistant), plus the profiles `oracle`, `doctor_blind`, `doctor_limited`, `assassin_mark`, `blacksmith_item`. Presets `classic-10`, `investigation-15`, `protection-15`, `chaos-15`, `expanded-24`, `expanded-30` are CONFIRMED. `ultimate-20` stays RECOMMENDED and `expanded-infection-20` stays RECONSTRUCTION. Effect: those presets no longer carry the `UNCONFIRMED_PRESET` warning, so Classic and Expanded 24 start without a warning acknowledgement; density warnings still apply.
- **Files:** `packages/domain/src/catalog/definitions/{core,investigation,special,support,protection,offense}.ts`, `packages/domain/src/config/packs.ts`, `packages/domain/test/confirmed-presets.test.ts`, `packages/domain/test/validate.test.ts`, `apps/api/test/{lobby.test,lobby.integration.test,assignment.integration.test}.ts`, `docs/werewolf/open-decisions.md`.
- **Tests:** Domain 404 passed; the one failure is `victory.test.ts` "records each Ultimate trigger", from U20-PLAY's in-progress `evaluate.ts`. API unit 59, lobby and assignment integration 50, web 345. `pnpm typecheck` passes.
- **Handoff to Cursor (U20-PLAY holds these files):**
  - `docs/werewolf/open-decisions.md`: Claude added a "**Decided 12 November 2026: accepted as recommended.**" line under each decision above and four rows to the approval table, before seeing that U20-PLAY lists this file. Please keep them when you save.
  - `docs/werewolf/role-catalog.md`: the status column still says RECOMMENDED for the 24 roles above. Please set them to CONFIRMED in your pass.
  - Your in-progress work currently fails `apps/api/test/migrations.integration.test.ts` (the rollback order needs `0013_ultimate_play`) and `packages/domain/test/victory.test.ts` (the dead-Servant case). Both pass after U20-PLAY. The role-catalog status column was not updated in that pass.
  - The setup screen will now show these presets without the "recommended rules" warning; no UI change is required.

### WW-1303 — Host route audit

- **Agent:** Claude
- **Status:** COMPLETED (12 November 2026)
- **Description:** Every route classified and checked by a test that reads the server's live route table. Host routes refuse a missing token, another game's token, and a guest. A source scan proves only the start, the resolvers, and the victory evaluator write roles or winners. Host write bodies are strict. Host-only events never reach a guest. Details and findings: `docs/werewolf/api-design.md`, "Host route audit".
- **Findings fixed:** (1) a host transfer during a game left the old host's socket in the host room, still receiving host-only events; the rooms now move on transfer and `join-session` re-reads the seat. (2) `POST /host/transfer` silently dropped unknown fields; its body is now strict.
- **Files:** `apps/api/test/host-routes.integration.test.ts`, `apps/api/test/host-transfer-socket.integration.test.ts`, `apps/api/src/realtime/play.gateway.ts` (`moveHost`, seat re-read on `join-session`), `apps/api/src/lobby/lobby.service.ts` (moves the host room after a transfer or a host leave), `packages/contracts/src/lobby.ts` (`transferHostRequestSchema` strict), `docs/werewolf/api-design.md`.
- **Acceptance (met):** No route writes a role or a winner directly.
- **Tests:** The audit is 85 checks; the socket test fails with the fix disabled. API integration 258 passed with only the known `events.integration.test.ts` line-129 failure. API unit 58, contracts 101, web 341. `pnpm typecheck` passes.
- **For anyone adding a route:** add it to `INVENTORY` in `host-routes.integration.test.ts` with its access class, or the test fails.

### WW-1003b — Sniper day shot

- **Agent:** Claude
- **Status:** COMPLETED (12 November 2026)
- **Decision:** OD-29 accepted 12 November 2026. Interpretation recorded there.
- **Description:** The Sniper submits its one shot during day discussion. When discussion closes, the shots resolve in submission order before voting opens. A Guard, Doctor, or Shieldbearer protection that resolved on the target the night before stops it (those abilities now list `SNIPER` in `cancels`); an Immortal survives it. The shot is spent either way. A hit is a DAY death caused by `SNIPER` via `ABILITY`, an Avenger shot by the Sniper takes revenge on the Sniper, and a shot that decides the game finishes it without opening voting. A Sniper death never wins a Jester. Only games that seat a day kill change: `PhaseRules.dayShots` makes the discussion close `RESOLVE_DAY` with ballot `DISCUSSION`; every other game still advances straight to voting.
- **Files:** `packages/domain/src/phase/machine.ts` (`dayShots`, ballot `DISCUSSION`), `packages/domain/src/day/shots.ts` (`nightShields`, `resolveShots`), `packages/domain/src/index.ts`, catalog `core.ts` (Guard, Doctor), `protection.ts` (Shieldbearer), `offense.ts` (Sniper CONFIRMED), `apps/api/src/day/day-resolution.service.ts` (`fireShots`), tests `packages/domain/test/day-shots.test.ts`, `packages/domain/test/phase.test.ts`, `packages/domain/test/catalog.test.ts`, `apps/api/test/sniper.integration.test.ts`, docs `open-decisions.md` (OD-29), `role-catalog.md` (Guard, Sniper).
- **Acceptance (met):** A shot at night is 409 `ACTION_WRONG_PHASE`. Last night's Doctor save keeps the target alive and the shot is still spent (EXHAUSTED, action RESOLVED). A shot on the last wolf finishes the game in round 2 without voting, recorded as a SNIPER death by the Sniper, and the recap names the village. A Classic game without a Sniper still advances discussion to voting.
- **Tests:** Domain 394. API integration: sniper 3 of 3; the full suite 173 passed with only the known `events.integration.test.ts` line-129 failure (Cursor's, see WW-1102 notes). Web 338. `pnpm typecheck` passes.
- **Not covered:** the Blacksmith's held shield item does not stop the shot (see OD-29).
- **Handoff to Cursor (UI, small):** In a game with a Sniper, `GET /state` reports the day discussion close as `{ next: null, resolves: 'DAY' }` instead of `{ next: 'VOTING' }`, so the host's close button should read as resolving the shot before voting, not "resolve day". The shot itself uses the existing action panel (`actionPrompts`, window `DAY_DISCUSSION`). The death appears like a day elimination; there is no separate announcement event.

### WW-904 — Public vote tally

- **Agent:** Claude
- **Status:** COMPLETED (12 November 2026)
- **Decision:** OD-85 (12 November 2026): counts per target, public after each ballot closes. Who voted for whom is never published.
- **Description:** The day resolution stores each closed ballot's weighted counts, abstentions, the named player, and any tie in `day_tallies`, from the same tally that decided it. After commit a PUBLIC `VOTE_TALLY` event is published (boot recovery repairs a missed one). `GET /games/:gameId/tallies` lists them for any seat, and the finished recap includes them.
- **Files:** `apps/api/src/db/schema.ts` (`day_tallies`), migration `0012_day_tallies` (+ down), `apps/api/src/day/day-resolution.service.ts`, `apps/api/src/day/tallies.ts`, `apps/api/src/events/event.service.ts` (`publishTallies`, `republishTallies`), `apps/api/src/phase/phase.service.ts`, `apps/api/src/results/results.service.ts`, `apps/api/src/app.module.ts`, `packages/contracts/src/tally.ts`, `packages/contracts/src/results.ts`, `apps/web/src/api/tallies.ts`, `apps/web/src/game/state/tallies.ts`, `apps/web/src/game/fixtures/results.ts`, tests `apps/api/test/tally.integration.test.ts`, `apps/api/test/results.integration.test.ts`, `apps/api/test/migrations.integration.test.ts`, `apps/web/test/state/tallies.test.tsx`, docs `api-design.md`, `data-model.md`, `open-decisions.md` (OD-85).
- **Acceptance (met):** Nothing is public while the ballot is open. After the close, a 3-2 ballot with one abstention reads exactly that, names the leader, and contains none of the six voters' ids; the event reaches a player once, and a second publish inserts nothing. A 2-2 tie lists both as tied with no one named, and the revote is listed as ballot 2.
- **Handoff to WW-904b (Cursor):** `useDayTallies(state.phase, state.stateVersion)` from `src/game/state/tallies.ts` returns `tallies`, `latest`, `isLoading`, `error`. Show `latest` after a ballot closes (for example during the following night announcement or the revote). Names come from `state.players` by id. `tallyTotal(tally)` gives the bar scale; `talliesOfRound(tallies, round)` groups a day. Show abstentions as a word, not a seat. A tie names the tied players ("Revote between …"). In the recap, `finished.tallies` is the same list. Never show counts while a ballot is open.

### WW-904b — Public tally on the table and the recap

- **Agent:** Cursor
- **Status:** COMPLETED (12 November 2026)
- **Description:** After a ballot closes, the table shows that ballot's weighted counts, the named player or the tie, and abstentions as a word. The same list is in the results recap. An open vote shows no counts.
- **Files:** `apps/web/src/game/components/VoteTally.tsx`, `apps/web/src/game/components/tallyCopy.ts`, `apps/web/src/game/components/table-screen.css`, `apps/web/src/game/components/ResultsRecap.tsx`, `apps/web/src/routes/Table.tsx`, `apps/web/test/screens/tally-copy.test.ts`, `apps/web/test/screens/table.test.tsx`, `apps/web/test/screens/results.test.tsx`, `apps/web/e2e/table.spec.ts`, `apps/web/e2e/results.spec.ts`.
- **Acceptance (met):** Morning shows the named player, the totals, and "2 abstentions", with no player id. Voting hides the card. A first tie reads "Revote between …". A second tie reads "Nobody was eliminated." The recap includes the same card on every priority viewport.
- **Tests:** `test/screens/tally-copy.test.ts`, the new table screen case, the results screen case. Playwright: results on all seven viewports, and the morning card on 390×844.

### WW-1503 — Request ids and readiness

- **Agent:** Claude
- **Status:** COMPLETED (12 November 2026)
- **Description:** Every request carries an id: a well-formed incoming `X-Request-Id` is kept, anything else is replaced with a UUID, and the id is returned on the response (exposed to the APK through CORS). One log line per request holds the id, method, path without its query, status, duration, and the game id when the path names one. A 5xx is logged with its request id. `GET /api/v1/health/ready` answers 200 when PostgreSQL responds within 2 seconds and 503 otherwise; `/health` stays the liveness check. The production Compose health check uses `/health/ready`.
- **Files:** `apps/api/src/http/request-log.ts`, `apps/api/src/http/log-line.ts` (keys `request`, `method`, `path`, `status`, `ms`), `apps/api/src/http/error.filter.ts`, `apps/api/src/app.ts`, `apps/api/src/system/readiness.controller.ts`, `apps/api/src/app.module.ts`, `packages/contracts/src/system.ts`, `compose.prod.yaml`, `README.md`, tests `apps/api/test/request-log.test.ts` and `apps/api/test/readiness.integration.test.ts`.
- **Acceptance (met):** Logs include the request id and the game id. A token in a query string never reaches the line. An id with spaces or over 64 characters is replaced.
- **Also fixed:** the three chat refusals (`CHAT_CLOSED`, `CHAT_READ_ONLY`, `CHAT_MUTED`) had no message in the error filter and reached players as "Something went wrong." They now carry the same words as the composer, and the message map's type now requires every error code. `apps/api/test/chat.integration.test.ts` checks the text.
- **Tests:** API unit 58. `pnpm typecheck` passes.

### WEB-09 — One shared `/play` socket

- **Agent:** Claude
- **Status:** COMPLETED (12 November 2026)
- **Description:** The phase signal (`usePlaySession`) and chat (`useChat`) each opened a `/play` socket. Now each seat has one connection, shared by reference count: the first subscriber opens it, the last one closes it. Every event is registered once and fanned out. `join-session` is sent once per connect with the newest stored event seq, so a reconnect replays only what was missed. Chat events never move that cursor.
- **Files:** `apps/web/src/realtime/session.ts` (`subscribePlay`), `apps/web/src/game/state/realtime.ts`, `apps/web/src/game/state/chat.ts`, `apps/web/test/realtime/session.test.ts`, `apps/web/test/state/realtime.test.tsx` and `apps/web/test/state/chat.test.tsx` (expectations: registration order, and chat no longer sends its own join).
- **Tests:** Full web suite 35 files, 332 tests. `pnpm typecheck` passes.
- **For new realtime features:** call `subscribePlay(token, gameId, { EVENT: handler })` from an effect and return its result as the cleanup. Do not call `connectPlay` from a hook.

### WW-1202a — Host dashboard projection

- **Agent:** Claude
- **Status:** COMPLETED (12 November 2026)
- **Description:** One host-only payload for the dashboard: overview, roster, this round's submissions, every infection attempt, every ballot with voters and weighted totals, every death with its causes, and victory flags.
- **Files:** `packages/contracts/src/hostDashboard.ts` (+ `index.ts`), `apps/api/src/host/dashboard.service.ts`, `apps/api/src/host/dashboard.controller.ts`, `apps/api/src/app.module.ts`, `apps/api/test/dashboard.integration.test.ts`, `apps/web/src/api/hostDashboard.ts`, `apps/web/src/game/state/hostDashboard.ts`, `apps/web/src/game/fixtures/hostDashboard.ts`, `apps/web/test/state/host-dashboard.test.tsx`, `docs/werewolf/api-design.md` section 8.
- **Acceptance (met):** A guest is 403 and the lobby is 409. Through a real Infection night: the Alpha's infect and kill show as PENDING submissions with their targets; after the night the infection is SUCCESS, the infected seat's current faction is WOLF_PACK, and the kill is a NIGHT death caused by WOLF_KILL with the Alpha as actor. During voting the open ballot lists each voter and totals 3; after the close it is closed, the voted-out seat is a DAY death with every voter as actor, and round 2 starts with no submissions.
- **Tests:** `apps/api/test/dashboard.integration.test.ts` 2 of 2. `apps/web/test/state/host-dashboard.test.tsx` 4 of 4. `pnpm typecheck` passes.
- **Handoff to WW-1202 (Cursor):**
  - `useHostDashboard(state.phase, state.stateVersion)` from `src/game/state/hostDashboard.ts` returns `dashboard`, `isLoading`, `error`, `refetch`. It asks nothing for a guest or in the lobby, reads again on each new state version, and polls every 4 seconds while a submission window or a ballot is open.
  - Sections map one to one onto the UI plan's sidebar: `overview` (Overview), `roster.players` (Players and roles), `infections` (Infection history, failures included with `failureReason`), `submissions` (Night actions and wolf submissions, this round only), `ballots` (Open and closed votes), `eliminations` (Eliminations, with `causes`), `victory` (Victory flags).
  - Helpers: `dashboardSeat(dashboard, playerId)` for a name and seat by id; `openBallot(dashboard)`; `wolfSubmissions(dashboard)`.
  - The Doctor prompt state is the `doctor_save` row in `submissions` during `NIGHT_REACTION`. Kill confirm stays on the existing `useKillTarget` / `useSetKillTarget` hooks. The event log is `GET /events` with the host token.
  - Every section is a secret. Never render it on a player route, and never put it in the discussion rail.
  - Fixture: `hostDashboardFixture()` in `src/game/fixtures/hostDashboard.ts`, round 2 voting on the 20-seat Infection deal, with one success and one failed infection, a night and a day death, and an open and a closed ballot.

### WW-1202 — Host dashboard screen

- **Agent:** Cursor
- **Status:** COMPLETED (12 November 2026)
- **Description:** `/game/:gameId/host` is a sidebar and a canvas. The host sees this round's submissions. A guest sees a refusal and the screen does not request the dashboard.
- **Files:** `apps/web/src/routes/Host.tsx`, `apps/web/src/routes.tsx`, `apps/web/src/routes/Table.tsx` (host link only), `apps/web/src/game/host/**`, `apps/web/src/api/events.ts`, `apps/web/src/game/state/hostEvents.ts`, `apps/web/test/screens/host.test.tsx`, `apps/web/test/routes.test.tsx`, `apps/web/e2e/host.spec.ts`.
- **Acceptance (met):** The host sees the pack submission, a failed infection in words, and the open ballot total. A guest has no sections and no dashboard request. Every section is reachable at 844×390, 390×844, and 568×320, and End the day stays on screen. There is no role dropdown.
- **Tests:** `apps/web/test/screens/host.test.tsx` 3 of 3. Playwright `e2e/host.spec.ts` on phone-land, phone-portrait, and phone-land-sm at 568×320. `tsc --noEmit` passes.
- **Handoff to WW-1303:** The screen writes nothing except the existing phase close and kill confirm (`useClosePhase`, `useSetKillTarget`). Configuration is a locked sentence. Event payloads are not rendered. The table status has a Host link for the host only.

### WW-1203 — Results viewport pass

- **Agent:** Cursor
- **Status:** COMPLETED (12 November 2026)
- **Description:** The existing results screen keeps the stat row and the recap inside every priority viewport, including 568×320.
- **Files:** `apps/web/e2e/results.spec.ts`.
- **Acceptance (met):** All seven projects show the winning team, the recap, and Play again, with no horizontal page scroll. The stat row is fully on screen at 1920×1080 and 390×844. At 568×320 the stats and Play again stay on screen, and Recap opens the rail. Cancelled games still hide roles.
- **Tests:** Playwright `e2e/results.spec.ts`.
- **Handoff:** WW-904 owns a public tally. These checks do not look for one. At 568×320 the recap is behind the Recap button.

### WW-903a — Results projection

- **Agent:** Claude
- **Status:** COMPLETED (12 November 2026)
- **Description:** `GET /games/:gameId/results` for any seat. A finished game reveals each seat's original and final role, death, win, and ability uses, plus the winning team or draw and the successful infections. A cancelled game returns seats and the reason, never a role. 409 while the game is in the lobby or running.
- **Files:** `packages/contracts/src/results.ts` (+ `index.ts`), `apps/api/src/results/results.service.ts`, `apps/api/src/results/results.controller.ts`, `apps/api/src/app.module.ts`, `apps/api/test/results.integration.test.ts`, `apps/web/src/api/results.ts`, `apps/web/src/game/state/results.ts`, `apps/web/src/game/fixtures/results.ts`, `apps/web/test/state/results.test.tsx`, `docs/werewolf/api-design.md` section 5.
- **Acceptance (met):** A Classic game played to a village win through the real resolvers returns VILLAGE, every wolf dead by DAY with `won: false`, every survivor alive, the Seeker's one resolved investigation counted, and the same body for a dead seat as a living one. A cancelled game's JSON contains no role id or faction. The lobby and a running game are 409. A token from another game is 404.
- **Tests:** `apps/api/test/results.integration.test.ts` 3 of 3. `apps/web/test/state/results.test.tsx` 5 of 5. `pnpm typecheck` passes.
- **Not included:** a public vote tally. No tally is stored today, and whether ballots are public is a product decision. See the decision list for 12 November 2026.
- **Handoff to WW-903 and WW-1203 (Cursor):**
  - `useResults(state.status)` from `src/game/state/results.ts` returns `finished`, `cancelled`, `isLoading`, `error`. It asks nothing until the status is `FINISHED` or `CANCELLED`.
  - `resultsHeadline(finished)` gives `{ kind: 'TEAM', team }`, `{ kind: 'DRAW' }`, or `{ kind: 'INDIVIDUALS' }` for `VictoryBanner`. A team colour always comes with its word.
  - `recapOrder(seats)` puts winners first, then seat order. `converted(seat)` marks a seat whose role changed, such as an infected villager (`originalRoleId` to `finalRoleId`).
  - `death.phaseKind` says night or day, and `death.roleId` is the role at death. `individualWin` marks a Jester or a surviving Neutral (OD-73).
  - A cancelled recap has no roles: show seats and the reason (`HOST` or `SURRENDER`) only.
  - Fixtures: `finishedResultsFixture({ winningTeam, draw })` and `cancelledResultsFixture(reason)` in `src/game/fixtures/results.ts`, on the 20-seat Infection deal with one infection and three deaths.

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
  - **WW-804** is done. See its section below. It writes `game_events` from the stored rows after commit.
  - **WW-901** must, in the day resolution: apply `scheduled_effects` of kind `POISON` with `due_phase = 'DAY'` and `due_round` equal to the round, and close them; run Immortal, Jester, and Avenger on a day elimination (queue revenge as a `REVENGE` effect due the next night, as step 16 does); hand a Doctor's save to a Healer Assistant when the Doctor is voted out; and set `games.infection_sealed` when the Alpha is voted out.
  - **WW-902** evaluates victory on the result. `NightResolution.gameOver` is always false until then.
  - Rows written per night: `resolution_runs`, `elimination_records`, `infection_records`, `investigation_records`, `role_conversion_records`, `scheduled_effects`, `role_assignments` through `changeAssignment`, `ability_instances` (patches and grants, with `source` COPY or INHERITED and `source_player_id`), `night_actions.status` and `rejected_reason`, `game_players.life_status` and `died_round`, and `games.infection_successes` and `infection_sealed`.
- **Handoff to Cursor (WW-604):** no contract changed. One behavior to know: once a night resolves, its actions are `RESOLVED` or `REJECTED`, and `GET /me/actions` returns only `PENDING` and `LOCKED` choices, so from the day announcement on each row's `action` is null. Show the ability's availability, not "Submitted". A dead seat's abilities read `DEAD`.

### WW-804 — Private result events after the night commit

- **Agent:** Cursor
- **Status:** COMPLETED
- **Description:** After the night transaction commits, write audience-specific `game_events` from the stored rows. A second publish of the same night is a no-op. Socket emit is not this task.
- **Files:** `apps/api/src/events/night-events.ts`, `apps/api/src/events/event.service.ts`, `apps/api/src/phase/phase.service.ts` (publish after commit; `recover` republishes first), `apps/api/src/db/schema.ts`, `apps/api/drizzle/0010_game_events.sql` with its down file and `meta/0010_snapshot.json`, `apps/api/src/app.module.ts`, `apps/api/test/night-events.test.ts`, `apps/api/test/events.integration.test.ts`.
- **Acceptance (met):** A Classic night writes an investigation to the actor and the host, and the player payload has no `actorPlayerId` and no catalog role id. An Infection success writes `INFECTION_OCCURRED` to the converted player with `{ roundNumber, actionId, roleId }` and a host row that adds `sourcePlayerId` and `targetPlayerId`. A failure is not an event. `ROLE_CONVERTED` player rows omit the source. `PLAYER_ELIMINATED` is `PUBLIC`, and `roleId` is set only when `revealedPublicly`. `ACTION_BLOCKED` reaches the target only when `informTarget` is set, as `{ roundNumber }`. Calling `publishNight` again returns 0.
- **Tests:** `pnpm --filter @warewolf/api test` and `pnpm test:integration` (151).
- **Handoff to Claude (WW-1102):** Read `game_events` and emit each row to its room: `PUBLIC` to `game:{id}:public`, `PLAYER` to `game:{id}:player:{recipientPlayerId}`, `HOST` to `game:{id}:host`. `afterSeq` is the reconnect catch-up. Do not rebuild payloads from the night result. `investigation_records.published` stays false; that flag is the Seeker's public reveal. The `NIGHT_PUBLISHED` marker is a host row, not a player fact. Publish failures are logged and do not roll back the night.

### WW-1101 — Socket authentication and rooms

- **Agent:** Cursor
- **Status:** COMPLETED
- **Description:** Namespace `/play`. The handshake token is the seat bearer token. `join-session` enters only that seat's rooms.
- **Files:** `apps/api/src/realtime/play.gateway.ts`, `apps/api/src/app.module.ts`, `apps/api/test/socket.integration.test.ts`. Dependencies: `socket.io`, `socket.io-client`.
- **Acceptance (met):** An unknown token gets `connect_error`. A token from another game acks `{ ok: false }` and joins no `game:` room. A `playerId` in the payload is ignored, so the host does not enter the guest's player room. A client `INFECTION_OCCURRED` is not relayed.
- **Rooms:** `playRooms(gameId, playerId, isHost)` returns `game:{gameId}:public`, `game:{gameId}:player:{playerId}`, and `game:{gameId}:host` when `isHost`.
- **Handoff to Claude (WW-1102):** Done. See the WW-1102 section.

### WW-803a — Host kill target

- **Agent:** Cursor (picked up 11 November 2026 after Claude's session stopped)
- **Status:** COMPLETED
- **Description:** The host chooses the night's final target among the players the pack named, or no kill. Host confirm cannot close without that choice. The informed Doctor is told the confirmed target. The client can read and replace the choice without fetch code in a screen.
- **Files:** The API, storage, and close guard were already in the tree (`apps/api/src/night/kill-target.ts`, migration `0007_kill_decisions`, `packages/domain/src/night/killTarget.ts`, `packages/contracts/src/killTarget.ts`). This pass added the client data layer: `apps/web/src/api/killTarget.ts`, `apps/web/src/game/state/killTarget.ts`, `apps/web/src/game/fixtures/killTarget.ts`, `apps/web/src/game/fixtures/actions.ts` (`finalWolfTarget`), `apps/web/src/api/api.ts`, `apps/web/src/api/game.ts`, `apps/web/test/state/kill-target.test.tsx`.
- **Acceptance (met):** A target no wolf named is 422 `KILL_TARGET_NOT_SUBMITTED`. Closing host confirm with no choice is 409 `KILL_TARGET_REQUIRED` and the phase stays. The informed Doctor's open save carries `finalWolfTarget`, or null when the host chose no kill. A non-host never requests the view.
- **Tests:** `apps/web/test/state/kill-target.test.tsx`. The API cases are in `apps/api/test/night.integration.test.ts` (`host kill target`).
- **Handoff to WW-803b:** Call `useKillTarget(state.phase, state.stateVersion)` and `useSetKillTarget()` from `src/game/state/killTarget.ts`. The view is null for a guest and outside `NIGHT_HOST_CONFIRM` and `NIGHT_REACTION`. `candidates` is the legal list, in player id order, with `submittedBy`. `choose({ targetPlayerId })` or `choose({ noKill: true })` replaces the choice while `editable` is true. Show `error.issues[0]?.message` for `KILL_TARGET_NOT_SUBMITTED`. The Doctor line is not this view: read `finalWolfTarget` on the `doctor_save` prompt from `actionPrompts` during the reaction window. Null means there is no attack. Do not put wolf names in the discussion rail.

### WW-803b — Host kill-target picker

- **Agent:** Cursor
- **Status:** COMPLETED
- **Description:** On the table, the host picks the night's attack from the players the pack named, or no kill, and can replace that choice until host confirm closes. The informed Doctor reads the attack on their own panel. Who submitted a name stays in the host panel.
- **Files:** `apps/web/src/game/components/killCopy.ts`, `apps/web/src/game/components/KillTargetPanel.tsx`, `apps/web/src/game/components/NightActionPanel.tsx` (the Doctor line), `apps/web/src/game/components/table-screen.css`, `apps/web/src/routes/Table.tsx`, `apps/web/test/screens/kill-copy.test.ts`, `apps/web/test/screens/table.test.tsx`, `apps/web/e2e/table.spec.ts`, `docs/werewolf/implementation-checklist.md`, `docs/AI-TASK-BOARD.md`. Reads the choice only through `src/game/state/killTarget.ts` and `finalWolfTarget` on `actionPrompts`.
- **Depends on:** WW-803a
- **Acceptance (met):** Confirm stays disabled until the host picks a candidate or no kill. A stored choice reads "Submitted" and can be replaced until the window closes. A refusal shows `issues[0].message` and does not read "Submitted". A guest has no picker and never requests the view. The Doctor sees "The attack is on {name}." or "There is no attack." That line and "Named by" stay out of the discussion rail.
- **Tests:** `pnpm --filter @warewolf/web typecheck`. `pnpm --filter @warewolf/web test` (311). `pnpm --filter @warewolf/web exec playwright test e2e/table.spec.ts`: the host confirms Diego and can switch to no kill at 1024×768, 844×390, and 390×844. Confirm target stays inside the viewport. No horizontal page scroll.
- **Handoff:** A locked reaction window shows the attack and does not offer Confirm target. The results route still has no tally. Wolf roles are not written into the rail.

### WW-1104 — Chat messages and moderation

- **Agent:** Claude
- **Status:** COMPLETED (12 November 2026). Cursor built WW-1206 on this data layer and reported no problems; the one follow-up is a shared `/play` socket.
- **Description:** Server-side public chat under the OD-72 rules. Living players post during `DAY_DISCUSSION`, `VOTING`, and `REVOTE` only. Dead players read only. No wolf channel. The host deletes a message and mutes or unmutes a seat. 280 characters (422), 5 messages per 10 seconds per seat (429). A separate chat table, emptied when the game finishes or is cancelled. Messages fan out to the public room.
- **Files:** Domain rule `packages/domain/src/chat/rules.ts` (+ `index.ts`, `test/chat.test.ts`). Contract `packages/contracts/src/chat.ts` (+ `index.ts`, `errors.ts` codes `CHAT_CLOSED`, `CHAT_READ_ONLY`, `CHAT_MUTED`, `test/chat.test.ts`). API `apps/api/src/chat/chat.service.ts`, `apps/api/src/chat/chat.controller.ts`, `apps/api/src/db/schema.ts` (`chat_messages`, `chat_mutes`), migration `apps/api/drizzle/0011_chat.sql` with the retention trigger, `drizzle/down/0011_chat.sql`, `drizzle/meta/`, `apps/api/src/http/api-error.ts`, `apps/api/src/realtime/play.gateway.ts` (`emitPublic`, chat events dropped from clients), `apps/api/src/app.module.ts`, tests `apps/api/test/chat.integration.test.ts`, `test/schema-drift.test.ts`, `test/migrations.integration.test.ts`. Client `apps/web/src/api/chat.ts`, `apps/web/src/api/api.ts` (`Chat` tag), `apps/web/src/game/state/chat.ts`, `apps/web/src/game/fixtures/chat.ts`, `apps/web/test/state/chat.test.tsx`. Docs `docs/werewolf/api-design.md` section 13 (plus the realtime and authorization tables), `docs/werewolf/data-model.md` (`chat_messages`, `chat_mutes`, retention).
- **Acceptance (met):** Every seat in the game hears `CHAT_MESSAGE_POSTED`; a seat in another game does not, and a client-emitted chat event is not relayed. Night, reveal, and announcement posts are 409 `CHAT_CLOSED`. A dead seat is 403 `CHAT_READ_ONLY` and still reads. A muted seat is 403 `CHAT_MUTED`. Blank or 281 characters is 422. The sixth post in 10 seconds is 429, and the budget is per seat. Cancel and finish delete the game's messages and mutes and leave other games alone.
- **Tests:** `pnpm typecheck` passes. Domain 388, contracts 101, API unit 50 pass. `apps/api/test/chat.integration.test.ts` 10 of 10 and `test/migrations.integration.test.ts` 35 of 35 pass. The full web suite passes, 26 files and 293 tests (the chat file also 5 runs in a row). The full API integration suite did not finish green on this machine: load average 10 to 13 on 8 cores made scattered tests in unrelated files hit the 30-second timeout, and each of those passes alone.
- **Found, not mine:** `apps/api/test/events.integration.test.ts` line 129 expects every `PUBLIC` row to be `PLAYER_ELIMINATED`. Since WW-1103 every phase close also writes a public `PHASE_CHANGED`, so this assertion fails with or without chat. Cursor owns that file (WW-804, WW-1103). Suggested fix: filter out `PHASE_CHANGED` before that check.
- **Handoff to WW-1206 (Cursor):**
  - `useChat(state.phase, state.stateVersion)` from `src/game/state/chat.ts` returns `messages` (oldest first), `mutedPlayerIds`, `canPost`, `refusal`, `isLoading`, `error`. It opens its own `/play` socket and keeps the list live. No fetch or socket code in the screen.
  - Enable the composer only when `canPost`. Disabled copy by `refusal`: `CLOSED` (chat opens in day discussion and voting), `DEAD` (the dead read only), `MUTED` (the host muted you).
  - `checkChatDraft(text)` gives `{ remaining, sendable }` for the counter and the Send button, counting as the server counts (an emoji is one).
  - `usePostChat().send(text)` resolves to the stored message or null. Show `error.message` for `RATE_LIMITED`, `CHAT_CLOSED`, `CHAT_READ_ONLY`, `CHAT_MUTED`, `VALIDATION_FAILED`. The sent message appears without waiting for the socket.
  - `useChatModeration()` returns `available` (host only), `deleteMessage(messageId)`, `mute(playerId)`, `unmute(playerId)`, `isWorking`, `error`. Hide the controls when `available` is false. Mutes are public, so a muted badge is fine on any seat.
  - Names and avatars come from `state.players` by `playerId`. A message carries no role or team, and the rail must not add one. The recap does not show chat.
  - Fixtures: `chatViewFixture({ count, mutedPlayerIds, you })` and `chatMessageFixture(n)` in `src/game/fixtures/chat.ts`.
  - Known cost: the chat hook opens a second `/play` socket beside `usePlaySession`. One shared socket is an engineering follow-up for Claude, not a WW-1206 concern.
- **Checked while building WW-1206:** the client hooks match this handoff. `useChat`, `checkChatDraft`, `usePostChat`, and `useChatModeration` are what the rail calls. No change to the data layer.

### WW-1206 — Discussion composer

- **Agent:** Cursor
- **Status:** COMPLETED
- **Description:** The discussion rail lists the public channel and keeps a composer at the bottom. Send is enabled only when the server says the seat may post. The host can delete a message and mute or unmute another seat. The results recap does not show chat.
- **Files:** `apps/web/src/game/components/chatCopy.ts`, `apps/web/src/game/components/DiscussionPanel.tsx`, `apps/web/src/game/components/table-screen.css`, `apps/web/src/routes/Table.tsx`, `apps/web/test/screens/chat-copy.test.ts`, `apps/web/test/screens/table.test.tsx`, `apps/web/e2e/table.spec.ts`, `docs/werewolf/implementation-checklist.md`, `docs/AI-TASK-BOARD.md`. The screen does not fetch or open a socket. `Table.tsx` is shared with WW-803b, done in the same pass.
- **Depends on:** WW-1104, WW-1204
- **Acceptance (met):** Day discussion and voting enable Send once the draft is legal. Night reads "Chat opens in day discussion and voting." A dead seat reads "The dead read only." and can still see messages. A muted seat reads "The host muted you." Over 280 characters disables Send. A 429 shows the server message. The host sees Delete and Mute. A guest does not. A message carries a display name and an avatar, and the rail does not add a role or a team. `/game/:id/results` has no composer.
- **Tests:** `pnpm --filter @warewolf/web typecheck`. `pnpm --filter @warewolf/web test` (311). `pnpm --filter @warewolf/web exec playwright test e2e/table.spec.ts`: Send stays inside the viewport at all seven projects, a day message can be sent, and at 568×320 the Discussion button opens the composer onto the screen. No horizontal page scroll.
- **Handoff to Claude:** The chat hook still opens its own `/play` socket beside `usePlaySession`. One shared socket remains the follow-up. The results recap is still WW-1203 and does not mount this panel.

### WW-1601 — Capacitor and the Android project

- **Agent:** Claude
- **Status:** COMPLETED (12 November 2026)
- **Description:** Capacitor wraps the same Vite client. `cap sync` copies the build into `apps/web/android`. Orientation stays unlocked (OD-71). No Android screens of its own.
- **Files:** `apps/web/capacitor.config.ts` (app id `com.warewolf.werewolf`, name Werewolf, `webDir: 'dist'`), `apps/web/android/` (generated by `cap add android` 8.6.0), `apps/web/package.json` (`@capacitor/core`, `@capacitor/android`, `@capacitor/cli`, script `android:sync`), `apps/web/tsconfig.json` (typechecks the config), `apps/web/test/android/android-project.test.ts`, `pnpm-lock.yaml`, `.dockerignore` (the web image skips `apps/web/android`), `README.md`, `docs/werewolf/ui-ux-plan.md` section 11.
- **Acceptance (met):** `pnpm --filter @warewolf/web android:sync` builds and copies `dist/` into `android/app/src/main/assets/public`; the two trees match file for file (99 assets) apart from Capacitor's cordova shims. The manifest has no `screenOrientation` and handles `orientation|screenSize` itself. The only permission is `INTERNET`.
- **Tests:** `pnpm typecheck` passes. The full web suite passes, 27 files and 297 tests, including the 4 Android project checks.
- **Notes:** The copied build, `capacitor.config.json`, and the cordova plugin folder are generated on every sync and ignored by the template's `android/.gitignore`. `android/capacitor.settings.gradle` points into the pnpm store by version; `cap sync` rewrites it after a Capacitor upgrade. This machine has no JDK and no Android SDK, so no Gradle build was run.
- **Handoff to WW-1602 (Claude):** Install a JDK 21 and the Android SDK (or Android Studio), set `ANDROID_HOME`, then `cd apps/web/android && ./gradlew assembleDebug`. Build with `VITE_API_ORIGIN=http://<lan-ip>:3000 pnpm --filter @warewolf/web android:sync` first: an empty origin makes the WebView call `https://localhost`, which is the phone itself. Debug cleartext to a LAN API needs a network security config or `android:usesCleartextTraffic` on the debug build only, and the API's Socket.IO CORS currently refuses every origin (`cors: { origin: false }` in `play.gateway.ts`), so the WebView origin `https://localhost` must be allowed for the APK.
- **Handoff to WW-1603 (Claude):** Done. See the WW-1603 section.

### WW-1603 — Seat token storage in the APK

- **Agent:** Claude
- **Status:** COMPLETED (12 November 2026) in code and unit tests. The on-device restart check is WW-1604's smoke test, which needs the APK from WW-1602.
- **Description:** The APK keeps the seat token in Capacitor Preferences so it survives a process kill. The web keeps sessionStorage, so a token stays in its tab. `/me` stays the source of truth: a stored token that gets a 401 is dropped from memory and from storage.
- **Files:** `apps/web/src/session/storage.ts` (`KeyValueStore`, `preferencesSessionStorage`, `platformSessionStorage`), `apps/web/src/session/nativeStorage.ts` (`startupSessionStorage`, the only file that imports the native bridge), `apps/web/src/main.tsx` (reads the seat before the first render), `apps/web/package.json` (`@capacitor/preferences`), `pnpm-lock.yaml`, `apps/web/android/` (plugin registered by `cap sync`), `apps/web/test/session/storage.test.ts`, `docs/werewolf/ui-ux-plan.md` section 11.
- **Design:** The store reads its seat synchronously, and Preferences is asynchronous. So the stored seat is read once before the app renders and held in memory, and every change is written through in order (leave then join cannot land reversed). A failed plugin call loses only persistence, never the session in memory.
- **Acceptance:** Met in tests: a new adapter over the same preferences (the simulated process kill) restores the seat; writes keep their order; unreadable or malformed values load as no seat; a 401 clears the stored seat. Selection picks Preferences when native and sessionStorage on the web. On a device: WW-1604.
- **Tests:** `pnpm typecheck` passes. The full web suite passes, 28 files and 302 tests.

### WW-1602 — Debug APK

- **Agent:** Claude
- **Status:** COMPLETED (12 November 2026) for the build and network path. Installing on a phone is WW-1604's smoke test; no device or emulator was used.
- **Description:** `assembleDebug` produces a sideload APK that reaches the API at a build-time origin. INTERNET is the only permission the app asks for. Cleartext HTTP to a LAN API is allowed in debug builds only. Keystores are ignored by git.
- **Files:** `apps/web/capacitor.config.ts` (an `http://` `VITE_API_ORIGIN` serves the WebView from `http://localhost`), `apps/web/android/app/src/debug/AndroidManifest.xml` (cleartext, debug only), `apps/web/android/.gitignore` (`*.jks`, `*.keystore`), `apps/web/package.json` (`android:apk`), `apps/web/test/android/android-project.test.ts`, `apps/api/src/config.ts` (`CORS_ORIGINS`), `apps/api/src/app.ts`, `apps/api/src/realtime/play.gateway.ts`, `apps/api/test/cors.test.ts`, `.env.example`, `README.md` ("Android debug APK"), `docs/werewolf/ui-ux-plan.md` section 11.
- **Toolchain (this Mac):** `openjdk@21` and `android-commandlinetools` from Homebrew; SDK `platform-tools`, `platforms;android-36`, `build-tools;36.0.0`, licenses accepted. `apps/web/android/local.properties` (ignored) points at the SDK.
- **Acceptance:** `VITE_API_ORIGIN=http://192.168.1.24:3000 pnpm --filter @warewolf/web android:apk` built `app-debug.apk` (11 MB). `aapt` shows package `com.warewolf.werewolf`, label Werewolf, target 36, `INTERNET`, and `usesCleartextTraffic` true in this debug build; the bundled config has `androidScheme: http`; the origin is compiled into the bundle; the assets match `dist/`. The API started with `CORS_ORIGINS=http://localhost` answered, over the LAN address with the WebView's Origin: health 200, the create-game preflight 204, and a real create; an unlisted origin got no CORS header. That test lobby was deleted afterwards.
- **Note:** `aapt` also lists `com.warewolf.werewolf.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION`. AndroidX core adds this app-private, signature-level permission; the user is never asked for it. It is left in because AndroidX uses it.
- **Tests:** API unit 53, including `cors.test.ts` 3. Web 318, including 6 Android project checks. `pnpm typecheck` passes.
- **Handoff to WW-1604 (Claude, needs a phone or an emulator):** run the API with `CORS_ORIGINS=http://localhost` on the LAN, build with that LAN origin, `adb install -r apps/web/android/app/build/outputs/apk/debug/app-debug.apk`, then create or join, kill the app, reopen, and confirm the seat returns (WW-1603).

### WW-1605 — Installable web app and Render APK

- **Agent:** Claude
- **Status:** BLOCKED (12 November 2026) on one deploy step by the owner: Render needs `CORS_ORIGINS=https://localhost` (in `render.yaml` here, or set in the dashboard) before the APK can create or join a game. Everything else is built and checked.
- **Description:** In a phone browser the game installs to the home screen and opens without browser chrome (iOS: Add to Home Screen; Android Chrome: Install app). A debug APK calls the deployed Render service over HTTPS and uses `art/ui/app_icon.png` as its launcher icon.
- **Files:** `apps/web/public/` (`manifest.webmanifest`, `icon-192.png`, `icon-512.png`, `apple-touch-icon.png`), `apps/web/index.html`, `apps/web/scripts/android-icons.sh`, `apps/web/android/app/src/main/res/` (launcher icons, `values/ic_launcher_background.xml`), `apps/web/test/pwa/web-manifest.test.ts`, `apps/web/test/android/android-project.test.ts`, `render.yaml` (`CORS_ORIGINS`, shared with HOST-01), `README.md`, `docs/werewolf/ui-ux-plan.md` section 11.
- **Checked:**
  - Chromium (Pixel 7 profile) parses the manifest with no errors. Its only installability error is `in-incognito`, which every Playwright context has.
  - Express static, the same server the API uses, sends `manifest.webmanifest` as `application/manifest+json`.
  - The APK is built from `HEAD` (10526ca, the commit `origin/main` and Render run) plus only these files, in a separate worktree, so the client matches the deployed API. `aapt` shows `com.warewolf.werewolf`, label Werewolf, INTERNET, and the adaptive icon. The bundle has the Render origin. The WebView is served from `https://localhost`.
  - On the emulator the launcher shows the wolf icon, and the app opens to the home screen.
  - Render's preflight from `Origin: https://localhost` currently answers 404 with no CORS header. That is the blocker above.
- **Tests:** `pnpm typecheck` passes. `pnpm test` passes in the worktree: domain 406, contracts 105, art 13, API 63, web 375, including `test/pwa/web-manifest.test.ts` (4) and 2 new launcher-icon checks. Two `table.test.tsx` cases timed out once when two suites ran in parallel, and pass when run alone.
- **APK:** `~/Desktop/Werewolf.apk`, a debug build signed with the debug key.
- **To finish:**
  - Once Render has the variable, confirm the preflight returns `access-control-allow-origin: https://localhost`.
  - Create a game from the APK.
  - Add to Home Screen on an iPhone and confirm there are no Safari bars.
- **Handoff to Cursor (visual, seen in the APK at 1080×2400 portrait):**
  - Below the home card the page shows a light band instead of the night scene.
  - The status bar area is light, against a dark app.
  - In the iOS standalone mode (black-translucent), the top of each screen sits under the status bar, padded by `env(safe-area-inset-top)` in `AppShell`. Check it on a notched iPhone.

### WW-1604 — Install smoke test

- **Agent:** Claude
- **Status:** COMPLETED (12 November 2026) on the Android emulator (Pixel 7 profile, Android 36, arm64). Not yet on a physical phone.
- **Setup:** API on the Mac at `192.168.1.24:3000` with `CORS_ORIGINS=http://localhost`; APK built with `VITE_API_ORIGIN=http://192.168.1.24:3000`; `adb install -r app-debug.apk`.
- **Checklist (passed):** The app opens to the home screen with its art. Rotating to landscape reflows the same layout without a restart (OD-71). Create Game with the name EmuHost reached the API over the LAN and opened lobby S5GVH3 as host, seat 1; the row is in the database. `am force-stop` killed the process; on reopening, the home screen showed the seat ("Return to the lobby") and returning opened the same lobby as host (WW-1603).
- **Emulator notes:** Android's "Try out your stylus" tour took the first text focus; `settings put secure stylus_handwriting_enabled 0` on the virtual device stops it. This is the emulator, not the app.
- **Handoff to Cursor (copy):** In the APK the home screen says "This tab already has a seat." An app has no tabs. Suggest wording that fits both, such as "You already have a seat in a game."

### WW-1402 — 10,000-game Infection report

- **Agent:** Claude
- **Status:** COMPLETED (12 November 2026)
- **Description:** 10,000 `infection-core` games under the accepted OD-02 rule (informed veto, unlimited saves), seed 1, for each of the three bot policies. The report is in `docs/werewolf/simulation/`.
- **Files:** `docs/werewolf/simulation/README.md`, `docs/werewolf/simulation/infection-core-{random-legal,infection-priority,vote-random}-seed1.json`, `packages/domain/bin/simulate.ts` and `packages/domain/package.json` (the script imported `../src/*.js`, which Node's type stripping cannot resolve; it now builds and imports `../dist`).
- **Acceptance (met):** The report names the seed, the policy, and the Doctor negation rate. Pack 62.7% and village 37.2% under `random-legal`; the Doctor negated 28.5% of wolf attacks because random bots skip half their saves, so the OD-02 "negates every kill" case is not measured by these bots. The README says so. Follow-up the same day: a `saving-doctor` policy (`packages/domain/src/simulate/policies.ts`, test in `test/simulate.test.ts`) negates 62.4% of attacks, and the pack still wins 58.5%, so the OD-02 informed veto does not tip Infection Edition to the village under bot play.
- **Tests:** Domain 388 pass.

### WW-1102 — Emit stored events and `afterSeq`

- **Agent:** Cursor
- **Status:** COMPLETED
- **Description:** After a night's event rows commit, each row is emitted to its room. `join-session` and `GET /games/:gameId/events` replay rows newer than `afterSeq` for that seat only.
- **Files:** `apps/api/src/events/event.service.ts`, `apps/api/src/events/event.controller.ts`, `apps/api/src/realtime/play.gateway.ts`, `apps/api/src/phase/phase.service.ts`, `apps/api/src/app.module.ts`, `packages/contracts/src/events.ts`, `apps/api/test/event-replay.integration.test.ts`, `apps/api/test/events.integration.test.ts`
- **Acceptance (met):** A connected Seeker receives one player `INVESTIGATION_RESULT`. A villager receives the public death and not the investigation. Disconnecting and rejoining with that seq does not deliver it again. A token from another game gets 404. `afterSeq=later` is 422.
- **Tests:** `pnpm --filter @warewolf/api exec vitest run --config vitest.integration.config.ts test/event-replay.integration.test.ts test/events.integration.test.ts test/socket.integration.test.ts` (4 passed).
- **Handoff to WW-1103:** Done. See the WW-1103 section.

### WW-1103 — Phase banners from the phase signal

- **Agent:** Cursor
- **Status:** COMPLETED
- **Description:** Every committed phase close writes one public `PHASE_CHANGED` row and emits it. The table refetches `GET /state` when that event arrives, so the host and a guest leave the night together. The two-second poll stays as the fallback.
- **Files:** `apps/api/src/events/event.service.ts` (`publishPhase`), `apps/api/src/phase/phase.service.ts`, `apps/api/test/phase-events.integration.test.ts`, `apps/web/src/realtime/play.ts`, `apps/web/src/game/state/realtime.ts`, `apps/web/src/game/state/phase.ts`, `apps/web/vite.config.ts` (dev socket proxy), `apps/web/package.json` (`socket.io-client`), `apps/web/test/state/realtime.test.tsx`.
- **Acceptance (met):** A Classic night close delivers the same `PHASE_CHANGED` to the host socket and a guest socket. The payload is `{ phase, roundNumber, stateVersion }` and names no role. Publishing that version again inserts nothing. The client sends `join-session` with the last seq and refetches the phase.
- **Tests:** `apps/api/test/phase-events.integration.test.ts`. `apps/web/test/state/realtime.test.tsx`.
- **Handoff:** Listen for `PHASE_CHANGED`. The body is `{ seq, type, audience, payload }`. `useGameState` already refetches on it. Private facts still arrive as their own event types. The discussion rail does not render them yet.

### WW-1205 — Playwright viewport coverage

- **Agent:** Cursor
- **Status:** COMPLETED
- **Description:** The seven UI-plan projects already run the layout assertions from WEB-05 and WW-1204.
- **Files:** `apps/web/e2e/layout.spec.ts`, `apps/web/e2e/table.spec.ts`
- **Acceptance (met):** Each project checks the shell regions, the primary button inside the viewport, and no horizontal page scroll. `phone-land-sm` also checks 568×320.

### WW-1304 — Structured logs

- **Agent:** Cursor
- **Status:** COMPLETED
- **Files:** `apps/api/src/http/log-line.ts`, `apps/api/src/phase/phase.service.ts`, `apps/api/test/log-line.test.ts`
- **Acceptance (met):** `logLine` writes only id fields. A role name and a display name passed in are absent from the line.

### WW-1501 and WW-1502 — Production stack

- **Agent:** Cursor
- **Status:** COMPLETED
- **Files:** `compose.prod.yaml`, `apps/api/Dockerfile`, `apps/web/Dockerfile`, `apps/web/nginx.conf`, `.dockerignore`
- **Acceptance:** `docker compose -f compose.prod.yaml up --build` starts Postgres, migrates, then serves the API. The API health check is `GET /api/v1/health`. The web container proxies `/api` and `/socket.io`. This session did not boot the images.

### WW-1301 — Token hashing, generic errors, rate limits

- **Agent:** Cursor
- **Status:** COMPLETED
- **Description:** Seat tokens stay SHA-256 hashed. Error bodies stay generic. Join attempts are limited per room and per address.
- **Files:** `apps/api/src/http/rate-limit.ts`, `apps/api/src/lobby/lobby.controller.ts`, `apps/api/src/http/api-error.ts`, `apps/api/src/http/error.filter.ts`, `packages/contracts/src/errors.ts` (`RATE_LIMITED`), `apps/api/test/security.integration.test.ts`, `apps/api/test/rate-limit.test.ts`.
- **Acceptance (met):** The stored token is the hash and a quoted display name is stored as text. A cross-game roster read is 404, a guest roster read is 403, a stale phase close is 409 `PHASE_CONFLICT`, and a Seeker self-target is 422 `ACTION_TARGET_ILLEGAL`. None of those bodies contain a catalog role id. The 41st join to one room in 10 seconds is 429 `RATE_LIMITED`.
- **Limits:** `JOIN_ROOM_LIMIT` 40 and `JOIN_IP_LIMIT` 1,000 per 10 seconds, on the controller instance. A refusal consumes neither budget. The address is `req.ip` or the socket address.

### WW-1302 — Boot recovery after night resolution

- **Agent:** Cursor
- **Status:** COMPLETED
- **Description:** Restarting after a night has resolved must not resolve that night again. A day deadline that passed while the process was down still advances.
- **Files:** `apps/api/src/phase/phase.service.ts` (`recover` republishes, then arms deadlines), `apps/api/test/recovery.integration.test.ts`.
- **Acceptance (met):** A Classic game closed through the night into `DAY_DISCUSSION` has one night `resolution_run`. After the app stops, `phase_ends_at` is set in the past, and a new app boots, the phase becomes `VOTING` and the night run count stays 1.
- **Handoff:** Host-paced phases still have no deadline and wait. Forcing the phase back to `NIGHT_SUBMIT` does not insert a second run; the existing unique key rejects it.

### WW-1403 — Deal tests for 10, 15, 20, 24, and 30 seats

- **Agent:** Cursor
- **Status:** COMPLETED
- **Description:** Each preset deals exactly the counts in its role list.
- **Files:** `apps/api/test/deal-counts.integration.test.ts`.
- **Acceptance (met):** `classic-10`, `chaos-15`, `infection-core`, `expanded-24`, and `expanded-30` start with `acknowledgeWarnings: true`, and `role_assignments.original_role_id` counts equal `pack.config.roles`.

### WW-1401 — Seeded simulator, 1,000 Infection games

- **Agent:** Cursor
- **Status:** COMPLETED
- **Description:** A pure seeded runner finishes Infection games. Bots see a seat projection, not the roster.
- **Files:** `packages/domain/src/simulate/{rng,view,policies,run}.ts`, `packages/domain/bin/simulate.ts`, `packages/domain/src/index.ts`, `packages/domain/test/simulate.test.ts`. Script: `pnpm --filter @warewolf/domain simulate -- --games 1000 --seed 1 --policy random-legal --out report.json`.
- **Acceptance (met):** 1,000 `infection-core` games, seed 1, policy `random-legal`, all finish. The report names the seed, the policy, and the sample size, and the test writes it as JSON. The note says these are bot measurements, not a human win rate.
- **Policies:** `random-legal` (uniform among legal sets, including skip and abstain), `infection-priority` (same night choices, votes do not abstain), `vote-random` (no night actions, random living vote).
- **Report:** `finish` (`VILLAGE`, `WOLF_PACK`, `draw`, `other`), `individuals`, `rounds.mean` and `median`, `deaths.nightMean` and `dayMean`, `infectionSuccesses`, `survivalByStartingRole`, `abilityUseRate`, `doctorNegatedFraction`.
- **Handoff to Claude (WW-1402):** Call `simulate({ presetId: 'infection-core', games: 10_000, seed, policyId })` once OD-02 picks the Doctor mode. Publish that JSON under docs. Do not treat the frequencies as a human win rate. The CLI stays outside `src/` so the domain package stays free of Node imports.

