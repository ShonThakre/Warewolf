import { avatarIdSchema, deviceKeySchema, displayNameSchema } from '@warewolf/contracts';
import type { KeyValueStore } from './storage';

/**
 * ID-01: the guest identity of this device. A random key, made once and kept
 * (localStorage on the web, Preferences in the APK). Joining a room where this
 * device already holds a seat gives that seat back, even after the browser
 * was closed or the seat token was lost.
 *
 * The key is a secret: it goes only in request bodies, never in a URL, a log,
 * or the UI.
 */

const KEY = 'warewolf.device';
const PROFILE_KEY = 'warewolf.profile';

let current: string | null = null;

function newKey(): string {
  const bytes = new Uint8Array(32);
  globalThis.crypto.getRandomValues(bytes);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function valid(value: string | null | undefined): value is string {
  return typeof value === 'string' && deviceKeySchema.safeParse(value).success;
}

function local(): Storage | undefined {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}

/** The device key, made and saved on first use. Never throws; blocked storage gives a key for this visit only. */
export function deviceKey(): string {
  if (current) return current;
  try {
    const stored = local()?.getItem(KEY);
    if (valid(stored)) {
      current = stored;
      return current;
    }
  } catch {
    // Fall through to a fresh key.
  }
  current = newKey();
  try {
    local()?.setItem(KEY, current);
  } catch {
    // Private mode: the key lasts for this visit.
  }
  return current;
}

/**
 * The APK reads its key from Preferences before the first render, because
 * the WebView's storage is not guaranteed to outlive the app. Writes a new key
 * there when none is stored.
 */
export async function loadDeviceKey(store: KeyValueStore): Promise<string> {
  try {
    const stored = await store.get(KEY);
    if (valid(stored)) {
      current = stored;
      return stored;
    }
  } catch {
    // Fall through.
  }
  const key = deviceKey();
  try {
    await store.set(KEY, key);
  } catch {
    // The key lasts for this run.
  }
  return key;
}

/** Vitest only. */
export function setDeviceKeyForTests(key: string | null): void {
  current = key;
}

/** The name and avatar this device last played with, to prefill the next create or join. Not a secret. */
export interface GuestProfile {
  readonly displayName: string;
  readonly avatarId?: number;
}

export function loadProfile(): GuestProfile | null {
  try {
    const raw = local()?.getItem(PROFILE_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as { displayName?: unknown; avatarId?: unknown };
    const name = displayNameSchema.safeParse(value.displayName);
    if (!name.success) return null;
    const avatar = avatarIdSchema.safeParse(value.avatarId);
    return avatar.success ? { displayName: name.data, avatarId: avatar.data } : { displayName: name.data };
  } catch {
    return null;
  }
}

export function saveProfile(profile: GuestProfile): void {
  try {
    local()?.setItem(PROFILE_KEY, JSON.stringify(profile));
  } catch {
    // Prefill is a convenience.
  }
}
