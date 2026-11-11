import type { LobbyProjection } from '@warewolf/contracts';
import { FACTIONS } from '@warewolf/domain';
import { FACTION_CLASS, FACTION_LABEL } from './lobbyCopy';

type Summary = LobbyProjection['configuration']['summary'];

export interface PackSummaryProps {
  summary: Summary;
  packName: string;
  modeLabel: string;
  /** `strip` is the one-line count row. `card` is the rail summary. */
  layout: 'strip' | 'card';
  warningCount?: number;
  errorCount?: number;
}

export function PackSummary({ summary, packName, modeLabel, layout, warningCount = 0, errorCount = 0 }: PackSummaryProps) {
  const factions = FACTIONS.map((faction) => ({
    faction,
    label: FACTION_LABEL[faction],
    count: summary.factions[faction] ?? 0,
  }));

  if (layout === 'strip') {
    return (
      <p className="ww-pack-strip">
        {factions.map((entry) => (
          <span key={entry.faction} className={FACTION_CLASS[entry.faction]}>
            {entry.label} {entry.count}
          </span>
        ))}
      </p>
    );
  }

  return (
    <div className="ww-pack">
      <p className="ww-pack-name">{packName}</p>
      <p className="ww-pack-mode">{modeLabel}</p>
      <ul className="ww-factions">
        {factions.map((entry) => (
          <li key={entry.faction} className={FACTION_CLASS[entry.faction]}>
            {entry.label} {entry.count}
          </li>
        ))}
      </ul>
      <p className="ww-pack-meta">Wolf cap {summary.wolfCap}</p>
      <p className="ww-pack-meta">Starting wolf pack {summary.startingPack}</p>
      {summary.infectionSuccesses != null ? <p className="ww-pack-meta">Infection limit {summary.infectionSuccesses}</p> : null}
      {summary.remainingSeats > 0 ? <p className="ww-pack-meta">Unassigned seats {summary.remainingSeats}</p> : null}
      {errorCount > 0 ? <p className="ww-pack-meta">Setup problems {errorCount}</p> : null}
      {warningCount > 0 ? <p className="ww-pack-meta">Warnings {warningCount}</p> : null}
    </div>
  );
}
