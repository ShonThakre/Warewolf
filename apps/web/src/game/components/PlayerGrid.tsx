import type { GameState, TargetRuleDto } from '@warewolf/contracts';
import { Button } from '@mui/material';
import { lifeLabel } from './phaseCopy';
import { PlayerAvatar } from './PlayerAvatar';
import { seatSelectable } from './actionCopy';
import { voteLifeLabel, voteSeatLabel } from './voteCopy';

type Seat = GameState['players'][number];

/**
 * Public seats. A PLAYERS rule turns legal seats into toggle buttons.
 * Dead seats stay visible and are not selectable when the rule asks for the living.
 * A chosen seat shows a check and the word "Selected", not only a color.
 * Voting cards use Seat N • Name and Living/Eliminated, with no Host/You tags.
 * Revote shows only the tied seats as horizontal cards.
 */
export function PlayerGrid({
  players,
  youId,
  rule,
  selected,
  onToggle,
  allowedIds = null,
  presentation = 'night',
}: {
  readonly players: readonly Seat[];
  readonly youId: string;
  readonly rule: TargetRuleDto | null;
  readonly selected: readonly string[];
  readonly onToggle: (playerId: string) => void;
  /** Narrows the legal seats further, such as the tied players in a revote. */
  readonly allowedIds?: ReadonlySet<string> | null;
  /** Voting/revote cards match the day ballots. Night keeps the denser target cards. */
  readonly presentation?: 'night' | 'voting' | 'revote';
}) {
  const picking = rule?.kind === 'PLAYERS';
  const count = picking ? rule.count : 0;
  const capped = picking && count > 1 && selected.length >= count;
  const label = picking ? (count === 2 ? 'Choose two players' : 'Choose a player') : 'Players';
  const voting = presentation === 'voting';
  const revote = presentation === 'revote';
  const ballot = voting || revote;
  const shown = revote && allowedIds ? players.filter((player) => allowedIds.has(player.playerId)) : players;

  return (
    <ul
      className={revote ? 'ww-seats ww-revote-seats' : voting ? 'ww-seats ww-vote-seats' : 'ww-seats'}
      aria-label={picking ? `${label}. ${selected.length} of ${count} chosen` : label}
      data-picking={picking}
    >
      {shown.map((player) => {
        const legal = picking && seatSelectable(player, youId, rule) && (allowedIds == null || allowedIds.has(player.playerId));
        const order = selected.indexOf(player.playerId);
        const pressed = order !== -1;
        const enabled = legal && (pressed || !capped);
        return (
          <li key={player.playerId} className="ww-seat" data-life={player.lifeStatus} data-legal={picking ? legal : undefined}>
            <Button className="ww-target" variant="outlined" aria-pressed={pressed} disabled={!enabled} onClick={() => onToggle(player.playerId)}>
              <span className="ww-target-avatar">
                <PlayerAvatar name={player.displayName} avatarId={player.avatarId} dead={player.lifeStatus === 'DEAD'} />
                {pressed ? (
                  <span className="ww-target-check" aria-hidden="true">
                    {count > 1 ? order + 1 : '✓'}
                  </span>
                ) : null}
              </span>
              <span className="ww-seat-copy">
                <span className="ww-seat-name">
                  {ballot ? voteSeatLabel(player.seatNumber, player.displayName, revote ? 'colon' : 'dot') : `${player.seatNumber}. ${player.displayName}`}
                </span>
                <span className="ww-seat-life" data-life={player.lifeStatus}>
                  {ballot ? <span className="ww-seat-life-dot" aria-hidden="true" /> : null}
                  {voting ? voteLifeLabel(player.lifeStatus) : lifeLabel(player.lifeStatus)}
                </span>
              </span>
              {ballot ? null : pressed ? <span className="ww-seat-picked">Selected</span> : null}
              {ballot ? null : player.isHost ? <span className="ww-seat-tag">Host</span> : null}
              {ballot ? null : player.playerId === youId ? <span className="ww-seat-tag is-you">You</span> : null}
            </Button>
          </li>
        );
      })}
    </ul>
  );
}
