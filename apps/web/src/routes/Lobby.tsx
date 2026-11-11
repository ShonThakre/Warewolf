import { skipToken } from '@reduxjs/toolkit/query/react';
import type { LobbyPlayer, LobbyProjection } from '@warewolf/contracts';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Tab,
  Tabs,
  TextField,
} from '@mui/material';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { apiErrorOf, type ApiErrorInfo } from '../api/api';
import { useStartGameMutation } from '../api/game';
import { useGetConfigurationQuery, useGetRolePacksQuery, useKickPlayerMutation, useLeaveGameMutation, useTransferHostMutation } from '../api/lobby';
import { AvatarPicker } from '../game/components/AvatarPicker';
import { PackSummary } from '../game/components/PackSummary';
import { PlayerAvatar } from '../game/components/PlayerAvatar';
import { PlayerCard } from '../game/components/PlayerCard';
import { VillageScene } from '../game/components/VillageScene';
import { MODE_LABEL, startSentences } from '../game/components/lobbyCopy';
import { useLobby, useSeat } from '../game/state/lobby';
import { gamePath } from '../game/state/role';
import { GameLayout } from '../game/layout';
import '../game/components/lobby-screen.css';

type RoomTab = 'players' | 'log' | 'info';
type PendingDialog = { type: 'leave' } | { type: 'kick'; player: LobbyPlayer } | { type: 'transfer'; player: LobbyPlayer } | null;

/** Members only. A missing seat returns home. A seat for another room opens that room. */
export function Lobby() {
  const seat = useSeat();
  const { gameId } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    if (!seat) {
      navigate('/', { replace: true });
      return;
    }
    if (gameId !== seat.gameId) navigate(`/lobby/${seat.gameId}`, { replace: true });
  }, [seat, gameId, navigate]);

  if (!seat || gameId !== seat.gameId) return null;
  return <LobbyScreen />;
}

