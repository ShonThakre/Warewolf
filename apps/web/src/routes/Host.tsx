import type { KillTargetView } from '@warewolf/contracts';
import { Button } from '@mui/material';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { KillTargetPanel } from '../game/components/KillTargetPanel';
import { PhaseCloseButton } from '../game/components/PhaseCloseButton';
import { closeConsequence, phaseActionNote } from '../game/components/phaseCopy';
import { killPickOf, sameKillPick, type KillPick } from '../game/components/killCopy';
import { HostCanvas } from '../game/host/HostCanvas';
import { HostShell } from '../game/host/HostShell';
import type { HostSection } from '../game/host/dashboardCopy';
import { useLayoutMode } from '../game/layout';
import { useHostDashboard } from '../game/state/hostDashboard';
import { useHostEvents } from '../game/state/hostEvents';
import { useKillTarget, useSetKillTarget } from '../game/state/killTarget';
import { useSeat } from '../game/state/lobby';
import { useClosePhase, useGameState } from '../game/state/phase';
import '../game/components/lobby-screen.css';

/** Host only. A guest sees a refusal and none of the secret sections. */
export function Host() {
  const seat = useSeat();
  const { gameId } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    if (!seat) {
      navigate('/', { replace: true });
      return;
    }
    if (gameId && gameId !== seat.gameId) navigate(`/game/${seat.gameId}/host`, { replace: true });
  }, [seat, gameId, navigate]);

  if (!seat || gameId !== seat.gameId) return null;
  return <HostScreen />;
}

function HostScreen() {
  const seat = useSeat();
  const view = useGameState();
  const dashboard = useHostDashboard(view.state?.phase, view.state?.stateVersion);
  const events = useHostEvents(Boolean(seat?.isHost && view.state && view.state.status === 'ACTIVE'));
  const close = useClosePhase(view.state);
  const kill = useKillTarget(view.state?.phase, view.state?.stateVersion);
  const setKill = useSetKillTarget();
  const layout = useLayoutMode();
  const navigate = useNavigate();
  const [section, setSection] = useState<HostSection>('overview');
  const [killPick, setKillPick] = useState<KillPick | null>(null);
  const [killAck, setKillAck] = useState<string | null>(null);
  const { state, isLoading, error, refetch } = view;

  useEffect(() => {
    if (!state) return;
    if (state.status === 'LOBBY') navigate(`/lobby/${state.gameId}`, { replace: true });
    if (state.status === 'FINISHED' || state.status === 'CANCELLED') navigate(`/game/${state.gameId}/results`, { replace: true });
  }, [state, navigate]);

  useEffect(() => {
    if (dashboard.error?.status === 409) refetch();
  }, [dashboard.error, refetch]);

  useEffect(() => {
    if (!state) return;
    if (state.phase === 'NIGHT_HOST_CONFIRM' || state.phase === 'NIGHT_REACTION' || state.phase === 'NIGHT_SUBMIT') {
      setSection((current) => (current === 'overview' ? 'actions' : current));
    }
  }, [state?.phase]);

  if (!seat) return null;

  if (!seat.isHost) {
    return (
      <div className="ww-lobby-message">
        <h1 className="ww-status-title">Host dashboard</h1>
        <p className="ww-status-copy">The host dashboard is only for the host.</p>
        <Button component={Link} to={`/game/${seat.gameId}`} variant="contained">
          Back to game
        </Button>
      </div>
    );
  }

  if ((isLoading && !state) || (state?.status === 'ACTIVE' && dashboard.isLoading && !dashboard.dashboard)) {
    return (
      <div className="ww-lobby-message">
        <h1 className="ww-status-title">Host dashboard</h1>
        <p className="ww-status-copy">Opening the dashboard…</p>
      </div>
    );
  }

  if (!state || state.status !== 'ACTIVE') return null;

  if (!dashboard.dashboard) {
    const unavailable = dashboard.error?.status === 409;
    return (
      <div className="ww-lobby-message">
        <h1 className="ww-status-title">Host dashboard</h1>
        <p className="ww-status-copy">{unavailable ? 'That is not available yet.' : (dashboard.error?.message ?? error?.message ?? 'The dashboard could not be opened.')}</p>
        <Button
          variant="contained"
          onClick={() => {
            refetch();
            dashboard.refetch();
          }}
        >
          Try again
        </Button>
      </div>
    );
  }

  const storedKill = kill.view ? killPickOf(kill.view.decision) : null;
  const showingKill = killPick ?? storedKill;
  const killSaved =
    showingKill != null && (sameKillPick(showingKill, storedKill) || killAck === (showingKill.kind === 'NO_KILL' ? 'NO_KILL' : showingKill.playerId));
  const killIssue = setKill.error?.issues[0]?.message ?? setKill.error?.message ?? null;

  async function onPickKill(pick: KillPick) {
    setKillPick(pick);
    if (!kill.view?.editable) return;
    if (sameKillPick(pick, storedKill) || killAck === (pick.kind === 'NO_KILL' ? 'NO_KILL' : pick.playerId)) return;
    const result = pick.kind === 'NO_KILL' ? await setKill.choose({ noKill: true }) : await setKill.choose({ targetPlayerId: pick.playerId });
    if (result) setKillAck(pick.kind === 'NO_KILL' ? 'NO_KILL' : pick.playerId);
  }

  const consequence = close.canClose && close.close ? closeConsequence(close.close, close.phase) : null;

  return (
    <HostShell
      section={section}
      onSection={setSection}
      oneStep={layout.mode === 'portrait'}
      canvas={
        <>
          <HostCanvas section={section} dashboard={dashboard.dashboard} events={events.events} eventsError={events.error?.message ?? null} />
          {section === 'actions' && kill.view ? (
            <KillChoices players={state.players} view={kill.view} pick={killPick} onPick={(pick) => void onPickKill(pick)} />
          ) : null}
        </>
      }
      action={
        <>
          {close.error ? (
            <p className="ww-host-action-copy" role="alert">
              {phaseActionNote(close.error)}{' '}
              <Button variant="text" onClick={() => refetch()}>
                Refresh
              </Button>
            </p>
          ) : consequence ? (
            <p className="ww-host-action-copy">
              <strong>Consequence:</strong> {consequence}
            </p>
          ) : (
            <p className="ww-host-action-copy">Host-only records for this room.</p>
          )}
          {killIssue ? (
            <p className="ww-host-action-copy" role="alert">
              {killIssue}
            </p>
          ) : null}
          <div className="ww-host-action-buttons">
            <Button component={Link} to={`/game/${state.gameId}`} variant="contained" color="primary">
              Back to game
            </Button>
            {kill.view?.editable && showingKill && !killSaved ? (
              <Button variant="outlined" disabled={setKill.isChoosing} onClick={() => showingKill && void onPickKill(showingKill)}>
                {setKill.isChoosing ? 'Sending…' : 'Confirm target'}
              </Button>
            ) : null}
            {close.canClose && close.close ? (
              <div className="ww-host-controls" role="group" aria-label="Close this phase">
                <PhaseCloseButton control={close} tone="secondary" />
              </div>
            ) : null}
          </div>
        </>
      }
    />
  );
}

function KillChoices({
  players,
  view,
  pick,
  onPick,
}: {
  players: readonly { playerId: string; displayName: string; avatarId?: number | null }[];
  view: KillTargetView;
  pick: KillPick | null;
  onPick: (pick: KillPick) => void;
}) {
  return (
    <div className="ww-host-panel">
      <KillTargetPanel players={players} view={view} pick={pick} onPick={onPick} includeNoKill />
    </div>
  );
}
