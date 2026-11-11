# Role Configuration

Presets are data. They select the same engine, the same catalog, and a validated configuration snapshot. They are not separate game programs.

The snapshot is frozen at start. Lobby edits after start are rejected.

Cross-references: [role-catalog.md](./role-catalog.md), [open-decisions.md](./open-decisions.md), [game-rules.md](./game-rules.md).

---

## 1. Configuration object

Conceptual groups stored as one versioned document plus indexed columns for status and mode.

### Game

| Field | Purpose |
|---|---|
| `mode` | `INFECTION`, `CLASSIC`, `EXPANDED`, `CUSTOM` |
| `playerCount` | Exact seats required before start |
| `minPlayers` / `maxPlayers` | Bounds for the mode |
| `rolePackId` | Source preset id, or `custom` |
| `pacing` | `HOST` or `TIMED` |
| `nightSeconds` / `daySeconds` / `voteSeconds` | Used when timed |
| `roundCap` | Default 20, then draw |
| `rulesetAcknowledgments` | Map of accepted open-decision ids to chosen values |
| `catalogHash` | Catalog version frozen into the game |

### Teams

| Field | Purpose |
|---|---|
| `startingFactionCounts` | Derived from seated roles, not typed independently |
| `wolfCap` | Maximum `WOLF_PACK` size after conversions |
| `teamVictory.village` | Clear wolf-aligned players |
| `teamVictory.wolfPack` | Parity rule |
| `allowMultipleWinners` | Default true |
| `endGameOnIndividualWin` | Per role, default false |

The host does not enter "village count" as a free number that can disagree with the role list. The summary counts are derived. The validator compares the derived totals with any explicit team targets the host set, and rejects a mismatch.

### Infection

| Field | Infection Edition | Other presets |
|---|---|---|
| `enabled` | true | false unless selected |
| `maxSuccesses` | 4 | 4 when enabled |
| `attemptsPerNight` | 1 | 1 |
| `eligibility` | `VILLAGE_ONLY` | `VILLAGE_ONLY` |
| `requiresSurvival` | true (OD-03) | true |
| `announcement` | `SILENT` | `SILENT` |
| `blockedByGuard` | false | false |
| `blockedByDoctor` | false | false |
| `alphaDeath` | `SEAL` | `SEAL` |
| `grantKillNextNight` | true | true |

### Roles

| Field | Purpose |
|---|---|
| `entries[]` | `roleId`, `count`, `faction`, `abilityProfile`, `overrides` |
| `overrides` | Charges, cooldowns, target rules, attack types cancelled |

Overrides may narrow a capability that already exists. They may not invent a mechanic for an unresolved role.

### Voting

| Field | Default |
|---|---|
| `abstain` | true |
| `changeUntilClose` | true |
| `deadMayVote` | false |
| `tie` | one revote, then no elimination |
| `revealOnDayElimination` | current role |
| `revealOnNightDeath` | current role |

### Night resolution profile

The step order is owned by the engine. Custom games toggle named behaviors. They do not reorder steps in version 1, except by choosing a profile id.

| Profile | Use |
|---|---|
| `infection-v1` | Host confirm, Doctor reaction, survival-gated infection |
| `classic-v1` | Majority kill, blind protects, no infection |
| `custom-v1` | Same steps, boolean toggles |

Toggles include `protectionBlocksPoison`, `bodyguardRedirectsPoison`, `copyInformedDoctor`, `friendlyFire`, `informBlockedPlayer`, and `trackerIncludesActionType`. Defaults are the recommendations in the open-decision file. Contradictory toggles fail validation. Example: infection enabled and `blockedByGuard` true is a contradiction of the confirmed Guard rule, so Infection Edition rejects it. Custom mode may allow it only with an acknowledgement, and the plan recommends rejecting it there too so the confirmed Guard identity stays intact.

---

## 2. Validation architecture

`validateConfiguration(draft, catalog)` is a pure function in the domain package. The API calls it from the lobby and again inside the start transaction.

Severity:

| Level | Start allowed |
|---|---|
| error | No |
| warning | Yes, the host must send `acknowledgeWarnings: true` |
| info | Yes |

