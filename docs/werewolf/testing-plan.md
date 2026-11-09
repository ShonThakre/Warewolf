# Testing Plan

The domain package is tested without a database or a socket. The API is tested with PostgreSQL. The browser is tested on the flows a player and a host actually perform. A simulator plays many games with scripted policies and reports frequencies. Those frequencies are measurements of the bots, not a claim about human win rates.

Runner recommendation: Vitest for domain and API, Playwright for browser flows, a `simulate` command in the domain package for batch games.

---

## 1. Unit tests

Each test constructs plain objects and calls a pure function.

| Area | Cases |
|---|---|
| Registry | Every catalog id is unique. Unresolved roles have no abilities. Infected Wolf starting count is rejected by validation, not by a hidden branch |
| Assignment | Exact counts, no extras, originals preserved, CSPRNG seam is injectable, Infection Core deals 20 |
| Validation | The error codes in the configuration document, including 5+13+3 rejected, Priest rejected, dominant vote weight rejected |
| Capabilities | Investigate uses the start-of-night snapshot. Protect cancels only listed attack types. Heal cancels wolf kill. Poison respects `cancels` |
| Charges | Witch potions, Guard consecutive target, Doctor decline, infection success counter |
| Infection | Cap 4, cap 5, Alpha death seal, Guard does not block, same-night death, ineligible target |
| Conversion | Original role remains, abilities revoked, kill starts next round, Jester victory revoked if converted |
| Protection stack | Two guards, Bodyguard redirect, Immortal charge not consumed when a heal already worked |
| Tracking | Multiple visits, blocked actor produces no visit, action type hidden by default |
| Copy | Next night only, own charges, cannot copy Alpha infection or a Shapeshifter |
| Block | Disruptor cancels a Doctor save and an infection attempt |
| Voting | Weights, abstain, replace vote, dead voter, tie then revote, second tie |
| Elimination | Day reveal flag, Jester trigger, Immortal on a vote |
| Victory | Village wipe, parity equal, parity below, Lone Wolf sole survivor, Jester plus team win, draw at round cap |
| Privacy fixtures | Projection builders: a player fixture must not contain another role id |

Property-style tests worth adding once the resolver is stable:

- Shuffling a fixed multiset always yields the same counts.
- For any action set, resolving twice yields the same result hash.
- Village win and pack parity are never both true.

---

## 2. Integration tests

Use a real PostgreSQL database and the HTTP API. Socket tests subscribe with tokens.

| Flow | Assert |
|---|---|
| Create, join 20, start Infection Core | 20 assignments, each player `GET /me` sees only itself, host roster sees 20 |
| Full Infection night | Submissions, host confirm, Doctor veto, public body has no infection |
| Infection converts and the next night accepts a kill from the new wolf | Old Seeker action is rejected |
| Alpha dies | Later infect is 409 and the seal remains after reload |
| Two resolve requests | One success, one 409, one `resolution_run` |
| Restart | Commit a night, rebuild the app object, `GET /state` matches |
| Vote tie | Revote ballot 2 only includes tied ids |
| Custom invalid start | 422 and the game stays in lobby |
| Private sockets | The Seeker client receives `INVESTIGATION_RESULT`. A villager client does not. The public room does not |
| Idempotency | Same key replays. Different body conflicts |
| Cancel | Results do not include roles |

Database failure: abort the transaction with a thrown error inside a test seam and assert the phase is unchanged.

---

## 3. End-to-end tests

Playwright, several browser contexts, one context per seat. These are fewer and slower than the API tests. They cover the interface, not every role matrix.

### Viewport projects

Layout mode follows width, height, and aspect ratio, as specified in the UI plan. These projects are the acceptance bar for Phase 12. Flow scripts run in `desktop-fhd` and `phone-land`. The other projects run the layout assertions.

| Project | Viewport | Role |
|---|---|---|
| `desktop-fhd` | 1920×1080 | Full three-area gameplay layout |
| `desktop-wide` | 1440×900 | Compact three-area layout |
| `tablet-land` | 1024×768 | Same areas on a short tablet |
| `phone-land-lg` | 915×412 | Landscape phone, combined top bar |
| `phone-land` | 844×390 | Landscape phone, action row on screen |
| `phone-land-sm` | 667×375 | Narrow short landscape. Includes a 568×320 collapsed-rail check |
| `phone-portrait` | 390×844 | Stacked reflow. Scene, Players/Log switch, and action row visible |

### Flow scripts

