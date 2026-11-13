# Open Decisions

Status of this document: planning baseline, 9 November 2026.

No Werewolf reference images were present in the workspace, the nested git checkout, Desktop, Downloads, or Screenshots under a Werewolf-related name. Every rule below comes from the written brief. Where that brief describes two behaviors for one role, both are preserved. Nothing in this file is an implemented rule.

Decisions are classified as:

| Class | Meaning |
|---|---|
| CONFIRMED | Explicit in the written brief. Implementation should follow it. |
| BLOCKING | A behavior must be chosen before the listed phase can be finished. |
| RECOMMENDED | A default is proposed so the engine has a concrete behavior. It is an assumption until the product owner accepts it. |
| UNRESOLVED | The brief does not define the mechanic. No default power is invented. The role stays disabled in shippable presets. |

Shippable presets may contain RECOMMENDED values only when this file names the default. They must not contain UNRESOLVED powers.

Related documents: [game-rules.md](./game-rules.md), [role-catalog.md](./role-catalog.md), [role-configuration.md](./role-configuration.md).

---

## Decision gate before Infection Edition can ship

These three block Phase 7. The engine can still be built so each choice is a configuration strategy.

### OD-01 Wolf kill aggregation

**Decided 9 November 2026: `HOST_SELECT_AMONG_SUBMISSIONS`** for Infection Edition, as recommended. `hostAdjudication` stays off.

**Question.** Each wolf submits a kill target and wolves do not know each other. What becomes the single final Wolf kill target that the Doctor is asked to save?

**Options.**

1. `HOST_SELECT_AMONG_SUBMISSIONS`. The host must choose one player who appears in at least one legal submission. This is the closest reading of "the Doctor receives the final target privately from the Host."
2. `MAJORITY`. The player with the most submissions is the final target. A tie produces no kill.
3. `ALPHA_PRIORITY`. The Alpha's submission is the final target when the Alpha is alive and submitted one. Other submissions are ignored.
4. `EACH_SUBMISSION_IS_AN_ATTACK`. Every submission resolves as its own attack. This contradicts the brief's singular "final Wolf kill target" and should be rejected for Infection Edition.

**Recommendation.** `HOST_SELECT_AMONG_SUBMISSIONS` for Infection Edition. `MAJORITY` with no kill on a tie for automated Classic games.

**Why it is blocking.** Night resolution, the Doctor reaction window, and the host dashboard all branch on this choice.

**Reject.** Letting the host select a player whom nobody submitted, unless a separate audited `hostAdjudication` flag is explicitly enabled. That flag should default off.

### OD-02 Doctor information timing

**Decided 9 November 2026: `INFORMED_VETO` with unlimited charges** for Infection Edition, as recommended. The balance consequence below is accepted and will be measured in WW-1402.

**Question.** Does the Doctor choose a save before knowing the final target, or after being told it?

The brief says the Doctor can save the final Wolf kill target, has unlimited saves in Infection Edition, can save themselves, and receives the final target privately from the Host.

**Options.**

1. `INFORMED_VETO`. Wolves submit, the final target is fixed, the Doctor is told that player and may spend a save or decline. While an unlimited Doctor is alive and unblocked, the Doctor can negate every wolf kill, including a self-target.
2. `BLIND_TARGET`. The Doctor commits a protect-like save during the open night window. The Host's private message is only a recap after resolution.

**Balance consequence of option 1.** Night kills stop working until the Doctor is infected, voted out, blocked, disconnected from the reaction window, or the mode uses a limited charge count. Infection and the day vote become the wolves' reliable tools. Guard still matters after the Doctor is gone. This may be the intended social game. It is a poor default for unattended Classic games.

**Recommendation.** Infection Edition uses `INFORMED_VETO` with unlimited charges. Classic and Expanded use `BLIND_TARGET` unless the host copies the Infection Doctor rule on purpose. The two configurations must not be merged into one ability definition.

**Why it is blocking.** It changes the phase machine. Informed veto needs `NIGHT_REACTION`. Blind save does not.

### OD-03 Infection when the target also dies that night

**Decided 9 November 2026: option 1**, as recommended. Infection sticks only if the target survives lethal resolution.

**Question.** Alpha infects a player, and that same player is the resolved lethal target.

**Options.**

1. Infection commits only if the target is alive after lethal resolution. The player dies as their original role. A failed survival does not increment the successful-infection counter. The Alpha's once-per-night attempt is still spent.
2. Infection commits before deaths. The player dies as an Infected Wolf. The successful-infection counter increments.
3. Infection commits and also cancels the death.

**Recommendation.** Option 1. The brief says infection does not immediately kill and is a conversion of a player, and a dead player has no next night in which to gain wolf actions. Option 3 contradicts wolf kill resolution.

**Related confirmed rule.** Guard protection does not stop infection. A Doctor save stops the wolf kill only. Under option 1, a saved target can still be infected.

### OD-04 What consumes an infection slot

**Decided 9 November 2026: the table below**, which follows from OD-03 option 1.

**Recommendation tied to OD-03.**

| Outcome | Night attempt spent | Successful-infection counter |
|---|---|---|
| Target ineligible (dead, already wolf, self, over cap) | No, while the window is open the Alpha may replace the action | No |
| Window closes on an illegal target | The night is missed | No |
| Legal target later dies the same night | Yes | No |
| Legal target survives | Yes | Yes |
| Cap of 4 successes already reached | Action rejected | No |
| Alpha dead | Action rejected and infection is sealed | No |

---

## Confirmed rules (not open)

Recorded here so later implementation does not reopen them.

