import { Button } from '@mui/material';
import { Link, useParams } from 'react-router';
import { tableSeatsFixture } from '../fixtures/lobby';
import { GameLayout } from './GameLayout';
import { STAGE_MODES, STAGE_SPECS, type ActionKind, type StageMode } from './stageMode';

/**
 * Development only: `/dev/layout/:stage` renders `GameLayout` for one stage
 * with fixture seats, so the shell can be styled (WEB-04) and checked at
 * every viewport (WEB-05) before each phase's screen exists. The text is
 * placeholder copy, not product copy. Registered only when
 * `import.meta.env.DEV` is true.
 */

const ACTION_LABEL: Record<ActionKind, string> = {
  start: 'Start game',
  'wait-for-host': 'Waiting for host',
  'submit-ability': 'Submit',
  'continue-to-day': 'Continue to day',
  'open-voting': 'Open voting',
  'confirm-vote': 'Confirm vote',
  'play-again': 'Play again',
};

const isStage = (value: string | undefined): value is StageMode => STAGE_MODES.includes(value as StageMode);

export function LayoutPreview() {
  const { stage } = useParams();
  if (!isStage(stage)) {
    return (
      <nav aria-label="Layout previews">
        <h1>Layout previews</h1>
        <ul>
          {STAGE_MODES.map((s) => (
            <li key={s}>
              <Link to={`/dev/layout/${s}`}>{s}</Link>
            </li>
          ))}
        </ul>
      </nav>
    );
  }

  const spec = STAGE_SPECS[stage];
  const seats = tableSeatsFixture();
  const living = seats.filter((s) => s.lifeStatus === 'ALIVE');

  const foreground = {
    avatars: (
      <ul aria-label="Seated players">
        {seats.map((s) => (
          <li key={s.playerId} data-life={s.lifeStatus}>
            {s.displayName}
          </li>
        ))}
      </ul>
    ),
    'player-grid': (
      <ul aria-label="Choose a player">
        {seats.map((s) => (
          <li key={s.playerId}>
            <Button disabled={s.lifeStatus === 'DEAD'} aria-pressed={false}>
              {s.displayName}
            </Button>
          </li>
        ))}
      </ul>
    ),
    'result-card': (
      <article aria-label="Night results">
        <h2>Morning</h2>
        <p>{seats[5]!.displayName} was found dead.</p>
      </article>
    ),
    victory: (
      <article aria-label="Result">
        <h2>The village wins</h2>
        <p>Round 4</p>
      </article>
    ),
  }[spec.foreground];

  return (
    <GameLayout
      stage={stage}
      status={
        <>
          <h1>{stage}</h1>
          <p aria-live="polite">Round 2. Waiting for host.</p>
          <p>{living.length} alive</p>
        </>
      }
      scene={<div data-scene={spec.scene} />}
      foreground={foreground}
      rail={<p>No public events yet.</p>}
      action={
        <Button variant="contained" color="secondary" disabled={spec.action === 'wait-for-host'}>
          {ACTION_LABEL[spec.action]}
        </Button>
      }
    />
  );
}
