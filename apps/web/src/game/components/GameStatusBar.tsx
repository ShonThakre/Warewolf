import type { GamePhase } from '@warewolf/domain';
import { CountdownTimer } from './CountdownTimer';
import { PHASE_LABEL, phaseGuide, roundLabel } from './phaseCopy';
import './table-screen.css';

export interface GameStatusBarProps {
  readonly phase: GamePhase;
  readonly roundNumber: number;
  /** Whole seconds from `useSecondsLeft`, or null when the host closes the phase. */
  readonly seconds: number | null;
  /** False once the game is finished or cancelled: there is nothing left to wait for. */
  readonly showClock: boolean;
  /** Called once when a deadline reaches 0. */
  readonly onElapsed?: () => void;
}

const NIGHT_PHASES: ReadonlySet<GamePhase> = new Set(['NIGHT_SUBMIT', 'NIGHT_HOST_CONFIRM', 'NIGHT_REACTION']);

/** Phase, round, what the phase is for, and the countdown or "Waiting for host". Phase changes are announced. */
export function GameStatusBar({ phase, roundNumber, seconds, showClock, onElapsed }: GameStatusBarProps) {
  const phaseName = PHASE_LABEL[phase];
  const round = roundLabel(roundNumber);
  const guide = phaseGuide(phase);
  const night = NIGHT_PHASES.has(phase);
  return (
    <div className="ww-status" data-phase={phase}>
      <div className="ww-status-pack">
        <h1 className="ww-status-title">{phaseName}</h1>
        {night ? <p className="ww-status-guide">{guide}</p> : <p className="ww-status-copy">{round}</p>}
        {!night && showClock ? <CountdownTimer seconds={seconds} {...(onElapsed ? { onElapsed } : {})} /> : null}
        {!night ? <p className="ww-status-guide">{guide}</p> : null}
      </div>
      {night ? (
        <div className="ww-status-trail">
          <span className="ww-pill ww-status-phase" data-tone="waiting">
            {phaseName} · In progress
          </span>
          {showClock ? <CountdownTimer seconds={seconds} {...(onElapsed ? { onElapsed } : {})} /> : null}
        </div>
      ) : null}
      <p className="ww-sr" aria-live="polite">
        {phaseName}. {round}. {guide}
      </p>
    </div>
  );
}
