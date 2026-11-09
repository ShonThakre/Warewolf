# Role Catalog

The catalog is the source of role identity for the future engine. It is a registry of definitions, not a set of branches inside night resolution.

Images referenced by the brief were not in the environment. Variants below are only the variants named in the written brief. Status values match [open-decisions.md](./open-decisions.md).

36 roles come from the numbered brief. `pack_wolf` is an additional Classic-mode role proposed in OD-36. Total catalog size: **37 definitions**.

A role is not a team. `defaultFaction` is the preset affiliation. `allowedFactions` is the set a configuration may assign. The seated instance stores `originalFaction` and `currentFaction` separately from `originalRoleId` and `currentRoleId`.

## Shared definition shape

This shape is conceptual. It is not source code and it is not a schema file to add during planning.

```yaml
id: seeker
displayName: Seeker
description: Learns whether one living player is a Wolf or a Non-Wolf.
category: INVESTIGATION
defaultFaction: VILLAGE
allowedFactions: [VILLAGE]
alignment: TEAM
visibility: SECRET
knowsTeammates: false
implementationStatus: CONFIRMED
requiredPlayerCount: 1
abilities:
  - id: seeker_investigate
    capability: INVESTIGATE
    timing: NIGHT
    usesPerNight: 1
    usesPerGame: null
    cooldownNights: 0
    target:
      count: 1
      living: true
      self: false
      factions: ANY
    result: ALIGNMENT_WOLF_OR_NOT
    resultAudience: [SELF, HOST]
    lostOnInfection: true
  - id: seeker_public_reveal
    capability: ROLE_REVEAL
    timing: DAY
    usesPerDay: 1
    target: OWN_PREVIOUS_RESULT
    resultAudience: [PUBLIC]
victory:
  type: TEAM
  individual: null
infection:
  whenSource: NOT_A_SOURCE
  whenTarget: LOSE_ROLE_AND_CONVERT_TO_INFECTED_WOLF
death:
  revealCurrentRole: CONFIGURED
compatibility:
  uniqueInGame: false
  conflicts: []
configurable:
  - usesPerGame
  - resultAudience
```

Capability handlers interpret `capability`. A role-specific handler is allowed only through `handlerKey` when no shared capability fits. The night engine orders steps. It does not switch on `roleId`.

### Capability set

| Capability | Shared handler responsibility |
|---|---|
| INVESTIGATE | Emit a configured fact from the start-of-night snapshot |
| PROTECT | Negate a configured attack type against one target |
| HEAL | Negate the final wolf kill, or cure an effect listed in `cancels` |
| KILL | Add a lethal intent of a named attack type |
| POISON | Add a delayed lethal intent |
| INFECT | Add a conversion intent |
| BLOCK_ACTION | Cancel the target's special actions this night |
| TRACK | Report the target's selected player ids |
| DETECT | Report a configured boolean |
| ROLE_COPY | Schedule a temporary ability grant |
| ROLE_REVEAL | Publish an already computed private result, or a death role |
| VOTE_MODIFIER | Attach a weight or a one-day penalty |
| SURVIVE_DEATH | Cancel lethals for one resolution step and consume a charge |
| REVENGE | Queue a named-cause kill |
| COMMUNICATE_WITH_DEAD | Disabled until a real channel is approved. Medium uses INVESTIGATE |
| MODIFY_VOTING | Same family as VOTE_MODIFIER, kept as an alias in config language |
| TEAM_SUPPORT | Inherit or grant an ally's configured ability |

`handlerKey` values reserved for mechanics that are more than a capability flag:

| handlerKey | Role |
|---|---|
| `infection.convert` | Shared by Alpha infection and Cursed conversion |
| `cursed.onSurvivedWolfAttack` | Cursed Villager |
| `jester.onDayElimination` | Jester |
| `assassin.onTargetEliminated` | Assassin variant A |
| `avenger.queueRevenge` | Avenger |
| `shapeshifter.scheduleCopy` | Shapeshifter |
| `assistant.inheritDoctor` | Healer Assistant |
| `immortal.consumeCharge` | Immortal |

