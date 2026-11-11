# Implementation Checklist

Status values: `Done`, `Not started`, `Blocked`.

Phases 0 to 4 are done, including the lobby screens (WW-304) and the reveal screen (WW-404). Phase 5, the phase machine (WW-501 to WW-503), is done in the API and the client data layer; its screens are WEB-06 on the task board. Phase 6 engineering (WW-601 to WW-603) is done in the domain and the API. The action panel (WW-604) is done on the table. Complexity is S, M, L, or XL. Priority P0 is required for a playable Infection Edition. P1 is required for the expanded catalog. P2 is later hardening or optional modes.

Dependencies refer to task ids or to decision ids in [open-decisions.md](./open-decisions.md).

---

## Phase 0 — Repository audit

| ID | Description | Priority | Depends on | Complexity | Acceptance | Status |
|---|---|---|---|---|---|---|
| WW-000 | Record that the local and GitHub repositories are empty and that no reference images were available | P0 | — | S | The implementation plan cites real paths and the empty remote | Done |

---

## Phase 1 — Architecture skeleton

| ID | Description | Priority | Depends on | Complexity | Acceptance | Status |
|---|---|---|---|---|---|---|
| WW-101 | Accept or replace the TypeScript modular-monolith recommendation (OD-60) | P0 | WW-000 | S | A written decision names the stack | Done |
| WW-102 | Create pnpm workspace with `apps/web`, `apps/api`, `packages/domain`, `packages/contracts` | P0 | WW-101 | M | `pnpm test` runs an empty suite in each package | Done |
| WW-103 | Add PostgreSQL via Docker Compose and a Drizzle migration pipeline | P0 | WW-102 | M | A migration creates `games` and rolls back | Done |
| WW-104 | Add the pure `GameSnapshot` types and faction enums in the domain package | P0 | WW-102 | M | Types compile and do not import Nest or Drizzle | Done |
| WW-105 | Add health and version endpoints | P2 | WW-102 | S | `GET /health` returns 200 | Done |

---

## Phase 2 — Catalog, packs, validation

| ID | Description | Priority | Depends on | Complexity | Acceptance | Status |
|---|---|---|---|---|---|---|
| WW-201 | Encode all 37 catalog definitions with status flags | P0 | WW-104 | L | Registry tests pass, including unresolved roles having no abilities | Done |
| WW-202 | Encode ability profiles for Doctor, Assassin, and Blacksmith without merging variants | P0 | WW-201 | M | Two Doctor profiles cannot be combined | Done |
| WW-203 | Implement `validateConfiguration` error and warning codes | P0 | WW-201 | L | Pack 1 passes. A 21-seat pack fails. Priest fails | Done |
| WW-204 | Encode Infection Core, Classic 10, Pack 2A, investigation, protection, chaos, and the 24- and 30-player suggestions | P1 | WW-203 | M | Each shippable pack sums to its player count | Done. `chaos-15` is a recommended pack after OD-73-impl |
| WW-205 | Require acknowledgements for blocking decisions before start | P0 | WW-203, OD-01, OD-02, OD-03 | M | Start is rejected when an acknowledgement is missing | Done |

---

## Phase 3 — Lobby

| ID | Description | Priority | Depends on | Complexity | Acceptance | Status |
|---|---|---|---|---|---|---|
| WW-301 | Migration for games, players, tokens, drafts | P0 | WW-103 | M | Unique room code and unique display name enforced | Done |
| WW-302 | Create, join, leave, kick, transfer, cancel | P0 | WW-301 | M | API tests cover full, started, and name clash | Done |
| WW-303 | Save and validate configuration drafts | P0 | WW-203, WW-302 | M | Invalid drafts save, and start stays closed | Done |
| WW-304 | Lobby screens: create, join, seats, pack summary | P0 | WW-302 | M | Browser test joins two clients | Done. Home and lobby screens. Start stays closed until WW-402 |
| WW-305 | Avatar choice: 36 avatars, unique per game, picked or assigned in the lobby | P1 | WW-302 | S | Concurrent joins get different avatars. A taken avatar is rejected | Done |

