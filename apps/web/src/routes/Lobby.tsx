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
import { explainIssue, MODE_LABEL, startSentences } from '../game/components/lobbyCopy';
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
  const problems = configuration.data?.validation.errors.map(explainIssue) ?? [];
  const warningLines = configuration.data?.validation.warnings.map(explainIssue) ?? [];
  const sentences = startSentences({
    status: lobby.status,
    ready: lobby.start.ready,
    blockers: lobby.start.blockers,
    requiresWarningAcknowledgement: lobby.start.requiresWarningAcknowledgement,
    seated: lobby.players.length,
    seats: lobby.playerCount,
    problems,
    warnings: warningLines,
  });
  const inLobby = lobby.status === 'LOBBY';
  const hostName = lobby.players.find((player) => player.isHost)?.displayName ?? 'the host';
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  const others = lobby.players.filter((player) => player.playerId !== lobby.you.playerId);
  const seated = lobby.players.length;
  const seats = lobby.playerCount;
  const openSeats = Math.max(0, seats - seated);
  const seatedPlayers = [...lobby.players].sort((a, b) => a.seatNumber - b.seatNumber);

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
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
      setCopyFailed(true);
    }
  }

  async function shareCode() {
    try {
      await navigator.share({ title: 'Werewolf', text: `Join my Werewolf game. Room code: ${lobby!.roomCode}`, url: window.location.origin });
    } catch {
      // A dismissed share sheet is not an error.
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
        status={<p className="ww-sr">Lobby</p>}
        foreground={
          <div className="ww-lobby-board">
            <header className="ww-lobby-head">
              <div className="ww-lobby-title">
                <h1>Moonlit Village</h1>
                <div className="ww-code-row">
                  <p className="ww-code-line">
                    <span className="ww-code-label">Room code:</span> <span className="ww-code">{lobby.roomCode}</span>
                  </p>
                  <Button className="ww-code-copy" variant="outlined" onClick={() => void copyCode()} aria-label={`Copy room code ${lobby.roomCode.split('').join(' ')}`}>
                    {copyFailed ? 'Copy failed' : copied ? '✓ Copied' : 'Copy code'}
                  </Button>
                  {canShare ? (
                    <Button variant="outlined" onClick={() => void shareCode()}>
                      Share
                    </Button>
                  ) : null}
                  <span className="ww-sr" aria-live="polite">
                    {copied ? 'Room code copied.' : copyFailed ? 'Copy failed. Select the code to copy it.' : ''}
                  </span>
                </div>
              </div>
            </header>
            <div className="ww-lobby-mode">
              <p>
                <ModeMark /> Mode: {MODE_LABEL[lobby.mode]}
              </p>
              <span className="ww-lobby-mode-rule" aria-hidden="true" />
              <p>
                <PackMark /> Pack: <span>{packName}</span>
              </p>
              <span className="ww-lobby-mode-rule" aria-hidden="true" />
              <p>
                <SeatMark /> {seated} / {seats} seats
              </p>
            </div>
            <PackSummary summary={lobby.configuration.summary} packName={packName} modeLabel={MODE_LABEL[lobby.mode]} layout="strip" />
            {lobby.status === 'CANCELLED' ? <p className="ww-status-copy">Cancelled</p> : null}
            <div className="ww-lobby-seats">
              <ul className="ww-seat-grid" aria-label="Seated players">
                {seatedPlayers.map((player) => {
                  const you = player.playerId === lobby.you.playerId;
                  return (
                    <li key={player.playerId} className="ww-seat-card">
                      <PlayerAvatar name={player.displayName} avatarId={player.avatarId} />
                      <span className="ww-seat-badges">
                        {player.isHost ? <span className="ww-seat-badge">Host</span> : null}
                        {you ? <span className="ww-seat-badge is-you">You</span> : null}
                      </span>
                      <p className="ww-seat-card-name">
                        <span className="ww-seat-dot" aria-hidden="true" />
                        <span className="ww-sr">Alive. </span>
                        {player.displayName}
                      </p>
                    </li>
                  );
                })}
              </ul>
              {openSeats > 0 ? (
                <ul className="ww-open-grid" aria-label="Open seats">
                  {Array.from({ length: openSeats }, (_, index) => (
                    <li key={index} className="ww-open-seat">
                      <span aria-hidden="true">+</span>
                      Open seat
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>
        }
        action={
          <div className="ww-action">
            <div className="ww-action-copy" id="start-reasons">
              {inLobby && !lobby.you.isHost ? <p>Waiting for {hostName} to start the game.</p> : null}
              {inLobby && lobby.you.isHost && lobby.start.ready && sentences.length === 0 ? <p>The room is ready to start.</p> : null}
              {sentences.map((line, index) => (
                <p key={`${index}-${line}`}>{line}</p>
              ))}
            </div>
            {inLobby ? (
              <>
                <Button className="ww-lobby-setup" component={Link} to={`/lobby/${lobby.gameId}/setup`} variant="outlined" startIcon={<GearMark />}>
                  {lobby.you.isHost ? 'Game setup' : 'View setup'}
                </Button>
                {lobby.you.isHost ? (
                  <Button
                    className="ww-lobby-start"
                    color="secondary"
                    variant="contained"
                    disabled={!lobby.start.ready || busy}
                    aria-describedby="start-reasons"
                    startIcon={startState.isLoading ? undefined : <PlayMark />}
                    onClick={() => {
                      setStartError(null);
                      if (lobby.start.requiresWarningAcknowledgement) setWarnOpen(true);
                      else void begin(false);
                    }}
                  >
                    {startState.isLoading ? 'Starting…' : 'Start game'}
                  </Button>
                ) : null}
                {startError ? <Alert severity="error">{startError.message}</Alert> : null}
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
            <Tabs value={tab} onChange={(_event, value: RoomTab) => setTab(value)} variant="scrollable" scrollButtons="auto" aria-label="Room sections">
              <Tab label="Players" value="players" />
              <Tab label="Log" value="log" />
              <Tab label="Room info" value="info" />
            </Tabs>
            <div className="ww-room-body" role="tabpanel">
              {tab === 'players' ? (
                <>
                <div className="ww-rail-count">
                  <h2>
                    Players ({seated} / {seats})
                  </h2>
                  <Button
                    onClick={() => {
                      setSuccessor('');
                      setActionError(null);
                      setDialog({ type: 'leave' });
                    }}
                    disabled={busy || !inLobby}
                  >
                    Leave
                  </Button>
                </div>
                <ul className="ww-player-list" aria-label="Players">
                  {lobby.players.map((player) => (
                    <li key={player.playerId}>
                      <PlayerCard
                        name={player.displayName}
                        seatNumber={player.seatNumber}
                        host={player.isHost}
                        you={player.playerId === lobby.you.playerId}
                        avatarId={player.avatarId}
                        connectionStatus={player.connectionStatus}
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
                </>
              ) : null}
              {tab === 'log' ? (
                <>
                  <p className="ww-log-empty">No public events yet. The log starts once the game leaves the lobby.</p>
                  <TextField label="Table chat" placeholder="Chat is not open in this version." disabled fullWidth helperText="The table talks out loud. A written log arrives with the game." />
                </>
              ) : null}
              {tab === 'info' ? (
                <>
                  <PackSummary
                    summary={lobby.configuration.summary}
                    packName={packName}
                    modeLabel={MODE_LABEL[lobby.mode]}
                    layout="card"
                    warningCount={lobby.configuration.warningCount}
                    errorCount={lobby.configuration.errorCount}
                  />
                  <RoomInfo />
                </>
              ) : null}
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
          {warningLines.map((message) => (
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

function ModeMark() {
  return (
    <svg className="ww-lobby-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm8-1a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM4 18.5c0-2.2 2-4 4.5-4h.2c.9.6 2 1 3.3 1 1.2 0 2.3-.4 3.2-1h.3c2.4 0 4.5 1.8 4.5 4v.5H4v-.5Zm12.2-3.2c.5-.2 1.1-.3 1.6-.3 1.8 0 3.2 1.2 3.2 2.8V19h-3.2c.1-.3.2-.6.2-1 0-1.2-.6-2.3-1.8-2.7Z" />
    </svg>
  );
}

function PackMark() {
  return (
    <svg className="ww-lobby-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M4 7.5 12 4l8 3.5v9L12 20l-8-3.5v-9Zm8 1.2L7.2 6.8 12 4.7l4.8 2.1L12 8.7Zm-6 1.4 5 2.2v5.9l-5-2.2V10.1Zm7 8.1v-5.9l5-2.2v5.9l-5 2.2Z" />
    </svg>
  );
}

function SeatMark() {
  return (
    <svg className="ww-lobby-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm0 2c-3.3 0-8 1.7-8 5v1h16v-1c0-3.3-4.7-5-8-5Z" />
    </svg>
  );
}

function GearMark() {
  return (
    <svg className="ww-lobby-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M19.1 12.9c.1-.3.1-.6.1-.9s0-.6-.1-.9l2-1.6-2-3.4-2.4 1a7.4 7.4 0 0 0-1.6-.9l-.4-2.6h-4l-.4 2.6c-.6.2-1.1.5-1.6.9l-2.4-1-2 3.4 2 1.6c-.1.3-.1.6-.1.9s0 .6.1.9l-2 1.6 2 3.4 2.4-1c.5.4 1 .7 1.6.9l.4 2.6h4l.4-2.6c.6-.2 1.1-.5 1.6-.9l2.4 1 2-3.4-2-1.6ZM12 15.5A3.5 3.5 0 1 1 12 8a3.5 3.5 0 0 1 0 7.5Z" />
    </svg>
  );
}

function PlayMark() {
  return (
    <svg className="ww-lobby-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M8 5.5v13l11-6.5L8 5.5Z" />
    </svg>
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
