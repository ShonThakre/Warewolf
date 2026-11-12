# End-to-end test report

12 November 2026. Every mode and role pack was played from create to results against the real API and database, and the main player and host journeys were run in a real browser. This page records how to run the suites, what passed, what broke, what was fixed, and what is left.

## How to run

| Suite | Command | Needs |
|---|---|---|
| Every pack through the API, on a throwaway database | `pnpm test:integration` (includes `apps/api/test/modes.integration.test.ts`) | PostgreSQL (`pnpm db:up`) |
| Same suite against a running server | `pnpm e2e:api` (defaults to `http://localhost:3000`; set `E2E_API_URL` for another, such as Render) | `pnpm dev:api` running |
| Browser flows against the real API | `pnpm --filter @warewolf/web e2e:live` (add `PW_CHANNEL=chrome` to use the installed Chrome) | `pnpm dev:api` running. Vite starts by itself |
| Driver unit tests | `pnpm --filter @warewolf/e2e-tools test` | nothing |

All three use the black-box driver in `tools/e2e` (`@warewolf/e2e-tools`). It plays through the public HTTP API only: seats, roles, and abilities come from `/me`, `/me/actions`, and the host roster, never from SQL.

After every phase it checks these invariants:
- The phase step is legal.
- `/state` carries no role.
- `/results` stays closed while the game runs.
- `/me` names no other seat.
- No player receives a host event or someone else's private event.
- No request returns 5xx.

## Results

### Every pack, through the API (35 scenarios, all pass)

Run against the live dev server with `pnpm e2e:api`, and on a throwaway database inside `pnpm test:integration` (297 tests, all pass).

| Pack | Scenario | Winner | Rounds | Notes |
|---|---|---|---:|---|
| infection-core | Village win | Village | 1 | Host confirm and Doctor reaction windows both open |
| infection-core | Wolf win | Wolf | 5 | 4 infections |
| infection-core | Host picks the kill, informed Doctor sees it and saves | (stopped) | 1 | Victim alive at dawn |
| infection-core | Tie, then tied revote | (stopped) | 1 | Nobody eliminated; revote limited to the tied pair |
| infection-core | Seeker publishes a result | (stopped) | 1 | Public `RESULT_PUBLISHED`; a Seeker with nothing to publish gets 422. **Fixed in this pass (G1)** |
| infection-core | Host cancels mid-game | Cancelled | – | Results list seats with no role |
| classic-10 | Village win | Village | 2 | |
| classic-10 | Wolf win | Wolf | 3 | |
| classic-10 | Tie, then tied revote | (stopped) | 1 | |
| classic-10 | Timed night closes by itself | (stopped) | 1 | 1-second night timer |
| expanded-infection-20 | Jester voted out, then Village win | Village | 2 | Game continued; Jester listed as an individual winner |
| expanded-infection-20 | Random legal play (seed 11) | Wolf | 8 | 4 infections; Assassin individual win |
| investigation-15 | Each information result reaches only its owner, live and on reload | Village | 3 | Socket events match stored events for every seat |
| protection-15 | Guard-protected target survives, then Village win | Village | 3 | |
| protection-15 | Wolf win | Wolf | 5 | |
| chaos-15 | Village win | Village | 3 | Surviving Shapeshifter wins individually (OD-73); Lone Wolf voted out |
| chaos-15 | Random legal play (seed 3) | Village | 4 | Assassin individual win |
| expanded-24 | Random legal play (seeds 1–3), Village win | Wolf ×3, Village | 14–17, 5 | |
| expanded-30 | Random legal play (seeds 1–3), Village win | Wolf ×2, Draw, Village | 13–19, 8 | Seed 3 ends in a draw with Lone Wolf and Assassin individual wins |
| ultimate-20 | Village win | Village | 2 | Mind Controller and Fox individual wins |
| ultimate-20 | Wolf win | Wolf | 8 | |
| ultimate-20 | Random legal play (seeds 1–3) | Village ×2, Wolf | 7–15 | Up to 4 infections; Chaos Demon individual win once |
| ultimate-20 | Vampire marks on night 1; promotion at dawn after night 2 | (stopped) | 2 | Servant told (`ROLE_CONVERTED`), Vampire told (`VAMPIRE_TEAM_JOIN`) |
| ultimate-20 | Ghost voted out, leaves a hint | (stopped) | 2 | Public `GHOST_HINT`. **Fixed in this pass (G4)** |
| ultimate-20 | Alchemist silences a seat | (stopped) | 1 | Silenced seat gets 403 `CHAT_MUTED`, `canPost: false`, and a private `SILENCED`. **Fixed in this pass (G4)** |
| custom | Setup with no wolves | – | – | Start refused with 422 `NO_WOLVES`. **Fixed in this pass (BUG-01)** |
| custom | Custom setup with a Sniper, random legal play | Wolf | 4 | |

"Random legal" games choose random legal targets and votes from a fixed seed. Their refused submissions (one to seven per game) are expected 4xx answers, such as a Seeker trying to publish with no result.

### Browser flows against the real API (5 flows × 2 viewports)