Adding a role that only composes existing capabilities does not change those handlers or the step list.

### Factions

| Faction | Counts as wolf for Seeker | Counts in pack parity as wolf | Village must clear them |
|---|---|---|---|
| VILLAGE | No | No | No |
| WOLF_PACK | Yes | Yes | Yes |
| NEUTRAL | No | No | No |
| INDEPENDENT | Yes when `wolfAligned` is true | No | Yes when `wolfAligned` is true |

Lone Wolf is `INDEPENDENT` and `wolfAligned: true`. Jester and Assassin are `NEUTRAL` and not wolf-aligned. This wolf-aligned flag is the recommended reading in OD-10.

### Infection behavior values

| Value | Meaning |
|---|---|
| `LOSE_ROLE_AND_CONVERT_TO_INFECTED_WOLF` | Default for Village roles |
| `INELIGIBLE` | Wolves, and anyone outside the config eligibility set |
| `NOT_A_SOURCE` | The role does not grant infection |
| `SEAL_INFECTION_ON_DEATH` | Alpha only |

On conversion the instance keeps `originalRoleId`, sets `currentRoleId` to `infected_wolf`, sets `currentFaction` to `WOLF_PACK`, revokes active ability rows, and grants the infected kill ability with `availableFromRound = currentRound + 1`.

---

## A. Core roles

### 1. Alpha Wolf

| Field | Value |
|---|---|
| id | `alpha_wolf` |
| Category | Core |
| Default faction | WOLF_PACK |
| Allowed factions | WOLF_PACK |
| Status | CONFIRMED |
| Teammate visibility | Hidden in Infection Edition |

Abilities:

| Ability | Capability | Limits | Notes |
|---|---|---|---|
| `alpha_infect` | INFECT | 1 attempt per night, 4 successful conversions per game | Eligible targets depend on OD-05. Stops forever when Alpha is dead |
| `alpha_kill` | KILL `WOLF_KILL` | 1 per night | Participates in final-target selection. Friendly fire on in Infection Edition |

Victory: Wolf Pack team rule. No individual win.

Death: seals infection. Existing Infected Wolves remain wolves.

The Alpha does not learn who the other wolves are, and other wolves do not learn the Alpha.

### 2. Infected Wolf

| Field | Value |
|---|---|
| id | `infected_wolf` |
| Category | Core |
| Default faction | WOLF_PACK |
| Status | CONFIRMED |
| Seated at start | Never. Validation rejects a starting count above 0 |

Created only by infection or by Cursed conversion. One kill submission per night once `availableFromRound` is reached. Friendly fire follows the game flag. No infection power. No knowledge of other wolves. Original abilities are gone. Survives as a wolf after the Alpha dies.

Victory: Wolf Pack team rule.

### 3. Seeker

| Field | Value |
|---|---|
| id | `seeker` |
| Category | Investigation |
| Faction | VILLAGE |
| Status | CONFIRMED |

Nightly alignment check of one living player. Public reveal is a separate day ability and can only publish the Seeker's own stored result. Lost on infection.

Distinct from Detective, Oracle, and Seer.

### 4. Guard

| Field | Value |
|---|---|
| id | `guard` |
| Category | Protection |
| Faction | VILLAGE |
| Status | CONFIRMED |

Protect one living player per night, including self (OD-47, recommended). Cannot repeat the same target on consecutive nights. Blocks `WOLF_KILL` only. Does not block infection, poison, sniper, or votes unless a future config adds attack types. Lost on infection.

### 5. Doctor

| Field | Value |
|---|---|
| id | `doctor` |
| Category | Protection |
| Faction | VILLAGE |
| Status | CONFIRMED identity, BLOCKING mode (OD-02) |

Three configurations, stored as ability profiles, never as one hybrid:

