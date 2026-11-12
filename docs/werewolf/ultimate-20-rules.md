# Ultimate 20

Selectable 20-seat mode. Infection Edition does not change.

This page separates what the reference images show from choices the engine makes where an image is silent. An unresolved item is not an image rule.

## Shown in the images

### Roster

Exactly 20 players: the 15 special roles below and 5 Villagers.

| Role | Team | Power shown |
|---|---|---|
| Alpha Wolf | Wolves | Each night, choose one player to kill or infect. |
| Shadow Wolf | Wolves | Each night, cancel one player's special ability. |
| Vampire | Vampire | Mark a player, or the team later chooses kill or mark. |
| Joker | Solo | Wins when eliminated by the Village vote. |
| Time Wizard | Village | Once per game, cancels an action from the previous night. |
| Oracle | Village | Each night, learns whether one player is Wolf or Non-Wolf. |
| Guardian | Village | Protects a player from a night attack. Not the same player on consecutive nights. |
| Alchemist | Village | Three one-use potions: heal, poison, or silence for the next day. |
| Fox | Solo | Each night, learns a player's team. Wins if all Wolves are eliminated while the Fox is alive. |
| Mimic | Village | Copies a dead player's special ability once. |
| Ghost | Village | After death, gives one indirect secret hint the next day, without naming a player. |
| Mind Controller | Chaos | Up to twice per game, secretly changes a player's vote target. No win is shown. |
| Necromancer | Solo | Returns one dead player for one night. That player cannot vote or use an ability. Wins after reviving at least one player and surviving to the end. |
| Double Agent | Neutral, initially Village | If infected by the Alpha, changes to the Wolves. |
| Chaos Demon | Chaos | Triggers a random Chaos event each night. Wins after three successful events and while alive when five or fewer players remain. |
| Villager | Village | No special power. Discusses and votes. |

### Victory shown

- Wolves win at parity with the living non-Wolves.
- Village wins when all Wolves are eliminated.
- Joker wins when the Village vote eliminates the Joker. The images do not say whether that ends the game (OD-75).
- Fox wins if every Wolf is eliminated while the Fox is alive.
- Necromancer wins after reviving at least one player and surviving to the end.
- Chaos Demon wins after three successful Chaos events and while alive among the final five.
- Vampire team wins if the Vampire and at least one Servant are alive at game end, or if both Village and Wolves are gone and the Vampire team is still alive.
- Servants share the Vampire team's win.
- Mind Controller has no win card (OD-76).

### Vampire Servant, from the guide image

- The Vampire marks a player at night. Until promotion, the target stays on their original team, does not know they were marked, and plays normally.
- Example: the Vampire marks Player 7 on Night 1. Player 7 is still an ordinary Villager after Night 1. If Player 7 is alive through Night 2, they become a Servant at dawn after Night 2. A death before promotion cancels the mark.
- The host tells that player privately. The promoted player learns the Vampire's identity. The Vampire and the Servants know one another and can coordinate privately.
- After promotion, the player joins the Vampire team. At night the team chooses one target and one action: kill or mark. Not both.
- During the day a Servant may speak, bluff, lie, vote, and cast suspicion like an ordinary Village player. The promotion is not announced.
- The guide does not say whether a Servant keeps their original special ability (OD-79).

### Chaos events shown

1. Nobody can vote the next day.
2. Protection abilities do not work that night.
3. Two random players' votes are swapped.
4. Nobody can kill that night.
5. One random player gets double vote weight.
6. One random player's ability is disabled.

A success counts only when the effect changes the game. The images do not say how the draw is chosen (OD-77).

### Wake-up order shown

1. Chaos Demon.
2. Alpha Wolf.
3. Shadow Wolf.
4. Vampire team: one target, kill or mark.
5. Guardian.
6. Oracle.
7. Alchemist.
8. Fox.
9. Necromancer.
10. Time Wizard.

That list is the host's wake-up order. Resolution order is a separate choice, below.

## What the engine does

