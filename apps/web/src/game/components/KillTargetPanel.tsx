import type { KillTargetView } from '@warewolf/contracts';
import { Button } from '@mui/material';
import { PlayerAvatar } from './PlayerAvatar';
import { killPickOf, namedByLine, playerName, type KillPick } from './killCopy';

type Named = { readonly playerId: string; readonly displayName: string; readonly avatarId?: number | null };

/**
 * The host's legal kill choices (WW-803b). Guests never receive this view.
 * "Named by" uses display names and stays in this panel, not the discussion rail.
 * On the host dashboard, No kill sits in the same card row as the candidates.
 */
export function KillTargetPanel({
  players,
  view,
  pick,
  onPick,
  includeNoKill = false,
}: {
  readonly players: readonly Named[];
  readonly view: KillTargetView;
  readonly pick: KillPick | null;
  readonly onPick: (pick: KillPick) => void;
  /** Host dashboard: No kill is a card in the picker. Table keeps No kill in the action row. */
  readonly includeNoKill?: boolean;
}) {
  const showing = pick ?? killPickOf(view.decision);
  const title = includeNoKill ? (view.editable ? 'Choose a kill target' : 'Kill target') : view.editable ? 'Choose the attack' : 'The attack';
  const hint = includeNoKill
    ? 'Select one eligible living player for the werewolves to kill, or choose No kill if allowed.'
    : null;

  return (
    <section className="ww-kill-panel" aria-label="Kill target">
      <h2 className="ww-kill-title">{title}</h2>
      {hint ? <p className="ww-host-panel-hint">{hint}</p> : null}
      {view.candidates.length === 0 ? <p className="ww-action-copy">Nobody was named. You can still choose no kill.</p> : null}
      <ul className="ww-kill-candidates">
        {includeNoKill ? (
          <li>
            <Button
              variant="outlined"
              aria-pressed={showing?.kind === 'NO_KILL'}
              aria-label="No kill"
              disabled={!view.editable}
              onClick={() => onPick({ kind: 'NO_KILL' })}
            >
              <span className="ww-kill-radio" aria-hidden="true" />
              <span className="ww-kill-copy">
                <span className="ww-kill-name">No kill</span>
              </span>
            </Button>
          </li>
        ) : null}
        {view.candidates.map((candidate) => {
          const name = playerName(players, candidate.playerId) ?? 'A player';
          const named = namedByLine(players, candidate.submittedBy);
          const avatarId = players.find((player) => player.playerId === candidate.playerId)?.avatarId ?? null;
          const pressed = showing?.kind === 'TARGET' && showing.playerId === candidate.playerId;
          return (
            <li key={candidate.playerId}>
              <Button
                variant="outlined"
                aria-pressed={pressed}
                aria-label={`Target ${name}`}
                disabled={!view.editable}
                onClick={() => onPick({ kind: 'TARGET', playerId: candidate.playerId })}
              >
                {includeNoKill ? <span className="ww-kill-radio" aria-hidden="true" /> : null}
                {includeNoKill ? <PlayerAvatar name={name} avatarId={avatarId} /> : null}
                <span className="ww-kill-copy">
                  <span className="ww-kill-name">{name}</span>
                  {named ? <span className="ww-kill-named">{named}</span> : null}
                </span>
              </Button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
