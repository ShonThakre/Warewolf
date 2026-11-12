import type { CSSProperties } from 'react';
import type { DayTally } from '@warewolf/contracts';
import { tallyTotal } from '../state/tallies';
import { abstentionLine, tallyResult, tallyTitle } from './tallyCopy';
import './table-screen.css';

/**
 * One closed ballot. Bar widths use the ballot's own total as the scale.
 * Names are display names passed in by the screen.
 */
export function VoteTally({ tally, nameOf }: { readonly tally: DayTally; readonly nameOf: (playerId: string) => string }) {
  const scale = Math.max(tallyTotal(tally), 1);
  const abstained = abstentionLine(tally.abstentions);
  return (
    <section className="ww-tally" aria-label={tallyTitle(tally)}>
      <h2 className="ww-tally-title">{tallyTitle(tally)}</h2>
      <p className="ww-tally-result">{tallyResult(tally, nameOf)}</p>
      <ul className="ww-tally-counts">
        {tally.counts.map((count) => (
          <li key={count.targetPlayerId}>
            <span className="ww-tally-name">{nameOf(count.targetPlayerId)}</span>
            <span className="ww-tally-track" aria-hidden="true">
              <span className="ww-tally-fill" style={{ '--tally': `${Math.round((count.total / scale) * 100)}%` } as CSSProperties} />
            </span>
            <span className="ww-tally-total">{count.total}</span>
          </li>
        ))}
      </ul>
      {abstained ? <p className="ww-tally-note">{abstained}</p> : null}
    </section>
  );
}
