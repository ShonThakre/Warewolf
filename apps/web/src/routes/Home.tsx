import { Button, Dialog, DialogActions, DialogContent, DialogTitle } from '@mui/material';
import { useState } from 'react';
import { Link } from 'react-router';
import { sceneArtUrl } from '../assets/art';
import { useGetRolePacksQuery } from '../api/lobby';
import { CreateGameDialog, JoinGameDialog } from '../game/components/SeatDialogs';
import { MODE_LABEL } from '../game/components/lobbyCopy';
import { useSeat } from '../game/state/lobby';
import '../game/components/home-scene.css';
import '../game/components/scene-art.css';

const FALLBACK_MODES = [
  { name: 'Infection Edition', description: 'The default 20-player game. Create Game starts here.' },
  { name: 'Classic', description: 'A shorter game with a wolf pack and a village.' },
  { name: 'Expanded', description: 'More roles and larger tables.' },
  { name: 'Custom', description: 'A table built from chosen roles.' },
  { name: 'Ultimate 20', description: 'Twenty seats: fifteen special roles and five villagers. The roster is locked.' },
] as const;

/** Full-bleed night scene. Create starts Infection Edition. Join asks for a room code. */
export function Home() {
  const seat = useSeat();
  const packs = useGetRolePacksQuery();
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [modesOpen, setModesOpen] = useState(false);

  const modes =
    packs.data && packs.data.length > 0
      ? packs.data.map((pack) => ({
          id: pack.id,
          name: pack.name,
          description: pack.description,
          unavailable: pack.status === 'BLOCKED' || pack.status === 'TEMPLATE',
        }))
      : null;

  const homeScene = sceneArtUrl('home_night_village');

  return (
    <div className="ww-home">
      <div className="ww-home-wash" aria-hidden="true">
        {homeScene ? <img src={homeScene} alt="" /> : null}
      </div>
      <div className="ww-home-card">
        <h1 className="ww-home-title">Werewolf</h1>
        <p className="ww-home-edition">Infection Edition</p>
        <p className="ww-home-tag">A social deduction game played around one table.</p>
        {seat ? (
          <p className="ww-home-note">
            This tab already has a seat.
          </p>
        ) : null}
        {seat ? (
          <Button component={Link} to={`/lobby/${seat.gameId}`} variant="contained" color="secondary">
            Return to the lobby
          </Button>
        ) : null}
        <div className="ww-home-actions">
          <Button variant="contained" onClick={() => setCreateOpen(true)}>
            Create Game
          </Button>
          <Button variant="outlined" onClick={() => setJoinOpen(true)}>
            Join Game
          </Button>
        </div>
        <div className="ww-home-links">
          <Button onClick={() => setModesOpen(true)}>Game Modes</Button>
          <Button component={Link} to="/roles">
            Role Library
          </Button>
          <Button component={Link} to="/how-to-play">
            How to Play
          </Button>
        </div>
      </div>
      <CreateGameDialog open={createOpen} onClose={() => setCreateOpen(false)} />
      <JoinGameDialog open={joinOpen} onClose={() => setJoinOpen(false)} />
      <Dialog open={modesOpen} onClose={() => setModesOpen(false)} fullWidth maxWidth="xs" aria-labelledby="game-modes-title">
        <DialogTitle id="game-modes-title">Game modes</DialogTitle>
        <DialogContent sx={{ display: 'grid', gap: 'var(--space)' }}>
          <p className="ww-dialog-copy">A new room starts as Infection Edition.</p>
          {packs.isLoading ? <p className="ww-dialog-copy">Loading game modes…</p> : null}
          {packs.isError && !modes ? <p className="ww-dialog-copy">Game modes could not be loaded.</p> : null}
          <ul className="ww-mode-list">
            {(modes ?? FALLBACK_MODES.map((mode) => ({ ...mode, id: mode.name, unavailable: false }))).map((mode) => (
              <li key={mode.id}>
                <p className="ww-mode-name">{mode.name}</p>
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
