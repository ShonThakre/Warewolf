import type { KillTargetView } from '@warewolf/contracts';
import { Button } from '@mui/material';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { KillTargetPanel } from '../game/components/KillTargetPanel';
import { PhaseCloseButton } from '../game/components/PhaseCloseButton';
import { killPickOf, playerName, sameKillPick, type KillPick } from '../game/components/killCopy';
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

  if (!seat) return null;

  if (!seat.isHost) {
    return (
      <div className="ww-lobby-message">
        <h1 className="ww-status-title">Host dashboard</h1>
        <p className="ww-status-copy">The host dashboard is only for the host.</p>
        <Button component={Link} to={`/game/${seat.gameId}`} variant="contained">
          Back to the table
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
  const killSaved = showingKill != null && (sameKillPick(showingKill, storedKill) || killAck === (showingKill.kind === 'NO_KILL' ? 'NO_KILL' : showingKill.playerId));
  const killIssue = setKill.error?.issues[0]?.message ?? setKill.error?.message ?? null;

  async function onConfirmKill() {
    if (!showingKill || !kill.view?.editable) return;
    const result = showingKill.kind === 'NO_KILL' ? await setKill.choose({ noKill: true }) : await setKill.choose({ targetPlayerId: showingKill.playerId });
    if (result) setKillAck(showingKill.kind === 'NO_KILL' ? 'NO_KILL' : showingKill.playerId);
  }

  return (
    <HostShell
      section={section}
      onSection={setSection}
      oneStep={layout.mode === 'portrait'}
      canvas={
        <>
          <HostCanvas section={section} dashboard={dashboard.dashboard} events={events.events} eventsError={events.error?.message ?? null} />
          {section === 'actions' && kill.view ? <KillChoices players={state.players} view={kill.view} pick={killPick} onPick={setKillPick} /> : null}
        </>
      }
      action={
        <>
          {close.error ? <p className="ww-host-copy">{close.error.message}</p> : null}
          {killIssue ? (
            <p className="ww-host-copy" role="alert">
              {killIssue}
            </p>
          ) : null}
          <PhaseCloseButton control={close} />
          {kill.view?.editable ? (
            <Button variant="outlined" aria-pressed={showingKill?.kind === 'NO_KILL'} onClick={() => setKillPick({ kind: 'NO_KILL' })}>
              No kill
            </Button>
          ) : null}
          {kill.view?.editable ? (
            <Button variant="contained" color="secondary" disabled={!showingKill || killSaved || setKill.isChoosing} onClick={() => void onConfirmKill()}>
              Confirm target
            </Button>
          ) : null}
          <Button component={Link} to={`/game/${state.gameId}`} variant="text">
            Table
          </Button>
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
  players: readonly { playerId: string; displayName: string }[];
  view: KillTargetView;
  pick: KillPick | null;
  onPick: (pick: KillPick) => void;
}) {
  const name = pick?.kind === 'TARGET' ? playerName(players, pick.playerId) : null;
  return (
    <div className="ww-host-stack">
      <KillTargetPanel players={players} view={view} pick={pick} onPick={onPick} />
      {name ? <p className="ww-host-copy">Chosen: {name}</p> : null}
    </div>
  );
}
