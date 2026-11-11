import { describe, expect, it } from 'vitest';
import { tokens } from '../src/theme/tokens';

/** WCAG relative luminance for a #rrggbb color. */
function luminance(hex: string): number {
  const channels = [0, 2, 4].map((start) => {
    const value = parseInt(hex.slice(start + 1, start + 3), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!;
}

function contrast(foreground: string, background: string): number {
  const lighter = Math.max(luminance(foreground), luminance(background));
  const darker = Math.min(luminance(foreground), luminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

function stops(token: string): string[] {
  return token.match(/#[0-9a-fA-F]{6}/g) ?? [];
}

const washes = [...stops(tokens['--bg-night']), ...stops(tokens['--bg-day']), tokens['--surface'], tokens['--surface-raised']];

const words = {
  text: tokens['--text'],
  muted: tokens['--text-muted'],
  wolf: tokens['--wolf'],
  village: tokens['--village'],
  neutral: tokens['--neutral'],
  danger: tokens['--danger'],
  accent: tokens['--accent'],
} as const;

describe('theme contrast', () => {
  it('keeps text and team words at AA on both scene washes and on panels', () => {
    for (const [name, color] of Object.entries(words)) {
      for (const wash of washes) {
        expect(contrast(color, wash), `${name} on ${wash}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it('keeps the purple and gold buttons readable, including hover', () => {
    for (const wash of [...stops(tokens['--bg-night']), ...stops(tokens['--bg-day'])]) {
      expect(contrast(tokens['--primary'], wash), `primary on ${wash}`).toBeGreaterThanOrEqual(3);
      expect(contrast(tokens['--primary-hover'], wash), `primary hover on ${wash}`).toBeGreaterThanOrEqual(3);
    }
    expect(contrast(tokens['--primary-ink'], tokens['--primary'])).toBeGreaterThanOrEqual(4.5);
    expect(contrast(tokens['--primary-ink'], tokens['--primary-hover'])).toBeGreaterThanOrEqual(4.5);
    expect(contrast(tokens['--accent-ink'], tokens['--accent'])).toBeGreaterThanOrEqual(4.5);
    expect(contrast(tokens['--accent-ink'], tokens['--accent-hover'])).toBeGreaterThanOrEqual(4.5);
    expect(contrast(tokens['--accent-ink'], tokens['--danger'])).toBeGreaterThanOrEqual(4.5);
  });
});
