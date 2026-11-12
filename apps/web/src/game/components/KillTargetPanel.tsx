import type { KillTargetView } from '@warewolf/contracts';
import { Button } from '@mui/material';
import { killPickOf, namedByLine, playerName, type KillPick } from './killCopy';

type Named = { readonly playerId: string; readonly displayName: string };

/**
 * The host's legal kill choices (WW-803b). Guests never receive this view.
 * "Named by" uses display names and stays in this panel, not the discussion rail.
 */
export function KillTargetPanel({
  players,
  view,
  pick,
  onPick,
}: {
  readonly players: readonly Named[];
  readonly view: KillTargetView;
  readonly pick: KillPick | null;
  readonly onPick: (pick: KillPick) => void;
}) {
  const showing = pick ?? killPickOf(view.decision);

  return (
    <section className="ww-kill-panel" aria-label="Kill target">
      <h2 className="ww-kill-title">{view.editable ? 'Choose the attack' : 'The attack'}</h2>
      {view.candidates.length === 0 ? <p className="ww-action-copy">Nobody was named. You can still choose no kill.</p> : null}
      <ul className="ww-kill-candidates">
        {view.candidates.map((candidate) => {
          const name = playerName(players, candidate.playerId) ?? 'A player';
          const named = namedByLine(players, candidate.submittedBy);
          const pressed = showing?.kind === 'TARGET' && showing.playerId === candidate.playerId;
          return (
            <li key={candidate.playerId}>
              <Button variant="outlined" aria-pressed={pressed} aria-label={`Target ${name}`} disabled={!view.editable} onClick={() => onPick({ kind: 'TARGET', playerId: candidate.playerId })}>
                <span className="ww-kill-name">{name}</span>
                {named ? <span className="ww-kill-named">{named}</span> : null}
              </Button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
