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

  '--text-title': 'clamp(1.25rem, 1.2vw + 0.9rem, 2.4rem)',
  '--text-body': 'clamp(0.75rem, 0.2vw + 0.7rem, 1rem)',
  '--text-label': 'clamp(0.7rem, 0.15vw + 0.65rem, 0.85rem)',
  '--font-display': '"Nunito", system-ui, -apple-system, "Segoe UI", sans-serif',
  '--space': 'clamp(0.5rem, 1vw, 1.25rem)',
  '--radius': 'clamp(0.75rem, 1vw, 1.25rem)',
  '--radius-pill': '999px',
  '--bar': 'clamp(2.5rem, 6vh, 3.5rem)',
  '--avatar': 'clamp(2.25rem, 5vh, 4.5rem)',
  /** Monogram in the top bar. Stays inside `--bar`. */
  '--avatar-nav': 'clamp(1.75rem, 4vh, 2.25rem)',
  '--avatar-fill': 'var(--surface-raised)',
  '--avatar-ink': 'var(--text)',
  '--avatar-ring': '2px',
  '--avatar-ring-color': 'var(--text-muted)',
  '--hit': '44px',
} as const;

export type TokenName = keyof typeof tokens;

/** `var(--name)` with a typo-proof name. */
export const cssVar = (name: TokenName) => `var(${name})`;

export function tokensToCss(): string {
  const lines = Object.entries(tokens).map(([name, value]) => `  ${name}: ${value};`);
  // Inside a scrolling player grid on a short landscape phone, 40px is the floor.
  return `:root {\n${lines.join('\n')}\n}\n@media (max-height: 499px) {\n  :root { --hit-grid: 40px; }\n}\n`;
}
