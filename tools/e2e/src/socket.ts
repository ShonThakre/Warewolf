import { io, type Socket } from 'socket.io-client';
import type { GameEvent } from '@warewolf/contracts';
import type { Seat } from './driver.js';

/**
 * One seat's live connection to `/play`. It records every stored event the
 * socket delivers, so a test can compare what arrived live with what the
 * seat may see.
 */
export interface SeatListener {
  readonly seat: Seat;
  readonly events: GameEvent[];
  close(): void;
}

export async function listen(baseUrl: string, seat: Seat, timeoutMs = 5_000): Promise<SeatListener> {
  const socket: Socket = io(`${baseUrl}/play`, { auth: { token: seat.token }, transports: ['websocket'], forceNew: true });
  const events: GameEvent[] = [];
  // The gateway emits each stored event under its own type name, with the event as the argument.
  socket.onAny((_type: string, event: unknown) => {
    if (event && typeof event === 'object' && 'seq' in event && 'audience' in event) events.push(event as GameEvent);
  });
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${seat.displayName}: socket did not join in ${timeoutMs} ms`)), timeoutMs);
    socket.on('connect_error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    socket.on('connect', () => {
      socket.emit('join-session', { gameId: seat.gameId }, (ack: { ok: boolean }) => {
        clearTimeout(timer);
        if (ack?.ok) resolve();
        else reject(new Error(`${seat.displayName}: join-session refused`));
      });
    });
  });
  return { seat, events, close: () => socket.close() };
}
