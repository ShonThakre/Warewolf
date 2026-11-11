# Ultimate 20

Selectable 20-seat mode. Engine-complete on 11 November 2026. Infection Edition does not change.

The sections below the roster are the image transcript. Where this page and that transcript disagree, the decided list and the engineering defaults win. Unresolved items stay open as OD-75 through OD-84.

## Implemented

The catalog seats 15 special roles and 5 Villagers. The pack id is `ultimate-20`. The host cannot edit the roster or the locked rules. Night resolution covers rewind, blocks, chaos, information, protection, heals, infection, vampire marks, copies, silence, revival, and hints. `tallyDay` and `evaluateVictory` run on phase close. The API accepts the new submissions, including a Ghost hint and an exclusive Alpha choice. The close does not yet draw chaos or pass revival and chaos-success counts into the victory evaluator, and it does not store the new night fields.

## Decided 11 November 2026

- The mode is selectable and locked. It does not change Infection Edition.
- Chaos is the six events on the reference image: disable one living player's ability, turn protections off, cancel remaining kills, stop one player voting, swap two players' ballots, and double one player's vote. The five-event list in the transcript below is not the pool.
- Time Wizard rewinds every action one living player submitted tonight, before blocks. It does not wait to see the result, and it does not return the dead.
- Scope stops at the engine. Persisting the new night fields, drawing chaos with a CSPRNG, and calling the tally and the victory evaluator wait for the night and day wiring.

## Engineering defaults

These are labeled defaults. They are in the code. They are not a product-owner ruling.

- Infection is on, silent, and needs 4 successes. The wolf cap is 5. Only village roles can be infected. Survival is required.
- The Alpha's own target is the kill (`ALPHA_PRIORITY`). Wolves do not know each other. Friendly fire is off. Protection does not stop poison.
- The chaos pool resets after all six events have been drawn.
- A Vampire mark fails when the target is in the wolf pack. Servants do not get a teammate list.
- Mind Controller's stored trigger is alive at the end of the game.
- Guardian stops a wolf kill only. A repeat target is refused.
- A team win ends the game and still records individual results that were already achieved.

## Still unresolved

| ID | Question |
|---|---|
| OD-75 | Does the Joker's recorded win end the game? The engine records it and continues while both teams remain. |
| OD-76 | Mind Controller's win. The engine uses alive at game end. |
| OD-77 | Chaos pool contents and the draw. The engine uses the six image events, uniformly, without replacement, resetting after six. |
| OD-78 | Whether infection keeps the original power. The engine follows each role's `lostOnInfection` flag. Double Agent becomes an infected wolf. |
| OD-79 | Whether a Vampire servant keeps abilities. The engine revokes abilities lost on infection and copied abilities, and grants no kill. |
| OD-80 | Necromancer: the same person twice, and whether a returned player can be attacked. The engine allows a second return and leaves the returned player attackable. They cannot vote or act. |
| OD-81 | Which actions Time Wizard removes. The engine removes every action that one player submitted tonight. |
| OD-82 | Whether Guardian stops poison. The engine stops wolf kills only. |
| OD-83 | When "final five" is checked. The engine checks on every victory evaluation, and a success that was already recorded stays recorded. |
| OD-84 | Team win against individuals. A team win ends the game and keeps individual records. |

Also open, and using the same defaults: who may be marked by the Vampire, who sees a Ghost hint, whether the Necromancer's returned player can speak, what happens when the chaos pool is empty, the infection caps, and `knowsTeammates` staying off.

## Starting roster

| Role | Count | Team | Main power |
|---|---:|---|---|
| Alpha Wolf | 1 | Wolves | Each night choose one player to kill or infect. |
| Shadow Wolf | 1 | Wolves | Each night cancel one player's special ability for that night. |
| Vampire | 1 | Solo | Mark a player. After two nights, that player becomes the Vampire's Servant. |
| Joker | 1 | Solo | Wins if eliminated by the Village vote. |
| Time Wizard | 1 | Village | Once per game, cancel one action from the previous night. |
| Oracle | 1 | Village | Each night learn whether one player is Wolf or Non-Wolf. |
| Guardian | 1 | Village | Protect one player from an attack each night; cannot protect the same player on consecutive nights. |
| Alchemist | 1 | Village | Three one-use potions: heal one player, poison one player, or silence one player for the next day. |
| Fox | 1 | Solo | Each night learn a player's team. Wins if all Wolves are eliminated while the Fox is alive. |
| Mimic | 1 | Village | Copy and use a dead player's special ability once. |
| Ghost | 1 | Village | After death, send one secret, indirect hint on the following day; it cannot identify a player by name. |
| Mind Controller | 1 | Chaos | Up to twice per game, secretly change one player's vote target. |
| Necromancer | 1 | Solo | Return one dead player for one night. The returned player cannot vote or use abilities. Wins after reviving at least one player and surviving to the end. |
| Double Agent | 1 | Neutral | Starts on Village. If infected by the Alpha, changes to Wolves. |
| Chaos Demon | 1 | Chaos | Each night trigger a random Chaos event. Wins after three events resolve successfully and while alive among the final five players. |
| Villager | 5 | Village | No special power; discusses and votes. |

