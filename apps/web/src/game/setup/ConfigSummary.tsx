import type { ReactNode } from 'react';
import { FACTIONS, type GameMode, type TeamSummary, type ValidationIssue } from '@warewolf/domain';
import { uiArtUrl } from '../../assets/art';
import { explainIssue, FACTION_CLASS, teamWord } from '../components/lobbyCopy';

export interface ConfigSummaryProps {
  mode: GameMode;
  summary: TeamSummary;
  /** Full sentences under the counts. A short viewport keeps the status line only. */
  detail: boolean;
  errors: readonly ValidationIssue[];
  warnings: readonly ValidationIssue[];
}

/** Live configuration counts. Problems are sentences the host can act on. */
export function ConfigSummary({ mode, summary, detail, errors, warnings }: ConfigSummaryProps) {
  const parchment = uiArtUrl('parchment');
  const ready = errors.length === 0 && warnings.length === 0;
  const tone = errors.length > 0 ? 'problem' : warnings.length > 0 ? 'waiting' : 'ready';
  const title = errors.length > 0 ? 'Needs changes' : warnings.length > 0 ? 'Warnings to acknowledge' : 'Configuration valid';
  const firstError = errors[0];
  const line = firstError
    ? explainIssue(firstError)
    : warnings.length > 0
      ? `${warnings.length} ${warnings.length === 1 ? 'warning needs' : 'warnings need'} acknowledgement before start.`
      : summary.remainingSeats === 0
        ? 'Every role seat is filled.'
        : `${summary.remainingSeats} role ${summary.remainingSeats === 1 ? 'seat is' : 'seats are'} still open.`;

  return (
    <div className="ww-setup-summary">
      {parchment ? <img className="ww-setup-parchment" src={parchment} alt="" /> : null}
      <div className="ww-setup-summary-body">
        <h2 className="ww-setup-summary-title">Current configuration</h2>
        <div className="ww-setup-stats" aria-label="Setup counts">
          <Stat label="Seats" value={summary.playerCount} icon={<PeopleMark />} />
          {FACTIONS.map((faction) => (
            <Stat
              key={faction}
              className={FACTION_CLASS[faction]}
              label={`${teamWord(mode, faction)} roles`}
              value={summary.factions[faction] ?? 0}
              icon={<DotMark />}
            />
          ))}
          <Stat label="Remaining seats" value={summary.remainingSeats} icon={<ChairMark />} />
          <Stat label="Wolf cap" value={summary.wolfCap} />
          <Stat label="Infection cap" value={summary.infectionSuccesses ?? 'off'} />
        </div>
        <div className="ww-setup-valid" data-tone={tone} role="status">
          <span className="ww-setup-valid-mark" aria-hidden="true">
            {ready ? '✓' : '!'}
          </span>
          <span>
            <strong>{title}</strong>
            <span className="ww-setup-valid-line">{line}</span>
          </span>
        </div>
        {detail && (errors.length > 0 || warnings.length > 0) ? (
          <ul className="ww-setup-detail">
            {errors.map((issue, index) => (
              <li key={`error-${issue.code}-${index}`} className="ww-setup-issue ww-setup-issue-error">
                {explainIssue(issue)}
              </li>
            ))}
            {warnings.map((issue, index) => (
              <li key={`warning-${issue.code}-${index}`} className="ww-setup-issue">
                {explainIssue(issue)}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}

function Stat({ label, value, icon, className }: { label: string; value: number | string; icon?: ReactNode; className?: string }) {
  return (
    <p className={className ? `ww-setup-stat ${className}` : 'ww-setup-stat'}>
      <span className="ww-setup-stat-name">
        {icon}
        {label}
      </span>
      <span className="ww-setup-stat-value">{value}</span>
    </p>
  );
}

function PeopleMark() {
  return (
    <svg className="ww-setup-stat-icon" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="9" cy="8" r="2.4" fill="currentColor" />
      <circle cx="16" cy="9" r="1.9" fill="currentColor" />
      <path d="M3.8 18.2c.7-2.6 2.7-3.8 5.2-3.8s4.5 1.2 5.2 3.8M14.6 14.6c1.5.2 2.9 1.1 3.6 2.8" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function DotMark() {
  return (
    <svg className="ww-setup-stat-icon" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="4" fill="currentColor" />
    </svg>
  );
}

function ChairMark() {
  return (
    <svg className="ww-setup-stat-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 10.5V7.2A1.7 1.7 0 0 1 8.7 5.5h6.6A1.7 1.7 0 0 1 17 7.2v3.3M6 10.5h12v3H6zM8.2 13.5V19M15.8 13.5V19" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