### Errors

| Code | Condition |
|---|---|
| `ROLE_COUNT_MISMATCH` | Sum of counts is not `playerCount` |
| `PLAYER_BOUNDS` | Count outside the mode min or max |
| `UNKNOWN_ROLE` | Id missing from the catalog |
| `ROLE_UNRESOLVED` | Hermit, Confuser, Priest, Bard, or any role with status unresolved |
| `INFECTED_SEATED` | Starting count of `infected_wolf` is above 0 |
| `INFECTION_WITHOUT_ALPHA` | Infection enabled and Alpha count is not 1 |
| `MULTIPLE_ALPHAS` | Alpha count above 1 |
| `WOLF_CAP` | Starting pack size is above `wolfCap`, or cap is below starting pack size |
| `WOLF_CAP_ABOVE_MODE` | Infection Edition cap is not 5, or successes are not 4, unless custom acknowledgement exists. Infection Edition itself rejects the acknowledgement |
| `NEUTRAL_VICTORY_MISSING` | Neutral or Independent seat whose victory is still undefined after the OD-73 survive rule |
| `FACTION_NOT_ALLOWED` | Chosen faction is outside `allowedFactions` |
| `DOCTOR_PROFILE_MIX` | Unlimited and limited flags on one Doctor ability |
| `DUPLICATE_ACTIVE_HEAL` | Two active Doctor profiles at start |
| `ABILITY_LIMIT_INVALID` | Negative charges, cooldown below 0, or uses per night above uses per game |
| `VOTE_WEIGHT_DOMINANT` | One seat's weight is at least half the player count |
| `NO_TERMINAL_PATH` | Voting is off and no kill or parity path exists |
| `CONTRADICTION` | Guard cannot block wolf kill, or infection is both sealed and uncapped |
| `PACK_DEPENDENCY` | Healer Assistant seated and Doctor count is 0. Recommended error |
| `DECISION_UNSET` | A blocking decision for the selected mode has no acknowledgement |

### Warnings

| Code | Condition |
|---|---|
| `WOLF_RATIO_HIGH` | Starting pack divided by players is above 0.30 |
| `WOLF_RATIO_LOW` | Starting pack divided by players is below 0.10 and infection is off |
| `INFECTION_CAN_REACH_PARITY` | `wolfCap >= ceil(playerCount / 2)` |
| `INFO_ROLE_DENSITY` | Information roles exceed `max(2, floor(players / 8))` |
| `PROTECTION_DENSITY` | More than 3 protection roles when players are 15 or fewer |
| `NEUTRAL_DENSITY` | Neutrals plus independents exceed `floor(players / 5)` |
| `INFORMED_DOCTOR` | Unlimited informed Doctor is active. Informational warning so the host sees the stall risk |
| `UNCONFIRMED_PRESET` | Preset still depends on a recommended rule |

### Reachability heuristic

This is a sanity check, not a proof that every table will finish.

- If day voting is enabled, a living majority can remove seats, so a finite game is possible.
- If voting is disabled, at least one repeating kill or a parity rule that infection can satisfy must exist.
- Each seated individual victory must name a trigger the engine implements.
- Roles with an empty trigger fail closed.

### Team summary

The lobby derives and displays:

- Selected seats.
- Village, Wolf Pack, Neutral, Independent.
- Remaining seats (`playerCount - selected`).
- Wolf cap and infection successes.
- Errors and warnings.

Start stays disabled while the remaining-seat number is not 0 or any error exists.

---

## 3. Pack 1 — Infection Core

| Field | Value |
|---|---|
| id | `infection-core` |
| Mode | Infection Edition |
| Players | 20 |
| Status | Confirmed composition. Resolution defaults still cite OD-01 through OD-04 |

| Role | Count |
|---|---:|
| Alpha Wolf | 1 |
| Seeker | 2 |
| Guard | 1 |
| Doctor | 1 |
| Witch | 1 |
| Normal Villager | 14 |

Derived factions: Wolf Pack 1, Village 19, Neutral 0, Independent 0.