| Script | Players | Path |
|---|---:|---|
| Classic short | 10 | Lobby, reveal, one night, one vote, state still consistent |
| Infection start | 20 | Full lobby and private reveal. Night actions for Alpha, both Seekers, Guard, Doctor, Witch. Villagers see a wait state |
| Infection village win | 20 | Scripted votes remove wolves after a scripted Alpha death |
| Infection wolf win | 20 | Scripted conversions and votes reach parity |
| Expanded individual | 15 or 20 | Jester is voted out, game continues, Jester is listed as an individual winner at the end |
| Tie vote | 10 | Revote UI |
| Host reload | 10 | Dashboard shows the same roster after refresh |
| Player reload | 10 | Private role returns |
| Cancel | 10 | Results hide roles |
| Shared layout | 10 | Lobby, reveal, night action, day, vote, and host dashboard. Landscape and desktop expose scene, players, rail, and the action row together. Portrait keeps the action row pinned |
| Narrow landscape | 10 | At 667×375 and 568×320 the page does not scroll sideways, the submit control is visible, and the rail collapses only under 600px width |

Automated 24- and 30-player browser suites are expensive. Cover those counts in the API and simulator. Keep one 20-player browser smoke test on `phone-land` and one on `desktop-fhd`.

### Android APK smoke

After Phase 16 produces a debug APK:

| Check | Expected |
|---|---|
| Install `app-debug.apk` on an emulator or device | App opens to create or join |
| Create or join against the configured API origin | Lobby seats appear |
| Kill the process and reopen | Bearer token restores from Capacitor Preferences. `GET /me` still loads |
| Rotate to landscape and portrait | The same game is usable in both. Landscape keeps scene, players, and the action row. Portrait keeps the action row pinned. The activity does not lock orientation |
| Night action or vote | The primary button clears the system bars |

This smoke check is manual or scripted with Appium later. It is not a substitute for the Playwright viewport projects.

---

## 4. Security tests

| Case | Expected |
|---|---|
| Player token on host roster | 403 |
| Cross-game token | 404 |
| Forged socket join to another player room | Rejected |
| Client emits `INFECTION_OCCURRED` | Ignored |
| Error payload scan | Fixtures of 422 and 409 bodies do not contain role ids of other players |
| Vote for a third party | 409 |
| Action after phase close | 409 |
| SQL injection in display name | Stored as text, no error, name rules reject quotes if the character rule says so |
| Rate limit | Burst of joins receives 429 |

Threat notes that tests cannot fully close:

- Two browsers can join as two guests. That is OD-63, a product limit of guest tokens.
- A player can photograph their screen. The UI can only avoid showing other people's secrets.
- The host is trusted with full information by design. Host abuse is cancellation and social, not a secret the server can hide from the host.

---

## 5. Simulation

Location: `packages/domain` command `simulate`.

Inputs: preset id, game count, seed, policy id.

Policies are intentionally simple and named in the report:

| Policy | Behavior |
|---|---|
| `random-legal` | Chooses uniformly among legal actions and votes |
| `infection-priority` | Alpha prefers power roles from a public heuristic that is not allowed to read hidden roles except its own. If the policy cannot know powers, it chooses randomly. Do not give bots the roster |
| `vote-random` | Random living target |

Bots must use the same legal-action generator as the server. A bot that reads the snapshot's full roster invalidates the run. The harness should pass each bot only the projection that seat would have.

Measures:

- Finish counts by village, wolf pack, individual role, draw, cancel.
- Mean and median rounds.
- Mean night deaths and day deaths.
- Infection success count distribution.
- Survival rate by starting role.
- Ability use rate.
- Fraction of wolf kills negated by the Doctor.

Output is a JSON report plus a short text summary. The UI may quote a report only by file name, seed, policy, and game count.

Initial target after the Infection resolver exists: 10,000 games of `infection-core` with `random-legal` and the approved Doctor mode. The report informs whether informed veto stalls the game. It does not by itself change the confirmed Doctor bullets.

Compare presets only when the policy and seed are recorded. Do not describe a result as the true human win rate.

---

## 6. Traceability

| Rule | Tests |
|---|---|
| C-02 through C-06 infection setup and conversion | Unit assignment, unit infection, API 20-player start |
| C-07 anonymity | Projection unit test and socket test |
| C-08 friendly fire | Unit target rule allows a wolf |
| C-10 parity | Unit victory, including equality |
| C-12 Guard | Unit protection matrix |
| C-13 Doctor profiles stay separate | Validation unit test |
| OD-01 both aggregators | Unit tests for host select and majority, even if one is the preset |
| OD-03 same-night death | Unit infection |

Every BLOCKING decision keeps a test for each option behind the strategy id, so changing the preset does not require a rewrite.