| ID | Rule |
|---|---|
| C-01 | Infection Edition is the default preset. |
| C-02 | Infection Edition starts at exactly 20 players. |
| C-03 | Starting seats: Alpha 1, Seeker 2, Guard 1, Doctor 1, Witch 1, Normal Villager 14. |
| C-04 | Maximum successful infections: 4. Maximum wolf-team size: 5, including Alpha. |
| C-05 | Infection converts the existing player. It does not add a seat and does not kill by itself. |
| C-06 | The infected player loses the original role and its abilities, becomes a Wolf, and may submit a wolf kill target starting the next night. |
| C-07 | Alpha and Infected Wolves do not automatically learn other wolf identities. |
| C-08 | Friendly fire is enabled in Infection Edition. |
| C-09 | Alpha's death seals infection permanently. Wolves who already converted stay wolves. |
| C-10 | Village wins when every wolf is eliminated. Wolves win when living wolves are greater than or equal to living non-wolves. |
| C-11 | Seeker checks one living player each night and learns Wolf or Non-Wolf. The Seeker may reveal that result publicly. Infection removes the ability. |
| C-12 | Guard protects one player each night, cannot protect the same player on consecutive nights, blocks wolf kill, and does not block infection. |
| C-13 | Infection Edition Doctor saves are unlimited and may target the Doctor. Expanded limited saves are a separate configuration. |
| C-14 | Witch has one save potion and one poison potion, each usable once, both usable on the same night, each aimed at any eligible living player. Unused potions are lost on infection. |
| C-15 | Normal Villager has no special ability and does vote. |
| C-16 | Jester wins individually if eliminated by day vote, and does not win if killed at night. |
| C-17 | Role assignment, resolution, voting, victory, and randomness are server-side. Ordinary players never receive the full role list. The host can. |
| C-18 | A neutral individual victory does not end the whole game unless that victory rule says it does. |
| C-19 | Original role and current role are stored separately. Initial team and current team are stored separately. |

---

## Role identity and teams

### OD-05 Who infection may target

**Decided 12 November 2026: accepted as recommended.**

**Recommendation.** `VILLAGE_ONLY` in Infection Edition, which has no other factions. Expanded default: living Village-faction players who are not already wolves. Neutrals and independents are ineligible unless the host sets `infectionEligibility` to `ANY_NON_PACK_WOLF`.

Infecting a neutral revokes that player's individual victory because the role is removed. The host UI must say so before a custom config allows it.

### OD-06 Cursed Villager conversion trigger

**Decided 12 November 2026: accepted as recommended.**

The brief says the Cursed Villager starts as a villager and, if successfully attacked by wolves but survives, may become an Infected Wolf. It asks whether Guard or Doctor protection counts as survival.

**Recommendation.**

- A wolf-kill attempt that is negated by Guard, Shieldbearer, Blacksmith shield, Doctor, Witch save, or Immortal counts as survived attack and converts the player.
- A wolf-kill attempt that becomes a death does not convert.
- Bodyguard redirect: the cursed player was attacked and survived, so they convert. The Bodyguard is the one who may die.
- Alpha infection of a Cursed Villager uses normal infection and does not require a survived attack.
- Conversion uses the same loss of abilities as infection and respects the wolf cap. If the cap is full, conversion fails and the player remains a Cursed Villager.
- The attack still "happened" if it was submitted and not role-blocked, even when protection cancels the damage.

This is a recommended rule, not a confirmed one.

### OD-07 When a same-night submitted action of a converted player resolves

**Decided 12 November 2026: accepted as recommended.**

**Recommendation.** Actions submitted while the player still held the old role resolve during that night. Conversion is applied after action resolution. Wolf kill submission is available only on later nights. This matches C-06.

### OD-08 Jester and game end

**Decided 12 November 2026: accepted as recommended.**

**Question.** The brief requires an individual victory and asks whether the game continues after the Jester wins.

**Recommendation.** Record a Jester win, reveal the Jester if `revealOnIndividualWin` is true (default true), and continue. `endGameOnIndividualWin` defaults false. Team victory is evaluated after the Jester is removed from the living counts. Both can be recorded when `allowMultipleWinners` is true (default true).

### OD-09 Assassin variants

**Decided 12 November 2026: accepted as recommended.** Variant A (`MARK`) only; variant B (`EXECUTE`) stays out of presets until its extra rule is decided.

Do not merge these.

| Variant | Behavior in the brief | Extra rule still required |
|---|---|---|
| A `MARK` | Select a target and win if that target is eliminated | Who may eliminate the target, when the mark is chosen, and whether the Assassin must deliver the blow |
| B `EXECUTE` | One special elimination after a day vote | Whether the elimination is in addition to the vote result, replaces it, or happens only if the vote tied |

**Recommendation for a playable default, still unconfirmed.**

- Variant A is the Expanded and Chaos preset choice.
- The Assassin marks one living player during Night 1 only.
- The mark is a win condition, not a kill. Any later elimination of that player completes it.
- Faction defaults to Neutral.
- The win does not end the game.
- The Assassin does not also win with a team.
- Variant B stays in the catalog as a separate ability profile with no preset until its extra rule is approved.

### OD-10 Lone Wolf victory and parity

**Decided 12 November 2026: accepted as recommended.**

The brief says the Lone Wolf is an independent wolf, does not know other wolves, has an individual victory, and can have an independent kill. It asks whether victory is last survivor or a kill count.

**Recommendation.**

- Default victory: be the sole living player.
- Alternative stored in the catalog and disabled: eliminate N configured players personally.
- Faction is `INDEPENDENT`, wolf-aligned for investigations that report Wolf versus Non-Wolf.
- Pack wolves and the Lone Wolf do not see each other.
- Pack parity counts only `WOLF_PACK` versus everyone else alive, including the Lone Wolf and neutrals.
- Village victory requires every living wolf-aligned player to be gone, including Lone Wolf and Infected Wolves. This is a recommended reading of "all Wolves."
- A sole surviving Lone Wolf is a Lone Wolf win, not a Village win and not a pack win.

### OD-11 Hermit

**Decided 12 November 2026: kept out of version 1.**

The brief forbids inventing the win condition. No ability and no victory will be attached.

**Preset rule.** Hermit cannot be seated until the host selects one victory from a future approved list. Shippable presets omit Hermit.