Infection on. Success cap 4. Wolf cap 5. Friendly fire on. Teammate knowledge off. Doctor profile `doctor_infection`. Witch potions 1 and 1. Guard consecutive-target ban on.

This pack is the default when a host creates a game and does not choose another.

---

## 4. Pack 2 — Balanced Expanded

### Why the prose suggestion is not a preset

The brief reports a reference split of about 5 wolves, 12 or 13 villagers, and 3 neutrals, totaling 20, and says the image disagrees with itself.

| Reading | Arithmetic | Problem |
|---|---|---|
| 5 + 12 + 3 | 20 | Valid sum, but 5 starting wolves leave no room under a cap of 5 for 4 infections |
| 5 + 13 + 3 | 21 | Invalid headcount |
| 1 Alpha + infection capacity 4, neutrals 3, villagers 16 | 20 | Valid sum, and it treats "5 wolves" as a cap. The named neutral list only has a clear Jester and Assassin. Cursed Villager starts as Village. Hermit has no win condition |

The images are not available to resolve the disagreement. No invalid 20-player list is proposed as shippable.

### Pack 2A — shippable reconstruction

id: `expanded-infection-20`

This is a reconstruction for playtest, labeled `UNCONFIRMED_PRESET`.

| Role | Count | Starting faction |
|---|---:|---|
| Alpha Wolf | 1 | Wolf Pack |
| Seeker | 1 | Village |
| Guard | 1 | Village |
| Doctor | 1 | Village |
| Witch | 1 | Village |
| Blacksmith | 1 | Village |
| Detective | 1 | Village |
| Bodyguard | 1 | Village |
| Cursed Villager | 1 | Village |
| Jester | 1 | Neutral |
| Assassin | 1 | Neutral |
| Normal Villager | 9 | Village |
| Total | 20 | |

Derived: Wolf Pack 1, Village 17, Neutral 2, Independent 0.

Priest is omitted because OD-17 gives Priest no power. Hermit is omitted because OD-11 gives Hermit no victory. Their suggested seats are villagers instead.

Infection remains available up to 4 successes and a cap of 5. Assassin uses the mark profile. Blacksmith uses the one-time shield. Doctor uses the blind limited profile with 2 saves, so this pack does not silently reuse the Infection Edition unlimited veto. That limited number is a recommendation and must be acknowledged.

### Pack 2B — not shippable

A 5 starting Pack Wolves + 12 Village + 3 Neutral skeleton sums to 20 and matches one reading of the image. It is recorded as a skeleton only. It needs a defined third neutral and it turns infection off, otherwise the wolf cap is already full. Do not present it as a finished preset.

---

## 5. Pack 3 — Investigation Edition

id: `investigation-15`

Players: 15. Infection off. Pack wolves know each other. Doctor is blind with 1 save per night and 2 saves per game. This Doctor limit is recommended.

**Note, 9 November 2026 (WW-204).** The table below has no Doctor, and adding one would make 16 seats. The encoded pack follows the table, which sums to 15. Seat a Doctor by replacing a villager if the sentence above is the intent.

| Role | Count |
|---|---:|
| Pack Wolf | 3 |
| Seeker | 1 |
| Detective | 1 |
| Oracle | 1 |
| Tracker | 1 |
| Psychic | 1 |
| Medium | 1 |
| Prophet | 1 |
| Seer | 1 |
| Normal Villager | 4 |

Derived: wolves 3, village 12. Information-role warning is expected and should be shown. The pack is still startable after the host acknowledges the warning.

Oracle, Tracker, Psychic, Medium, Prophet, and Seer use the recommended profiles in the catalog. They are not confirmed canon from an image.

---

## 6. Pack 4 — Protection Edition

id: `protection-15`

| Role | Count |
|---|---:|
| Pack Wolf | 3 |
| Doctor | 1 |
| Guard | 1 |
| Bodyguard | 1 |
| Shieldbearer | 1 |
| Trapper | 1 |
| Blacksmith | 1 |
| Healer Assistant | 1 |
| Normal Villager | 5 |

Priest is omitted until a Priest power exists. The omitted seat is a villager. Protection-density warning is expected at 15 players.

Doctor profile: blind, 2 saves per game. Assistant inherits whatever remains. Blacksmith is the item variant. Trapper has 2 charges.

