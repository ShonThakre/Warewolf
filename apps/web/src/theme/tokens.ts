/**
 * Theme tokens from docs/werewolf/ui-ux-plan.md, section 2, settled against
 * the mockup grids. This object is the single source: it is written to :root
 * as CSS variables and also feeds the MUI palette. Screens read the variables
 * and do not invent local hex values.
 *
 * The day wash is darker than the plan's starting brown so a purple button
 * and the team words stay WCAG AA on both ends of the gradient. The wolf word
 * is a lighter rose for the same reason.
 */
export const tokens = {
  '--bg': '#140b22',
  '--bg-night': 'linear-gradient(180deg, #1a1030, #2a1248)',
  '--bg-day': 'linear-gradient(180deg, #2a1844, #3a2214)',
  '--surface': '#241538',
  '--surface-raised': '#31204c',
  '--primary': '#7c4dff',
  '--primary-hover': '#7858f9',
  '--primary-ink': '#ffffff',
  '--accent': '#f5b942',
  '--accent-hover': '#e0a42e',
  '--accent-ink': '#2a1a08',
  '--wolf': '#ff5c78',
  '--village': '#34d399',
  '--neutral': '#c4b5fd',
  '--text': '#f7f3ff',
  '--text-muted': '#c4b6dc',
  '--border': 'rgb(255 255 255 / 0.12)',
  '--shadow': '0 12px 40px rgb(8 4 20 / 0.45)',
  '--danger': '#fb7185',

  '--text-display': 'clamp(2.75rem, 6.3vw, 6.25rem)',
  /** Home hero wordmark. Cap height matches the title in 01-home.png at 1586px. */
  '--text-home': 'clamp(2.75rem, 5vw, 5rem)',
  /** Lobby place title over the campfire. One line beside the room code at 1586px. */
  '--text-lobby': 'clamp(2rem, 3vw, 3.25rem)',
  /** Room code on the lobby card. */
  '--text-code': 'clamp(1.8rem, 3.2vw, 3.6rem)',
  '--text-title': 'clamp(1.25rem, 1.2vw + 0.9rem, 2.4rem)',
  '--text-nav': 'clamp(1rem, 0.3vw + 0.9rem, 1.35rem)',
  '--text-body': 'clamp(0.75rem, 0.2vw + 0.7rem, 1rem)',
  '--text-label': 'clamp(0.7rem, 0.15vw + 0.65rem, 0.85rem)',
  '--font-display': '"Nunito", system-ui, -apple-system, "Segoe UI", sans-serif',
  /** Large fantasy headings only. Body copy and the home hero stay on `--font-display`. */
  '--font-fantasy': '"Playfair Display", Palatino, "Palatino Linotype", "Book Antiqua", serif',
  '--space': 'clamp(0.5rem, 1vw, 1.25rem)',
  '--radius': 'clamp(0.75rem, 1vw, 1.25rem)',
  '--radius-pill': '999px',
  '--bar': 'clamp(2.5rem, 6vh, 3.5rem)',
  /** Home masthead at the 1586×992 reference. Other screens keep `--bar`. */
  '--bar-home': '4.6875rem',
  /** Lobby masthead at the 1586×992 reference. */
  '--bar-lobby': '3.625rem',
  /** Home create and join. Stays at least a touch target on short screens. */
  '--hit-hero': 'clamp(3.25rem, 9vh, 5.625rem)',
  '--avatar': 'clamp(2.25rem, 5vh, 4.5rem)',
  /** Monogram in the top bar. Stays inside `--bar`. */
  '--avatar-nav': 'clamp(1.75rem, 4vh, 2.25rem)',
  '--avatar-fill': 'var(--surface-raised)',
  '--avatar-ink': 'var(--text)',
  '--avatar-ring': '2px',
  '--avatar-ring-color': 'var(--text-muted)',
  '--hit': '44px',

  /** Portrait phone spacing, type, and chrome (PHONE-IMPLEMENTATION-PLAN). */
  '--phone-page-gutter': '16px',
  '--phone-section-gap': '12px',
  '--phone-card-gap': '10px',
  '--phone-card-padding': '14px',
  '--phone-card-radius': '16px',
  '--phone-control-radius': '12px',
  '--phone-toolbar-min': '56px',
  '--phone-control-height': '48px',
  '--phone-hit': '44px',
  '--phone-icon-size': '20px',
  '--phone-icon-size-large': '24px',
  '--phone-dock-gap': '8px',
  '--phone-safe-bottom': 'max(12px, env(safe-area-inset-bottom))',
  '--phone-content-max': '430px',
  '--phone-title-size': '1.5rem',
  '--phone-heading-size': '1.25rem',
  '--phone-body-size': '0.9375rem',
  '--phone-label-size': '0.8125rem',
  '--phone-meta-size': '0.75rem',
} as const;

export type TokenName = keyof typeof tokens;

/** `var(--name)` with a typo-proof name. */
export const cssVar = (name: TokenName) => `var(${name})`;

export function tokensToCss(): string {
  const lines = Object.entries(tokens).map(([name, value]) => `  ${name}: ${value};`);
  // Inside a scrolling player grid on a short landscape phone, 40px is the floor.
  return `:root {\n${lines.join('\n')}\n}\n@media (max-height: 499px) {\n  :root { --hit-grid: 40px; }\n}\n`;
}