The pack id is `ultimate-20`. The host cannot edit the roster or the locked rules. `resolveNight` applies one deterministic order after the window closes: exclusive groups, Time Wizard rewind, blocks, Chaos, the Vampire team's one action, information, attacks, protection, heals, deaths, infection, due marks, copies, silence, revival, and hints. The same actions in another order produce the same result.

- A mark placed on Night N promotes at the end of Night N+1, which is dawn after the next night. Night N itself does not promote. If the Vampire or the target is dead, or the target was converted or is already on the Vampire team or in the wolf pack, the mark expires.
- The Vampire's own kill or mark wins if they submitted one. Otherwise the lowest player id on the team wins. Other team submissions are superseded. One player cannot submit both; the later submission replaces the earlier one.
- Promotion revokes abilities that infection would take, and copied abilities. It does not grant a wolf kill. It grants the Servant's team kill and team mark for the next night. Abilities with `lostOnInfection: false` stay. That is the current OD-79 behavior, not an image rule.
- The promoted player and the other living Vampire-team members receive private events. The host receives the same facts. No public event names the mark or the promotion. `GET /me` lists living teammates only for a Vampire or a Servant. Wolves still do not know each other.
- The faction stored for the Vampire and a Servant is `NEUTRAL`. The enum has no Vampire value. The team is the two roles.
- Chaos is drawn uniformly, without replacement, from the six image events, and the pool resets after all six. The API uses `crypto.randomInt`. A blocked or rewound draw is not remembered and is not a success. A night event that changes nothing is remembered and is not a success. A day event becomes a success only when the ballot actually changes.
- Nobody-votes drops every counted ballot. A swap, a double vote, and a disabled ability name the players the draw picked. Protections-off and no-kills name nobody.
- Guardian stops a wolf kill only (OD-82). The Alchemist's heal also stops poison and the Vampire team's kill. That heal list is an engine choice; the image says "heal a player" and does not list attack types.
- Time Wizard still rewinds every action one player submitted this night, before blocks (OD-81). The image text says "the previous night" and lists the Wizard last in the wake-up order. Undoing an announced death is not specified, so the engine does not do that.
- Mind Controller's stored trigger is still alive at game end (OD-76). That is not an image rule.
- A team win ends the game and keeps individual results that were already achieved (OD-84). The Vampire pair is recorded when the game ends and both are alive, including beside a Village or Wolf win. The wipe path, when Village and Wolves are both gone, ends the game for the Vampire team instead of awarding Village.

## Still unresolved

| ID | Question |
|---|---|
| OD-75 | Does the Joker's recorded win end the game? The engine records it and continues while both teams remain. |
| OD-76 | Mind Controller's win. The images do not give one. The engine uses alive at game end. |
| OD-77 | How the Chaos pool is drawn. The six effects are the image pool. Uniform, without replacement, resetting after six, is the engine's draw. |
| OD-78 | Whether infection keeps the original power. The engine follows each role's `lostOnInfection` flag. Double Agent becomes an infected wolf. |
| OD-79 | Whether a Servant keeps the original ability. The engine revokes abilities lost on infection and copied abilities, keeps the rest, and grants the team kill and mark. It does not grant a wolf kill. |
| OD-80 | Necromancer: the same person twice, and whether a returned player can be attacked. The engine allows a second return and leaves the returned player attackable. They cannot vote or act. |
| OD-81 | Which action Time Wizard removes. The image says one action from the previous night. The engine removes every action one player submitted this night, before blocks. |
| OD-82 | Whether Guardian stops poison or a Vampire kill. The image says "attack" and does not list types. The engine stops wolf kills only. |
| OD-83 | When "final five" is checked. The engine checks on every victory evaluation, and a recorded success stays recorded. |
| OD-84 | A team win against individuals. A team win ends the game and keeps individual records. |

Also open: who may be marked, who sees a Ghost hint, whether a returned player can speak, and what a Servant may say in public beyond the guide's day behavior. There is no second chat channel (OD-72). Private coordination is the teammate list and the shared night choice.