| Flow | desktop-fhd 1920×1080 | phone-land 844×390 |
|---|---|---|
| Classic: Home → Create → Setup (switch to Classic) → Start → Reveal → Seeker investigates from the screen → Morning result only on the Seeker's screen → chat → vote from the screen → Village wins on Results | Pass | **Fails: BUG-03** (marked expected-fail) |
| Infection: 20 seats; host picks the kill on the Host dashboard; informed Doctor sees the target and saves; morning says no one was eliminated | Pass | Pass |
| Tie vote: revote ballot lists only the two tied players; second tie eliminates nobody | Pass | Pass |
| Reload: a player's own role returns after reload; host dashboard roster survives reload | Pass | Pass |
| How to Play: reached from Home, all five modes, no sideways scroll | Pass | Pass |

## Defects

### Fixed in this pass

| Id | What was wrong | Fix |
|---|---|---|
| G1 | A Seeker's "publish my result" was accepted in day discussion but never resolved or shown, although `game-rules.md` requires it. Affects Infection, Classic, and most Expanded packs | When discussion closes, the latest unpublished result becomes a public `RESULT_PUBLISHED` event, and the table feed reads it out. The `published_round` column is migration 0014. A Seeker with nothing to publish is refused at submit |
| G4 | Ultimate 20 effects never reached anyone: the Ghost hint, the Necromancer's return, and the Alchemist's silence. Rewind, copy, and Chaos outcomes sent no event | New events: public `GHOST_HINT` and `PLAYER_RETURNED`; private `SILENCED`, `REWIND_RESULT`, `ABILITY_COPIED`, and `CHAOS_EVENT`. Each also has a host copy. Chat refuses a silenced seat for that day. The defaults are recorded in `ultimate-20-rules.md` |
| BUG-01 | A Custom setup with no wolf-aligned seat passed validation (only a warning) and could start | New validation error `NO_WOLVES` |
| BUG-02 | `pnpm test:integration` was already red on `main`: `events.integration.test.ts` expected every public event to be a death, which `PHASE_CHANGED` broke. Unit tests (`pnpm test`) do not run it, so nobody saw it | Assertion now excludes the phase signal |
| META | `apps/api/drizzle/meta/0013_snapshot.json` was a copy of 0012 (same id and parent, no 0013 columns), so `db:generate` refused to run | 0013 given its own id; 0014's snapshot is the full current schema |

### Open

| Id | Severity | What happens | Owner |
|---|---|---|---|
| BUG-03 | High: blocks voting on phone landscape | At 844×390, the voting grid gets about one row of height between the status bar and the action bar. Seat buttons cannot be brought into view, or sit under the app header, so a ballot cannot be cast by tapping a seat. "End the day" is cut off at the bottom. Reproduced before and after UX-11. The mocked `table.spec.ts` misses it because its fixture has fewer seats. Repro: `PW_CHANNEL=chrome pnpm --filter @warewolf/web e2e:live --project=phone-land classic` | Cursor |
| UX-R1 | Medium | Results banner: the stat row (Rounds, Infections, Eliminations) and the subtitle are nearly unreadable over the bright scene, and the ribbon above "Village wins" is empty | Cursor (UX-14) |
| GAP-02 | Medium | No in-game Cancel game or Make host control. The API already allows both during a game (`POST /host/cancel`, `POST /host/transfer`), and `useCancelGameMutation` exists. Leaving a started game is refused by the API (`GAME_STARTED`) by design; what leaving mid-game should mean needs a product decision | Cursor (buttons); product owner (leave rule) |
| GAP-04 | Low | "Play again" on Results keeps the old seat in the tab. The Table's own Play again and cancelled stage cannot be reached | Claude |
| GAP-05 | Low | The Lobby still says "Chat is not open in this version." | Cursor |
| GAP-06 | Low | No connection or reconnect indicator on the table (the Lobby has one) | Claude (hook), Cursor (visual) |
| GAP-07 | Low | No dedicated test for the Servant's `WITH_VAMPIRE` win. Simulation reports cover `infection-core` only | Claude |
| UX-12–14 | – | Mockups 10–12 (revote, host overview, game results) not yet matched | Cursor |

Two observations that are not defects but worth a product look:

- The Doctor gets no private "you saved them" note in the morning; the morning only says no one was eliminated.
- A Necromancer's returned player stays dead in the engine, so they cannot post in the discussion either.

## Plan to finish, in order

1. **BUG-03** (Cursor): phone-landscape ballot. The live Classic flow turns green when it is fixed, and its expected-fail marker must then be removed.
2. **GAP-02** (Cursor buttons, product decision on leaving): Cancel game and Make host on the Host dashboard. Then turn on the `cancel` browser flow.
3. **UX-R1 and UX-12 to UX-14** (Cursor): results banner contrast, and mockups 10–12.
4. **GAP-04, GAP-06, GAP-07** (Claude): Play again clears the seat, the table connection hook, and Servant-win and simulator coverage.
5. **GAP-05** (Cursor): stale lobby copy.
6. Re-run all three suites. Done means `pnpm test`, `pnpm test:integration`, `pnpm e2e:api`, and `e2e:live` on both viewports all pass with no expected-fail markers.
