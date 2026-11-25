import { displayNameSchema, rejoinCodeSchema, roomCodeSchema, type SeatCredentials } from '@warewolf/contracts';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField } from '@mui/material';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { apiErrorOf, type ApiErrorInfo } from '../../api/api';
import { useCreateGameMutation, useJoinGameMutation, useRejoinGameMutation } from '../../api/lobby';
import { loadProfile } from '../../session/device';
import { useSeat } from '../state/lobby';

function fieldMessage(error: ApiErrorInfo | null, field: string): string | undefined {
  return error?.issues.find((issue) => issue.path === field)?.message;
}

/** Field-level codes are shown on the input. Everything else is a banner. */
function bannerMessage(error: ApiErrorInfo | null, fields: readonly string[]): string | null {
  if (!error) return null;
  if (error.code === 'DISPLAY_NAME_TAKEN' || error.code === 'NOT_FOUND') return null;
  if (error.code === 'VALIDATION_FAILED' && error.issues.some((issue) => fields.includes(issue.path))) return null;
  return error.message;
}

export function CreateGameDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const seat = useSeat();
  const navigate = useNavigate();
  const [createGame, { isLoading }] = useCreateGameMutation();
  const [name, setName] = useState('');
  const [nameError, setNameError] = useState<string | undefined>();
  const [error, setError] = useState<ApiErrorInfo | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(loadProfile()?.displayName ?? '');
    setNameError(undefined);
    setError(null);
  }, [open]);

  async function submit() {
    const parsed = displayNameSchema.safeParse(name);
    if (!parsed.success) {
      setNameError(parsed.error.issues[0]?.message ?? 'Check this name.');
      setError(null);
      return;
    }
    setNameError(undefined);
    const result = await createGame({ displayName: parsed.data, mode: 'INFECTION' });
    if ('data' in result && result.data) {
      onClose();
      navigate(`/lobby/${result.data.gameId}/setup`);
      return;
    }
    const info = apiErrorOf('error' in result ? result.error : null);
    setError(info);
    setNameError(info?.code === 'DISPLAY_NAME_TAKEN' ? info.message : fieldMessage(info, 'displayName'));
  }

  const banner = bannerMessage(error, ['displayName']);

  return (
    <Dialog open={open} onClose={isLoading ? undefined : onClose} fullWidth maxWidth="xs" aria-labelledby="create-game-title">
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <DialogTitle id="create-game-title">Create a game</DialogTitle>
        <DialogContent sx={{ display: 'grid', gap: 'var(--space)' }}>
          <p className="ww-dialog-copy">You will host the room. It opens as Infection Edition for 20 players, then Game setup so you can change the mode before the game starts.</p>
          <p className="ww-dialog-copy">Other players join with the room code shown in the lobby.</p>
          {seat ? <p className="ww-dialog-copy">Creating a game replaces the seat saved on this device. Your old seat stays open with its rejoin code.</p> : null}
          {banner ? <Alert severity="error">{banner}</Alert> : null}
          <TextField
            label="Display name"
            name="displayName"
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              setNameError(undefined);
              setError(null);
            }}
            error={Boolean(nameError)}
            helperText={nameError ?? '2 to 24 characters.'}
            fullWidth
            disabled={isLoading}
            autoFocus
            slotProps={{ htmlInput: { maxLength: 24, autoComplete: 'nickname' } }}
          />
        </DialogContent>
        <DialogActions>
          <Button type="button" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={isLoading}>
            {isLoading ? 'Creating…' : 'Create Game'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

export function JoinGameDialog({ open, onClose, onRejoin }: { open: boolean; onClose: () => void; onRejoin?: (roomCode: string) => void }) {
  const seat = useSeat();
  const navigate = useNavigate();
  const [joinGame, { isLoading }] = useJoinGameMutation();
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [codeError, setCodeError] = useState<string | undefined>();
  const [nameError, setNameError] = useState<string | undefined>();
  const [error, setError] = useState<ApiErrorInfo | null>(null);

  useEffect(() => {
    if (!open) return;
    setCode('');
    setName(loadProfile()?.displayName ?? '');
    setCodeError(undefined);
    setNameError(undefined);
    setError(null);
  }, [open]);

  async function submit() {
    const parsedCode = roomCodeSchema.safeParse(code);
    const parsedName = displayNameSchema.safeParse(name);
    setCodeError(parsedCode.success ? undefined : (parsedCode.error.issues[0]?.message ?? 'Check the room code.'));
    setNameError(parsedName.success ? undefined : (parsedName.error.issues[0]?.message ?? 'Check this name.'));
    if (!parsedCode.success || !parsedName.success) {
      setError(null);
      return;
    }
    const result = await joinGame({ roomCode: parsedCode.data, displayName: parsedName.data });
    if ('data' in result && result.data) {
      onClose();
      goToLobby(result.data, navigate);
      return;
    }
    const info = apiErrorOf('error' in result ? result.error : null);
    setError(info);
    if (info?.code === 'DISPLAY_NAME_TAKEN') setNameError(info.message);
    else setNameError(fieldMessage(info, 'displayName'));
    if (info?.code === 'NOT_FOUND') setCodeError(info.message);
    else setCodeError(fieldMessage(info, 'roomCode'));
  }

  const banner = bannerMessage(error, ['displayName', 'roomCode']);

  return (
    <Dialog open={open} onClose={isLoading ? undefined : onClose} fullWidth maxWidth="xs" aria-labelledby="join-game-title">
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <DialogTitle id="join-game-title">Join a game</DialogTitle>
        <DialogContent sx={{ display: 'grid', gap: 'var(--space)' }}>
          <p className="ww-dialog-copy">Ask the host for the room code on their lobby screen.</p>
          {seat ? <p className="ww-dialog-copy">Joining replaces the seat saved on this device. Your old seat stays open with its rejoin code.</p> : null}
          {banner ? <Alert severity="error">{banner}</Alert> : null}
          <TextField
            label="Room code"
            name="roomCode"
            value={code}
            onChange={(event) => {
              setCode(cleanRoomCode(event.target.value));
              setCodeError(undefined);
              setError(null);
            }}
            error={Boolean(codeError)}
            helperText={codeError ?? '6 letters or digits. The code skips I, L, O, 0, and 1.'}
            fullWidth
            disabled={isLoading}
            autoFocus
            placeholder="For example K7MXPQ"
            slotProps={{ htmlInput: { maxLength: 12, autoCapitalize: 'characters', autoComplete: 'off', spellCheck: 'false', inputMode: 'text' } }}
          />
          <TextField
            label="Display name"
            name="displayName"
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              setNameError(undefined);
              setError(null);
            }}
            error={Boolean(nameError)}
            helperText={nameError ?? '2 to 24 characters.'}
            fullWidth
            disabled={isLoading}
            slotProps={{ htmlInput: { maxLength: 24, autoComplete: 'nickname' } }}
          />
          {(error?.code === 'DISPLAY_NAME_TAKEN' || error?.code === 'GAME_STARTED') && onRejoin ? (
            <Alert
              severity="info"
              action={
                <Button color="inherit" size="small" onClick={() => onRejoin(cleanRoomCode(code))}>
                  Rejoin
                </Button>
              }
            >
              {error.code === 'GAME_STARTED' ? 'Already playing in this game? Use your rejoin code.' : 'Is this you? Rejoin your seat with your code.'}
            </Alert>
          ) : null}
        </DialogContent>
        <DialogActions>
          {onRejoin ? (
            <Button type="button" className="mr-auto" onClick={() => onRejoin(cleanRoomCode(code))} disabled={isLoading}>
              Have a rejoin code?
            </Button>
          ) : null}
          <Button type="button" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={isLoading}>
            {isLoading ? 'Joining…' : 'Join Game'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

/**
 * ID-01: get a seat back on this device with its rejoin code. The old device
 * loses the seat. Errors stay generic: a wrong room and a wrong code read the
 * same, so the dialog never confirms which one exists.
 */
export function RejoinDialog({ open, onClose, initialRoomCode = '' }: { open: boolean; onClose: () => void; initialRoomCode?: string }) {
  const navigate = useNavigate();
  const [rejoin, { isLoading }] = useRejoinGameMutation();
  const [room, setRoom] = useState('');
  const [code, setCode] = useState('');
  const [roomError, setRoomError] = useState<string | undefined>();
  const [codeError, setCodeError] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setRoom(initialRoomCode);
    setCode('');
    setRoomError(undefined);
    setCodeError(undefined);
    setError(null);
  }, [open, initialRoomCode]);

  async function submit() {
    const parsedRoom = roomCodeSchema.safeParse(room);
    const parsedCode = rejoinCodeSchema.safeParse(code);
    setRoomError(parsedRoom.success ? undefined : (parsedRoom.error.issues[0]?.message ?? 'Check the room code.'));
    setCodeError(parsedCode.success ? undefined : (parsedCode.error.issues[0]?.message ?? 'Check the rejoin code.'));
    if (!parsedRoom.success || !parsedCode.success) return;
    const result = await rejoin({ roomCode: parsedRoom.data, rejoinCode: parsedCode.data });
    if ('data' in result && result.data) {
      onClose();
      goToLobby(result.data, navigate);
      return;
    }
    const info = apiErrorOf('error' in result ? result.error : null);
    if (info?.code === 'NOT_FOUND') setError('We could not find that seat. Check both codes. The game may also have ended.');
    else if (info?.code === 'RATE_LIMITED') setError('Too many tries. Wait a minute, then try again.');
    else setError(info?.message ?? 'Rejoin did not work. Try again.');
  }

  return (
    <Dialog open={open} onClose={isLoading ? undefined : onClose} fullWidth maxWidth="xs" aria-labelledby="rejoin-title">
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <DialogTitle id="rejoin-title">Rejoin your seat</DialogTitle>
        <DialogContent sx={{ display: 'grid', gap: 'var(--space)' }}>
          <p className="ww-dialog-copy">Lost your seat, or switching devices? Enter the room code and the rejoin code you saved. Your seat opens here and closes on the other device.</p>
          {error ? <Alert severity="error">{error}</Alert> : null}
          <TextField
            label="Room code"
            name="roomCode"
            value={room}
            onChange={(event) => {
              setRoom(cleanRoomCode(event.target.value));
              setRoomError(undefined);
              setError(null);
            }}
            error={Boolean(roomError)}
            helperText={roomError ?? '6 letters or digits.'}
            fullWidth
            disabled={isLoading}
            autoFocus={!initialRoomCode}
            slotProps={{ htmlInput: { maxLength: 12, autoCapitalize: 'characters', autoComplete: 'off', spellCheck: 'false' } }}
          />
          <TextField
            label="Rejoin code"
            name="rejoinCode"
            value={code}
            onChange={(event) => {
              setCode(cleanRejoinCode(event.target.value));
              setCodeError(undefined);
              setError(null);
            }}
            error={Boolean(codeError)}
            helperText={codeError ?? '8 letters or digits, like K7P4-QX2M.'}
            fullWidth
            disabled={isLoading}
            autoFocus={Boolean(initialRoomCode)}
            placeholder="XXXX-XXXX"
            slotProps={{ htmlInput: { maxLength: 9, autoCapitalize: 'characters', autoComplete: 'one-time-code', spellCheck: 'false' } }}
          />
        </DialogContent>
        <DialogActions>
          <Button type="button" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={isLoading}>
            {isLoading ? 'Rejoining…' : 'Rejoin'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

/** `k7p4qx2m` → `K7P4-QX2M` as the player types. */
export function cleanRejoinCode(value: string): string {
  const raw = value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
  return raw.length > 4 ? `${raw.slice(0, 4)}-${raw.slice(4)}` : raw;
}

/** Uppercase, with spaces and dashes from a pasted invite dropped. */
export function cleanRoomCode(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
}

function goToLobby(seat: SeatCredentials, navigate: ReturnType<typeof useNavigate>) {
  navigate(`/lobby/${seat.gameId}`);
}
