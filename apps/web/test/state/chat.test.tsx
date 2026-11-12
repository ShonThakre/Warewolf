import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { chatViewSchema, type ChatView, type SeatCredentials } from '@warewolf/contracts';
import type { GamePhase } from '@warewolf/domain';
import { useState } from 'react';
import { Provider } from 'react-redux';
import { afterEach, describe, expect, it } from 'vitest';
import { makeStore } from '../../src/app/store';
import { chatMessageFixture, chatViewFixture } from '../../src/game/fixtures/chat';
import { FIXTURE_GAME_ID, fixturePlayerId } from '../../src/game/fixtures/role';
import { checkChatDraft, useChat, useChatModeration, usePostChat } from '../../src/game/state/chat';
import { setPlayConnectorForTests, type PlayClient } from '../../src/realtime/play';
import { memorySessionStorage } from '../../src/session/storage';

/** WW-1104: the chat data layer the WW-1206 composer binds to. */

const BASE = 'http://api.test/api/v1';
const GAME = FIXTURE_GAME_ID;
const hostSeat: SeatCredentials = { gameId: GAME, roomCode: 'K7QMPR', playerId: fixturePlayerId(1), token: 'ww_token_for_tests_0123456789', isHost: true };
const guestSeat: SeatCredentials = { ...hostSeat, playerId: fixturePlayerId(4), token: 'ww_token_for_tests_guest_0123456789', isHost: false };

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

class FakePlay implements PlayClient {
  private readonly handlers = new Map<string, (body: unknown) => void>();
  readonly sent: { event: string; body: unknown }[] = [];
  on(event: string, handler: (body: unknown) => void): void {
    this.handlers.set(event, handler);
  }
  emit(event: string, body: unknown): void {
    this.sent.push({ event, body });
  }
  close(): void {}
  fire(event: string, body: unknown): void {
    this.handlers.get(event)?.(body);
  }
}

function setup(routes: Record<string, (request: Request) => Response | Promise<Response>>, seat: SeatCredentials = guestSeat) {
  const requests: Request[] = [];
  const fetchFn = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = input instanceof Request ? input : new Request(input, init);
    requests.push(request.clone());
    const path = new URL(request.url).pathname.replace('/api/v1/', '');
    const route = routes[`${request.method} ${path}`];
    return route ? route(request) : json(404, { error: { code: 'NOT_FOUND', message: 'Not found.' } });
  }) as typeof fetch;
  const play = new FakePlay();
  setPlayConnectorForTests(() => play);
  const store = makeStore({ environment: { baseUrl: BASE, fetchFn }, storage: memorySessionStorage(seat) });
  return { store, requests, play };
}

function Panel({ initialPhase = 'DAY_DISCUSSION' as GamePhase }) {
  const [phase, setPhase] = useState<GamePhase>(initialPhase);
  const [version, setVersion] = useState(1);
  const chat = useChat(phase, version);
  const { send, error } = usePostChat();
  const moderation = useChatModeration();
  return (
    <div>
      <p>
        bodies:{chat.messages.map((m) => m.seq).join(',') || '-'} canPost:{String(chat.canPost)} refusal:{chat.refusal ?? '-'} muted:{chat.mutedPlayerIds.length} error:{error?.code ?? '-'} host:{String(moderation.available)}
      </p>
      <button type="button" onClick={() => void send('Hello table')}>
        send
      </button>
      <button type="button" onClick={() => void moderation.deleteMessage(chatMessageFixture(2).messageId)}>
        delete 2
      </button>
      <button type="button" onClick={() => void moderation.mute(fixturePlayerId(5))}>
        mute 5
      </button>
      <button
        type="button"
        onClick={() => {
          setPhase('NIGHT_SUBMIT');
          setVersion((v) => v + 1);
        }}
      >
        night
      </button>
    </div>
  );
}

const show = (store: ReturnType<typeof makeStore>, phase?: GamePhase) =>
  render(
    <Provider store={store}>
      <Panel initialPhase={phase} />
    </Provider>,
  );

afterEach(() => {
  cleanup();
  setPlayConnectorForTests(null);
});

describe('chat fixtures and draft check', () => {
  it('match the contract', () => {
    expect(chatViewSchema.parse(chatViewFixture())).toEqual(chatViewFixture());
    expect(chatViewSchema.parse(chatViewFixture({ count: 0, you: { canPost: false, refusal: 'DEAD' } })).messages).toEqual([]);
  });

  it('counts what the server counts', () => {
    expect(checkChatDraft('  hi  ')).toEqual({ remaining: 278, sendable: true });
    expect(checkChatDraft('   ')).toMatchObject({ sendable: false });
    expect(checkChatDraft('x'.repeat(281))).toEqual({ remaining: -1, sendable: false });
    expect(checkChatDraft('🐺'.repeat(280))).toEqual({ remaining: 0, sendable: true });
  });
});

