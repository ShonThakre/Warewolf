import { MODE_BOUNDS, type GameMode } from '@warewolf/domain';
import type { LobbyProjection } from '@warewolf/contracts';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle } from '@mui/material';
import { useState } from 'react';
import { Link } from 'react-router';
import { sceneArtUrl, uiArtUrl } from '../assets/art';
import { useGetRolePacksQuery } from '../api/lobby';
import { CreateGameDialog, JoinGameDialog } from '../game/components/SeatDialogs';
import { MODE_LABEL, returnSeatLabel } from '../game/components/lobbyCopy';
import { useLayoutMode } from '../game/layout';
import { useLobby, useSeat } from '../game/state/lobby';
import { gamePath } from '../game/state/role';
import '../game/components/home-scene.css';
import '../game/components/scene-art.css';

const FALLBACK_MODES = [
  { mode: 'INFECTION', name: 'Infection Edition', description: 'The default 20-player game. Create Game starts here.' },
  { mode: 'CLASSIC', name: 'Classic', description: 'A shorter game with a wolf pack and a village.' },
  { mode: 'EXPANDED', name: 'Expanded', description: 'More roles and larger tables.' },
  { mode: 'CUSTOM', name: 'Custom', description: 'A table built from chosen roles.' },
  { mode: 'ULTIMATE_20', name: 'Ultimate 20', description: 'Twenty seats: fifteen special roles and five villagers. The roster is locked.' },
] as const satisfies readonly { mode: GameMode; name: string; description: string }[];

function playerRange(mode: GameMode): string {
  const { min, max } = MODE_BOUNDS[mode];
  return min === max ? `${min} players` : `${min} to ${max} players`;
}

function seatWhere(status: LobbyProjection['status']): string {
  if (status === 'LOBBY') return 'Lobby';
  if (status === 'ACTIVE') return 'In game';
  if (status === 'FINISHED') return 'Finished';
  if (status === 'CANCELLED') return 'Cancelled';
  return 'Open';
}

/** Real seat facts only. No sample village name. */
function seatLine(lobby: LobbyProjection | null, loading: boolean): string {
  if (!lobby) return loading ? 'Opening your seat…' : 'Saved in this browser.';
  return `${MODE_LABEL[lobby.mode]} · ${seatWhere(lobby.status)} · ${lobby.players.length} of ${lobby.playerCount}`;
}