---

## Phase 4 — Assignment and secrets

| ID | Description | Priority | Depends on | Complexity | Acceptance | Status |
|---|---|---|---|---|---|---|
| WW-401 | Migration for assignments and ability instances | P0 | WW-301 | M | Original role column has no update path in the repository layer | Done. Migration `0003_assignments`, plus a trigger that rejects changes to the original columns |
| WW-402 | Fisher-Yates deal inside the start transaction | P0 | WW-401, WW-205 | M | 20-player test has exact counts | Done. `POST /games/:gameId/start` |
| WW-403 | Player and host projections | P0 | WW-402 | M | Non-host JSON does not contain other role ids | Done. `GET /me` and `GET /host/roster` |
| WW-404 | Reveal screen and private drawer | P1 | WW-403, WW-304 | M | A second browser does not see the first role | Done. Lobby Start and the private reveal (WW-404b) |

---

## Phase 5 — Phase machine

| ID | Description | Priority | Depends on | Complexity | Acceptance | Status |
|---|---|---|---|---|---|---|
| WW-501 | Persist phase, round, version, and phase deadlines | P0 | WW-301 | M | Illegal transitions return 409 | Done. Migration `0004_phase_machine` adds status, round, and deadline checks. `POST /host/phase/close` takes the `stateVersion`; stale, racing, and end-state closes are 409 |
| WW-502 | Host-paced close and timed auto-advance | P0 | WW-501 | M | A passed deadline advances a Classic game after restart | Done. `PhaseService` timer and boot recovery. Night, day, and vote timers only; other phases wait for the host |
| WW-503 | Conditional host-confirm and Doctor-reaction windows | P0 | WW-502, OD-01, OD-02 | M | Classic profile skips both windows | Done. Windows fixed by the configuration, not by who is alive (OD-74) |

---

## Phase 6 — Ability execution

| ID | Description | Priority | Depends on | Complexity | Acceptance | Status |
|---|---|---|---|---|---|---|
| WW-601 | Action table, idempotency, and submit endpoint | P0 | WW-501, WW-401 | M | Duplicate key replays. Locked window conflicts | Done. `POST /actions`, `GET /me/actions`, migration `0005_night_actions`. Closing a window locks its actions |
| WW-602 | Capability handler registry and target rules | P0 | WW-201 | L | Adding a test capability does not require a role id switch | Done. `DEFAULT_CAPABILITY_REGISTRY` and `checkTargets` in `packages/domain/src/action/` |
| WW-603 | Charge, cooldown, and consecutive-target checks | P0 | WW-602 | M | Guard cannot repeat a target. Witch potions stop at one | Done. `availability` and `consumeUse`. The resolver (WW-802) calls `consumeUse` |
| WW-604 | Generic action panel bound to ability prompts | P1 | WW-601, WW-404 | M | Seeker and Guard both render from fixtures without custom pages | Done. One panel on `/game/:id`. Seeker, Guard, and Witch render from fixtures |

---

## Phase 7 — Infection Edition rules

| ID | Description | Priority | Depends on | Complexity | Acceptance | Status |
|---|---|---|---|---|---|---|
| WW-701 | Implement infect, wolf kill submit, seeker, guard, doctor profiles, witch, villager | P0 | WW-602, OD-01, OD-02, OD-03 | L | Unit matrix in the testing plan passes for confirmed rules | Done. `resolveNight` in `packages/domain/src/night/resolve.ts` with the Infection and Classic steps. Not yet called by the phase service (WW-802) |
| WW-702 | Anonymity projections for wolves | P0 | WW-403, WW-701 | M | A wolf fixture has no teammate list and no allied targets | Done. `apps/api/test/anonymity.integration.test.ts`: Alpha and an Infected Wolf see no teammates, the same target rule, and only their own submissions |
| WW-703 | Infection Core preset wired to create-game default | P0 | WW-204, WW-701 | S | New games start as Infection Edition at 20 players | Done. Already the create default; the lobby test now asserts mode, pack, and 20 players |