| Profile | Mode | Charges | Used by |
|---|---|---|---|
| `doctor_infection` | Informed veto of the final wolf kill | Unlimited per game, 1 decision per night | Infection Edition |
| `doctor_limited` | Blind save or informed veto, as configured | Finite `usesPerGame` | Expanded only |
| `doctor_blind` | Blind nightly save | Unlimited, configurable down | Classic. Added in WW-202 because game-rules.md gives Classic a blind unlimited Doctor, which neither profile above describes |

The Doctor may save themselves in Infection Edition. The private delivery of the final target is host-visible and Doctor-visible. Lost on infection. Healer Assistant may inherit the active profile under OD-32.

### 6. Witch

| Field | Value |
|---|---|
| id | `witch` |
| Category | Support |
| Faction | VILLAGE |
| Status | CONFIRMED |

| Ability | Capability | Charges |
|---|---|---|
| `witch_save` | HEAL, cancels `WOLF_KILL` | 1 per game |
| `witch_poison` | POISON | 1 per game |

Both may be used on one night. Targets are any eligible living players, including self for the save. The Witch is not told the final wolf target. Unused charges are revoked on infection and are not transferred. Poison timing follows OD-28.

### 7. Normal Villager

| Field | Value |
|---|---|
| id | `normal_villager` |
| Category | Core |
| Faction | VILLAGE |
| Status | CONFIRMED |

No abilities. Votes with weight 1. Eligible infection target. Fills unused seats in presets.

### 37. Pack Wolf

| Field | Value |
|---|---|
| id | `pack_wolf` |
| Category | Core |
| Faction | WOLF_PACK |
| Status | RECOMMENDED addition (OD-36) |

Basic Classic wolf. Kill submission only. Learns other Pack Wolves when `knowsTeammates` is true. No infection. Not used by the Infection Edition preset. Friendly fire defaults off, so the target list excludes fellow pack members unless the flag is on.

---

## B. Special and neutral roles

### 8. Jester

| Field | Value |
|---|---|
| id | `jester` |
| Category | Neutral |
| Default faction | NEUTRAL |
| Allowed factions | NEUTRAL |
| Status | CONFIRMED win trigger, RECOMMENDED continuation (OD-08) |

No night power. Individual victory: eliminated by day vote. Night death, infection, poison, and sniper do not award the win. `endGameOnIndividualWin` defaults false. Recommended reveal on that win: current role public.

### 9. Assassin

| Field | Value |
|---|---|
| id | `assassin` |
| Category | Neutral |
| Default faction | NEUTRAL |
| Allowed factions | NEUTRAL, VILLAGE, WOLF_PACK |
| Status | Two variants, do not merge (OD-09) |

| Profile | Status | Behavior |
|---|---|---|
| `assassin_mark` | Recommended playable default | Night 1, mark one living player. Individual win if that player is later eliminated by anyone. Does not itself kill |
| `assassin_execute` | UNRESOLVED detail | One special elimination associated with a day vote. Leave disabled until the extra rule in OD-09 is chosen |

If faction is set to Village or Wolf Pack, the recommended rule is that the Assassin still uses the individual mark and does not also receive the team win. Team contribution requires `victory.type: BOTH`, which no preset sets.

### 10. Cursed Villager

| Field | Value |
|---|---|
| id | `cursed_villager` |
| Category | Transformation |
| Start faction | VILLAGE |
| Status | RECOMMENDED trigger (OD-06) |

Starts with no active ability beyond a passive `cursed.onSurvivedWolfAttack`. A survived wolf attack converts the player into `infected_wolf` if the wolf cap allows. Death does not convert. Alpha infection converts through the normal infection path. After conversion the player is an Infected Wolf for victory and anonymity purposes.

### 11. Lone Wolf

| Field | Value |
|---|---|
| id | `lone_wolf` |
| Category | Independent |
| Faction | INDEPENDENT |
| wolfAligned | true |
| Status | RECOMMENDED victory (OD-10) |