**Candidate list for a later decision, none of them active.** Survive until game end. Never be the target of a night action. Never receive a day vote. Outlast N nights. These are placeholders, not rules.

### OD-12 Immortal charge

**Decided 12 November 2026: accepted as recommended.**

**Recommendation.**

- One charge per game.
- The charge is evaluated after protection, redirect, heals, and poison.
- If any lethal would kill the Immortal that night or that day vote, the charge cancels every lethal from that single resolution step and is consumed.
- Two different nights require two charges, so the second death kills.
- Doctor or Guard saving the Immortal does not consume the charge, because the death was already negated.
- The charge cannot be recharged, copied into a second charge, or stacked with a second Immortal ability.
- Faction is configuration, default Village.

"One resolution step" is the recommended reading of a single survival charge. A stricter alternative is one lethal source only. Recorded as an alternative, not the default.

### OD-13 Avenger

**Decided 12 November 2026: accepted as recommended.** Revenge fires against a named killer and the day-vote plurality leader, never against the anonymous pack kill.

**Recommendation.**

- The revenge target is the primary cause recorded on the elimination.
- Night wolf kill: the voters are not individually guilty, because Infection wolves may have disagreed. Primary cause is the final-target selection source. If the host chose among submissions, revenge targets the host-selected final target's contributing wolves is ambiguous. Narrower rule: revenge cannot fire against a wolf kill while wolves are anonymous. It fires against a named killer ability (Sniper, Poisoner, Assassin execute, Lone Wolf kill) and against the day-vote plurality leader.
- If the plurality is a tie, no single responsible player exists, revenge is spent, and nobody dies.
- Timing: the following night, automatic, no choice, and it respects protection and Immortal.
- If the Avenger is infected before revenge resolves, revenge is revoked with the role.
- Multiple contributors beyond the cases above remain unresolved. The engine records every contributor on `EliminationRecord.causes` so a later rule can use them.

### OD-14 Bodyguard

**Decided 12 November 2026: accepted as recommended.**

**Recommendation.**

- One protection selection per night.
- If the selected other player would take a wolf kill, the Bodyguard dies instead and the target lives.
- The Bodyguard cannot select themselves.
- Charges default to unlimited nights and are configurable.
- If the Bodyguard is also protected or Immortal, that protection is applied to the redirected death.
- If the original attack was already cancelled by Guard or Doctor, the Bodyguard does not die and the nightly use is still consumed because the action was taken.
- Poison is not redirected unless `bodyguard.redirectsPoison` is set. Default false.

### OD-15 Trapper

**Decided 12 November 2026: accepted as recommended.**

**Recommendation.**

- Place a trap on one living player per night, two successful traps per game.
- The trap triggers if at least one wolf-kill action targets that player.
- Trigger reveals the attacking players' identities to the Trapper and the host only.
- The trap cancels those wolf-kill contributions against that player.
- The trap is consumed on trigger.
- It does not stop infection, poison, or a day vote.
- It does not announce publicly.

### OD-16 Blacksmith variants

**Decided 12 November 2026: accepted as recommended.** Variant B (`ITEM`).

Do not merge.

| Variant | Rule |
|---|---|
| A `AURA` | A reusable nightly protection, close to Guard |
| B `ITEM` | A one-time shield granted to a player |

**Recommendation for presets.** Variant B. One shield per game. It blocks wolf kill only. It is consumed when it blocks, and also consumed if the holder dies before it blocks. It does not block infection or poison.

**Catalog note, 9 November 2026 (WW-202).** Variant A is encoded as profile `blacksmith_aura` with status UNRESOLVED and no abilities. "Close to Guard" does not say who may be protected, whether self is allowed, or whether a repeat target is banned, so it cannot be seated until those are chosen.

### OD-17 Priest

**Decided 12 November 2026: kept out of version 1.**

The brief says the exact power must be configured and must not be assumed. No ability is defined.

Priest is in the catalog with `implementationStatus: UNRESOLVED` and zero abilities. Presets omit Priest. A custom game that enables Priest without a selected approved ability fails validation.

### OD-18 Confuser

**Decided 12 November 2026: kept out of version 1.**

The brief says the transformation mechanic is unresolved. No swap, scramble, or copy behavior is defined.

Confuser is catalogued and disabled. Enabling it fails validation until a future ability definition exists.

### OD-19 Spy information

**Decided 12 November 2026: accepted as recommended.**

The brief requires an explicit information grant and forbids full wolf identities by default.

**Recommendation.** One night action. Result is the integer count of legal wolf-kill submissions that night, with no names, no targets, and no Alpha identity. Anything richer requires a new decision. The API returns that integer to the Spy and the host only.

### OD-20 Bard

**Decided 12 November 2026: kept out of version 1.**

In a digital game the day discussion is already available to every living player. The tabletop power "let selected players speak" has no effect unless discussion is closed.

**Recommendation.** Bard ships with no mechanical power and is omitted from presets. A later decision can choose a real digital power. The engine must not open an out-of-game channel.

### OD-21 Oracle

**Decided 12 November 2026: accepted as recommended.**

**Recommendation, kept distinct from Seeker.** Once every two nights, the Oracle learns the target's role category: `WOLF`, `VILLAGE_POWER`, `VILLAGE_BASIC`, `NEUTRAL`, or `INDEPENDENT`. The Oracle does not learn the role id or wolf teammates. "Future event" remains an unused information mode until defined.

### OD-22 Seer

**Decided 12 November 2026: accepted as recommended.**

Kept distinct from Seeker and Detective.

**Recommendation.** Every other night the Seer learns the target's current role id at 100 percent accuracy. Presets should prefer Detective or Seeker when a softer result is wanted. Accuracy below 100 percent is a config field defaulting to 100, because a lie table was not specified.

### OD-23 Detective

**Decided 12 November 2026: accepted as recommended.**

