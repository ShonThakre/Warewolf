import { Box, Button, IconButton, Menu, MenuItem, Typography } from '@mui/material';
import { useId, useState, type MouseEvent } from 'react';
import { Link, NavLink, Outlet, useMatch } from 'react-router';
import { uiArtUrl } from '../assets/art';
import { PlayerAvatar } from '../game/components/PlayerAvatar';
import { isPhoneLayout, useLayoutMode } from '../game/layout';
import { useLobby, useSeat } from '../game/state/lobby';
import './app-shell.css';

/**
 * Top navigation shared by every shell. Desktop and tablet keep marketing
 * links (Play, How to Play, Roles). Phone layout modes use compact session
 * chrome: wordmark → lobby/home, seat avatar, and a ⋯ menu for the same links.
 */
export function AppShell() {
  const seat = useSeat();
  const { lobby } = useLobby();
  const home = useMatch({ path: '/', end: true });
  const layout = useLayoutMode();
  const sessionChrome = isPhoneLayout(layout.mode);
  const playTo = seat ? `/lobby/${seat.gameId}` : '/';
  /** Marketing keeps "Play"; session menu says "Lobby" when this tab has a seat. */
  const sessionPlayLabel = seat ? 'Lobby' : 'Play';
  const marketingNav = [
    { to: playTo, label: 'Play', end: !seat },
    { to: '/how-to-play', label: 'How to Play', end: false },
    { to: '/roles', label: 'Roles', end: false },
  ] as const;
  const sessionNav = [
    { to: playTo, label: sessionPlayLabel, end: !seat },
    { to: '/how-to-play', label: 'How to Play', end: false },
    { to: '/roles', label: 'Roles', end: false },
  ] as const;
  const emblem = uiArtUrl('emblem');
  const me = lobby?.players.find((player) => player.playerId === seat?.playerId);
  const seatedName = me?.displayName ?? 'You';
  const menuId = useId();
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const menuOpen = menuAnchor != null;

  const openMenu = (event: MouseEvent<HTMLElement>) => setMenuAnchor(event.currentTarget);
  const closeMenu = () => setMenuAnchor(null);

  const chrome = sessionChrome ? 'session' : 'marketing';
  const appClass = ['ww-app', home ? 'is-home' : null].filter(Boolean).join(' ');

  return (
    <Box
      className={appClass}
      data-chrome={chrome}
      data-layout={layout.mode}
      sx={{ height: '100dvh', minHeight: '100dvh', display: 'grid', gridTemplateRows: 'auto minmax(0, 1fr)', overflow: 'hidden' }}
    >
      <Box
        component="header"
        className={sessionChrome ? 'ww-app-nav ww-session-nav flex items-center gap-2' : 'ww-app-nav flex flex-wrap items-center gap-2'}
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
        <Typography
          component={Link}
          to={playTo}
          className="ww-wordmark flex items-center gap-2"
          aria-label={seat ? 'Back to lobby' : 'Werewolf home'}
          sx={{
            fontWeight: 800,
            fontSize: 'var(--text-title)',
            mr: 'auto',
            color: 'inherit',
            textDecoration: 'none',
            minWidth: 0,
          }}
        >
          {emblem ? <img className="ww-emblem" src={emblem} alt="" /> : null}
          <span className="ww-wordmark-text">Werewolf</span>
        </Typography>
        {sessionChrome ? (
          <>
            {seat ? (
              <span className="flex items-center gap-2" aria-label={me ? `${seatedName}, seated` : 'Seated'}>
                <PlayerAvatar name={seatedName} size="nav" avatarId={me?.avatarId ?? null} />
              </span>
            ) : null}
            <IconButton
              className="ww-session-menu-btn"
              aria-label="Menu"
              aria-controls={menuOpen ? menuId : undefined}
              aria-haspopup="true"
              aria-expanded={menuOpen ? 'true' : undefined}
              onClick={openMenu}
              size="small"
              sx={{ minWidth: 'var(--hit)', minHeight: 'var(--hit)' }}
            >
              <SessionMenuIcon />
            </IconButton>
            <Menu
              id={menuId}
              anchorEl={menuAnchor}
              open={menuOpen}
              onClose={closeMenu}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
              transformOrigin={{ vertical: 'top', horizontal: 'right' }}
              slotProps={{ list: { 'aria-label': 'Session' } }}
            >
              {sessionNav.map((item) => (
                <MenuItem
                  key={item.label}
                  component={NavLink}
                  to={item.to}
                  end={item.end}
                  onClick={closeMenu}
                >
                  {item.label}
                </MenuItem>
              ))}
            </Menu>
          </>
        ) : (
          <>
            <span className="ww-nav-rule" aria-hidden="true" />
            <Box component="nav" aria-label="Main" className="flex flex-wrap gap-1">
              {marketingNav.map((item) => (
                <Button
                  key={item.label}
                  component={NavLink}
                  to={item.to}
                  end={item.end}
                  color="inherit"
                  className={home && item.label === 'Play' ? 'active' : undefined}
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
          </>
        )}
      </Box>
      <Box className="ww-app-main" component="main" sx={{ minWidth: 0, minHeight: 0, overflow: 'auto' }}>
        <Outlet />
      </Box>
    </Box>
  );
}

function SessionMenuIcon() {
  return (
    <svg className="ww-session-menu-icon" viewBox="0 0 24 24" width="1.25rem" height="1.25rem" aria-hidden="true">
      <circle cx="5" cy="12" r="2" fill="currentColor" />
      <circle cx="12" cy="12" r="2" fill="currentColor" />
      <circle cx="19" cy="12" r="2" fill="currentColor" />
    </svg>
  );
}
