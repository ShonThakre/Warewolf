import { configureStore } from '@reduxjs/toolkit';
import { setupListeners } from '@reduxjs/toolkit/query';
import { api, defaultApiEnvironment, type ApiEnvironment } from '../api/api';
import { cleared, seated, sessionSlice } from '../session/sessionSlice';
import { browserSessionStorage, type SessionStorageAdapter } from '../session/storage';

export interface StoreOptions {
  readonly environment?: ApiEnvironment;
  readonly storage?: SessionStorageAdapter;
}

/**
 * Builds the store. The app makes one at startup; tests make their own with a
 * fake fetch and in-memory storage.
 */
export function makeStore(options: StoreOptions = {}) {
  const storage = options.storage ?? browserSessionStorage();
  const environment = options.environment ?? defaultApiEnvironment();

  const store = configureStore({
    reducer: {
      session: sessionSlice.reducer,
      [api.reducerPath]: api.reducer,
    },
    preloadedState: { session: { credentials: storage.load() } },
    middleware: (getDefault) => getDefault({ thunk: { extraArgument: environment } }).concat(api.middleware),
  });

  // Persist the seat whenever it changes.
  let last = store.getState().session.credentials;
  store.subscribe(() => {
    const next = store.getState().session.credentials;
    if (next === last) return;
    const previous = last;
    last = next;
    if (next) {
      storage.save(next);
      return;
    }
    // ID-01: a 401 here may only mean another tab rejoined and holds a newer
    // token. Adopt that seat instead of wiping it.
    const stored = storage.load();
    if (stored && previous && stored.token !== previous.token) {
      store.dispatch(seated(stored));
      return;
    }
    storage.save(null);
  });

  // ID-01: every tab follows the seat another tab stored or cleared.
  storage.watch?.((credentials) => {
    const current = store.getState().session.credentials;
    if (credentials?.token === current?.token) return;
    store.dispatch(credentials ? seated(credentials) : cleared());
  });

  // Refetch on focus and reconnect, so a backgrounded phone catches up.
  setupListeners(store.dispatch);
  return store;
}

export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore['getState']>;
export type AppDispatch = AppStore['dispatch'];
