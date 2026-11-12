import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { platformSessionStorage, type SessionStorageAdapter } from './storage';

/**
 * The seat storage for this runtime (WW-1603). Inside the APK the token goes
 * to Capacitor Preferences; in a browser it stays in sessionStorage. Kept out
 * of `storage.ts` so tests of the adapters never load the native bridge.
 */
export function startupSessionStorage(): Promise<SessionStorageAdapter> {
  return platformSessionStorage({
    isNative: Capacitor.isNativePlatform(),
    preferences: () => ({
      get: async (key) => (await Preferences.get({ key })).value,
      set: (key, value) => Preferences.set({ key, value }),
      remove: (key) => Preferences.remove({ key }),
    }),
  });
}
