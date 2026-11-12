import type { SeatCredentials } from '@warewolf/contracts';
import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ROLE_FIXTURES } from '../../src/game/fixtures/role';
import { roleCardContent } from '../../src/game/components/roleCopy';
import { json, renderApp } from '../render';

const GAME = '0f4c1c2e-2b0a-4d5e-9a11-6b2f0a9d4c31';
const seat: SeatCredentials = {
  gameId: GAME,
  roomCode: 'K7QMPR',
  playerId: ROLE_FIXTURES.villager.playerId,
  token: 'ww_token_for_tests_0123456789',
  isHost: false,
};

function roleFetch(body: unknown, status = 200): typeof fetch {
  return (async () => json(status, body)) as typeof fetch;
}

afterEach(cleanup);

describe('role card words', () => {
  it('describes a villager without a night action or a teammate list', () => {
    const card = roleCardContent(ROLE_FIXTURES.villager);
    expect(card.name).toBe('Villager');
    expect(card.team).toBe('Village');
    expect(card.tonight).toBe('You have no night action.');
    expect(card.teammates).toBeNull();
    expect(card.originalLine).toBeNull();
  });

  it('names tonight for the doctor and keeps infection wolves from seeing a pack', () => {
    expect(roleCardContent(ROLE_FIXTURES.doctor).tonight).toBe('Tonight: Heal.');
    expect(roleCardContent(ROLE_FIXTURES.alphaWolf).teammates).toBeNull();
    expect(roleCardContent(ROLE_FIXTURES.packWolf).teammates).toMatch(/You know/);
  });

  it('shows a conversion without putting a role id in the words', () => {
    const card = roleCardContent(ROLE_FIXTURES.infected);
    expect(card.name).toBe('Infected Wolf');
    expect(card.originalLine).toBe('You started as Seeker.');
    expect(card.tonight).toBe('You have no night action.');
    expect(JSON.stringify(card)).not.toContain('infected_wolf');
    expect(JSON.stringify(card)).not.toContain('seeker');
  });
});

describe('reveal screen', () => {
  it('shows only this seat\'s role', async () => {
    renderApp(`/game/${GAME}/reveal`, { seat, fetchFn: roleFetch(ROLE_FIXTURES.villager) });
    expect(await screen.findByRole('heading', { name: 'Villager' })).toBeTruthy();
    expect(screen.getByText('You have no night action.')).toBeTruthy();
    expect(document.body.textContent).not.toContain('alpha_wolf');
    expect(document.body.textContent).not.toContain('Alpha Wolf');
  });

  it('covers the role name', async () => {
    renderApp(`/game/${GAME}/reveal`, { seat, fetchFn: roleFetch(ROLE_FIXTURES.villager) });
    fireEvent.click(await screen.findByRole('button', { name: 'Hide role' }));
    expect(screen.getByRole('heading', { name: 'Your role is hidden' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Villager' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Show role' }));
    expect(screen.getByRole('heading', { name: 'Villager' })).toBeTruthy();
  });

  it('continues to the table', async () => {
    const { router } = renderApp(`/game/${GAME}/reveal`, { seat, fetchFn: roleFetch(ROLE_FIXTURES.villager) });
    fireEvent.click(await screen.findByRole('link', { name: 'I understand' }));
    expect(router.state.location.pathname).toBe(`/game/${GAME}`);
  });

  it('returns to the lobby when the game has not started', async () => {
    const { router } = renderApp(`/game/${GAME}/reveal`, {
      seat,
      fetchFn: roleFetch({ error: { code: 'PHASE_CONFLICT', message: 'That action is not available in this phase.' } }, 409),
    });
    expect(await screen.findByRole('heading', { name: 'Lobby' })).toBeTruthy();
    expect(router.state.location.pathname).toBe(`/lobby/${GAME}`);
  });
});