---

## Phase 8 — Night resolver

| ID | Description | Priority | Depends on | Complexity | Acceptance | Status |
|---|---|---|---|---|---|---|
| WW-801 | Pure `resolveNight` in the documented step order | P0 | WW-701 | XL | Golden fixtures for the same-night examples | Done. Steps 1 to 18, every information kind, delayed poison, and persistent effects. `packages/domain/test/night-golden.test.ts` compares the whole result for each section 8 example; `night-expanded.test.ts` covers each new step |
| WW-802 | Transaction, game lock, resolution_run, event rows | P0 | WW-801, WW-501 | L | Double resolve is one commit | Done. Event rows are written after this commit by WW-804. `apps/api/test/night.integration.test.ts`: racing closes, a forced second resolve, the unique run key, and a failed write that rolls back and then retries |
| WW-803 | Host kill confirmation constrained to submissions | P0 | WW-802, WW-503 | M | A target nobody submitted is rejected | Not started |
| WW-804 | Private result events after commit | P0 | WW-802 | M | Investigation and infection events have the audiences in the API design | Done. `game_events` is written after the night commit from the stored rows, with separate player and host payloads. `apps/api/test/events.integration.test.ts` |

---

## Phase 9 — Voting and victory

| ID | Description | Priority | Depends on | Complexity | Acceptance | Status |
|---|---|---|---|---|---|---|
| WW-901 | Ballots, weights, abstain, replace, close, revote | P0 | WW-501 | L | Tie fixture matches OD-40 | Done. A tie opens one revote. A second tie eliminates nobody. `POST /games/:gameId/votes` |
| WW-902 | Victory evaluator with team and individual records | P0 | WW-801 | L | Parity equality is a wolf win. Jester does not end the game by default | Done. Night and day closes write `victory_records`. A night that ends the game does not open the day |
| WW-903 | Public tally and results screen | P1 | WW-901, WW-902 | M | Finished game shows original and final roles. Cancelled game does not | Not started |

---

## Phase 10 — Expanded roles

Grouped so a role ships with its handler tests. Unresolved roles stay unseatable.

| ID | Description | Priority | Depends on | Complexity | Acceptance | Status |
|---|---|---|---|---|---|---|
| WW-1001 | Detective, Oracle, Tracker, Psychic, Medium, Prophet, Seer | P1 | WW-801, OD-21–OD-27 | L | Each result fixture matches the catalog profile | Partly done. Every result kind resolves (WW-801, `night-expanded.test.ts`) and the private result rows are stored (WW-804). Left: emitting them (WW-1102) and prompts |
| WW-1002 | Bodyguard, Shieldbearer, Trapper, Blacksmith item, Immortal | P1 | WW-801 | L | Protection matrix in night-resolution.md | Partly done. Night side resolves (WW-801). Left: Immortal on day elimination (WW-901) |
| WW-1003 | Sniper, Poisoner, Disruptor | P1 | WW-801 | M | Poison is not stopped by Guard in the default toggle | Partly done. Disruptor and the Poisoner's scheduling resolve (WW-801). Left: the Sniper and a day-due poison, both in the day resolution |
| WW-1004 | Jester, Assassin mark, Cursed, Lone Wolf, Avenger | P1 | WW-902 | L | Individual wins record without always ending the game | Not started |
| WW-1005 | Shapeshifter, Spy, Elder, Mayor, Healer Assistant | P1 | WW-801, WW-901 | L | Copy cannot chain. Assistant is idle while Doctor lives | Partly done. Shapeshifter, Spy, and the Assistant's night inheritance resolve (WW-801). Left: Elder and Mayor weights, and inheritance after a day vote (WW-901) |
| WW-1006 | Keep Hermit, Confuser, Priest, Bard, and Assassin execute unseatable | P0 | WW-203 | S | Validation error names the decision id | Done |
| WW-1007 | Pack Wolf and Classic knowledge flag | P1 | WW-701, OD-35 | M | Classic reveal includes pack mates. Infection reveal does not | Not started |
| WW-1008 | Ultimate 20 mode, pack, roles, and pure day and victory functions | P1 | WW-802 | L | A 20-seat Ultimate room deals the locked roster. Domain tests cover the new night steps, `tallyDay`, and `evaluateVictory` | Done as an engine. Left: persist rewinds, chaos, revivals, silences, and hints; call `drawChaos`; pass revival and chaos success into the victory call that phase close already makes |

