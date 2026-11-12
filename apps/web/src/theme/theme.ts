import { createTheme } from '@mui/material/styles';
import { tokens } from './tokens';
import './visual.css';

const font = tokens['--font-display'];

/**
 * MUI owns controls. The palette, type, and button variants are built from
 * the tokens: purple for the primary action, gold for confirm and start.
 */
export const theme = createTheme({
  palette: {
    mode: 'dark',
    background: { default: tokens['--bg'], paper: tokens['--surface'] },
    primary: { main: tokens['--primary'], contrastText: tokens['--primary-ink'] },
    secondary: { main: tokens['--accent'], contrastText: tokens['--accent-ink'] },
    error: { main: tokens['--danger'], contrastText: tokens['--accent-ink'] },
    success: { main: tokens['--village'], contrastText: tokens['--accent-ink'] },
    text: { primary: tokens['--text'], secondary: tokens['--text-muted'] },
    divider: tokens['--border'],
  },
  shape: { borderRadius: 16 },
  typography: {
    fontFamily: font,
    button: { textTransform: 'none', fontWeight: 700, fontSize: 'var(--text-body)' },
    h1: { fontFamily: font, fontWeight: 800, fontSize: 'var(--text-title)' },
    h2: { fontFamily: font, fontWeight: 800, fontSize: 'var(--text-title)' },
    body1: { fontSize: 'var(--text-body)' },
    body2: { fontSize: 'var(--text-label)' },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: { fontFamily: font, fontSize: 'var(--text-body)' },
      },
    },
    MuiButtonBase: {
      styleOverrides: {
        root: {
          '&.Mui-focusVisible': {
            outline: '2px solid var(--accent)',
            outlineOffset: '2px',
          },
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          minHeight: 'var(--hit)',
          borderRadius: 'var(--radius-pill)',
          paddingInline: 'var(--space)',
          fontFamily: font,
        },
        contained: {
          '&.MuiButton-colorPrimary': {
            backgroundColor: 'var(--primary)',
            color: 'var(--primary-ink)',
            '&:hover': { backgroundColor: 'var(--primary-hover)' },
          },
          '&.MuiButton-colorSecondary': {
            backgroundColor: 'var(--accent)',
            color: 'var(--accent-ink)',
            '&:hover': { backgroundColor: 'var(--accent-hover)' },
          },
          '&.MuiButton-colorError': {
            backgroundColor: 'var(--danger)',
            color: 'var(--accent-ink)',
          },
          '&.Mui-disabled': {
            backgroundColor: 'var(--surface-raised)',
            color: 'var(--text-muted)',
          },
        },
        outlined: {
          color: 'var(--text)',
          borderColor: 'var(--primary)',
          '&:hover': { borderColor: 'var(--primary-hover)', backgroundColor: 'transparent' },
          '&.Mui-disabled': { borderColor: 'var(--border)', color: 'var(--text-muted)' },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          borderRadius: 'var(--radius)',
          backgroundColor: 'var(--surface)',
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: 'var(--accent)' },
        },
      },
    },
    MuiTabs: {
      styleOverrides: { indicator: { backgroundColor: 'var(--accent)' } },
    },
  },
});