describe('useChat', () => {
  it('does not ask the server in the lobby', async () => {
    const { store, requests } = setup({});
    show(store, 'LOBBY');
    await waitFor(() => expect(screen.getByText(/bodies:- canPost:false/)).toBeTruthy());
    expect(requests).toHaveLength(0);
  });

  it('loads the channel, applies live messages, deletions, and mutes, and reads again on a new version', async () => {
    let view: ChatView = chatViewFixture({ count: 2 });
    const { store, requests, play } = setup({ [`GET games/${GAME}/chat`]: () => json(200, view) });
    show(store);
    await waitFor(() => expect(screen.getByText(/bodies:1,2 canPost:true refusal:-/)).toBeTruthy());

    // A (re)connect reads the whole view again, so a message or deletion missed while offline is caught up.
    const firstReads = requests.length;
    act(() => play.fire('connect', {}));
    // The shared session (WEB-09) joins the rooms once per connect; chat only listens.
    expect(play.sent).toEqual([{ event: 'join-session', body: { gameId: GAME, afterSeq: 0 } }]);
    await waitFor(() => expect(requests.length).toBe(firstReads + 1));
    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      play.fire('CHAT_MESSAGE_POSTED', chatMessageFixture(3));
      play.fire('CHAT_MESSAGE_POSTED', chatMessageFixture(3));
      play.fire('CHAT_MESSAGE_POSTED', { body: 'not a message' });
    });
    await waitFor(() => expect(screen.getByText(/bodies:1,2,3 /)).toBeTruthy());
    act(() => play.fire('CHAT_MESSAGE_DELETED', { messageId: chatMessageFixture(1).messageId }));
    await waitFor(() => expect(screen.getByText(/bodies:2,3 /)).toBeTruthy());
    act(() => play.fire('CHAT_SEAT_MUTED', { playerId: fixturePlayerId(7) }));
    await waitFor(() => expect(screen.getByText(/muted:1/)).toBeTruthy());

    view = chatViewFixture({ count: 3, you: { canPost: false, refusal: 'CLOSED' } });
    const reads = requests.length;
    await act(async () => screen.getByRole('button', { name: 'night' }).click());
    await waitFor(() => expect(screen.getByText(/canPost:false refusal:CLOSED/)).toBeTruthy());
    expect(requests.length).toBeGreaterThan(reads);
  });
});

describe('usePostChat and useChatModeration', () => {
  it('adds the sent message and shows a refusal', async () => {
    let refuse = false;
    const { store, requests } = setup({
      [`GET games/${GAME}/chat`]: () => json(200, chatViewFixture({ count: 1 })),
      [`POST games/${GAME}/chat/messages`]: () =>
        refuse
          ? json(429, { error: { code: 'RATE_LIMITED', message: 'Too many requests.' } })
          : json(201, chatMessageFixture(6, { playerId: guestSeat.playerId, body: 'Hello table' })),
    });
    show(store);
    await waitFor(() => expect(screen.getByText(/bodies:1 /)).toBeTruthy());
    await act(async () => screen.getByRole('button', { name: 'send' }).click());
    await waitFor(() => expect(screen.getByText(/bodies:1,6 /)).toBeTruthy());
    expect(await requests.find((r) => r.method === 'POST')!.json()).toEqual({ body: 'Hello table' });

    refuse = true;
    await act(async () => screen.getByRole('button', { name: 'send' }).click());
    await waitFor(() => expect(screen.getByText(/error:RATE_LIMITED/)).toBeTruthy());
    expect(screen.getByText(/host:false/)).toBeTruthy();
  });

  it('lets the host delete and mute, and never sends moderation for a guest', async () => {
    const routes = {
      [`GET games/${GAME}/chat`]: () => json(200, chatViewFixture({ count: 3 })),
      [`DELETE games/${GAME}/chat/messages/${chatMessageFixture(2).messageId}`]: () => new Response(null, { status: 204 }),
      [`PUT games/${GAME}/chat/mutes/${fixturePlayerId(5)}`]: () => new Response(null, { status: 204 }),
    };
    const host = setup(routes, hostSeat);
    show(host.store);
    await waitFor(() => expect(screen.getByText(/bodies:1,2,3 .*host:true/)).toBeTruthy());
    await act(async () => screen.getByRole('button', { name: 'delete 2' }).click());
    await waitFor(() => expect(screen.getByText(/bodies:1,3 /)).toBeTruthy());
    await act(async () => screen.getByRole('button', { name: 'mute 5' }).click());
    await waitFor(() => expect(host.requests.some((r) => r.method === 'PUT')).toBe(true));
    cleanup();

    const guest = setup(routes, guestSeat);
    show(guest.store);
    await waitFor(() => expect(screen.getByText(/host:false/)).toBeTruthy());
    await act(async () => screen.getByRole('button', { name: 'delete 2' }).click());
    await act(async () => screen.getByRole('button', { name: 'mute 5' }).click());
    expect(guest.requests.every((r) => r.method === 'GET')).toBe(true);
  });
});
