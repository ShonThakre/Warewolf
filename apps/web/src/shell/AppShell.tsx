import { Box, Button, Typography } from '@mui/material';
import { NavLink, Outlet } from 'react-router';
import { uiArtUrl } from '../assets/art';
import { PlayerAvatar } from '../game/components/PlayerAvatar';
import { useLobby, useSeat } from '../game/state/lobby';

/**
 * Top navigation shared by every shell: wordmark, Play, How to Play, Roles,
 * and the seated player's monogram. Play returns to the lobby when this tab has a seat.
 */
export function AppShell() {
  const seat = useSeat();
  const { lobby } = useLobby();
  const playTo = seat ? `/lobby/${seat.gameId}` : '/';
  const nav = [
    { to: playTo, label: 'Play', end: !seat },
    { to: '/how-to-play', label: 'How to Play', end: false },
    { to: '/roles', label: 'Roles', end: false },
  ] as const;
  const emblem = uiArtUrl('emblem');
  const me = lobby?.players.find((player) => player.playerId === seat?.playerId);
  const seatedName = me?.displayName ?? 'You';

  return (
    <Box className="ww-app" sx={{ height: '100dvh', minHeight: '100dvh', display: 'grid', gridTemplateRows: 'auto minmax(0, 1fr)', overflow: 'hidden' }}>
      <Box
        component="header"
        className="ww-app-nav flex flex-wrap items-center gap-2"
        sx={{
          minHeight: 'var(--bar)',
          px: 'max(var(--space), env(safe-area-inset-left))',
          pr: 'max(var(--space), env(safe-area-inset-right))',
          pt: 'env(safe-area-inset-top)',
          borderBottom: '1px solid var(--border)',
          background: 'var(--surface)',
          minWidth: 0,
        }}
      >
        <Typography component="span" className="ww-wordmark flex items-center gap-2" sx={{ fontWeight: 800, fontSize: 'var(--text-title)', mr: 'auto' }}>
          {emblem ? <img className="ww-emblem" src={emblem} alt="" /> : null}
          Werewolf
        </Typography>
        <Box component="nav" aria-label="Main" className="flex flex-wrap gap-1">
          {nav.map((item) => (
            <Button
              key={item.label}
              component={NavLink}
              to={item.to}
              end={item.end}
              color="inherit"
              sx={{ '&.active': { color: 'var(--accent)' } }}
            >
              {item.label}
            </Button>
          ))}
        </Box>
        {seat ? (
          <span className="flex items-center gap-2" aria-label={me ? `${seatedName}, seated` : 'Seated'}>
            <PlayerAvatar name={seatedName} size="nav" avatarId={me?.avatarId ?? null} />
          </span>
        ) : null}
      </Box>
      <Box className="ww-app-main" component="main" sx={{ minWidth: 0, minHeight: 0, overflow: 'auto' }}>
        <Outlet />
      </Box>
    </Box>
  );
}