**Recommendation.** Separate role. Learns Wolf or Non-Wolf. Two uses per game. Does not learn the role id. This matches the brief's "may have two investigations."

### OD-24 Psychic comparison key

**Decided 12 November 2026: accepted as recommended.**

**Recommendation.** Compare `currentFaction`. Two neutrals both read as the same faction even when their roles differ. The result is `SAME` or `DIFFERENT` plus nothing else. Alternative, not adopted: compare role ids.

### OD-25 Medium

**Decided 12 November 2026: accepted as recommended.**

**Recommendation.** Once per night the Medium learns the current role id at death of one dead player. No conversation channel with the dead. The host also sees the lookup because the host already knows roles.

### OD-26 Prophet

**Decided 12 November 2026: accepted as recommended.**

**Recommendation.** Every three nights the Prophet may ask one whitelisted question. The only shipped question is `WOLF_PACK_SIZE_AT_LEAST` with a configured integer. The answer is yes or no from server state. Free-text questions are rejected so a Prophet cannot ask for names.

### OD-27 Tracker detail

**Decided 12 November 2026: accepted as recommended.**

**Recommendation.** The Tracker learns the list of player ids their target selected that night. Action types stay hidden, so an infection and a kill look the same. Empty list if the target took no targeted action or was blocked. Multiple visits are all returned. Results go to the Tracker and the host.

### OD-28 Poison versus protection

**Decided 12 November 2026: accepted as recommended.**

**Recommendation.**

- Guard, Shieldbearer, and Blacksmith do not block poison.
- Doctor wolf-kill save does not cure poison.
- Witch save potion does not cure poison. It only cancels a wolf kill on the chosen player.
- A heal ability can cure poison only when that ability's `cancels` list includes `POISON`.
- Default poison delay: the victim dies at the end of the following day's vote resolution if still alive, so there is one full day of information. Alternative: die at the next dawn. Preset default is end of the next day resolution.

### OD-29 Sniper

**Decided 12 November 2026: accepted as recommended.** How the protection clause is applied, since protections are placed at night and the shot is fired by day: a Guard, Doctor, or Shieldbearer protection that resolved on the target the night before covers that player through the following day, because those abilities now list `SNIPER` in `cancels`. A Doctor's save on the final wolf target covers that player. The Blacksmith's shield item does not stop the shot yet: it stays with its holder across nights, and a day check of held items is not built. An Immortal survives the shot. The shot is spent when it is fired, even when it is stopped. It resolves when day discussion closes, before voting opens, and only in games that seat a role with a day kill. A Sniper death does not win a Jester. Built in WW-1003b.

**Recommendation.** One shot per game. The Sniper fires during the day discussion, before voting opens. The shot is a Village-attributed kill. Guard, Doctor, Immortal, and shields can prevent it using the same protection pipeline as a special kill of type `SNIPER`. The host sees the action. The server validates the target. Killing a villager is legal.

### OD-30 Disruptor

**Decided 12 November 2026: accepted as recommended.**

**Recommendation.** Once per game in presets, configurable. The Disruptor names one living player. Every special ability that player submitted that night is cancelled before resolution. Villager votes are not abilities and are not blocked. Infection submitted by a blocked Alpha is cancelled. The blocked player is not told why, unless `informTarget` is set. Default false.

### OD-31 Shapeshifter

**Decided 12 November 2026: accepted as recommended.**

**Recommendation.**

- The Shapeshifter copies one target's active abilities for the next night only, or for two nights when configured. Preset: one night, starting next night.
- Copied abilities use a fresh charge pool equal to the definition default, not the victim's remaining charges.
- The victim keeps their own abilities.
- Copy cannot target a Shapeshifter, a copied stand-in, Alpha infection, or another copy chain.
- The Shapeshifter's faction does not change.
- Permanent role theft exists only if `permanentSteal` is true. Default false.
- Same-night copy is rejected because it creates recursive resolution.

### OD-32 Healer Assistant

**Decided 12 November 2026: accepted as recommended.**

**Recommendation.**

- While the Doctor is alive, the Assistant has no heal action.
- When the Doctor dies or is converted, the Assistant inherits the Doctor ability configuration, including informed versus blind and the remaining charge count.
- Unlimited Infection Doctor produces an unlimited Assistant.
- A limited Doctor's unused charges transfer. They are not reset to full and not duplicated.
- If the Doctor is alive again through an effect that does not exist in the current catalog, inheritance ends. No current role resurrects the Doctor, so this is defensive.

### OD-33 Elder penalty

**Decided 12 November 2026: accepted as recommended.**

**Recommendation.** The Elder has vote weight 2 while alive. If wolves kill the Elder at night, the next day each Village-faction vote has weight 1 and one extra phantom weight of 1 is applied against the Village plurality after tally, which can create a tie. The modifier expires after that day. Infecting the Elder removes the weight immediately and does not apply the death penalty, because infection is not a wolf kill death.

This penalty is a concrete recommendation for an underspecified "voting disadvantage."

### OD-34 Mayor

**Decided 12 November 2026: accepted as recommended.**

**Recommendation.** Vote weight 2 from game start. The weight applies while the Mayor's identity is still secret. `publicLeader` defaults false. If true, the public player list shows the Mayor label and no other role. Weight is configurable and validation rejects a weight that can unilaterally exceed half the living seats at game start.

### OD-35 Classic wolves knowing each other

**Decided 12 November 2026: accepted as recommended.**

The anonymity rule is confirmed for Alpha and Infected Wolves only.

**Recommendation.** Classic Pack Wolves learn the other Pack Wolves at role reveal. They do not learn a Lone Wolf. Infection Edition does not seat Pack Wolves.

### OD-36 Pack Wolf as a role

**Decided 12 November 2026: accepted as recommended.**

Classic mode needs a basic wolf. The numbered list has Alpha and Infected Wolf, which carry infection rules.

**Recommendation.** Add `pack_wolf` as a catalog role required by Classic mode. It submits a wolf kill and has no infection power. This is an engine role, not a claim that the missing images named it.