Does not know pack wolves and is not shown to them. Ability `lone_kill`: one `WOLF_KILL` per night that is resolved as its own attack, not as part of the pack's final target. Default individual victory: sole living player. Kill-count victory is a disabled alternative profile.

### 12. Immortal

| Field | Value |
|---|---|
| id | `immortal` |
| Category | Defensive |
| Default faction | VILLAGE |
| Allowed factions | VILLAGE, NEUTRAL, WOLF_PACK, INDEPENDENT |
| Status | RECOMMENDED timing (OD-12) |

Passive `SURVIVE_DEATH`, one charge. Faction is configurable because the brief says so. No infinite loop: the charge cannot refresh.

### 13. Avenger

| Field | Value |
|---|---|
| id | `avenger` |
| Category | Reactive |
| Default faction | VILLAGE |
| Allowed factions | VILLAGE, NEUTRAL, WOLF_PACK |
| Status | RECOMMENDED partial rule (OD-13) |

Passive revenge. Named killers and day-vote plurality leaders can be queued. Anonymous pack kills do not produce a revenge target under the recommended rule. The elimination record still stores every contributor for a future rule.

### 14. Hermit

| Field | Value |
|---|---|
| id | `hermit` |
| Category | Neutral |
| Default faction | NEUTRAL |
| Status | UNRESOLVED |

No abilities. No victory condition. Cannot be seated by a valid configuration. Candidate conditions are listed in OD-11 and are not active.

---

## C. Investigation roles

All of these are Village, secret, lost on infection, and distinct ids. None of them replace Seeker.

| Role | id | Status | Recommended ability |
|---|---|---|---|
| 15 Detective | `detective` | RECOMMENDED | INVESTIGATE alignment, 2 uses per game, 1 per night |
| 16 Oracle | `oracle` | RECOMMENDED | INVESTIGATE category every 2 nights. Future-event mode is not defined |
| 17 Tracker | `tracker` | RECOMMENDED | TRACK target ids only, 1 per night, multiple visits returned |
| 18 Psychic | `psychic` | RECOMMENDED | INVESTIGATE two players, result SAME or DIFFERENT faction, 1 per night |
| 19 Medium | `medium` | RECOMMENDED | INVESTIGATE one dead player's role at death, 1 per night. No dead chat |
| 20 Prophet | `prophet` | RECOMMENDED | DETECT via whitelist question `WOLF_PACK_SIZE_AT_LEAST`, every 3 nights |
| 21 Seer | `seer` | RECOMMENDED | INVESTIGATE current role id every other night, accuracy default 100 |

Detective does not return the role id. Seer does. Oracle returns a category. Seeker returns alignment every night with a public-reveal ability the others do not have unless configured.

Information audience is the actor and the host. Public release requires an explicit reveal action or a death-reveal setting.

---

## D. Protection roles

| Role | id | Status | Recommended ability |
|---|---|---|---|
| 22 Bodyguard | `bodyguard` | RECOMMENDED | PROTECT. Redirects wolf kill onto the Bodyguard. See OD-14 |
| 23 Shieldbearer | `shieldbearer` | RECOMMENDED | PROTECT against `WOLF_KILL`, no consecutive repeat, configurable charges, default unlimited nights |
| 24 Trapper | `trapper` | RECOMMENDED | DETECT plus optional cancel. Two traps per game. Private reveal. Consumed on trigger. OD-15 |

Guard remains the Infection Edition protector and is not replaced by these roles.

---

## E. Offensive roles

| Role | id | Default faction | Status | Recommended ability |
|---|---|---|---|---|
| 25 Sniper | `sniper` | VILLAGE | RECOMMENDED | KILL `SNIPER`, 1 per game, day discussion window. OD-29 |
| 26 Poisoner | `poisoner` | Configurable, default NEUTRAL | RECOMMENDED | POISON, 1 per game, delay per OD-28 |
| 27 Disruptor | `disruptor` | Configurable, default NEUTRAL | RECOMMENDED | BLOCK_ACTION, 1 per game. OD-30 |

