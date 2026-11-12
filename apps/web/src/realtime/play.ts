import { io, type Socket } from 'socket.io-client';

/**
 * The `/play` socket (WW-1101, WW-1103). The seat token is the handshake.
 * Screens do not construct this. `usePlaySession` does.
 */

export interface PlayClient {
  on(event: string, handler: (body: unknown) => void): void;
  emit(event: string, body: unknown, ack?: (result: { ok: boolean }) => void): void;
  close(): void;
}

export type PlayConnector = (token: string) => PlayClient;

/** Same origin as the page, unless `VITE_API_ORIGIN` points the APK at the API. */
export function playOrigin(): string {
  const configured = import.meta.env.VITE_API_ORIGIN ?? '';
  if (configured) return configured;
  return typeof window === 'undefined' ? '' : window.location.origin;
}

function livePlay(token: string): PlayClient {
  const socket: Socket = io(`${playOrigin()}/play`, { auth: { token }, transports: ['websocket'] });
  return socket;
}

/** Tests install a fake. A test run never opens a real socket. */
function silentPlay(): PlayClient {
  return { on() {}, emit() {}, close() {} };
}

let connector: PlayConnector = import.meta.env.VITEST ? silentPlay : livePlay;

export function connectPlay(token: string): PlayClient {
  return connector(token);
}

/** Vitest only. Pass null to restore the silent connector. */
export function setPlayConnectorForTests(next: PlayConnector | null): void {
  connector = next ?? silentPlay;
}
