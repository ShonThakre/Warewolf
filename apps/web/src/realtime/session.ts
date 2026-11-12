import { connectPlay, type PlayClient } from './play';

/**
 * One `/play` connection per seat, shared by every hook that listens
 * (WEB-09). Before this, the phase signal and chat each opened a socket.
 *
 * - The first subscriber opens the connection; the last one to leave closes it.
 * - Each event is registered on the socket once and fanned out to every
 *   subscriber, so two hooks can both hear `connect`.
 * - On every connect and reconnect the session sends `join-session` once,
 *   with the seq of the last stored game event it has seen, so the server
 *   replays only what was missed. Chat events carry their own `seq` from a
 *   different sequence and have no `audience`, so they never move the cursor.
 */

export type PlayHandler = (body: unknown) => void;

interface Session {
  readonly client: PlayClient;
  readonly gameId: string;
  readonly listeners: Map<string, Set<PlayHandler>>;
  refs: number;
  /** Seq of the newest stored game event delivered on this connection. */
  cursor: number;
}

const sessions = new Map<string, Session>();

function storedSeq(body: unknown): number {
  if (typeof body !== 'object' || body === null || !('seq' in body) || !('audience' in body)) return 0;
  const seq = body.seq;
  return typeof seq === 'number' && Number.isInteger(seq) && seq > 0 ? seq : 0;
}

function listen(session: Session, event: string): Set<PlayHandler> {
  let set = session.listeners.get(event);
  if (set) return set;
  set = new Set();
  session.listeners.set(event, set);
  const handlers = set;
  session.client.on(event, (body) => {
    const seq = storedSeq(body);
    if (seq > session.cursor) session.cursor = seq;
    for (const handler of [...handlers]) handler(body);
  });
  return set;
}

function open(token: string, gameId: string): Session {
  const session: Session = { client: connectPlay(token), gameId, listeners: new Map(), refs: 0, cursor: 0 };
  // Registered first so the room join happens before any subscriber's own connect handler.
  listen(session, 'connect').add(() => session.client.emit('join-session', { gameId, afterSeq: session.cursor }));
  return session;
}

/**
 * Subscribes to events on this seat's shared connection. Returns the
 * unsubscribe function; call it from the effect cleanup.
 */
export function subscribePlay(token: string, gameId: string, handlers: Readonly<Record<string, PlayHandler>>): () => void {
  let session = sessions.get(token);
  if (session && session.gameId !== gameId) {
    // A token belongs to one game. A different game id means a new seat, so start clean.
    session.client.close();
    sessions.delete(token);
    session = undefined;
  }
  if (!session) {
    session = open(token, gameId);
    sessions.set(token, session);
  }
  const active = session;
  active.refs += 1;
  const added = Object.entries(handlers).map(([event, handler]) => {
    // Each subscription gets its own wrapper, so one hook subscribing twice is two listeners.
    const wrapped: PlayHandler = (body) => handler(body);
    listen(active, event).add(wrapped);
    return [event, wrapped] as const;
  });

  let done = false;
  return () => {
    if (done) return;
    done = true;
    for (const [event, wrapped] of added) active.listeners.get(event)?.delete(wrapped);
    active.refs -= 1;
    if (active.refs === 0 && sessions.get(token) === active) {
      active.client.close();
      sessions.delete(token);
    }
  };
}

/** Vitest only: how many connections are open. */
export function openPlaySessionsForTests(): number {
  return sessions.size;
}
