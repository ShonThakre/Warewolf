# Game Rules

This document separates rules the brief states outright, defaults this plan recommends, and mechanics that are still undefined.

Authority: the server applies these rules. The host paces Infection Edition and can see secret state. The host cannot invent a result outside the configured rules unless a future adjudication flag is turned on. That flag is recommended to stay off (OD-54).

Cross-references: [open-decisions.md](./open-decisions.md), [role-catalog.md](./role-catalog.md), [role-configuration.md](./role-configuration.md), [night-resolution.md](./night-resolution.md).

---

## 1. Shared structure

Every mode uses the same lifecycle.

1. A host creates a room and receives a room code.
2. Players join until the configured seat count is full.
3. The host selects a mode, a role pack, and any allowed overrides.
4. The server validates the configuration.
5. The host starts the game. The server assigns roles and stores them.
6. Each player privately sees their own role. The host sees every role.
7. The game alternates night and day until a terminal victory, a draw, or a cancellation.
8. Individual non-terminal wins are recorded without ending the game.

### Teams are not roles

| Concept | Meaning |
|---|---|
| Role | The ability package, such as Seeker or Jester |
| Original role | The role dealt at start. Never overwritten |
| Current role | The role used for actions now. Changes on conversion |
| Faction | Village, Wolf Pack, Neutral, or Independent |
| Alignment report | The coarse Wolf or Non-Wolf fact some roles learn |

A Jester is Neutral. A Lone Wolf is Independent and wolf-aligned. A Cursed Villager starts Village and can become an Infected Wolf. An Assassin defaults to Neutral and may be configured into another faction only where the catalog allows.

### Living counts

Victory and parity use living players only. Dead seats do not vote, act, or count.

Wolf Pack parity, under the recommended rule: living `WOLF_PACK` compared with all other living players.

Village clearance, under the recommended rule: no living wolf-aligned player remains. That includes the pack, Infected Wolves, and a Lone Wolf.

---

## 2. Infection Edition

Status: default mode. Player count and starting roles are confirmed. A few resolution details are blocking and listed at the end of this section.

### Setup

| Role | Seats | Faction |
|---|---:|---|
| Alpha Wolf | 1 | Wolf Pack |
| Seeker | 2 | Village |
| Guard | 1 | Village |
| Doctor | 1 | Village |
| Witch | 1 | Village |
| Normal Villager | 14 | Village |
| Total | 20 | |

Infected Wolf is not dealt. It appears only through conversion. Maximum successful infections: 4. Maximum Wolf Pack size: 5 including the Alpha.

### Night, confirmed pieces

- The Alpha may infect one eligible living non-wolf per night.
- Infection replaces the target's current role with Infected Wolf and removes the old abilities.
- Infection does not kill the target by itself.
- The converted player can submit a wolf kill starting the next night.
- Converted players and the Alpha do not learn each other's identities.
- Every living wolf may submit one kill target.
- Friendly fire is on, so a wolf may submit another wolf.
- The Guard may protect one player and may not repeat the same player on consecutive nights. Protection stops a wolf kill and does not stop infection.
- The Seeker may investigate one living player and may later publish their own result.
- The Witch may use a save, a poison, both, or neither. Each potion exists once per game.
- The Doctor may save the final wolf-kill target, including themselves, with unlimited uses in this mode.
- If the Alpha is dead, no new infection can succeed. Earlier conversions remain.

### Day, confirmed pieces

Living players discuss and vote. The Village wins when all wolves are eliminated. The Wolf Pack wins when living wolves are at least as numerous as living non-wolves.

### Recommended operating rules for this mode

These are not extra lore. They are the defaults the engine should use if OD approvals match the plan.

| Topic | Default |
|---|---|
| Pacing | Host closes each window. Timers off |
| Kill aggregation | Host picks the final target from names the wolves actually submitted |
| Doctor | Told the final target privately, then chooses save or decline |
| Same-night kill and infection | The player dies as the original role and is not converted. The success counter does not increase |
| Infection news | The converted player and the host learn it. The room does not |
| Death reveal | Current role is shown. Original role waits until the recap |
| Ties | One revote among the tied players, then no elimination |
| Wolf screens | No wolf names, no allied targets, no allied submission state |
| Doctor profile | `doctor_infection` only. Limited Doctor is not mixed in |
| Pack Wolf, neutrals, expanded roles | Not seated |

### Worked victory examples

Start: 1 wolf and 19 villagers.

After 4 successful infections and no deaths: 5 wolves and 15 villagers. Wolves are not yet winning, because 5 is less than 15.

Wolves win at 5 living wolves only when non-wolves alive are 5 or fewer. They can also win at 4 wolves when non-wolves are 4 or fewer, and so on, including 1 wolf and 1 non-wolf.