function EditionMark() {
  return (
    <svg className="ww-home-edition-mark" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="2.2" fill="currentColor" />
      <path
        d="M12 3.2a2.2 2.2 0 1 1 0 4.4M12 3.2V8M5.4 16.2a2.2 2.2 0 1 1 3.2 2.5M6.9 17.4 10.1 13.5M18.6 16.2a2.2 2.2 0 1 0-3.2 2.5M17.1 17.4 13.9 13.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function PlusMark() {
  return (
    <svg className="ww-home-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

function PeopleMark() {
  return (
    <svg className="ww-home-icon" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="9" cy="8.2" r="2.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="16" cy="9.2" r="2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M3.8 18.2c.6-2.6 2.6-3.9 5.2-3.9s4.6 1.3 5.2 3.9" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M14.4 14.6c1.6.2 3 1.1 3.7 3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function ModesMark() {
  return (
    <svg className="ww-home-icon" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3.5" y="7" width="17" height="11" rx="3" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path d="M8 11.2v2.2M10.2 10.2v4.2M7.2 12.3h1.6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="15.6" cy="11.2" r="0.8" fill="currentColor" />
      <circle cx="17.4" cy="13.4" r="0.8" fill="currentColor" />
    </svg>
  );
}

function BookMark() {
  return (
    <svg className="ww-home-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6.5 4.5h9.2A2.3 2.3 0 0 1 18 6.8v12.7l-5.5-2.6L7 19.5V6.8A2.3 2.3 0 0 1 9.3 4.5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    </svg>
  );
}

function GuideMark() {
  return (
    <svg className="ww-home-icon" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path d="M9.6 9.4a2.4 2.4 0 1 1 3.3 2.2c-.7.3-1.1.8-1.1 1.5V14" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <circle cx="11.8" cy="16.6" r="0.8" fill="currentColor" />
    </svg>
  );
}

function ChevronMark() {
  return (
    <svg className="ww-home-chevron" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9 6.5 15 12l-6 5.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChairMark() {
  return (
    <svg className="ww-home-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 10.5V6.8A1.8 1.8 0 0 1 8.8 5h6.4A1.8 1.8 0 0 1 17 6.8v3.7" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M6 10.5h12v3.2H6zM8.2 13.7V19M15.8 13.7V19" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Night village. Create starts Infection Edition. Join asks for a room code. */
export function Home() {
  const seat = useSeat();
  const { lobby, isLoading } = useLobby();
  const packs = useGetRolePacksQuery();
  const layout = useLayoutMode();
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [modesOpen, setModesOpen] = useState(false);
  const homeLayout =
    layout.mode === 'phone-landscape' || layout.mode === 'narrow-landscape'
      ? 'short'
      : layout.mode === 'portrait' || (layout.mode === 'tablet' && !layout.landscape)
        ? 'stack'
        : 'wide';

  const modes =
    packs.data && packs.data.length > 0
      ? packs.data.map((pack) => ({
          id: pack.id,
          name: pack.name,
          players: playerRange(pack.mode),
          description: pack.description,
          unavailable: pack.status === 'BLOCKED' || pack.status === 'TEMPLATE',
        }))
      : null;

  const homeScene = sceneArtUrl('home_night_village');
  const emblem = uiArtUrl('emblem');
  const returnTo = seat ? (lobby ? (gamePath(lobby.gameId, lobby.status, lobby.phase) ?? `/lobby/${seat.gameId}`) : `/lobby/${seat.gameId}`) : '/';
  const returnLabel = returnSeatLabel(lobby?.status ?? null);

  return (
    <div className="ww-home" data-layout={layout.mode} data-home={homeLayout}>
      <div className="ww-home-wash" aria-hidden="true">
        {homeScene ? <img src={homeScene} alt="" fetchPriority="high" /> : null}
      </div>
      <div className="ww-home-card">
        {emblem ? <img className="ww-home-mark" src={emblem} alt="" fetchPriority="high" /> : null}
        <h1 className="ww-home-title">Werewolf</h1>
        <p className="ww-home-edition">
          <EditionMark />
          Infection Edition
        </p>
        <p className="ww-home-tag">A social-deduction game of hidden roles, bluffing, and teamwork. Find the Werewolves before the infection spreads.</p>
        <div className="ww-home-actions">
          <Button className="ww-home-create" variant="contained" color="secondary" onClick={() => setCreateOpen(true)}>
            <PlusMark />
            Create Game
          </Button>
          <Button className="ww-home-join" variant="outlined" onClick={() => setJoinOpen(true)}>
            <PeopleMark />
            Join Game
          </Button>
        </div>
        <div className="ww-home-links">
          <Button onClick={() => setModesOpen(true)}>
            <ModesMark />
            Game Modes
            <ChevronMark />
          </Button>
          <span className="ww-home-link-rule" aria-hidden="true" />
          <Button component={Link} to="/roles">
            <BookMark />
            Role Library
            <ChevronMark />
          </Button>
          <span className="ww-home-link-rule" aria-hidden="true" />
          <Button component={Link} to="/how-to-play">
            <GuideMark />
            How to Play
            <ChevronMark />
          </Button>
        </div>
        <hr className="ww-home-rule" />
        {seat ? (
          <div className="ww-home-return" role="region" aria-label="Your seat">
            <Button component={Link} to={returnTo} className="ww-home-return-link" aria-labelledby="home-return-title">
              <ChairMark />
              <span className="ww-home-return-copy">
                <span id="home-return-title" className="ww-home-return-title">
                  {returnLabel}
                </span>
                <span className="ww-home-note">
                  {lobby?.roomCode ?? seat.roomCode}
                  {' · '}
                  {seatLine(lobby, isLoading)}
                </span>
              </span>
              <ChevronMark />
            </Button>
          </div>
        ) : null}
      </div>
      <CreateGameDialog open={createOpen} onClose={() => setCreateOpen(false)} />
      <JoinGameDialog open={joinOpen} onClose={() => setJoinOpen(false)} />
      <Dialog open={modesOpen} onClose={() => setModesOpen(false)} fullWidth maxWidth="xs" aria-labelledby="game-modes-title">
        <DialogTitle id="game-modes-title">Game modes</DialogTitle>
        <DialogContent sx={{ display: 'grid', gap: 'var(--space)' }}>
          <p className="ww-dialog-copy">A new room starts as Infection Edition. The host can switch to another mode in setup, before the game starts.</p>
          {packs.isLoading ? <p className="ww-dialog-copy">Loading game modes…</p> : null}
          {packs.isError && !modes ? <p className="ww-dialog-copy">Game modes could not be loaded.</p> : null}
          <ul className="ww-mode-list">
            {(modes ?? FALLBACK_MODES.map((mode) => ({ ...mode, id: mode.name, players: playerRange(mode.mode), unavailable: false }))).map((mode) => (
              <li key={mode.id}>
                <p className="ww-mode-name">{mode.name}</p>
                <p className="ww-mode-meta">{mode.players}</p>
                <p className="ww-dialog-copy">{mode.description}</p>
                {mode.unavailable ? <p className="ww-dialog-copy">Not available yet.</p> : null}
              </li>
            ))}
          </ul>
          {packs.data?.some((pack) => pack.mode === 'INFECTION') ? (
            <p className="ww-dialog-copy">{MODE_LABEL.INFECTION} is the table Create Game opens.</p>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setModesOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
