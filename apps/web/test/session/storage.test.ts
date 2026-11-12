import type { SeatCredentials } from '@warewolf/contracts';
import { describe, expect, it } from 'vitest';
import { api } from '../../src/api/api';
import { makeStore } from '../../src/app/store';
import { selectCredentials } from '../../src/session/sessionSlice';
import { memorySessionStorage, platformSessionStorage, preferencesSessionStorage, type KeyValueStore } from '../../src/session/storage';

/** WW-1603: the APK keeps the seat in Preferences, the web in sessionStorage, and the server decides. */

const seat: SeatCredentials = {
  gameId: '0f4c1c2e-2b0a-4d5e-9a11-6b2f0a9d4c31',
  roomCode: 'K7QMPR',
  playerId: '00000000-0000-4000-8000-000000000004',
  token: 'ww_token_for_tests_0123456789',
  isHost: false,
};

/** Stands in for Android SharedPreferences: it outlives every adapter built on it, as the file outlives the process. */
function fakePreferences(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  const log: string[] = [];
  const store: KeyValueStore = {
    async get(key) {
      return values.get(key) ?? null;
    },
    async set(key, value) {
      await Promise.resolve();
      log.push(`set ${key}`);
      values.set(key, value);
    },
    async remove(key) {
      log.push(`remove ${key}`);
      values.delete(key);
    },
  };
  return { store, values, log };
}

describe('platformSessionStorage', () => {
  it('uses Preferences in the APK and sessionStorage on the web', async () => {
    const prefs = fakePreferences({ 'warewolf.seat': JSON.stringify(seat) });
    const web = memorySessionStorage(null);
    expect((await platformSessionStorage({ isNative: true, preferences: () => prefs.store, browser: () => web })).load()).toEqual(seat);
    let asked = false;
    const chosen = await platformSessionStorage({
      isNative: false,
      preferences: () => {
        asked = true;
        return prefs.store;
      },
      browser: () => web,
    });
    expect(chosen).toBe(web);
    expect(asked).toBe(false);
  });
});

describe('preferencesSessionStorage', () => {
  it('keeps the seat across a process kill', async () => {
    const prefs = fakePreferences();
    const first = await preferencesSessionStorage(prefs.store);
    expect(first.load()).toBeNull();
    first.save(seat);
    expect(first.load()).toEqual(seat);
    await first.flushed();

    // The process dies; a new one reads the same preferences.
    const reopened = await preferencesSessionStorage(prefs.store);
    expect(reopened.load()).toEqual(seat);
  });

  it('writes changes in order, so leaving then joining keeps the new seat', async () => {
    const prefs = fakePreferences();
    const adapter = await preferencesSessionStorage(prefs.store);
    const next = { ...seat, playerId: '00000000-0000-4000-8000-000000000009', token: 'ww_token_for_tests_next_0123456789' };
    adapter.save(seat);
    adapter.save(null);
    adapter.save(next);
    await adapter.flushed();
    expect(prefs.log).toEqual(['set warewolf.seat', 'remove warewolf.seat', 'set warewolf.seat']);
    expect((await preferencesSessionStorage(prefs.store)).load()).toEqual(next);
  });

  it('ignores a stored value it cannot read, and survives a failing plugin', async () => {
    expect((await preferencesSessionStorage(fakePreferences({ 'warewolf.seat': '{not json' }).store)).load()).toBeNull();
    expect((await preferencesSessionStorage(fakePreferences({ 'warewolf.seat': JSON.stringify({ token: 'x' }) }).store)).load()).toBeNull();

    const broken: KeyValueStore = {
      get: () => Promise.reject(new Error('bridge down')),
      set: () => Promise.reject(new Error('bridge down')),
      remove: () => Promise.reject(new Error('bridge down')),
    };
    const adapter = await preferencesSessionStorage(broken);
    expect(adapter.load()).toBeNull();
    adapter.save(seat);
    await expect(adapter.flushed()).resolves.toBeUndefined();
    expect(adapter.load()).toEqual(seat);
  });

  it('drops the stored seat when the server refuses its token', async () => {
    const prefs = fakePreferences({ 'warewolf.seat': JSON.stringify(seat) });
    const storage = await preferencesSessionStorage(prefs.store);
    const fetchFn = (async () =>
      new Response(JSON.stringify({ error: { code: 'UNAUTHENTICATED', message: 'Sign in again.' } }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })) as typeof fetch;
    const store = makeStore({ environment: { baseUrl: 'http://api.test/api/v1', fetchFn }, storage });
    expect(selectCredentials(store.getState())).toEqual(seat);

    await store.dispatch(api.endpoints.getHealth.initiate());
    expect(selectCredentials(store.getState())).toBeNull();
    await storage.flushed();
    expect(prefs.values.has('warewolf.seat')).toBe(false);
  });
});
