import { seatCredentialsSchema, type SeatCredentials } from '@warewolf/contracts';

/**
 * Where the seat token lives between reloads. Web uses sessionStorage, so a
 * token stays in its tab. The Android build will provide a Capacitor
 * Preferences adapter with the same interface (WW-1603).
 *
 * The server is the source of truth: a stored token that no longer works is
 * discarded on the first 401.
 */
export interface SessionStorageAdapter {
  load(): SeatCredentials | null;
  save(credentials: SeatCredentials | null): void;
}

const KEY = 'warewolf.seat';

/** sessionStorage, failing safe when storage is blocked, full, or holds something unreadable. */
export function browserSessionStorage(storage: () => Storage | undefined = () => globalThis.sessionStorage): SessionStorageAdapter {
  return {
    load() {
      try {
        const raw = storage()?.getItem(KEY);
        if (!raw) return null;
        const parsed = seatCredentialsSchema.safeParse(JSON.parse(raw));
        return parsed.success ? parsed.data : null;
      } catch {
        return null;
      }
    },
    save(credentials) {
      try {
        if (credentials) storage()?.setItem(KEY, JSON.stringify(credentials));
        else storage()?.removeItem(KEY);
      } catch {
        // Private mode or quota: the session simply does not survive a reload.
      }
    },
  };
}

/** For tests and server rendering. */
export function memorySessionStorage(initial: SeatCredentials | null = null): SessionStorageAdapter & { current: SeatCredentials | null } {
  return {
    current: initial,
    load() {
      return this.current;
    },
    save(credentials) {
      this.current = credentials;
    },
  };
}
