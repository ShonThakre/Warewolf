import { AVATAR_COUNT } from '@warewolf/contracts';
import { AVATAR_FILE_IDS, SCENE_IDS, UI_ART_IDS, avatarFileId, createArtIndex, type SceneId, type UiArtId } from './art-index';

/**
 * Every illustration in `art/` at the repository root, found by file name.
 *
 * The globs below match only the files that exist, so art can arrive a few
 * images at a time: a function returns `null` until its file is added, and
 * the component shows its fallback (initials, a plain panel, or
 * `mystery_avatar`). `vite-imagetools` converts each PNG to WebP at the width
 * players need, in dev and in the build; the PNG originals are never shipped.
 *
 * Widths match `webWidth` in `art/manifest.json`.
 */
const roleFiles = import.meta.glob<string>('../../../../art/roles/*.png', {
  eager: true,
  import: 'default',
  query: { w: '512', format: 'webp', quality: '80' },
});
const avatarFiles = import.meta.glob<string>('../../../../art/avatars/*.png', {
  eager: true,
  import: 'default',
  query: { w: '256', format: 'webp', quality: '80' },
});
const sceneFiles = import.meta.glob<string>('../../../../art/scenes/*.png', {
  eager: true,
  import: 'default',
  query: { w: '1536', format: 'webp', quality: '78' },
});
const uiFiles = import.meta.glob<string>('../../../../art/ui/*.png', {
  eager: true,
  import: 'default',
  query: { w: '768', format: 'webp', quality: '82' },
});

const roles = createArtIndex(roleFiles);
const avatars = createArtIndex(avatarFiles, AVATAR_FILE_IDS);
const scenes = createArtIndex(sceneFiles, new Set(SCENE_IDS));
const ui = createArtIndex(uiFiles, new Set(UI_ART_IDS));

/** Portrait for a role id from the catalog, such as `alpha_wolf`. */
export function roleArtUrl(roleId: string): string | null {
  return roles.get(roleId) ?? null;
}

/** Portrait for avatar 1 to 36. */
export function avatarArtUrl(avatarId: number): string | null {
  if (!Number.isInteger(avatarId) || avatarId < 1 || avatarId > AVATAR_COUNT) return null;
  return avatars.get(avatarFileId(avatarId)) ?? null;
}

export function sceneArtUrl(id: SceneId): string | null {
  return scenes.get(id) ?? null;
}

export function uiArtUrl(id: UiArtId): string | null {
  return ui.get(id) ?? null;
}

/** How many images of each kind are present. Useful for a dev overlay or a test. */
export function artCoverage(): { roles: number; avatars: number; scenes: number; ui: number } {
  return { roles: roles.size, avatars: avatars.size, scenes: scenes.size, ui: ui.size };
}

export { AVATAR_COUNT, SCENE_IDS, UI_ART_IDS, type SceneId, type UiArtId };
