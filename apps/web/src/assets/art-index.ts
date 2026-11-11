import { AVATAR_COUNT } from '@warewolf/contracts';

/**
 * Names of the art the game uses. They match `art/manifest.json`, and a test
 * keeps the two in step. Role art is named by role id from the catalog, so
 * it has no list here.
 */
export const SCENE_IDS = [
  'home_night_village',
  'lobby_campfire',
  'square_day',
  'square_dusk',
  'square_night',
  'reveal_wolf',
  'reveal_village',
  'reveal_neutral',
  'reveal_independent',
  'victory_village',
  'victory_wolves',
  'victory_lone_wolf',
  'victory_neutral',
  'result_draw',
] as const;
export type SceneId = (typeof SCENE_IDS)[number];

export const UI_ART_IDS = [
  'emblem',
  'app_icon',
  'card_back',
  'parchment',
  'mystery_avatar',
  'ribbon_village',
  'ribbon_wolves',
  'ribbon_lone_wolf',
  'ribbon_neutral',
  'ribbon_draw',
] as const;
export type UiArtId = (typeof UI_ART_IDS)[number];

/** `avatar_01` for avatar 1. */
export function avatarFileId(avatarId: number): string {
  return `avatar_${String(avatarId).padStart(2, '0')}`;
}

/** File name without folder or extension: `../../art/roles/alpha_wolf.png` gives `alpha_wolf`. */
export function stemOf(path: string): string {
  const name = path.slice(path.lastIndexOf('/') + 1);
  const dot = name.lastIndexOf('.');
  return dot === -1 ? name : name.slice(0, dot);
}

/** Maps each found file's stem to its built URL. Files whose stem is not in `allowed` are ignored. */
export function createArtIndex(files: Readonly<Record<string, string>>, allowed?: ReadonlySet<string>): ReadonlyMap<string, string> {
  const index = new Map<string, string>();
  for (const [path, url] of Object.entries(files)) {
    const stem = stemOf(path);
    if (!allowed || allowed.has(stem)) index.set(stem, url);
  }
  return index;
}

/** The set of avatar file ids, 1 to AVATAR_COUNT. */
export const AVATAR_FILE_IDS: ReadonlySet<string> = new Set(Array.from({ length: AVATAR_COUNT }, (_, i) => avatarFileId(i + 1)));