Poisoner and Disruptor must declare a faction in the configuration. Validation fails if faction is missing.

---

## F. Transformation and deception

### 28. Shapeshifter

| Field | Value |
|---|---|
| id | `shapeshifter` |
| Default faction | Configurable, preset NEUTRAL |
| Status | RECOMMENDED (OD-31) |
| Capability | ROLE_COPY |

Copies for a later night, uses a fresh charge pool, cannot copy infection or another Shapeshifter, and does not change faction. Permanent steal defaults off.

### 29. Confuser

| Field | Value |
|---|---|
| id | `confuser` |
| Status | UNRESOLVED (OD-18) |

No mechanic. Seating the role fails validation.

### 30. Spy

| Field | Value |
|---|---|
| id | `spy` |
| Default faction | Configurable, preset VILLAGE |
| Status | RECOMMENDED narrow info (OD-19) |
| Capability | DETECT |

Learns the count of wolf-kill submissions and nothing else. Full identity feeds are forbidden by the default profile.

---

## G. Support roles

| Role | id | Status | Recommended ability |
|---|---|---|---|
| 31 Blacksmith | `blacksmith` | Two variants (OD-16) | Presets use ITEM: one shield that blocks wolf kill. AURA remains a separate disabled-by-default profile |
| 32 Priest | `priest` | UNRESOLVED (OD-17) | No ability. Cannot be seated |
| 33 Elder | `elder` | RECOMMENDED | VOTE_MODIFIER weight 2, and a one-day village penalty if killed by wolves. OD-33 |
| 34 Mayor | `mayor` | RECOMMENDED | VOTE_MODIFIER weight 2 from the start. Public label optional. OD-34 |
| 35 Bard | `bard` | UNRESOLVED digital power (OD-20) | No ability. Cannot be seated |
| 36 Healer Assistant | `healer_assistant` | RECOMMENDED | TEAM_SUPPORT inherit Doctor on Doctor death or conversion. OD-32 |

---

## Conversion and death matrix

| Role | On infection | On night death | On day-vote death |
|---|---|---|---|
| Alpha | Ineligible | Seal infection. Reveal per config | Seal infection |
| Infected Wolf | Already a wolf | Remain recorded as wolf | Remain recorded as wolf |
| Any seated power role with `lostOnInfection` | Revoke abilities, become Infected Wolf next round for actions | Abilities stop | Abilities stop |
| Jester | If ever allowed by eligibility: lose Jester win | No Jester win | Jester win |
| Cursed Villager | Normal infection | No cursed conversion | No cursed conversion |
| Immortal | Lose Immortal if infection eligibility allows | Charge may cancel the death | Charge may cancel the death |
| Healer Assistant | Lose inheritance | No inherit | No inherit |
| Hermit, Confuser, Priest, Bard | Not seatable | — | — |

---

## How a future role is added

1. Add one definition object to the catalog.
2. Reuse an existing capability, or add one handler module and register it by capability or `handlerKey`.
3. Add tests for that definition and handler.
4. Leave the night step list unchanged unless a new ordered step is truly required.
5. Optionally add the id to a role pack.
6. Extend validation only when the role introduces a new constraint.

No central `switch (roleId)` is part of the design.

## Sample ability instance after assignment

Conceptual record for one Seeker after seating:

```yaml
abilityInstanceId: generated
playerId: generated
abilityId: seeker_investigate
capability: INVESTIGATE
status: ACTIVE
chargesRemaining: null
usesConsumed: 0
lastUsedRound: null
lastTargetPlayerId: null
source: NATIVE
availableFromRound: 1
config:
  result: ALIGNMENT_WOLF_OR_NOT
  lostOnInfection: true
```

After that player is infected, this row becomes `REVOKED` with reason `INFECTION`, and a new `infected_kill` row is created with `availableFromRound` set to the next night.