### OD-37 Friendly fire outside Infection Edition

**Decided 12 November 2026: accepted as recommended.**

**Recommendation.** Off in Classic and Expanded presets. On in Infection Edition because that case is confirmed. Lone Wolf can target anyone, including pack wolves, because the Lone Wolf is not on the pack team.

### OD-38 Investigation snapshot

**Decided 12 November 2026: accepted as recommended.**

**Recommendation.** Wolf / Non-Wolf, category, role id, and Psychic comparisons use the state at the start of the night, before conversions and deaths. The Tracker uses the action list from that same night.

### OD-39 Death reveal

**Decided 12 November 2026: accepted as built.**

**Recommendation.** Day-vote eliminations reveal the current role. Night deaths reveal the current role. Original role stays host-only until game end. Configuration can set night reveal to hidden. Infection Edition default: reveal current role on death.

### OD-40 Tie votes

**Decided 12 November 2026: accepted as built.**

**Recommendation.** One revote between the tied players only. Abstention allowed on the revote. A second tie eliminates nobody. Hosts do not break ties in the default rules.

### OD-41 Abstention and vote changes

**Decided 12 November 2026: accepted as built.**

**Recommendation.** Abstention is allowed and counts as no weight. A living player may replace their vote until the ballot closes. The last legal vote counts. Earlier votes remain in the audit log as superseded.

### OD-42 Dead voting and disconnected voting

**Decided 12 November 2026: accepted as built.**

**Recommendation.** Dead players cannot vote or act. A disconnected living player may vote if they reconnect before close. Their earlier vote stands if they do not. No proxy votes.

### OD-43 Phase pacing

**Decided 9 November 2026: host-paced Infection Edition**, as recommended. Classic timers as listed.

**Recommendation.** Infection Edition is host-paced. The host closes night submission, confirms the kill target, closes the Doctor window, and opens voting. Optional timers exist and default off. Classic presets default to night 90 seconds, day discussion 180 seconds, voting 60 seconds, and auto-advance with missing actions treated as no action.

### OD-44 Public infection announcement

**Decided 9 November 2026: `SILENT`**, as recommended.

**Recommendation.** `SILENT`. The converted player and the host learn the new role. No public event says that an infection happened. Public death text never includes "infected" unless the config is changed to `PUBLIC`.

### OD-45 Does the infected player learn the Alpha's identity

**Decided 12 November 2026: accepted as built.**

**Recommendation.** No. The private event says the player's own role changed to Infected Wolf.

### OD-46 Wolf submissions visible to other wolves

**Decided 12 November 2026: accepted as recommended.**

**Derived from C-07 and recommended as an API rule.** A wolf does not receive other wolves' targets, names, or submission counts. The host does. The Spy's recommended result is a count with no names, which is a deliberate exception for that role only.

### OD-47 Guard self-protection and Alpha self-infection

**Decided 12 November 2026: accepted as built.**

**Recommendation.** Guard may protect themselves, still subject to the consecutive-night rule. Alpha cannot infect themselves. A wolf cannot be infected. Witch and Doctor may target themselves, and Doctor self-save is confirmed.

### OD-48 Multiple protections

**Decided 12 November 2026: accepted as recommended.**

**Recommendation.** Any single successful wolf-kill protection negates the kill. Every protector who spent an action consumes their nightly use or item, including redundant protectors.

### OD-49 Witch potions on one target

**Decided 12 November 2026: accepted as built.**

**Confirmed that both potions can be used the same night.** Recommendation: they may name the same player or two players. Save cancels a wolf kill, a Vampire kill, or a Sniper shot on that player (widened 13 November 2026). Poison schedules poison. Using both on the same player can cancel the wolf kill and still poison them.

### OD-50 Individual and team wins together

**Decided 12 November 2026: accepted as built.**

**Recommendation.** Evaluate individual triggers first and record them. Then evaluate team terminal conditions. If any team terminal condition is met, the game ends and recorded individual winners are kept. If only non-terminal individual wins fired, the game continues. Draws are a separate end state.

### OD-51 Only neutrals or independents left

**Decided 12 November 2026: accepted as built.**

**Recommendation.** If no Village and no Wolf Pack remain, evaluate individual rules. If exactly one individual winner qualifies, the game ends with that winner. If several qualify, the game ends with all of them. If none qualify, the game is a draw.

### OD-52 Draw

**Decided 12 November 2026: accepted as built.**

**Recommendation.** The host may cancel. Cancellation is `CANCELLED`, not a victory. A configured round cap defaults to 20. Reaching it with no terminal victory is a draw. The cap is a safety rail, not a lore rule.

### OD-53 Host disconnect

**Decided 12 November 2026: accepted as built.**

**Recommendation.** The seat remains host. Socket loss does not transfer power. The host token reconnects and receives a snapshot. Another player cannot become host unless the host calls a transfer action. If the host is absent longer than a configured lobby timeout, any seated player may call a unanimous surrender that cancels the game. Unanimous means every currently connected living player.

### OD-54 Host adjudication

**Decided 12 November 2026: accepted as built.**

**Recommendation.** The host cannot type a winner, edit a role, or delete a vote. The host can pace phases, confirm a kill target only from legal submissions, and cancel the game. `allowHostAdjudication` defaults false and is rejected by the production validator if true.

### OD-55 Reconnect after a submitted action

**Decided 12 November 2026: accepted as built.**

**Recommendation.** The action remains. Reconnect restores state. The player may replace a replaceable action until the window closes.

### OD-56 Duplicate and concurrent resolution

**Decided 12 November 2026: accepted as built.**

**Recommendation.** One database transaction locks the game row, requires the expected `stateVersion`, and writes one `resolution_run` per round. A second resolver receives a conflict and publishes nothing.

### OD-57 Server restart mid-phase

**Decided 12 November 2026: accepted as built.**

