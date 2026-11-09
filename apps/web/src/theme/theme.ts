import { createTheme } from '@mui/material/styles';
import { tokens } from './tokens';

/** MUI owns controls. Its palette is built from the tokens. */
export const theme = createTheme({
  palette: {
    mode: 'dark',
    background: { default: tokens['--bg'], paper: tokens['--surface'] },
    primary: { main: tokens['--primary'], contrastText: tokens['--primary-ink'] },
    secondary: { main: tokens['--accent'], contrastText: tokens['--accent-ink'] },
    error: { main: tokens['--danger'] },
    success: { main: tokens['--village'] },
    text: { primary: tokens['--text'], secondary: tokens['--text-muted'] },
    divider: tokens['--border'],
  },
  shape: { borderRadius: 12 },
  typography: {
    fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    button: { textTransform: 'none', fontWeight: 600 },
  },
  components: {
    MuiButtonBase: { defaultProps: { disableRipple: false } },
    MuiButton: { styleOverrides: { root: { minHeight: 'var(--hit)' } } },
    MuiPaper: { styleOverrides: { root: { backgroundImage: 'none' } } },
  },
});
