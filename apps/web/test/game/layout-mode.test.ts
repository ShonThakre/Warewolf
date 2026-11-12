import { GAME_PHASES } from '@warewolf/domain';
import { describe, expect, it } from 'vitest';
import { SCENE_IDS } from '../../src/assets/art';
import {
  LAYOUT_MODES,
  NARROW_LANDSCAPE_CHECK,
  PRIORITY_VIEWPORTS,
  STAGE_MODES,
  STAGE_SPECS,
  layoutInfo,
  layoutMode,
  stageModeFor,
} from '../../src/game/layout';

describe('layoutMode', () => {
  it.each([...PRIORITY_VIEWPORTS, NARROW_LANDSCAPE_CHECK].map((v) => [`${v.width}×${v.height}`, v.width, v.height, v.mode] as const))(
    '%s is %s',
    (_name, width, height, mode) => {
      expect(layoutMode(width, height)).toBe(mode);
    },
  );

  it.each([
    // Section 3 boundaries.
    [1440, 799, 'compact'],
    [1439, 900, 'compact'],
    [1024, 700, 'compact'],
    [1024, 699, 'tablet'],
    [1023, 768, 'tablet'],
    [768, 500, 'tablet'],
    [768, 499, 'phone-landscape'],
    [767, 500, 'phone-landscape'],
    [600, 300, 'phone-landscape'],
    [599, 300, 'narrow-landscape'],
    [767, 1024, 'portrait'],
    // Wide but short windows.
    [1280, 600, 'tablet'],
    [1280, 450, 'phone-landscape'],
    // A tall tablet is compact desktop: width and height both clear the band.
    [1024, 1366, 'compact'],
    // Gaps in the table, filled with tablet.
    [768, 1024, 'tablet'],
    [820, 1180, 'tablet'],
    [750, 710, 'tablet'],
    // Square is portrait, as in CSS.
    [600, 600, 'portrait'],
  ] as const)('%i×%i is %s', (width, height, mode) => {
    expect(layoutMode(width, height)).toBe(mode);
  });

  it('reaches every mode', () => {
    const seen = new Set<string>();
    for (let w = 300; w <= 2600; w += 20) for (let h = 300; h <= 1600; h += 20) seen.add(layoutMode(w, h));
    expect([...seen].sort()).toEqual([...LAYOUT_MODES].sort());
  });
});

describe('layoutInfo', () => {
  it('gives the status line its own row only when tall and not portrait', () => {
    expect(layoutInfo(1920, 1080).statusRow).toBe(true);
    expect(layoutInfo(1024, 768).statusRow).toBe(true);
    expect(layoutInfo(1280, 600).statusRow).toBe(false);
    expect(layoutInfo(915, 412).statusRow).toBe(false);
    expect(layoutInfo(390, 844).statusRow).toBe(false);
  });

  it('collapses the rail only in narrow landscape, and stacks only in portrait', () => {
    for (const v of [...PRIORITY_VIEWPORTS, NARROW_LANDSCAPE_CHECK]) {
      const info = layoutInfo(v.width, v.height);
      expect(info.railCollapsible, v.project).toBe(v.mode === 'narrow-landscape');
      expect(info.stacked, v.project).toBe(v.mode === 'portrait');
      expect(info.landscape, v.project).toBe(v.width > v.height);
    }
  });
});

describe('stage modes', () => {
  it.each(GAME_PHASES.map((p) => [p]))('%s has a stage', (phase) => {
    expect(STAGE_MODES).toContain(stageModeFor(phase));
  });

  it('follows the section 4 table', () => {
    expect(stageModeFor('LOBBY')).toBe('lobby');
    expect(stageModeFor('ROLE_REVEAL')).toBe('reveal');
    for (const p of ['NIGHT_SUBMIT', 'NIGHT_HOST_CONFIRM', 'NIGHT_REACTION'] as const) expect(stageModeFor(p)).toBe('night');
    expect(stageModeFor('DAY_ANNOUNCE')).toBe('night-results');
    expect(stageModeFor('DAY_DISCUSSION')).toBe('day');
    expect(stageModeFor('VOTING')).toBe('voting');
    expect(stageModeFor('REVOTE')).toBe('voting');
    expect(stageModeFor('FINISHED')).toBe('results');
    expect(stageModeFor('CANCELLED')).toBe('results');

    expect(STAGE_SPECS.night).toMatchObject({ wash: 'night', foreground: 'player-grid', action: 'submit-ability' });
    expect(STAGE_SPECS['night-results']).toMatchObject({ scene: 'square_day', wash: 'day', foreground: 'result-card', action: 'continue-to-day' });
    expect(STAGE_SPECS.voting).toMatchObject({ wash: 'day', foreground: 'player-grid', action: 'confirm-vote' });
    expect(STAGE_SPECS.lobby).toMatchObject({ foreground: 'avatars', action: 'start' });
  });

  it.each(STAGE_MODES.map((s) => [s, STAGE_SPECS[s]] as const))('%s names real scene art', (_stage, spec) => {
    if (spec.scene !== 'BY_OUTCOME') expect(SCENE_IDS).toContain(spec.scene);
  });

  it('moves only target grids under the portrait switch', () => {
    for (const s of STAGE_MODES) {
      const spec = STAGE_SPECS[s];
      expect(spec.portraitForeground, s).toBe(spec.foreground === 'player-grid' ? 'middle' : 'scene');
    }
  });
});
