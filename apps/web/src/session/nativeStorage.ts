import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { deviceKey, loadDeviceKey } from './device';
import { platformSessionStorage, type KeyValueStore, type SessionStorageAdapter } from './storage';

const preferences: KeyValueStore = {
  get: async (key) => (await Preferences.get({ key })).value,
  set: (key, value) => Preferences.set({ key, value }),
  remove: (key) => Preferences.remove({ key }),
};

/**
 * The seat storage for this runtime (WW-1603). Inside the APK the token goes
 * to Capacitor Preferences; in a browser it stays in localStorage (ID-01). Kept out
 * of `storage.ts` so tests of the adapters never load the native bridge.
 */
export function startupSessionStorage(): Promise<SessionStorageAdapter> {
  return platformSessionStorage({
    isNative: Capacitor.isNativePlatform(),
    preferences: () => preferences,
  });
}

/** ID-01: the device key, read before the first render. Preferences in the APK, localStorage on the web. */
export async function startupDeviceKey(): Promise<string> {
  return Capacitor.isNativePlatform() ? loadDeviceKey(preferences) : deviceKey();
}
