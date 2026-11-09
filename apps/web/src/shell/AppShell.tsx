import { Box, Button, Typography } from '@mui/material';
import { NavLink, Outlet } from 'react-router';

const NAV = [
  { to: '/', label: 'Play', end: true },
  { to: '/how-to-play', label: 'How to Play', end: false },
  { to: '/roles', label: 'Roles', end: false },
] as const;

/**
 * Top navigation shared by every shell: wordmark, Play, How to Play, Roles.
 * The seated player's avatar joins it once sessions exist (Phase 3).
 */
export function AppShell() {
  return (
    <Box sx={{ minHeight: '100dvh', display: 'grid', gridTemplateRows: 'var(--bar) 1fr' }}>
      <Box
        component="header"
        className="flex items-center gap-2"
        sx={{
          px: 'max(var(--space), env(safe-area-inset-left))',
          borderBottom: '1px solid var(--border)',
          background: 'var(--surface)',
        }}
      >
        <Typography component="span" sx={{ fontWeight: 800, fontSize: 'var(--text-title)', mr: 'auto' }}>
          Werewolf
        </Typography>
        <Box component="nav" aria-label="Main" className="flex gap-1">
          {NAV.map((item) => (
            <Button
              key={item.to}
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
      </Box>
      <Box component="main" sx={{ minWidth: 0 }}>
        <Outlet />
      </Box>
    </Box>
  );
}
