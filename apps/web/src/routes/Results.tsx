import type { FinishedResults } from '@warewolf/contracts';
import { Button } from '@mui/material';
import { useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ResultsRecap } from '../game/components/ResultsRecap';
import { VillageScene } from '../game/components/VillageScene';
import { VictoryBanner } from '../game/components/VictoryBanner';
import { bannerOutcome, cancelReasonCopy, resultsReason, resultsTitle, resultStats } from '../game/components/resultsCopy';
import type { SceneId } from '../assets/art';
import { GameLayout } from '../game/layout';
import { useSeat } from '../game/state/lobby';
import { useGameState } from '../game/state/phase';
import { resultsHeadline, useResults } from '../game/state/results';
import '../game/components/lobby-screen.css';
import '../game/components/results-screen.css';

/** The end of a game. A missing seat returns home. Roles come only from the results projection. */
export function Results() {
  const seat = useSeat();
  const { gameId } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    if (!seat) {
      navigate('/', { replace: true });
      return;
    }
    if (gameId && gameId !== seat.gameId) navigate(`/game/${seat.gameId}/results`, { replace: true });
  }, [seat, gameId, navigate]);

  if (!seat || gameId !== seat.gameId) return null;
  return <ResultsScreen />;
}

function ResultsScreen() {
  const view = useGameState();
  const results = useResults(view.state?.status);
  const navigate = useNavigate();
  const { state, isLoading, error, refetch } = view;

  useEffect(() => {
    if (!state) return;
    if (state.status === 'LOBBY') navigate(`/lobby/${state.gameId}`, { replace: true });
    if (state.status === 'ACTIVE') navigate(`/game/${state.gameId}`, { replace: true });
  }, [state, navigate]);

  if ((isLoading && !state) || (state && (state.status === 'FINISHED' || state.status === 'CANCELLED') && results.isLoading && !results.finished && !results.cancelled)) {
    return (
      <div className="ww-lobby-message">
        <h1 className="ww-status-title">Results</h1>
        <p className="ww-status-copy">Opening the results…</p>
      </div>
    );
  }

  if (!state) {
    return (
      <div className="ww-lobby-message">
        <h1 className="ww-status-title">Results</h1>
        <p className="ww-status-copy">{error?.message ?? 'The results could not be opened.'}</p>
        <Button variant="contained" onClick={() => refetch()}>
          Try again
        </Button>
      </div>
    );
  }

  if (state.status !== 'FINISHED' && state.status !== 'CANCELLED') return null;

  const failure = results.error?.message ?? null;
  if (failure || (!results.finished && !results.cancelled)) {
    return (
      <div className="ww-lobby-message">
        <h1 className="ww-status-title">Results</h1>
        <p className="ww-status-copy">{failure ?? 'The results could not be opened.'}</p>
        <Button
          variant="contained"
          onClick={() => {
            refetch();
            results.refetch();
          }}
        >
          Try again
        </Button>
      </div>
    );
  }

  const headline = results.finished ? resultsHeadline(results.finished) : null;
  const title = results.finished && headline ? resultsTitle(headline) : 'Cancelled';
  const reason = results.finished ? resultsReason(results.finished) : cancelReasonCopy(results.cancelled?.cancelReason ?? 'HOST');

  return (
    <GameLayout
      stage="results"
      labels={{ rail: 'Recap' }}
      scene={<VillageScene scene={results.finished ? sceneFor(results.finished) : 'square_dusk'} />}
      status={
        <div className="ww-status">
          <h1 className="ww-status-title">Results</h1>
          <p className="ww-status-copy">{title}</p>
          {results.finished ? <p className="ww-status-copy">Round {results.finished.roundNumber}</p> : null}
          <p className="ww-sr" aria-live="polite">
            {title}. {reason}
          </p>
        </div>
      }
      foreground={
        results.finished ? (
          <FinishedStage results={results.finished} title={title} reason={reason} />
        ) : (
          <div className="ww-results-stage">
            <VictoryBanner title="Cancelled" reason={reason} />
          </div>
        )
      }
      rail={<ResultsRecap finished={results.finished} cancelled={results.cancelled} />}
      action={
        <div className="ww-action">
          <p className="ww-action-copy">{reason}</p>
          <Button component={Link} to="/" variant="contained" color="secondary">
            Play again
          </Button>
        </div>
      }
    />
  );
}

function FinishedStage({ results, title, reason }: { results: FinishedResults; title: string; reason: string }) {
  const stats = resultStats(results);
  return (
    <div className="ww-results-stage">
      <VictoryBanner title={title} reason={reason} outcome={bannerOutcome(results)} />
      <ul className="ww-results-stats" aria-label="Game stats">
        <li className="ww-results-stat">
          <strong>{stats.rounds}</strong>
          <span>Rounds</span>
        </li>
        <li className="ww-results-stat">
          <strong>{stats.infections}</strong>
          <span>Infections</span>
        </li>
        <li className="ww-results-stat">
          <strong>{stats.eliminations}</strong>
          <span>Eliminations</span>
        </li>
      </ul>
    </div>
  );
}

function sceneFor(results: FinishedResults): SceneId {
  const headline = resultsHeadline(results);
  return headline.kind === 'TEAM' && headline.team === 'VILLAGE' ? 'square_day' : 'square_dusk';
}
