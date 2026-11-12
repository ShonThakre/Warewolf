import { seatCredentialsSchema, type SeatCredentials } from '@warewolf/contracts';

/**
 * Where the seat token lives between reloads. Web uses sessionStorage, so a
 * token stays in its tab. The APK uses Capacitor Preferences behind the same
 * interface (WW-1603), chosen in `nativeStorage.ts`.
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

/** The slice of Capacitor Preferences this module needs. Tests pass a fake; `nativeStorage.ts` passes the plugin. */
export interface KeyValueStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

/**
 * The APK's adapter (WW-1603). Preferences is asynchronous and the store reads
 * its seat synchronously at startup, so the stored seat is read once, before
 * the app renders, and kept in memory. Each change is written through in
 * order, so a quick leave-then-join cannot land out of sequence. A process
 * kill keeps the last completed write, which is what lets a player reopen the
 * app and land back in their game.
 *
 * Nothing here trusts the stored seat: the first 401 clears it, as on the web.
 */
export async function preferencesSessionStorage(store: KeyValueStore): Promise<SessionStorageAdapter & { flushed(): Promise<void> }> {
  let current: SeatCredentials | null = null;
  try {
    const raw = await store.get(KEY);
    const parsed = raw ? seatCredentialsSchema.safeParse(JSON.parse(raw)) : null;
    current = parsed?.success ? parsed.data : null;
  } catch {
    current = null;
  }

  let writes: Promise<void> = Promise.resolve();
  return {
    load() {
      return current;
    },
    save(credentials) {
      current = credentials;
      const value = credentials ? JSON.stringify(credentials) : null;
      writes = writes
        .then(() => (value === null ? store.remove(KEY) : store.set(KEY, value)))
        .catch(() => {
          // A failed write loses only persistence across a restart; the session in memory is unaffected.
        });
    },
    /** Resolves when every write so far has finished. Tests use it; the app does not wait. */
    flushed() {
      return writes;
    },
  };
}

/**
 * Picks the adapter for the platform: Preferences inside the APK, where
 * sessionStorage does not survive the process being killed, and
 * sessionStorage on the web, where a token belongs to its tab.
 */
export async function platformSessionStorage(platform: {
  readonly isNative: boolean;
  readonly preferences: () => KeyValueStore;
  readonly browser?: () => SessionStorageAdapter;
}): Promise<SessionStorageAdapter> {
  if (platform.isNative) return preferencesSessionStorage(platform.preferences());
  return (platform.browser ?? browserSessionStorage)();
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
