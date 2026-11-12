import { DEFAULT_PACK_BY_MODE, GAME_MODES, MODE_BOUNDS, getPack } from '@warewolf/domain';
import { cleanup, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { modeGuides } from '../../src/game/howto/howToPlayCopy';
import { renderApp } from '../render';

afterEach(cleanup);

describe('How to play copy (HOWTO-01)', () => {
  it('has one guide per mode, in the setup order', () => {
    expect(modeGuides().map((g) => g.mode)).toEqual([...GAME_MODES]);
  });

  it('reads seat counts and timers from the domain', () => {
    const byMode = new Map(modeGuides().map((g) => [g.mode, g]));
    expect(byMode.get('INFECTION')!.players).toBe('20 players');
    expect(byMode.get('CLASSIC')!.players).toBe(`${MODE_BOUNDS.CLASSIC.min} to ${MODE_BOUNDS.CLASSIC.max} players`);
    const timers = getPack('classic-10')!.config.timers!;
    expect(byMode.get('CLASSIC')!.pacing).toContain(`${timers.nightSeconds} seconds of night`);
    expect(byMode.get('INFECTION')!.pacing).toMatch(/host moves each phase on/);
  });

  it('lists each default setup’s starting roles with counts that fill the table', () => {
    for (const guide of modeGuides()) {
      const pack = getPack(DEFAULT_PACK_BY_MODE[guide.mode])!;
      if (guide.mode === 'CUSTOM') expect(guide.roles).toEqual([]);
      else expect(guide.roles.reduce((n, r) => n + r.count, 0), guide.mode).toBe(pack.config.playerCount);
    }
    const infection = modeGuides().find((g) => g.mode === 'INFECTION')!;
    expect(infection.roles).toContainEqual({ name: 'Alpha Wolf', count: 1, faction: 'WOLF_PACK' });
    expect(infection.roles.reduce((n, r) => n + r.count, 0)).toBe(20);
  });

  it('names the other Expanded setups', () => {
    const expanded = modeGuides().find((g) => g.mode === 'EXPANDED')!;
    expect(expanded.packs).toEqual(expect.arrayContaining(['Chaos', 'Expanded 24', 'Expanded 30']));
  });
});

describe('How to play page', () => {
  it('replaces the placeholder with the rules and a card per mode', async () => {
    renderApp('/how-to-play');
    expect(await screen.findByRole('heading', { level: 1, name: 'How to play' })).toBeTruthy();
    for (const name of ['The goal', 'One round', 'Your role card', 'The host', 'Game modes']) {
      expect(screen.getByRole('heading', { level: 2, name })).toBeTruthy();
    }
    const modes = screen.getByRole('list', { name: 'Game modes' });
    expect(within(modes).getAllByRole('article')).toHaveLength(GAME_MODES.length);
    expect(within(modes).getByRole('heading', { level: 3, name: 'Ultimate 20' })).toBeTruthy();
    expect(screen.queryByText(/Placeholder/)).toBeNull();
    expect(screen.getByRole('link', { name: 'See all roles' }).getAttribute('href')).toBe('/roles');
  });

  it('pairs every team colour with its word', () => {
    renderApp('/how-to-play');
    const roles = screen.getByRole('list', { name: 'Infection Edition starting roles' });
    const chips = within(roles)
      .getAllByRole('listitem')
      .map((item) => item.querySelector('.ww-team-chip')?.textContent);
    expect(chips).toEqual(['Village', 'Wolf']);
    expect(roles.textContent).toContain('14 × Villager');
  });
});