function LobbyScreen() {
  const { lobby, isLoading, error, refetch } = useLobby();
  const packs = useGetRolePacksQuery();
  const [tab, setTab] = useState<RoomTab>('players');
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const [dialog, setDialog] = useState<PendingDialog>(null);
  const [successor, setSuccessor] = useState('');
  const [actionError, setActionError] = useState<ApiErrorInfo | null>(null);
  const [leaveGame, leaveState] = useLeaveGameMutation();
  const [kickPlayer, kickState] = useKickPlayerMutation();
  const [transferHost, transferState] = useTransferHostMutation();
  const [startGame, startState] = useStartGameMutation();
  const [warnOpen, setWarnOpen] = useState(false);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [startError, setStartError] = useState<ApiErrorInfo | null>(null);
  const busy = leaveState.isLoading || kickState.isLoading || transferState.isLoading || startState.isLoading;
  const navigate = useNavigate();
  const configuration = useGetConfigurationQuery(lobby?.you.isHost && lobby.status === 'LOBBY' ? lobby.gameId : skipToken);

  useEffect(() => {
    if (!lobby || lobby.status === 'LOBBY') return;
    const next = gamePath(lobby.gameId, lobby.status, lobby.phase);
    if (next) navigate(next, { replace: true });
  }, [lobby, navigate]);

  if (isLoading && !lobby) {
    return (
      <div className="ww-lobby-message">
        <h1 className="ww-status-title">Lobby</h1>
        <p className="ww-status-copy">Opening the lobby…</p>
      </div>
    );
  }

  if (!lobby) {
    return (
      <div className="ww-lobby-message">
        <h1 className="ww-status-title">Lobby</h1>
        <p className="ww-status-copy">{error?.message ?? 'The lobby could not be opened.'}</p>
        <Button variant="contained" onClick={() => refetch()}>
          Try again
        </Button>
      </div>
    );
  }

  const packName = packs.data?.find((pack) => pack.id === lobby.rolePackId)?.name ?? MODE_LABEL[lobby.mode];
  const sentences = startSentences({
    status: lobby.status,
    ready: lobby.start.ready,
    blockers: lobby.start.blockers,
    requiresWarningAcknowledgement: lobby.start.requiresWarningAcknowledgement,
    seated: lobby.players.length,
    seats: lobby.playerCount,
  });
  const inLobby = lobby.status === 'LOBBY';
  const others = lobby.players.filter((player) => player.playerId !== lobby.you.playerId);
  const warnings = configuration.data?.validation.warnings.map((warning) => warning.message) ?? [];

  async function begin(acknowledgeWarnings: boolean) {
    const result = await startGame({ gameId: lobby!.gameId, acknowledgeWarnings });
    if ('data' in result && result.data) {
      setWarnOpen(false);
      const next = gamePath(result.data.gameId, result.data.status, result.data.phase);
      if (next) navigate(next, { replace: true });
      return;
    }
    setStartError(apiErrorOf('error' in result ? result.error : null));
  }

  function closeDialog() {
    if (busy) return;
    setDialog(null);
    setActionError(null);
  }

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(lobby!.roomCode);
      setCopied(true);
      setCopyFailed(false);
    } catch {
      setCopied(false);
      setCopyFailed(true);
    }
  }

  async function confirmLeave(handover: boolean) {
    const hostPlayerId = handover ? successor : undefined;
    const result = await leaveGame({ gameId: lobby!.gameId, ...(hostPlayerId ? { hostPlayerId } : {}) });
    if ('error' in result && result.error) setActionError(apiErrorOf(result.error));
  }

  async function confirmKick() {
    if (dialog?.type !== 'kick') return;
    const result = await kickPlayer({ gameId: lobby!.gameId, playerId: dialog.player.playerId });
    if ('error' in result) setActionError(apiErrorOf(result.error));
    else closeDialog();
  }

  async function confirmTransfer() {
    if (dialog?.type !== 'transfer') return;
    const result = await transferHost({ gameId: lobby!.gameId, playerId: dialog.player.playerId });
    if ('error' in result) setActionError(apiErrorOf(result.error));
    else closeDialog();
  }

  return (
    <>
      <GameLayout
        stage="lobby"
        scene={<VillageScene scene="lobby_campfire" />}
        status={
          <div className="ww-status">
            <h1 className="ww-status-title">Lobby</h1>
            <p className="ww-status-copy" aria-live="polite">
              {lobby.players.length} of {lobby.playerCount} seated
            </p>
            <p className="ww-code">{lobby.roomCode}</p>
            <Button onClick={() => void copyCode()}>Copy code</Button>
            {copied ? <span className="ww-status-copy">Copied</span> : null}
            {copyFailed ? <span className="ww-status-copy">Select the code to copy it.</span> : null}
            <p className="ww-status-copy">{MODE_LABEL[lobby.mode]}</p>
            {inLobby && lobby.you.isHost ? <p className="ww-status-copy">You are the host</p> : null}
            {inLobby && !lobby.you.isHost ? <p className="ww-status-copy">Waiting for the host</p> : null}
            {lobby.status === 'CANCELLED' ? <p className="ww-status-copy">Cancelled</p> : null}
            <div className="ww-status-pack">
              <PackSummary summary={lobby.configuration.summary} packName={packName} modeLabel={MODE_LABEL[lobby.mode]} layout="strip" />
            </div>
          </div>
        }
        foreground={
          <div className="ww-scene">
            <p className="ww-scene-count">
              {lobby.players.length} of {lobby.playerCount} seated
            </p>
            <ul className="ww-seats" aria-label="Seated players">
              {lobby.players.map((player) => (
                <li key={player.playerId} className="ww-seat">
                  <PlayerAvatar name={player.displayName} avatarId={player.avatarId} />
                  <span className="ww-seat-name">{player.displayName}</span>
                  {player.isHost ? <span className="ww-seat-tag">Host</span> : null}
                  {player.playerId === lobby.you.playerId ? <span className="ww-seat-tag">You</span> : null}
                </li>
              ))}
            </ul>
          </div>
        }
        action={
          <div className="ww-action">
            <p className="ww-action-copy" id="start-reasons">
              {inLobby && !lobby.you.isHost ? 'Waiting for the host. ' : null}
              {sentences.join(' ')}
            </p>
            {inLobby ? (
              <>
                <Button component={Link} to={`/lobby/${lobby.gameId}/setup`}>
                  Game setup
                </Button>
                {lobby.you.isHost ? (
                  <Button
                    color="secondary"
                    variant="contained"
                    disabled={!lobby.start.ready || busy}
                    aria-describedby="start-reasons"
                    onClick={() => {
                      setStartError(null);
                      if (lobby.start.requiresWarningAcknowledgement) setWarnOpen(true);
                      else void begin(false);
                    }}
                  >
                    Start game
                  </Button>
                ) : null}
                {startError ? <Alert severity="error">{startError.message}</Alert> : null}
                <Button
                  onClick={() => {
                    setSuccessor('');
                    setActionError(null);
                    setDialog({ type: 'leave' });
                  }}
                  disabled={busy}
                >
                  Leave
                </Button>
              </>
            ) : (
              <Button component={Link} to="/" variant="contained">
                Back to home
              </Button>
            )}
          </div>
        }
        rail={
          <>
            {error ? <Alert severity="error">{error.message}</Alert> : null}
            <PackSummary
              summary={lobby.configuration.summary}
              packName={packName}
              modeLabel={MODE_LABEL[lobby.mode]}
              layout="card"
              warningCount={lobby.configuration.warningCount}
              errorCount={lobby.configuration.errorCount}
            />
            <Tabs value={tab} onChange={(_event, value: RoomTab) => setTab(value)} variant="scrollable" scrollButtons="auto" aria-label="Room sections">
              <Tab label="Players" value="players" />
              <Tab label="Log" value="log" />
              <Tab label="Info" value="info" />
            </Tabs>
            <div className="ww-room-body" role="tabpanel">
              {tab === 'players' ? (
                <ul className="ww-player-list" aria-label="Players">
                  {lobby.players.map((player) => (
                    <li key={player.playerId}>
                      <PlayerCard
                        name={player.displayName}
                        seatNumber={player.seatNumber}
                        host={player.isHost}
                        you={player.playerId === lobby.you.playerId}
                        avatarId={player.avatarId}
                        actions={
                          <>
                            {inLobby && player.playerId === lobby.you.playerId ? (
                              <Button onClick={() => setAvatarOpen(true)} disabled={busy}>
                                Change avatar
                              </Button>
                            ) : null}
                            {lobby.you.isHost && inLobby && player.playerId !== lobby.you.playerId ? (
                              <>
                                <Button
                                  aria-label={`Make ${player.displayName} the host`}
                                  disabled={busy}
                                  onClick={() => {
                                    setActionError(null);
                                    setDialog({ type: 'transfer', player });
                                  }}
                                >
                                  Make host
                                </Button>
                                <Button
                                  color="error"
                                  aria-label={`Remove ${player.displayName}`}
                                  disabled={busy}
                                  onClick={() => {
                                    setActionError(null);
                                    setDialog({ type: 'kick', player });
                                  }}
                                >
                                  Remove
                                </Button>
                              </>
                            ) : null}
                          </>
                        }
                      />
                    </li>
                  ))}
                </ul>
              ) : null}
              {tab === 'log' ? (
                <>
                  <p className="ww-log-empty">No public events yet. The log starts once the game leaves the lobby.</p>
                  <TextField label="Table chat" placeholder="Chat is not open in this version." disabled fullWidth helperText="The table talks out loud. A written log arrives with the game." />
                </>
              ) : null}
              {tab === 'info' ? <RoomInfo /> : null}
            </div>
          </>
        }
      />

      <AvatarPicker
        open={avatarOpen}
        onClose={() => setAvatarOpen(false)}
        gameId={lobby.gameId}
        currentId={lobby.players.find((player) => player.playerId === lobby.you.playerId)?.avatarId ?? null}
        takenIds={lobby.players.filter((player) => player.playerId !== lobby.you.playerId).map((player) => player.avatarId)}
      />

      <Dialog open={warnOpen} onClose={() => (startState.isLoading ? undefined : setWarnOpen(false))} fullWidth maxWidth="xs" aria-labelledby="warn-title">
        <DialogTitle id="warn-title">Acknowledge warnings</DialogTitle>
        <DialogContent sx={{ display: 'grid', gap: 'var(--space)' }}>
          {configuration.isLoading ? <p className="ww-info-copy">Loading the warnings…</p> : null}
          {warnings.map((message) => (
            <p key={message} className="ww-info-copy">
              {message}
            </p>
          ))}
          {startError ? <Alert severity="error">{startError.message}</Alert> : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setWarnOpen(false)} disabled={startState.isLoading}>
            Cancel
          </Button>
          <Button variant="contained" color="secondary" onClick={() => void begin(true)} disabled={startState.isLoading || configuration.isLoading}>
            Start the game
          </Button>
        </DialogActions>
      </Dialog>
      <LeaveDialog
        open={dialog?.type === 'leave'}
        lobby={lobby}
        others={others}
        successor={successor}
        onSuccessor={setSuccessor}
        error={actionError}
        busy={busy}
        onClose={closeDialog}
        onConfirm={(handover) => void confirmLeave(handover)}
      />
      <Dialog open={dialog?.type === 'kick'} onClose={closeDialog} fullWidth maxWidth="xs" aria-labelledby="kick-title">
        <DialogTitle id="kick-title">Remove {dialog?.type === 'kick' ? dialog.player.displayName : ''}?</DialogTitle>
        <DialogContent sx={{ display: 'grid', gap: 'var(--space)' }}>
          <p className="ww-info-copy">They can join again with the room code.</p>
          {actionError ? <Alert severity="error">{actionError.message}</Alert> : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog} disabled={busy}>
            Cancel
          </Button>
          <Button color="error" variant="contained" onClick={() => void confirmKick()} disabled={busy}>
            Remove
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog open={dialog?.type === 'transfer'} onClose={closeDialog} fullWidth maxWidth="xs" aria-labelledby="transfer-title">
        <DialogTitle id="transfer-title">Make {dialog?.type === 'transfer' ? dialog.player.displayName : ''} the host?</DialogTitle>
        <DialogContent sx={{ display: 'grid', gap: 'var(--space)' }}>
          <p className="ww-info-copy">You stay in the room. Start and room controls move to them.</p>
          {actionError ? <Alert severity="error">{actionError.message}</Alert> : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog} disabled={busy}>
            Cancel
          </Button>
          <Button variant="contained" onClick={() => void confirmTransfer()} disabled={busy}>
            Make host
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

function RoomInfo() {
  return (
    <>
      <p className="ww-info-copy">Your seat token stays in this browser tab. Closing the tab drops it, and a display name cannot get it back.</p>
      <p className="ww-info-copy">One person can hold a seat in more than one browser. Each browser is its own seat.</p>
      <p className="ww-info-copy">A removed player can join again with the room code.</p>
    </>
  );
}

function LeaveDialog({
  open,
  lobby,
  others,
  successor,
  onSuccessor,
  error,
  busy,
  onClose,
  onConfirm,
}: {
  open: boolean;
  lobby: LobbyProjection;
  others: readonly LobbyPlayer[];
  successor: string;
  onSuccessor: (playerId: string) => void;
  error: ApiErrorInfo | null;
  busy: boolean;
  onClose: () => void;
  onConfirm: (handover: boolean) => void;
}) {
  const hostWithCompany = lobby.you.isHost && others.length > 0;
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs" aria-labelledby="leave-title">
      <DialogTitle id="leave-title">{hostWithCompany ? 'Leave this room?' : lobby.you.isHost ? 'Close this room?' : 'Leave this room?'}</DialogTitle>
      <DialogContent sx={{ display: 'grid', gap: 'var(--space)' }}>
        {hostWithCompany ? (
          <p className="ww-info-copy">Hand the room to another player, or close it for everyone.</p>
        ) : lobby.you.isHost ? (
          <p className="ww-info-copy">You are the only player. Leaving closes the room.</p>
        ) : (
          <p className="ww-info-copy">Your seat can be taken by the next person who joins.</p>
        )}
        {hostWithCompany ? (
          <TextField select label="New host" value={successor} onChange={(event) => onSuccessor(event.target.value)} fullWidth slotProps={{ select: { displayEmpty: true } }}>
            <MenuItem value="">Choose a player</MenuItem>
            {others.map((player) => (
              <MenuItem key={player.playerId} value={player.playerId}>
                {player.displayName}
              </MenuItem>
            ))}
          </TextField>
        ) : null}
        {error ? <Alert severity="error">{error.message}</Alert> : null}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        {hostWithCompany ? (
          <Button variant="contained" onClick={() => onConfirm(true)} disabled={busy || successor === ''}>
            Hand over and leave
          </Button>
        ) : null}
        <Button color={lobby.you.isHost ? 'error' : 'primary'} variant={hostWithCompany ? 'text' : 'contained'} onClick={() => onConfirm(false)} disabled={busy}>
          {lobby.you.isHost ? 'Close the room' : 'Leave'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