---

## 7. Pack 5 — Chaos

id: `chaos-15`

A shippable subset. Confuser, Hermit, and Priest are listed in the brief's chaos theme and are excluded here.

| Role | Count | Faction |
|---|---:|---|
| Pack Wolf | 2 | Wolf Pack |
| Jester | 1 | Neutral |
| Assassin | 1 | Neutral |
| Cursed Villager | 1 | Village |
| Shapeshifter | 1 | Neutral |
| Spy | 1 | Village |
| Lone Wolf | 1 | Independent |
| Avenger | 1 | Village |
| Normal Villager | 6 | Village |

Infection off. Friendly fire off for the pack. Lone Wolf may target anyone. Spy learns submission counts only. Several individual win flags can be true in one game. The Neutral Shapeshifter wins by surviving to the end.

Expected warning: neutral and independent density.

---

## 8. Pack 6 — Custom

id: `custom`

No seats. The host adds catalog roles until validation passes. The catalog browser groups roles by category and shows unresolved roles as disabled rows with the decision id.

---

## 9. Suggested headcounts

These ranges are starting suggestions for hosts. They are not hard validation limits except where a mode already has a fixed count. They are not measured win rates.

| Players | Suggested living wolf pressure | Preset to start from | Composition | Complexity | Imbalance risk |
|---:|---|---|---|---|---|
| 10 | 2 or 3 | Classic | 2 Pack Wolves, 1 Seeker, 1 Doctor, 6 Villagers. A third wolf replaces a villager | Low | 3 wolves is 30 percent and should warn. One information role is enough |
| 15 | 3 or 4 | Classic or a trimmed Infection-style game | 3 Pack Wolves, Seeker, Guard, Doctor, Witch, 8 Villagers | Medium | A fourth wolf should warn. Unlimited informed Doctor is a poor fit at this size |
| 20 | Cap of 4 or 5 | Infection Core, or Pack 2A | Infection Core is 1 starting wolf and a cap of 5. Pack 2A adds two neutrals and extra powers | Medium or high | Informed Doctor can stall night kills. Neutrals add extra endings |
| 24 | 5 or 6 | Expanded custom | 5 Pack Wolves, 2 Seekers, Detective, Doctor, Guard, Witch, Bodyguard, Blacksmith, Jester, Assassin, 9 Villagers | High | Five wolves of 24 is about 21 percent. Two vote-weight roles together need the weight warning |
| 30 | 6 to 8 | Expanded custom | 7 Pack Wolves, 2 Seekers, Detective, Oracle, Doctor, Guard, Witch, Bodyguard, Trapper, Jester, Assassin, Lone Wolf, 11 Villagers | Very high | Three non-village win paths. Information density should warn |

The 24-player line sums to 24. The 30-player line sums to 30. Both are proposals for later playtests, with recommended role profiles, not confirmed products.

### How balance will be judged

The host UI shows ratios and warnings. It does not show a fake 50 percent win probability. After the simulation harness exists, preset pages can show measured village, wolf, and neutral finish rates from a named seed and a named bot policy. Until those runs exist, the UI says the preset is unmeasured.

## 10. Pack ultimate-20

`ULTIMATE_20` has one pack, `ultimate-20`, and it is the default for that mode. Twenty seats: the fifteen special roles in [ultimate-20-rules.md](./ultimate-20-rules.md) and five Villagers. Alpha uses `alpha_ultimate`. Oracle uses `oracle_alignment`. Infection is on, silent, four successes, village only, survival required. The wolf cap is 5. Wolves do not know each other. Friendly fire is off. The kill is `ALPHA_PRIORITY`. The night profile is `ultimate-v1`. There are no night toggles. The pack acknowledges OD-03 as survival required.

The validator rejects any edit to that roster or those rules with `MODE_RULE_LOCKED` and the prefix `Ultimate 20:`. Saving a draft still returns the validation object, the same way an invalid custom draft does. Start stays closed until the draft is valid and warnings are acknowledged. The pack warns `NEUTRAL_DENSITY` and `UNCONFIRMED_PRESET`.