---

## Phase 11 — Realtime

| ID | Description | Priority | Depends on | Complexity | Acceptance | Status |
|---|---|---|---|---|---|---|
| WW-1101 | Socket authentication and rooms | P0 | WW-403 | M | Foreign token cannot join a player room | Done. Handshake token, `join-session` enters only that seat's rooms, a foreign token joins nothing. `apps/api/test/socket.integration.test.ts` |
| WW-1102 | Emit stored events after commit and support `afterSeq` | P0 | WW-804, WW-1101 | M | Kill the socket, reconnect, and the private result arrives once | Not started |
| WW-1103 | Phase banners update from events | P1 | WW-1102, WW-604 | M | Two browsers move from night to day together | Not started |
| WW-1104 | Chat message contract, storage, send endpoint, and socket fan-out with host moderation | P1 | WW-1102, OD-72 chat rules | L | A message reaches only the audience the chat rules allow. Rate limit and length checks return 422 or 429. A muted seat cannot post | Not started. Chat rules accepted 11 November 2026 |

---

## Phase 12 — Host and configuration UI

| ID | Description | Priority | Depends on | Complexity | Acceptance | Status |
|---|---|---|---|---|---|---|
| WW-1201 | Configuration browser, counts, warnings, locked Infection Core. Step rail on landscape and desktop. One step and a count strip in portrait | P0 | WW-304, WW-303 | L | Invalid start control stays disabled. The summary counts stay visible at 1024×768 and at 390×844 | Done. Host setup at `/lobby/:gameId/setup` |
| WW-1202 | Host dashboard sections listed in the UI plan, using `ResponsiveSidebar` | P0 | WW-1103, WW-803 | L | Host sees submissions. A player route does not. Sections remain reachable at 844×390 and at 390×844 | Not started |
| WW-1203 | Results recap on `GameLayout` | P1 | WW-903 | M | Recap matches API results. Cancelled games hide roles. The stat row fits 1920×1080 and 390×844 | Not started |
| WW-1204 | `GameLayout` for lobby, reveal, night, day, and vote, including the portrait reflow and safe areas | P0 | WW-1201, WW-604 | L | Desktop and landscape show the same regions. Primary buttons clear system bars. No horizontal page scroll at the seven UI-plan viewports | Done. Fixture shell covers lobby, reveal, night, night results, day, voting, and results at the seven viewports. The live reveal stays a private scene |
| WW-1206 | Live composer in the discussion rail, including the host moderation controls | P1 | WW-1104, WW-1204 | M | The composer is enabled only when the chat rules allow it. It stays reachable at the seven viewports | Not started. Chat rules accepted 11 November 2026 |
| WW-1205 | Playwright coverage for the seven viewports in the UI plan | P0 | WW-1204 | M | `desktop-fhd`, `desktop-wide`, `tablet-land`, `phone-land-lg`, `phone-land`, `phone-land-sm`, and `phone-portrait` pass the layout assertions | Not started |

---

## Phase 13 — Security and recovery