**Recommendation.** All authoritative state is in PostgreSQL. On boot, timed phases whose deadline has passed auto-advance in Classic. Host-paced games stay in the current phase and wait for the host. Clients reload by player token and event cursor.

### OD-58 Copy and infection interaction

**Decided 12 November 2026: accepted as recommended.**

**Recommendation.** A copied ability is revoked when the Shapeshifter is infected. Infection cannot be copied. A copy of a Doctor does not create a second informed veto in Infection Edition unless the copied ability id is `doctor_save` and the config explicitly allows `copyInformedDoctor`. Default false, because two unlimited vetoes make night kills impossible.

### OD-59 Role registry source of truth

**Decided 12 November 2026: accepted as built.**

**Recommendation.** Definitions live in code in the domain package, versioned by a catalog hash stored on the game snapshot. Database rows store ids and per-game overrides, not a second editable copy of the global catalog. This avoids a plugin platform.

### OD-60 Technology choice

The repository has no application stack. This choice is blocking for Phase 1 and is a planning recommendation, not a discovered architecture.

**Recommendation.** TypeScript modular monolith: React + Vite client, NestJS HTTP and Socket.IO adapter, pure domain package, PostgreSQL, Drizzle, pnpm workspaces. Rationale and alternatives are in [implementation-plan.md](./implementation-plan.md).

**Accepted, 9 November 2026 (WW-101).** Phase 1 was built on the recommendation. Versions resolved at that time: Node 22.12 or later, pnpm 10, TypeScript 7, NestJS 12, Drizzle ORM 0.45 with drizzle-kit 0.31, PostgreSQL 17 in Compose, React 19, React Router 8, Vite 8, MUI 9, Tailwind 4, Zod 4, Vitest 5. Browser-environment unit tests use happy-dom, because current jsdom does not support the Node 23 line. Replacing the stack now means replacing the Phase 1 skeleton only.

**Confirmed again, 9 November 2026.** The agent workflow brief listed ASP.NET Core, Entity Framework Core, and SignalR. The product owner chose to keep the TypeScript stack, because Phases 1 and 2 and the shared rules package are built on it. Redux Toolkit is added for client state. See `docs/AI-WORKFLOW.md`.

### OD-61 Missing reference images and Pack 2 arithmetic

**Decided 12 November 2026: accepted as built.** No 21-seat Pack 2 preset ships; the reconstruction stays marked as one.

The brief says the expanded reference image disagrees with itself on village counts, and the images were not available here.

**Do not ship** a 5 + 13 + 3 preset. That sum is 21.

**Do not treat** "wolf team 5" plus "up to 4 infected" as 5 starting wolves and 4 further infections. The infection cap is 5 including Alpha.

The validated reconstruction is Pack 2A in [role-configuration.md](./role-configuration.md). It is labeled a reconstruction.

### OD-62 Art

**Decided 12 November 2026: accepted as built.** Role and avatar art now exists under `art/`; missing art falls back to a monogram.

No role art exists in the repository. The reveal screen should reserve an image slot and render a monogram until art is provided. Art is not a rules blocker.

### OD-63 Accounts and multi-accounting

**Decided 12 November 2026: accepted as built.** Guest seats only in version 1; one person can hold several seats.

**Recommendation.** Version 1 uses guest seat tokens. One human with several browsers can hold several seats. Full prevention needs accounts, and accounts are out of scope for the first Infection ship. Document the limitation in the host UI. Rate-limit room creation and joins.

### OD-64 Spectator and mid-game join

**Decided 12 November 2026: accepted as built.**

**Recommendation.** No spectators and no joins after start in version 1. Seat count must equal the configured player count before start.

### OD-65 Kick and rejoin

**Decided 12 November 2026: accepted as built.**

**Recommendation.** Before start, the host may remove a seat and that person may rejoin if the room is open. After start, a seat cannot be replaced by a new person. The same token can reconnect.

### OD-66 Display names

**Decided 12 November 2026: accepted as built.**

**Recommendation.** Unique among seats in a game, 2 to 24 characters, trimmed, no control characters.

### OD-67 Minimum and maximum players

**Decided 12 November 2026: accepted as built.**

| Mode | Minimum | Maximum | Default |
|---|---:|---:|---:|
| Infection Edition | 20 | 20 | 20 |
| Classic | 6 | 20 | 10 |
| Expanded | 10 | 30 | 20 |
| Custom | 6 | 30 | unset |

Infection Edition's fixed 20 is confirmed. Other bounds are recommendations.

### OD-68 Day vote after a night victory

**Decided 12 November 2026: accepted as built.**

**Recommendation.** If night resolution already ended the game, day and voting do not open.

### OD-69 Elder and Mayor both seated

**Decided 12 November 2026: accepted as built.**

**Recommendation.** Weights multiply from a base of 1 by summing modifiers, they do not multiply by each other. An Elder who is not the Mayor has weight 2. Validation warns if any single weight is 3 or more.

### OD-70 Assistant and Doctor both resolving a save

**Decided 12 November 2026: accepted as built.**

Covered by OD-32. Both cannot hold an active heal in the same resolution.

### OD-71 Mobile packaging

**Decided 9 November 2026: Capacitor wrapping the shared web client**, as recommended.

**Question.** How should the web client become an installable Android app?

**Recommendation.** Capacitor wraps the same React + Vite client. That client is the shared desktop and landscape layout plus the portrait reflow. `vite build` produces the web assets. `cap sync` copies them into `apps/web/android`. Gradle builds a sideload debug APK. Release builds use a keystore that is not committed. The only Android permission is `INTERNET`. The API origin is a build-time setting. Debug may allow cleartext HTTP on the LAN. Release uses HTTPS. Tokens use Capacitor Preferences in the APK and `sessionStorage` on the web. The activity allows portrait and landscape.

**Rejected alternative.** A separate React Native client. It would duplicate every screen and diverge from the web app. An orientation lock is also rejected. Portrait players keep the stacked reflow.

