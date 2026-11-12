# Infection Edition simulation, 10,000 games per policy

WW-1402, run 12 November 2026. Preset `infection-core` (20 seats, one Alpha Wolf, infection cap 4), with the accepted Doctor rule from OD-02: informed veto, unlimited saves. Seed 1 for every run. The raw reports are the JSON files in this folder.

**These are bot measurements, not human win rates.** The bots know nothing a seat would not know, and they choose at random. Use the numbers to compare rule changes against each other, not to predict a real table.

## Results

| Policy | Village wins | Pack wins | Draws | Mean rounds | Doctor negated | Games at 4 infections |
|---|---|---|---|---|---|---|
| `random-legal` | 3,722 (37.2%) | 6,274 (62.7%) | 4 | 10.4 | 28.5% of wolf attacks | 6,982 (69.8%) |
| `infection-priority` | 3,761 (37.6%) | 6,238 (62.4%) | 1 | 10.2 | 28.7% | 6,930 (69.3%) |
| `vote-random` | 8,707 (87.1%) | 503 (5.0%) | 790 | 11.0 | 0% (no night actions) | 0 |
| `saving-doctor` | 3,922 (39.2%) | 5,852 (58.5%) | 226 | 12.1 | 62.4% | 7,451 (74.5%) |

Every game finished in all four runs. No individual wins were recorded; this preset seats no role that has one.

Reproduce one row: `pnpm --filter @warewolf/domain simulate -- --games 10000 --seed 1 --policy random-legal --out report.json`.

## What the policies are

- `random-legal`: each open ability picks uniformly among its legal targets or a skip. Votes pick a living seat or abstain.
- `infection-priority`: the same night choices; votes never abstain.
- `vote-random`: no night actions at all; every seat votes for a random living seat. A baseline for the day vote alone.
- `saving-doctor`: `random-legal`, except that an informed Doctor always spends the save on the target it is told. Added 12 November 2026 to measure OD-02 directly.

## Reading it

1. **The pack wins about 62% of random games.** With random choices, infection is the strongest tool on the table. The Alpha reaches the cap of 4 successful infections in about 70% of games, and the infected seats then kill each night (`infected_kill`, about 15 uses per game).
2. **A Doctor who never declines does not stop the pack (OD-02).** Under `random-legal` the Doctor negated 29% of wolf attacks, because a random Doctor skips half its saves. With `saving-doctor` it negates 62%, night deaths fall from 5.3 to 3.7 per game, and games run two rounds longer. The pack still wins 58.5%, down only about 4 points. The saves cannot stop infection (OD-03) or the day vote, and the Doctor is a village seat: once it is infected or voted out, the saves stop. The Alpha reaches the cap of 4 infections even more often (74.5%), because games last about two rounds longer, which gives it more nights to infect. The OD-02 worry, that night kills stop working, holds only while the Doctor is alive and uninfected; it does not tip the game to the village.
3. **Without night actions the village wins 87%.** Seats survive about half the time in that baseline, and the Alpha survives only 13% of games, so the vote alone favours the larger team. The night is what gives the pack its 62%.
4. **No single role survives much better than another under random play.** Guard, Seeker, Witch, Doctor, and Villager all sit between 27% and 30%, and the Alpha at 30% (`random-legal`). Random bots cannot use what a role knows, so this says nothing about how strong a role is in human hands.

## What this does not measure

- Human information use beyond the saving Doctor: a Seeker who acts on a result, wolves who coordinate.
- Talk, bluffing, and the host's kill choice beyond picking among the pack's submissions.
- Any preset but `infection-core`.
