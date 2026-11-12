import type { KillTargetView } from '@warewolf/contracts';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle } from '@mui/material';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { apiErrorOf, type ApiErrorInfo } from '../api/api';
import { useCancelGameMutation, useTransferHostMutation } from '../api/lobby';
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

type HostDialog =
  | { type: 'cancel' }
  | { type: 'transfer'; playerId: string; displayName: string }
  | null;

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
  const [dialog, setDialog] = useState<HostDialog>(null);
  const [actionError, setActionError] = useState<ApiErrorInfo | null>(null);
  const [cancelGame, cancelState] = useCancelGameMutation();
  const [transferHost, transferState] = useTransferHostMutation();
  const { state, isLoading, error, refetch } = view;
  const roomBusy = cancelState.isLoading || transferState.isLoading;

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

  function closeDialog() {
    if (roomBusy) return;
    setDialog(null);
    setActionError(null);
  }

  async function confirmCancel() {
    const result = await cancelGame({ gameId: state!.gameId });
    if ('error' in result) setActionError(apiErrorOf(result.error));
    else setDialog(null);
  }

  async function confirmTransfer() {
    if (dialog?.type !== 'transfer') return;
    const result = await transferHost({ gameId: state!.gameId, playerId: dialog.playerId });
    if ('error' in result) setActionError(apiErrorOf(result.error));
    else setDialog(null);
  }

  const consequence = close.canClose && close.close ? closeConsequence(close.close, close.phase) : null;

  return (
    <>
      <HostShell
        section={section}
        onSection={setSection}
        oneStep={layout.mode === 'portrait'}
        layoutMode={layout.mode}
        canvas={
          <>
            <HostCanvas
              section={section}
              dashboard={dashboard.dashboard}
              events={events.events}
              eventsError={events.error?.message ?? null}
              transferBusy={roomBusy}
              onMakeHost={(player) => {
                setActionError(null);
                setDialog({ type: 'transfer', playerId: player.playerId, displayName: player.displayName });
              }}
            />
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
              <Button
                color="error"
                variant="outlined"
                disabled={roomBusy}
                onClick={() => {
                  setActionError(null);
                  setDialog({ type: 'cancel' });
                }}
              >
                Cancel game
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
      <Dialog open={dialog?.type === 'cancel'} onClose={closeDialog} fullWidth maxWidth="xs" aria-labelledby="cancel-game-title">
        <DialogTitle id="cancel-game-title">Cancel this game?</DialogTitle>
        <DialogContent sx={{ display: 'grid', gap: 'var(--space)' }}>
          <p className="ww-host-copy">Roles stay hidden. Every seat moves to the results screen.</p>
          {actionError ? <Alert severity="error">{actionError.message}</Alert> : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog} disabled={roomBusy}>
            Keep playing
          </Button>
          <Button color="error" variant="contained" onClick={() => void confirmCancel()} disabled={roomBusy}>
            Cancel game
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog open={dialog?.type === 'transfer'} onClose={closeDialog} fullWidth maxWidth="xs" aria-labelledby="make-host-title">
        <DialogTitle id="make-host-title">Make {dialog?.type === 'transfer' ? dialog.displayName : ''} the host?</DialogTitle>
        <DialogContent sx={{ display: 'grid', gap: 'var(--space)' }}>
          <p className="ww-host-copy">You stay at the table. Host controls move to them.</p>
          {actionError ? <Alert severity="error">{actionError.message}</Alert> : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog} disabled={roomBusy}>
            Keep hosting
          </Button>
          <Button variant="contained" onClick={() => void confirmTransfer()} disabled={roomBusy}>
            Make host
          </Button>
        </DialogActions>
      </Dialog>
    </>
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
