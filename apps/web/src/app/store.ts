import { configureStore } from '@reduxjs/toolkit';
import { setupListeners } from '@reduxjs/toolkit/query';
import { api, defaultApiEnvironment, type ApiEnvironment } from '../api/api';
import { sessionSlice } from '../session/sessionSlice';
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
    if (next !== last) {
      last = next;
      storage.save(next);
    }
  });

  // Refetch on focus and reconnect, so a backgrounded phone catches up.
  setupListeners(store.dispatch);
  return store;
}

export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore['getState']>;
export type AppDispatch = AppStore['dispatch'];