**Why this is recorded.** Packaging the web client is part of the product, not a later rewrite. Google Play listing stays out of scope until a later decision.

**Depends on.** Shared-layout flows in Phase 12 (`WW-1204`) and a reachable API.

### OD-72 In-app text chat

**Decided 9 November 2026: real server-side chat in version 1.** This replaces the recommendation below, which is kept for history. The composer becomes a live control, backed by a message contract in the API.

**Chat rules decided 11 November 2026.** These unblock WW-1104 and WW-1206.

| Rule | Decision |
|---|---|
| When chat is open | Living players post during day discussion and voting only. Chat is closed at night and on the reveal screen. |
| Dead players | Read only. They see the public chat and cannot post. There is no dead channel. |
| Wolf channel | None, in any mode, in version 1. Infection Edition hides pack mates, and a channel would break that. |
| Host moderation | The host can delete a message and mute a seat. A muted seat cannot post. |
| Limits | 280 characters per message (422 when longer). 5 messages per 10 seconds per seat (429 when exceeded). |
| Retention | Messages are deleted when the game finishes or is cancelled. |
| Storage | A separate chat table, not `game_events`. |
| Recap | The results recap does not show chat. |
| Bard | OD-20 still stands: Bard gains no side channel through chat. |

**Question.** Should the discussion rail send free-text messages?

**Recommendation.** No in version 1. The rail is part of `GameLayout` and renders the public event feed. The composer drawn in the mockups is a disabled slot with the hint that people talk at the table. Connecting it needs a message contract, moderation, and a rule for dead players. Those are not in the current API. OD-20 still stands: Bard does not gain a side channel through this slot.

**Rejected alternative.** A client-only chat that stores lines in the browser and presents them as game events. Other seats would not see them, and the feed would mix local notes with server facts.

**Why this is recorded.** The mockup grids include a composer. The layout reserves that row so a later contract does not reshape the shell.

**Depends on.** A future API decision. It does not block WW-1204.

---

### OD-85 Public vote tally

**Decided 12 November 2026: counts per target, published when each ballot closes.** After a ballot closes, every seat sees the weighted total for each player who received votes, the number of abstentions, who was eliminated, and any tie. Who voted for whom is never published; the host sees ballots on the dashboard. Counts are not shown while a ballot is open. The results recap lists each ballot's counts the same way. Built in WW-904.

**Options considered.** Counts after close (chosen), fully open ballots, hidden counts, live counts during voting.

---

### OD-73 Victory for Neutral roles without an individual win

**Question.** Shapeshifter defaults to Neutral, and Poisoner, Disruptor, Immortal, and Avenger may be configured as Neutral. None of them has an individual victory, and Neutral is not a team. The validator rejects a Neutral or Independent seat with no victory (`NEUTRAL_VICTORY_MISSING`), and the Chaos pack seats a Neutral Shapeshifter.

**Options.**

1. Give each such role an individual victory, for example survive to the end of the game.
2. Allow these roles only in Village or Wolf Pack factions, and change the Chaos pack's Shapeshifter to one of those.
3. Let a Neutral role without a victory be seated as a role that cannot win, with an explicit host acknowledgement.

**Decided 11 November 2026: option 1.** A role seated as Neutral or Independent that has no individual victory of its own wins if it is alive when the game ends. It wins alongside the winning team and does not end the game itself. This applies to Shapeshifter, Poisoner, Disruptor, Immortal, and Avenger when they are configured as Neutral or Independent.

**Implemented (11 November 2026, OD-73-impl).** `victoryForSeat` turns a team victory into a survive win for a Neutral or Independent seat. The validator no longer rejects those seats. `chaos-15` is a recommended pack. Unresolved roles stay unseatable. WW-902 records the win when the victory checker is built.

---

### OD-74 Whether the night windows depend on who is alive

**Decided 12 November 2026: option 1, fixed by the configuration**, as recommended. This is how WW-503 already behaves, so no code changes.

**Question.** The host-confirm and Doctor-reaction windows exist only when the configuration needs them (OD-01, OD-02). Once a game is running, should a window still open when nobody can use it, for example after the informed Doctor has died or been infected?

**Options.**

1. Fixed by the configuration. The reaction window opens every night when a seated role has a `NIGHT_REACTION` ability, whether or not that player can still act. A Doctor who cannot act counts as a decline, and the host closes the window. Host confirm follows `killAggregation` the same way.
2. Live. The reaction window opens only while an informed Doctor is alive and able to act, as the earlier lifecycle diagrams drew it.

**Why it matters.** Every seat sees the phase. Under option 2 the table sees the reaction window disappear the night the Doctor is infected. Infection is silent (OD-44), so option 2 would make it public. With `revealOnNightDeath: HIDDEN` it would also reveal which dead player was the Doctor. Option 1 is how a narrator at a real table handles it: they still call the dead Doctor.

**Cost of option 1.** One extra host click each night after the Doctor is gone. Timed games are not slowed, because the reaction window has no timer in any game.

**Recommendation.** Option 1. Adopted as the engineering default in WW-503 on 11 November 2026, pending product-owner confirmation. Switching to option 2 changes only `nightWindows` in `packages/domain/src/phase/machine.ts`.

---

### OD-75 Joker's win ending the game

**Decided 12 November 2026: accepted as built.** The Joker's win is recorded and the game continues.

Ultimate 20 records a Joker win on a day elimination and does not end the game while both teams remain. Whether that win should end the game is open. See ultimate-20-rules.md.

### OD-76 Mind Controller's win

**Decided 12 November 2026: accepted as built.** The Mind Controller wins if alive at game end, alongside the winning team (as OD-73).

The images name the Chaos team and give no win card. This is unresolved. The engine stores alive at game end, and that default is not an image rule.

### OD-77 Chaos event pool

**Decided 12 November 2026: accepted as built.** Shuffled deck: all six effects come up once, in random order, before any repeats.

