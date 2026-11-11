import { act, cleanup, render, screen } from '@testing-library/react';
import type { SeatCredentials } from '@warewolf/contracts';
import { Provider } from 'react-redux';
import { afterEach, describe, expect, it } from 'vitest';
import { makeStore } from '../../src/app/store';
import { useLobby, useSeat } from '../../src/game/state/lobby';
import { memorySessionStorage } from '../../src/session/storage';

const GAME = '0f4c1c2e-2b0a-4d5e-9a11-6b2f0a9d4c31';
const HOST = '5c1d0e77-1a2b-4c3d-8e9f-001122334455';
const seat: SeatCredentials = { gameId: GAME, roomCode: 'K7QMPR', playerId: HOST, token: 'ww_token_for_tests_0123456789', isHost: true };

const lobbyBody = {
  gameId: GAME,
  roomCode: 'K7QMPR',
  status: 'LOBBY',
  phase: 'LOBBY',
  mode: 'CLASSIC',
  rolePackId: 'classic-10',
  playerCount: 10,
  hostPlayerId: HOST,
  stateVersion: 3,
  players: [{ playerId: HOST, displayName: 'Asha', seatNumber: 1, avatarId: 1, isHost: true, connectionStatus: 'DISCONNECTED' }],
  you: { playerId: HOST, isHost: true },
  configuration: {
    valid: true,
    errorCount: 0,
    warningCount: 0,
    summary: { playerCount: 10, selectedSeats: 10, remainingSeats: 0, factions: { VILLAGE: 8, WOLF_PACK: 2, NEUTRAL: 0, INDEPENDENT: 0 }, startingPack: 2, wolfCap: 2, infectionSuccesses: null },
  },
  start: { ready: false, blockers: ['SEATS_OPEN'], requiresWarningAcknowledgement: false },
};

function Probe() {
  const current = useSeat();
  const { lobby, error } = useLobby();
  return (
    <p>
      seat:{current ? 'yes' : 'no'} version:{lobby?.stateVersion ?? '-'} error:{error?.code ?? '-'}
    </p>
  );
}

function renderWith(status: number, body: unknown) {
  const fetchFn = (async () => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })) as typeof fetch;
  const store = makeStore({ environment: { baseUrl: 'http://api.test/api/v1', fetchFn }, storage: memorySessionStorage(seat) });
  render(
    <Provider store={store}>
      <Probe />
    </Provider>,
  );
}

afterEach(cleanup);

describe('lobby hooks', () => {
  it('loads the lobby for the seated player', async () => {
    renderWith(200, lobbyBody);
    expect(await screen.findByText('seat:yes version:3 error:-')).toBeTruthy();
  });

  it('a rejected token clears the seat and reports the error', async () => {
    renderWith(401, { error: { code: 'UNAUTHENTICATED', message: 'Sign in to continue.' } });
    await act(async () => {});
    expect(await screen.findByText(/seat:no/)).toBeTruthy();
  });
});
