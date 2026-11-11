import { useEffect, useRef } from 'react';
import { formatCountdown } from './phaseCopy';

/**
 * Displays the seconds `useSecondsLeft` already computed. It does not advance
 * the phase. When the clock reaches 0 it asks the screen to read the state
 * again, so a timed phase can move on the server's close.
 */
export function CountdownTimer({ seconds, onElapsed }: { seconds: number | null; onElapsed?: () => void }) {
  const fired = useRef(false);

  useEffect(() => {
    if (seconds === null || seconds > 0) {
      fired.current = false;
      return;
    }
    if (fired.current) return;
    fired.current = true;
    onElapsed?.();
  }, [seconds, onElapsed]);

  if (seconds === null) return <p className="ww-status-copy">Waiting for host</p>;

  const clock = formatCountdown(seconds);
  return (
    <p className="ww-status-copy">
      <span className="ww-countdown" aria-hidden="true">
        {clock}
      </span>
      <span className="ww-sr">{clock} remaining</span>
    </p>
  );
}
