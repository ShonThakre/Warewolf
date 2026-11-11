import { FACTIONS, type GameMode, type TeamSummary, type ValidationIssue } from '@warewolf/domain';
import { FACTION_CLASS, teamWord } from '../components/lobbyCopy';

export interface ConfigSummaryProps {
  mode: GameMode;
  summary: TeamSummary;
  /** Full sentences under the counts. A short viewport keeps the counts only. */
  detail: boolean;
  errors: readonly ValidationIssue[];
  warnings: readonly ValidationIssue[];
}

/** Counts stay on screen. Errors name the validator code in the sentence. */
export function ConfigSummary({ mode, summary, detail, errors, warnings }: ConfigSummaryProps) {
  return (
    <div className="ww-setup-summary">
      <p className="ww-setup-counts" aria-label="Setup counts">
        <span>Seats {summary.selectedSeats}</span>
        <span>Players {summary.playerCount}</span>
        {FACTIONS.map((faction) => (
          <span key={faction} className={FACTION_CLASS[faction]}>
            {teamWord(mode, faction)} {summary.factions[faction] ?? 0}
          </span>
        ))}
        <span>Remaining {summary.remainingSeats}</span>
        <span>Wolf cap {summary.wolfCap}</span>
        <span>Infection cap {summary.infectionSuccesses ?? 'off'}</span>
        {errors.length > 0 ? <span>Problems {errors.length}</span> : null}
        {warnings.length > 0 ? <span>Warnings {warnings.length}</span> : null}
      </p>
      {detail && (errors.length > 0 || warnings.length > 0) ? (
        <ul className="ww-setup-detail">
          {errors.map((issue, index) => (
            <li key={`error-${issue.code}-${index}`} className="ww-setup-issue ww-setup-issue-error">
              {issue.message} ({issue.code})
            </li>
          ))}
          {warnings.map((issue, index) => (
            <li key={`warning-${issue.code}-${index}`} className="ww-setup-issue">
              {issue.message} ({issue.code})
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