| ID | Description | Priority | Depends on | Complexity | Acceptance | Status |
|---|---|---|---|---|---|---|
| WW-1301 | Token hashing, generic errors, rate limits | P0 | WW-302, WW-601 | M | Security tests in the testing plan | Done. Hashed tokens, generic 404/403/409/422 bodies, and 429 on a join burst. `apps/api/test/security.integration.test.ts` |
| WW-1302 | Boot recovery for timed and host-paced games | P0 | WW-502, WW-802 | M | Restart test | Done. After a resolved Classic night, a restart with a passed day deadline advances and leaves that night's `resolution_run` at one. `apps/api/test/recovery.integration.test.ts` |
| WW-1303 | Audit review of every host route | P0 | WW-1202 | M | No route writes a role or a winner directly | Not started |
| WW-1304 | Structured logs with ids only | P2 | WW-1301 | S | A test logger assertion excludes role names | Not started |

---

## Phase 14 — Simulation and balance

| ID | Description | Priority | Depends on | Complexity | Acceptance | Status |
|---|---|---|---|---|---|---|
| WW-1401 | Seeded simulator using player projections only | P1 | WW-902 | L | 1,000 Infection games finish and write JSON | Done. `simulate` in `packages/domain`. Bots see `SeatProjection` only. 1,000 Infection games, seed 1, policy `random-legal`, write JSON. Frequencies are bot measurements |
| WW-1402 | Run 10,000 Infection games on the approved Doctor mode and publish the report under docs | P1 | WW-1401, OD-02 | M | The report names seed, policy, and Doctor negates | Not started |
| WW-1403 | API integration suite for 10, 15, 20, 24, and 30 seat deals | P1 | WW-402 | M | Counts match the presets | Done. `classic-10`, `chaos-15`, `infection-core`, `expanded-24`, and `expanded-30` deal the preset counts. `apps/api/test/deal-counts.integration.test.ts` |

---

## Phase 15 — Deployment

| ID | Description | Priority | Depends on | Complexity | Acceptance | Status |
|---|---|---|---|---|---|---|
| WW-1501 | Production Compose file for web, api, and PostgreSQL | P1 | WW-1302 | M | A clean machine boots and passes health checks | Not started |
| WW-1502 | Migrations on startup or a documented release step | P1 | WW-1501 | S | An empty volume reaches the current schema | Not started |
| WW-1503 | Request ids and a minimal uptime check | P2 | WW-1501 | S | Logs include request id and game id | Not started |

---

## Phase 16 — Android APK

| ID | Description | Priority | Depends on | Complexity | Acceptance | Status |
|---|---|---|---|---|---|---|
| WW-1601 | Add Capacitor to `apps/web` and sync the Vite build into `apps/web/android` | P1 | WW-1204 | M | `cap sync` copies the responsive client into the Android project. Orientation stays unlocked | Not started |
| WW-1602 | Produce a sideload `app-debug.apk` with INTERNET permission and a build-time API origin | P1 | WW-1601, WW-1501 | M | Gradle assembleDebug installs and reaches the API. Keystore stays out of git | Not started |
| WW-1603 | Store the bearer token with Capacitor Preferences in the APK and sessionStorage on web | P1 | WW-1601 | S | Token survives APK process kill. `/me` remains the source of truth | Not started |
| WW-1604 | Install smoke test: open APK, create or join, restore session after restart | P1 | WW-1602, WW-1603 | M | Smoke checklist passes on a physical or emulated device | Not started |

---

## Suggested build order

P0 path: WW-101 → WW-102 → WW-103 → WW-104 → WW-201 → WW-203 → WW-301 → WW-302 → WW-401 → WW-402 → WW-501 → WW-601 → WW-701 → WW-801 → WW-802 → WW-901 → WW-902 → WW-1101.

WW-304, WW-404, WW-604, WW-1201, and WW-1204 can proceed beside the resolver once the projections exist. WW-1205 waits on WW-1204.

WW-1001 through WW-1005 can proceed in parallel after WW-801, split by role family.

WW-1601 through WW-1604 wait on WW-1204 and a reachable API from Phase 15 or a LAN debug server.
