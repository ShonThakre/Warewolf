import { afterEach, describe, expect, it } from 'vitest';
import { setPlayConnectorForTests, type PlayClient } from '../../src/realtime/play';
import { openPlaySessionsForTests, subscribePlay } from '../../src/realtime/session';

/** WEB-09: one /play connection per seat, shared by every listener. */

class FakePlay implements PlayClient {
  readonly handlers = new Map<string, (body: unknown) => void>();
  readonly sent: { event: string; body: unknown }[] = [];
  closed = false;
  on(event: string, handler: (body: unknown) => void): void {
    if (this.handlers.has(event)) throw new Error(`${event} registered twice on one socket`);
    this.handlers.set(event, handler);
  }
  emit(event: string, body: unknown): void {
    this.sent.push({ event, body });
  }
  close(): void {
    this.closed = true;
  }
  fire(event: string, body: unknown = {}): void {
    this.handlers.get(event)?.(body);
  }
}

let opened: FakePlay[] = [];

afterEach(() => {
  setPlayConnectorForTests(null);
  opened = [];
});

function install() {
  setPlayConnectorForTests(() => {
    const play = new FakePlay();
    opened.push(play);
    return play;
  });
}

const GAME = '0f4c1c2e-2b0a-4d5e-9a11-6b2f0a9d4c31';
const phaseEvent = (seq: number) => ({ seq, type: 'PHASE_CHANGED', audience: 'PUBLIC', payload: {} });

describe('subscribePlay', () => {
  it('shares one connection, fans events out, and joins once per connect', () => {
    install();
    const heard: string[] = [];
    const offPhase = subscribePlay('tok', GAME, { PHASE_CHANGED: () => heard.push('phase'), connect: () => heard.push('phase-connect') });
    const offChat = subscribePlay('tok', GAME, { CHAT_MESSAGE_POSTED: () => heard.push('chat'), connect: () => heard.push('chat-connect') });
    expect(opened).toHaveLength(1);
    const play = opened[0]!;

    play.fire('connect');
    expect(play.sent).toEqual([{ event: 'join-session', body: { gameId: GAME, afterSeq: 0 } }]);
    expect(heard).toEqual(['phase-connect', 'chat-connect']);

    play.fire('PHASE_CHANGED', phaseEvent(7));
    // A chat message's seq is another sequence and never moves the replay cursor.
    play.fire('CHAT_MESSAGE_POSTED', { seq: 900, messageId: 'm', body: 'hi' });
    play.fire('connect');
    expect(play.sent[1]).toEqual({ event: 'join-session', body: { gameId: GAME, afterSeq: 7 } });
    expect(heard.filter((h) => h === 'phase' || h === 'chat')).toEqual(['phase', 'chat']);

    offChat();
    play.fire('CHAT_MESSAGE_POSTED', { seq: 901 });
    expect(heard.filter((h) => h === 'chat')).toHaveLength(1);
    expect(play.closed).toBe(false);
    offPhase();
    offPhase();
    expect(play.closed).toBe(true);
    expect(openPlaySessionsForTests()).toBe(0);
  });

  it('opens a fresh connection for another seat or a new game', () => {
    install();
    const a = subscribePlay('tok-a', GAME, {});
    const b = subscribePlay('tok-b', GAME, {});
    expect(opened).toHaveLength(2);
    const c = subscribePlay('tok-a', '6a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d', {});
    expect(opened).toHaveLength(3);
    expect(opened[0]!.closed).toBe(true);
    a();
    b();
    c();
    expect(openPlaySessionsForTests()).toBe(0);
  });
});
