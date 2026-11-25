import { formatRejoinCode } from '@warewolf/contracts';
import { Alert, Badge, Button, Dialog, DialogActions, DialogContent, DialogTitle, Snackbar, Tab, Tabs } from '@mui/material';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router';
import { apiErrorOf } from '../../api/api';
import { useNewRejoinCodeMutation } from '../../api/lobby';
import { useAppSelector } from '../../app/hooks';
import { revokedSeen, selectRevoked } from '../../session/sessionSlice';
import { useSeat } from '../state/lobby';
import { useShownConnection, type ConnectionState } from '../state/presence';
import { GameIcon } from './GameIcon';
import './seat-panels.css';

/**
 * ID-01 / LOG-02 surfaces around the seat: the rejoin code, the notice when a
 * seat is opened elsewhere, the connection notice, and the rail's Chat | Log
 * switch.
 */

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * The seat's rejoin code with Copy. A seat stored before rejoin codes has
 * none; "Get a rejoin code" asks the server for one.
 */
export function RejoinCodeCard({ compact = false }: { readonly compact?: boolean }) {
  const seat = useSeat();
  const [issue, issuing] = useNewRejoinCodeMutation();
  const [copied, setCopied] = useState<'yes' | 'no' | null>(null);
  if (!seat) return null;
  const code = seat.rejoinCode ? formatRejoinCode(seat.rejoinCode) : null;
  const error = issuing.error ? apiErrorOf(issuing.error) : null;

  return (
    <section className="ww-rejoin-card" data-compact={compact || undefined} aria-labelledby="rejoin-code-title">
      <h3 id="rejoin-code-title" className="ww-rejoin-title">
        <GameIcon name="lock" size={16} />
        Your rejoin code
      </h3>
      {code ? (
        <div className="ww-rejoin-row">
          <code className="ww-rejoin-code" aria-label={`Rejoin code ${code.split('').join(' ')}`}>
            {code}
          </code>
          <Button
            size="small"
            variant="outlined"
            startIcon={<GameIcon name={copied === 'yes' ? 'check' : 'copy'} size={16} />}
            onClick={() => void copyText(code).then((ok) => setCopied(ok ? 'yes' : 'no'))}
          >
            {copied === 'yes' ? 'Copied' : 'Copy'}
          </Button>
        </div>
      ) : (
        <Button size="small" variant="outlined" disabled={issuing.isLoading} onClick={() => void issue({ gameId: seat.gameId })}>
          {issuing.isLoading ? 'Getting a code…' : 'Get a rejoin code'}
        </Button>
      )}
      <p className="ww-rejoin-help">
        This device brings you back on its own, even after you close the browser. Use the code with room <strong>{seat.roomCode}</strong> to get back in from
        another phone or browser. Keep it to yourself: it opens your seat.
      </p>
      {copied === 'no' ? <p className="ww-rejoin-help">Copy did not work here. Write the code down instead.</p> : null}
      {error ? <Alert severity="error">{error.message}</Alert> : null}
    </section>
  );
}

const NOTICED_KEY = 'warewolf.rejoin-noticed';

/**
 * Once per code: a quiet snackbar after joining (or rejoining) that says the
 * seat is saved and shows the code. Never a blocking dialog.
 */
export function RejoinCodeNotice() {
  const seat = useSeat();
  const code = seat?.rejoinCode ?? null;
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!code) return;
    let noticed: string | null = null;
    try {
      noticed = globalThis.localStorage?.getItem(NOTICED_KEY) ?? null;
    } catch {
      noticed = null;
    }
    if (noticed === code) return;
    setOpen(true);
    setCopied(false);
  }, [code]);

  const close = () => {
    setOpen(false);
    try {
      if (code) globalThis.localStorage?.setItem(NOTICED_KEY, code);
    } catch {
      // Shown again next visit.
    }
  };

  if (!code || !seat) return null;
  const pretty = formatRejoinCode(code);
  return (
    <Snackbar
      open={open}
      onClose={(_event, reason) => {
        if (reason !== 'clickaway') close();
      }}
      autoHideDuration={12_000}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
    >
      <Alert
        severity="success"
        variant="filled"
        onClose={close}
        icon={<GameIcon name="check" size={20} />}
        action={
          <Button color="inherit" size="small" onClick={() => void copyText(pretty).then(setCopied)}>
            {copied ? 'Copied' : 'Copy code'}
          </Button>
        }
      >
        {seat.resumed ? 'Welcome back. ' : 'Your seat is saved on this device. '}
        Rejoin code <strong>{pretty}</strong>
      </Alert>
    </Snackbar>
  );
}