The images list six effects: nobody votes the next day, protections do not work that night, two players' votes are swapped, nobody kills that night, one player gets double vote weight, and one player's ability is disabled. The images do not say how the draw is chosen. The engine draws those six uniformly, without replacement, and resets the pool after all six. A success is counted only when the effect changes the game.

### OD-78 Infection and the original power

**Decided 12 November 2026: accepted as built.** Each converted role keeps or loses its power by its `lostOnInfection` flag.

Ultimate infection follows each role's `lostOnInfection` flag. Double Agent becomes an infected wolf. Whether every converted role should keep its power is open.

### OD-79 Vampire servant abilities

**Decided 12 November 2026: accepted as built.** A Servant follows the same flag and joins the Vampire team's kill-or-mark choice.

The guide does not say whether a Servant keeps the original ability. The engine still revokes abilities lost on infection and copied abilities, keeps any ability with `lostOnInfection: false`, and does not grant a wolf kill. It also grants the shared team kill and team mark, because the guide says the team chooses one of those. That grant is the team action, not a ruling on the original power.

### OD-80 Necromancer limits

**Decided 12 November 2026: accepted as built.** The same player may be returned twice; a returned player can be attacked again.

The engine allows the same player to be returned twice and leaves a returned player attackable. They cannot vote or use abilities. The image does not say.

### OD-81 Time Wizard's target

**Decided 12 November 2026: accepted as built.** The blind rewind: every action the target submitted tonight is removed, before blocks resolve.

The engine removes every action one player submitted tonight, before blocks resolve. The transcript said one action from the previous night, after the result. The decided behavior is the blind rewind.

### OD-82 Guardian and poison

**Decided 12 November 2026: accepted as built.**

The engine stops a wolf kill only. Poison is not stopped.

### OD-83 Chaos Demon's final five

**Decided 12 November 2026: accepted as built.**

The engine checks on every victory evaluation. Once three successful events have happened with the demon alive among five or fewer players, the flag stays achieved.

### OD-84 Team wins and individual records

**Decided 12 November 2026: accepted as built.**

A village or wolf win ends the game and keeps individual records that were already achieved.

---

## Approval checklist

The product owner can unblock Infection Edition by accepting or replacing the items below. Status as of 9 November 2026:

| ID | Recommended value for Infection Edition |
|---|---|
| OD-01 | Host selects the final kill target from legal wolf submissions. **Accepted** |
| OD-02 | Informed Doctor veto, unlimited charges. **Accepted** |
| OD-03 | Infection sticks only if the target survives the night. **Accepted** |
| OD-04 | Success counter increments only on a surviving convert. **Accepted** |
| OD-43 | Host-paced phases. **Accepted** |
| OD-44 | Silent infection. **Accepted** |
| OD-60 | TypeScript modular monolith. **Accepted** (WW-101) |
| OD-71 | Capacitor APK wrapping the shared web client, orientation unlocked. **Accepted** |
| OD-73 | A Neutral or Independent role with no individual victory wins if alive at game end, alongside the winning team. **Accepted and implemented** (11 November 2026) |
| OD-72 | ~~Discussion rail shows the public event feed. The composer stays disabled~~ Replaced: real server-side chat in version 1. Chat rules **Accepted** (11 November 2026), see OD-72 |
| OD-74 | Night windows are fixed by the configuration, not by who is alive, so silent infection stays silent. **Accepted** (12 November 2026). Built in WW-503 |
| OD-85 | Vote counts per target are public after each ballot closes; who voted for whom is not. **Accepted** (12 November 2026) |
| OD-29 | Sniper: one day shot, before voting; a protection from the night before, or an Immortal, stops it. **Accepted** (12 November 2026) |
| OD-05 to OD-10, OD-12 to OD-16 | Infection targets, Cursed Villager, same-night conversion, Jester, Assassin (mark), Lone Wolf, Immortal, Avenger, Bodyguard, Trapper, Blacksmith (item). **Accepted as recommended** (12 November 2026) |
| OD-19, OD-21 to OD-28 | Spy, Oracle, Seer, Detective, Psychic, Medium, Prophet, Tracker, poison versus protection. **Accepted as recommended** (12 November 2026) |
| OD-30 to OD-34 | Disruptor, Shapeshifter, Healer Assistant, Elder penalty, Mayor. **Accepted as recommended** (12 November 2026) |
| OD-35 to OD-38, OD-46, OD-48, OD-58 | Classic Pack Wolves see each other; Pack Wolf role; no friendly fire outside Infection Edition; investigations read the start-of-night state; wolves never see each other's submissions; redundant protectors all spend; copying and infection. **Accepted as recommended** (12 November 2026) |
| OD-11, OD-17, OD-18, OD-20 | Hermit, Priest, Confuser, Bard: no mechanic. **Kept out of every preset** until a real power is decided (12 November 2026) |
| OD-39 to OD-42, OD-45, OD-47, OD-49 to OD-57, OD-59, OD-61 to OD-70 | General rules: death reveal, ties, abstention, dead and disconnected voting, infection privacy, self-targeting, Witch potions, combined wins, neutrals-only and draw endings, host powers and disconnects, reconnects, concurrent resolution, restarts, catalog source, Pack 2 arithmetic, art, guest seats, no spectators, kick and rejoin, names, player counts, no day after a night victory, vote-weight sums. **Accepted as built** (12 November 2026) |
| OD-75 to OD-84 | Ultimate 20: Joker win continues the game, Mind Controller alive at end, shuffled Chaos deck, conversions follow `lostOnInfection`, Necromancer may return a player twice, blind Time Wizard rewind, Guardian stops wolf kills only, Chaos Demon final five, team wins keep individual records. **Accepted as built** (12 November 2026) |

Expanded, Chaos, Investigation, and Protection presets additionally need the recommended role defaults in OD-06 through OD-34 accepted or replaced. Hermit, Confuser, Priest, and Bard stay out of those presets until their UNRESOLVED entries gain a real mechanic.