Total: 20 players, 15 special roles, and 5 Villagers.

## Teams and shared victory

- **Village:** eliminate every living Wolf.
- **Wolves:** reach parity with the living non-Wolves.
- **Joker:** immediately earns an individual win if eliminated by the Village vote.
- **Vampire:** survive to the end and create at least one Servant.
- **Fox:** survive until every Wolf is eliminated.
- **Necromancer:** revive at least one player and survive to the end.
- **Chaos Demon:** resolve three Chaos events successfully and be alive when five or fewer players remain.
- The image does not show a separate victory condition for the Mind Controller. Proposed default: they share the Chaos team's survival objective, but this needs confirmation.
- Multiple individual wins may be recorded alongside a team win. A Joker win is recorded immediately; whether it ends the whole game is unresolved.

## Night order shown in the image

1. Chaos Demon: resolve one random event.
2. Alpha Wolf: choose kill or infection target.
3. Shadow Wolf: choose a player whose special action to cancel.
4. Vampire: mark a target; conversion becomes due after two nights.
5. Guardian: choose a protection target.
6. Oracle: inspect a target's Wolf/Non-Wolf alignment.
7. Alchemist: use any available potion(s).
8. Fox: inspect a target's team.
9. Necromancer: choose a dead player to return for one night.
10. Time Wizard: optionally cancel one action from the just-resolved night, if its once-per-game power remains.

Night order is the host's wake-up order. Actions resolve together after submissions close, with protection, cancellation, death, infection, and revival applied using the precedence below.

## Resolution defaults for a playable draft

These are explicit design assumptions where the images do not settle implementation details:

- A target may receive at most one lethal result per night; Guardian protection blocks one attack, but not infection, silence, marking, inspection, or vote effects.
- Shadow Wolf cancellation prevents a target's selected special ability from resolving that night. It cannot cancel a passive team victory or a previously completed action.
- If the Alpha chooses infection, the target changes faction to Wolves without dying. Double Agent changes to Wolves on conversion; the other image-listed Village roles converted by this mode also join Wolves but retain their original role's passive information only if the role explicitly says so. (Needs final role-retention rule.)
- A Vampire mark resolves at the end of the second full night after application. If either Vampire or target dies first, it fails. A Servant becomes a Vampire-side player and does not create another Vampire.
- Alchemist potions are each usable once per game. A player may use more than one potion on the same night. Poison is lethal, heal stops one lethal attack, silence prevents public discussion but not a ballot.
- Mimic chooses a dead player and copies one ability that can legally be used at night. It gets one use; it cannot copy a win condition, passive, or another copy.
- A returned player is alive only for the next night window. They cannot submit actions or vote. They return to dead status after that night unless another explicit effect changes it.
- Time Wizard can cancel one submitted action after the host sees the resolved results, but cannot undo a death, infection, or public announcement already revealed. To avoid time paradoxes, cancellation restores the immediate pre-action state of that one action only.
- Chaos events are drawn without replacement from: silence a player for the next day; disable a protection ability for one night; prevent one vote next day; protect one random living player from one attack; swap two players' public identities until day end. An event counts toward the win only if its effect successfully changes game state.
- Night deaths are announced at dawn with current role; private inspections and secret action details remain private.

## Unresolved choices from the images

1. Does Joker's individual win end the game, or does the game continue?
2. What is the Mind Controller's win condition? The image lists the Chaos team but gives no win card for this role.
3. What exact effects are in the Chaos Demon event pool, and are effects selected uniformly?
4. When infection changes a player's faction, do they keep their original power, and can the Alpha infect the Double Agent more than once?
5. Does Vampire conversion preserve the target's original ability? Can Servants act for the Vampire?
6. Can the Necromancer revive the same person twice, and can the returned player be attacked during that night?
7. Can Time Wizard cancel only a hostile action, or any action including a heal, inspection, infection, and Chaos event?
8. Does Guardian block poison as well as Wolf attacks? The image says “attack” but does not enumerate types.
9. Is the image's “final five” condition for Chaos Demon checked immediately after deaths, at day close, or only at game end?
10. Does a Village or Wolf team win override a pending Vampire, Fox, Necromancer, or Chaos Demon objective?

## Difference from the current default

This mode is not the existing Infection Edition preset. Infection Edition starts with one Alpha, two Seekers, Guard, Doctor, Witch, and fourteen Villagers. Its role composition, infection rules, role powers, and team victory conditions remain unchanged by this draft.
