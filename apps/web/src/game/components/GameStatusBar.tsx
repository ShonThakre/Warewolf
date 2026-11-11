import type { GamePhase } from '@warewolf/domain';
import { CountdownTimer } from './CountdownTimer';
import { PHASE_LABEL, roundLabel } from './phaseCopy';
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

/** Phase, round, and the countdown or "Waiting for host". Phase changes are announced. */
export function GameStatusBar({ phase, roundNumber, seconds, showClock, onElapsed }: GameStatusBarProps) {
  const phaseName = PHASE_LABEL[phase];
  const round = roundLabel(roundNumber);
  return (
    <div className="ww-status">
      <h1 className="ww-status-title">{phaseName}</h1>
      <p className="ww-status-copy">{round}</p>
      {showClock ? <CountdownTimer seconds={seconds} {...(onElapsed ? { onElapsed } : {})} /> : null}
      <p className="ww-sr" aria-live="polite">
        {phaseName}. {round}.
      </p>
    </div>
  );
}