/** ID-01: shown once after the server closed this seat here. Mounted in the app shell. */
export function SeatRevokedDialog() {
  const reason = useAppSelector(selectRevoked);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const done = () => {
    dispatch(revokedSeen());
    navigate('/', { replace: true });
  };
  return (
    <Dialog open={reason !== null} onClose={done} fullWidth maxWidth="xs" aria-labelledby="seat-revoked-title">
      <DialogTitle id="seat-revoked-title">{reason === 'KICKED' ? 'You were removed from the room' : 'Your seat moved to another device'}</DialogTitle>
      <DialogContent>
        <p className="ww-dialog-copy">
          {reason === 'KICKED'
            ? 'The host removed your seat. You can join again with the room code while the room is still in the lobby.'
            : 'Someone opened your seat with its rejoin code, so it is no longer open here. If that was you, carry on on the other device. If it was not, ask the host.'}
        </p>
      </DialogContent>
      <DialogActions>
        <Button variant="contained" onClick={done}>
          Back to home
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/**
 * ID-02: "Reconnecting…" only after two seconds offline, then a short "Back
 * online". A role=status region, so a screen reader hears it without a jump.
 */
export function ConnectionNotice({ state }: { readonly state: ConnectionState }) {
  const shown = useShownConnection(state);
  const [back, setBack] = useState(false);
  const wasDown = useRef(false);

  useEffect(() => {
    if (shown === 'reconnecting') {
      wasDown.current = true;
      setBack(false);
      return;
    }
    if (!wasDown.current) return;
    wasDown.current = false;
    setBack(true);
    const timer = setTimeout(() => setBack(false), 3000);
    return () => clearTimeout(timer);
  }, [shown]);

  return (
    <span className="ww-connection" role="status" data-state={shown === 'reconnecting' ? 'down' : back ? 'back' : undefined}>
      {shown === 'reconnecting' ? 'Reconnecting…' : back ? 'Back online' : ''}
    </span>
  );
}

/**
 * LOG-02: the rail's Chat | Log switch. The Log tab carries an unread count
 * while chat is open, so news never steals focus from a conversation.
 */
export function RailTabs({ chat, log, unread, onLogShown }: { readonly chat: ReactNode; readonly log: (active: boolean) => ReactNode; readonly unread: number; readonly onLogShown?: () => void }) {
  const [tab, setTab] = useState<'chat' | 'log'>('chat');
  return (
    <div className="ww-rail-tabs">
      <Tabs
        value={tab}
        onChange={(_event, value: 'chat' | 'log') => {
          setTab(value);
          if (value === 'log') onLogShown?.();
        }}
        variant="fullWidth"
        aria-label="Rail"
      >
        <Tab value="chat" label="Chat" id="rail-chat-tab" aria-controls="rail-chat-panel" />
        <Tab
          value="log"
          id="rail-log-tab"
          aria-controls="rail-log-panel"
          label={
            <Badge color="secondary" badgeContent={tab === 'log' ? 0 : unread} max={99} aria-label={unread > 0 && tab !== 'log' ? `Log, ${unread} new` : undefined}>
              <span className="ww-rail-tab-label">Log</span>
            </Badge>
          }
        />
      </Tabs>
      <div className="ww-rail-panel" id="rail-chat-panel" role="tabpanel" aria-labelledby="rail-chat-tab" hidden={tab !== 'chat'}>
        {tab === 'chat' ? chat : null}
      </div>
      <div className="ww-rail-panel" id="rail-log-panel" role="tabpanel" aria-labelledby="rail-log-tab" hidden={tab !== 'log'}>
        {tab === 'log' ? log(true) : null}
      </div>
    </div>
  );
}