Village wins at 0 living wolves, even if many villagers are dead.

If the Alpha dies before any infection, the pack size stays 1 and infection never starts. The remaining wolf can still kill and vote.

### Balance consequence that must stay visible

If the informed unlimited Doctor is approved, that Doctor can refuse every wolf kill while alive and unblocked. Wolves then advance by infection, by the day vote, and by night kills only after the Doctor is converted, voted out, or blocked. This is a direct consequence of the brief's Doctor bullets. It should be playtested, not quietly replaced with a blind Doctor.

### Blocking items inside an otherwise confirmed mode

| Item | Document |
|---|---|
| How several wolf submissions become one final target | OD-01 |
| Whether the Doctor is told the target before the save | OD-02 |
| Infection of a player who dies the same night | OD-03 |
| When the success counter increments | OD-04 |

---

## 3. Classic mode

Status: recommended preset family for beginners. Not the default game.

### Intent

A short game with a wolf pack, villagers, and optional investigation or protection. No infection. No neutral win conditions.

### Recommended 10-player setup

| Role | Seats |
|---|---:|
| Pack Wolf | 2 |
| Seeker | 1 |
| Doctor | 1 |
| Normal Villager | 6 |

Optional swap: remove one villager and add a Guard.

### Recommended rules that differ from Infection Edition

| Topic | Classic default |
|---|---|
| Wolves know fellow Pack Wolves | Yes |
| Friendly fire | Off |
| Infection | Off |
| Doctor | Blind nightly save, unlimited, configurable down |
| Kill aggregation | Majority of pack submissions. Tie means no kill |
| Pacing | Timers on, host can still end a window early |
| Neutrals | None |
| Win | Village clears all wolf-aligned players. Pack wins on parity |

A 15-player Classic suggestion is in [role-configuration.md](./role-configuration.md).

---

## 4. Expanded mode

Status: advanced preset family. Several seated roles use recommended powers from the catalog.

Expanded games may enable infection or leave it off. They may seat neutral roles with individual victories. The host picks a pack and can disable optional roles only when the remaining counts still sum to the player total.

Pack 2A is the validated 20-player reconstruction. It is not a transcription of the missing image. The image's reported 5 / 12–13 / 3 split is arithmetically inconsistent if 13 is used, and it conflicts with a 5-wolf infection cap if those 5 wolves are starting seats plus 4 later infections. See OD-61.

## 5. Ultimate 20

Ultimate 20 is a selectable, engine-complete mode: 20 seats, 15 special roles, and 5 Villagers. The rules, the lock, and the open questions are in [ultimate-20-rules.md](./ultimate-20-rules.md). Creating a room and dealing the roster work. Night resolution of the new steps is in the domain. Phase close already tallies the day and evaluates victory. It does not yet draw a chaos event, and it does not yet pass revival or chaos success into that evaluation. The new night fields (rewinds, silences, revivals, hints) are not stored. Infection Edition does not change.

Individual wins follow OD-08 and OD-50. A Jester win does not by itself finish the game. A Neutral or Independent seat whose catalog victory is the team victory wins by being alive at the end, beside the winning team, and that win does not end the game (OD-73).

---

## 6. Custom mode

The host sets counts, factions, ability limits, infection, voting, protection interactions, and victory flags. The validator must accept the configuration before start. Custom mode uses the same engine and the same role objects as the presets.

A custom game cannot:

- Seat more roles than players, or fewer.
- Seat Infected Wolves at the start.
- Seat Hermit, Confuser, Priest, or Bard until those roles have an approved mechanic.
- Seat a neutral whose victory object is empty.
- Raise the wolf cap above the mode maximum without an explicit override acknowledgement.
- Combine `doctor_infection` unlimited charges with a limited-charge flag on the same ability.
- Start with two active Doctor heals, including an Assistant who already inherited one.
- Enable infection without an Alpha.
- Set a vote weight that can alone pass half the seats.

The full constraint list is in [role-configuration.md](./role-configuration.md).

---

## 7. Phase rules

### Lobby

The host is the creating seat. Room codes are unguessable enough for a party game and are revocable by cancelling the room. The configured headcount must be joined before start. Late join is closed after start (OD-64).

### Role reveal

The server sends one private role payload per player. It contains current role, faction, ability text, charges, and whether teammates are visible. In Infection Edition the teammate list is empty for everyone. In Classic it contains Pack Wolves for Pack Wolves.

### Night submission

Only abilities whose timing includes the current window, whose status is active, whose charges remain, and whose `availableFromRound` has been reached are accepted. Dead players are rejected. Each ability accepts one pending action per round, replaceable until the window closes.

Players with no night ability see a waiting state.

### Host confirm and Doctor reaction

