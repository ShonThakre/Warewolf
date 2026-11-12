import { MODE_BOUNDS, type GameMode } from '@warewolf/domain';
import type { LobbyProjection } from '@warewolf/contracts';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle } from '@mui/material';
import { useState } from 'react';
import { Link } from 'react-router';
import { sceneArtUrl, uiArtUrl } from '../assets/art';
import { useGetRolePacksQuery } from '../api/lobby';
import { GameIcon } from '../game/components/GameIcon';
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
  return <GameIcon className="ww-home-edition-mark" name="infect" size={18} />;
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
        <div className="ww-home-hero">
          {emblem ? <img className="ww-home-mark" src={emblem} alt="" fetchPriority="high" /> : null}
          <h1 className="ww-home-title">Werewolf</h1>
          <p className="ww-home-edition">
            <EditionMark />
            Infection Edition
          </p>
        </div>
        <p className="ww-home-tag">Find the werewolves, stop the infection, and keep your village safe — before it is too late.</p>
        <div className="ww-home-actions">
          <Button className="ww-home-create" variant="contained" color="secondary" onClick={() => setCreateOpen(true)}>
            <GameIcon className="ww-home-icon" name="plus" size={20} />
            Create Game
          </Button>
          <Button className="ww-home-join" variant="outlined" onClick={() => setJoinOpen(true)}>
            <GameIcon className="ww-home-icon" name="people" size={20} />
            Join Game
          </Button>
        </div>
        <div className="ww-home-links">
          <Button onClick={() => setModesOpen(true)}>
            <GameIcon className="ww-home-icon" name="layers" size={20} />
            Game Modes
            <GameIcon className="ww-home-chevron" name="chevron" size={18} />
          </Button>
          <span className="ww-home-link-rule" aria-hidden="true" />
          <Button component={Link} to="/roles">
            <GameIcon className="ww-home-icon" name="card" size={20} />
            Role Library
            <GameIcon className="ww-home-chevron" name="chevron" size={18} />
          </Button>
          <span className="ww-home-link-rule" aria-hidden="true" />
          <Button component={Link} to="/how-to-play">
            <GameIcon className="ww-home-icon" name="book" size={20} />
            How to Play
            <GameIcon className="ww-home-chevron" name="chevron" size={18} />
          </Button>
        </div>
        <hr className="ww-home-rule" />
        {seat ? (
          <div className="ww-home-return" role="region" aria-label="Your seat">
            <Button component={Link} to={returnTo} className="ww-home-return-link" aria-labelledby="home-return-title">
              <span className="ww-home-return-mark" aria-hidden="true">
                <GameIcon name="moon" size={22} />
              </span>
              <span className="ww-home-return-copy">
                <span className="ww-home-return-kicker">Resume game</span>
                <span id="home-return-title" className="ww-home-return-title">
                  {returnLabel}
                </span>
                <span className="ww-home-note">
                  {lobby?.roomCode ?? seat.roomCode}
                  {' · '}
                  {seatLine(lobby, isLoading)}
                </span>
              </span>
              <GameIcon className="ww-home-chevron" name="chevron" size={18} />
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
