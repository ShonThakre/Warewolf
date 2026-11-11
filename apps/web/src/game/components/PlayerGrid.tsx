import type { GameState, TargetRuleDto } from '@warewolf/contracts';
import { Button } from '@mui/material';
import { lifeLabel } from './phaseCopy';
import { PlayerAvatar } from './PlayerAvatar';
import { seatSelectable } from './actionCopy';

type Seat = GameState['players'][number];

/**
 * Public seats. A PLAYERS rule turns legal seats into toggle buttons.
 * Dead seats stay visible and are not selectable when the rule asks for the living.
 */
export function PlayerGrid({
  players,
  youId,
  rule,
  selected,
  onToggle,
}: {
  readonly players: readonly Seat[];
  readonly youId: string;
  readonly rule: TargetRuleDto | null;
  readonly selected: readonly string[];
  readonly onToggle: (playerId: string) => void;
}) {
  const picking = rule?.kind === 'PLAYERS';
  const count = picking ? rule.count : 0;
  const capped = picking && count > 1 && selected.length >= count;

  return (
    <ul className="ww-seats" aria-label={picking ? (count === 2 ? 'Choose two players' : 'Choose a player') : 'Players'}>
      {players.map((player) => {
        const legal = picking && seatSelectable(player, youId, rule);
        const pressed = selected.includes(player.playerId);
        const enabled = legal && (pressed || !capped);
        return (
          <li key={player.playerId} className="ww-seat" data-life={player.lifeStatus}>
            <Button className="ww-target" variant="outlined" aria-pressed={pressed} disabled={!enabled} onClick={() => onToggle(player.playerId)}>
              <PlayerAvatar name={player.displayName} avatarId={player.avatarId} dead={player.lifeStatus === 'DEAD'} />
              <span className="ww-seat-name">{player.displayName}</span>
              <span className="ww-seat-life" data-life={player.lifeStatus}>
                {lifeLabel(player.lifeStatus)}
              </span>
              {player.isHost ? <span className="ww-seat-tag">Host</span> : null}
              {player.playerId === youId ? <span className="ww-seat-tag">You</span> : null}
            </Button>
          </li>
        );
      })}
    </ul>
  );
}