These windows exist only when the active configuration needs them. Infection Edition needs both if OD-01 and OD-02 are accepted as recommended. Classic majority resolution skips host confirm. Classic blind Doctor skips the reaction window.

### Day

The public feed receives the night's public facts: who died, which current roles are revealed, and any result a Seeker chose to publish. It does not receive investigations, infection, wolf submissions, or unused protections.

Living players discuss. Configured day abilities, such as the Sniper shot or a Seeker publication, close before voting opens.

### Voting

Each living player has their configured weight, default 1. Mayor and Elder change weight. Dead players have weight 0. Abstention is allowed. Votes can be replaced until close. The highest weight sum is eliminated. Ties follow OD-40.

### Game end

| End | When |
|---|---|
| Village victory | No living wolf-aligned player |
| Wolf Pack victory | Living pack members are at least the count of other living players |
| Individual victory | That role's rule fired. Terminal only when its own flag says so |
| Multiple winners | Team end plus any individual wins already recorded, when multiple winners are allowed |
| Draw | Round cap, or a terminal position where nobody qualifies |
| Cancelled | Host cancel, or the unanimous surrender rule if the host is gone |

The results screen shows original roles, final roles, infections, eliminations, and ability use. That full disclosure happens only after the game is over.

---

## 8. Voting detail

| Rule | Default |
|---|---|
| One ballot per living player | Yes, replaceable until close |
| Weight | Sum of modifiers, not a product of Elder and Mayor |
| Tie | One revote, then no death |
| Abstain | Legal |
| Dead vote | Illegal |
| Reveal after day elimination | Current role |
| Vote while game already won | Ballot does not open |

Elder death penalty and Mayor publicity are recommended rules in OD-33 and OD-34.

---

## 9. Victory detail

### Village

All opposing wolves are eliminated. Recommended implementation: no living player has wolf alignment. A living Lone Wolf blocks Village victory. A living Jester does not.

### Wolf Pack

Living pack wolves `>=` living everyone else. Lone Wolf and neutrals count on the "everyone else" side. Infection Edition has neither, so the confirmed sentence and this implementation match on the default preset.

### Jester

Day-vote elimination of the current Jester. Night death fails the condition. Infection removes the condition because the role is gone.

### Assassin

Variant A: the marked player is later eliminated. Variant B: not active.

### Lone Wolf

Default: sole survivor. A pack parity win can occur while the Lone Wolf is alive, because the Lone Wolf counts as a non-pack living player. That ends the game on the team rule before the Lone Wolf's sole-survivor rule can become true, if the pack is large enough. If the pack is wiped and the Lone Wolf later becomes sole survivor, the Lone Wolf wins and the Village does not.

### Hermit

No rule. The role cannot be played.

### Evaluation order

1. Apply deaths and conversions.
2. Record individual victories whose triggers just became true.
3. Revoke individual victories whose roles were lost.
4. Evaluate Village and Wolf Pack.
5. If a terminal team condition is true, end and keep recorded individual winners.
6. If the living set has no Village and no Wolf Pack, end with any qualifying individuals, or draw if none qualify.
7. Otherwise continue.

Conflicting team conditions should not both be true. Zero wolves and a pack that outnumbers the village cannot happen together. Tests should assert that invariant.

---

## 9. Information privacy

| Fact | Who may know it during play |
|---|---|
| Own current role and abilities | That player, host |
| Own original role | That player, host |
| Full roster | Host |
| Wolf identity of teammates | Classic Pack Wolves only, and the host. Infection wolves do not |
| Investigation result | The investigator and the host, unless a reveal action publishes it |
| Final kill target before resolution | Host and, in informed Doctor mode, the Doctor |
| Individual wolf submissions | The submitting wolf and the host |
| Infection success | The converted player and the host |
| Vote in progress | Each voter sees their own vote. The host sees all. The room sees the tally after close |
| Game recap | Everyone after terminal end |

Private facts must not appear in public errors, public sockets, or another player's state payload.

---

## 10. Edge-case behavior

Expected behavior for the cases the brief requires. "Decision" means a product-owner choice is still open. Tests named here are specified further in [testing-plan.md](./testing-plan.md).

### Infection

| Case | Expected behavior | Owner | Decision |
|---|---|---|---|
| Alpha dies before any infection | Infection sealed at 0 | Infection handler | Confirmed |
| Alpha dies after infections | Seal further attempts. Current wolves stay | Infection handler | Confirmed |
| Cap of 4 reached | Further infect actions rejected | Validator | Confirmed |
| Cap of 5 wolves reached | Conversion rejected even if successes remain | Validator | Confirmed |
| Target already a wolf | Reject, allow a replacement submission | Action validator | Confirmed |
| Target dead | Reject | Action validator | Confirmed |
| Target also killed | No conversion if OD-03 option 1 | Resolver | OD-03 |
| Target protected by Guard | Infection still applied if the target lives | Resolver | Confirmed |
| Power role infected | Abilities revoked after this night's already submitted actions resolve | Resolver | OD-07 recommended |
| Multiple conversions in one night | Alpha produces at most one. Cursed conversion is separate and both must respect the cap. Apply Alpha first, then Cursed, each checking the cap | Resolver | Recommended |

### Abilities

| Case | Expected behavior | Owner | Decision |
|---|---|---|---|
| Disruptor blocks a player | That player's special actions are cancelled before they affect resolution | Block handler | OD-30 |
| Two copies of one ability | Shapeshifter copy cannot chain. A player cannot hold two native rows of the same ability id | Copy handler | OD-31 |
| Same ability submitted twice | Second request replaces the pending row or returns conflict if the window is locked | Action service | Recommended |
| Actor dies before resolution | Submitted actions still resolve | Resolver | Recommended |
| Disconnect after submit | Action remains, token reconnects | Lobby and state | OD-55 |
| Role lost the same night | Old action resolves, then the role changes | Resolver | OD-07 |
| Copied charges | Copy has its own fresh charges | Copy handler | OD-31 |
| Conversion would break faction | Resulting faction must be in `allowedFactions` or the conversion fails | Validator | Recommended |

### Protection

| Case | Expected behavior | Owner | Decision |
|---|---|---|---|
| Several protections on one player | One is enough to stop a wolf kill. Each spent action is consumed | Resolver | OD-48 |
| Poison versus Guard | Poison is not stopped | Resolver | OD-28 |
| Wolf kill versus Guard | Kill is stopped. Infection is not | Resolver | Confirmed for Guard |
| Bodyguard redirect | Target lives, Bodyguard receives the lethal, then Bodyguard's own protection or Immortal may save the Bodyguard | Resolver | OD-14 |
| Trapper and several wolves | All contributing attackers are reported privately. Trap consumed once | Trapper handler | OD-15 |
| Immortal | One resolution step can be survived. Charge cannot return | Immortal handler | OD-12 |
| Several attacks on one player | Each attack type resolves by the pipeline. Immortal clears the remaining lethals of that step if the charge remains | Resolver | OD-12 |

### Neutrals

| Case | Expected behavior | Owner | Decision |
|---|---|---|---|
| Jester voted while Village is close to winning | Record Jester. Continue unless the elimination also causes a team end | Victory service | OD-08 |
| Assassin mark dies on a team-win night | Record both if multiple winners are allowed | Victory service | OD-50 |
| Lone Wolf sole survivor | Lone Wolf win. Village does not win | Victory service | OD-10 |
| Several individual wins | Keep all of them | Victory service | OD-50 |
| Neutral or Independent seat with a team victory | Record a win if that player is alive when the game ends. Do not end the game for it | Victory service | OD-73 |
| Individual rule conflicts with team rule | Team terminal condition ends the game and keeps non-revoked individual records | Victory service | OD-50 |

### Voting

| Case | Expected behavior | Owner | Decision |
|---|---|---|---|
| Tie | Revote once, then no elimination | Voting service | OD-40 |
| Second tie | No elimination | Voting service | OD-40 |
| Mayor or Elder weight | Add weight into the tally | Vote modifier | OD-33, OD-34 |
| Dead player votes | Reject | Voting service | Recommended |
| Disconnect during vote | Last stored vote stands | Voting service | OD-42 |
| Vote changed | Last legal vote counts. History kept | Voting service | OD-41 |
| Vote after victory | Phase does not open | Phase service | OD-68 |

### Reliability

| Case | Expected behavior | Owner | Decision |
|---|---|---|---|
| Host socket drops | Host seat and powers remain | Lobby | OD-53 |
| Server restart | State reloads from the database. Timed modes catch up. Host-paced modes wait | Phase service | OD-57 |
| Duplicate action request | Idempotency key returns the original result | Action service | Recommended |
| Two resolvers at once | One transaction wins the version lock | Resolution service | OD-56 |
| Database failure during resolve | Transaction rolls back. Phase unchanged | Resolution service | Recommended |
| Socket failure | Client reconnects with the event cursor | Realtime adapter | Recommended |

---

## 11. What players are told

Infection Edition public night script, when the recommended silence rules are used:

- "No one died." or "This player was eliminated. Their role was Seeker."
- A Seeker publication, only after that Seeker spends the reveal action.
- Never "a villager was infected."
- Never the Guard's target.
- Never the Doctor's decision, except the observable absence of a death.

The converted player receives a private role update. The Doctor receives the final target only in the reaction window.
