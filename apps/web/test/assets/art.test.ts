import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DEFAULT_CATALOG } from '@warewolf/domain';
import { describe, expect, it } from 'vitest';
import { AVATAR_COUNT, SCENE_IDS, UI_ART_IDS, artCoverage, avatarArtUrl, roleArtUrl, sceneArtUrl, uiArtUrl } from '../../src/assets/art';
import { avatarFileId, createArtIndex, stemOf } from '../../src/assets/art-index';

// Vitest runs from apps/web. (import.meta.url is an http URL under happy-dom.)
const artDir = `${resolve(process.cwd(), '../../art')}/`;
const manifest = JSON.parse(readFileSync(`${artDir}manifest.json`, 'utf8')) as { assets: { id: string; category: string }[] };
const idsIn = (category: string) => manifest.assets.filter((a) => a.category === category).map((a) => a.id);
const onDisk = (category: string, id: string) => existsSync(`${artDir}${category}/${id}.png`);

describe('art index helpers', () => {
  it('takes the file stem', () => {
    expect(stemOf('../../../../art/roles/alpha_wolf.png')).toBe('alpha_wolf');
    expect(stemOf('emblem')).toBe('emblem');
  });

  it('names avatar files with two digits', () => {
    expect(avatarFileId(1)).toBe('avatar_01');
    expect(avatarFileId(36)).toBe('avatar_36');
  });

  it('ignores files whose names are not expected', () => {
    const index = createArtIndex({ '/a/emblem.png': 'u1', '/a/Emblem copy.png': 'u2' }, new Set(UI_ART_IDS));
    expect([...index.keys()]).toEqual(['emblem']);
  });
});

describe('art names match the manifest', () => {
  it('scene and UI ids', () => {
    expect([...SCENE_IDS]).toEqual(idsIn('scenes'));
    expect([...UI_ART_IDS]).toEqual(idsIn('ui'));
  });

  it('avatar count', () => {
    expect(idsIn('avatars')).toEqual(Array.from({ length: AVATAR_COUNT }, (_, i) => avatarFileId(i + 1)));
  });

  it('role ids come from the catalog', () => {
    expect(idsIn('roles').sort()).toEqual(DEFAULT_CATALOG.roles.map((r) => r.id).sort());
  });
});

describe('art lookups', () => {
  // These hold however much art has been generated: a URL exactly when the file exists.
  it('returns a URL for each role whose file exists, and null otherwise', () => {
    for (const role of DEFAULT_CATALOG.roles) {
      const url = roleArtUrl(role.id);
      expect(url === null, role.id).toBe(!onDisk('roles', role.id));
    }
  });

  it('does the same for avatars, scenes, and UI art', () => {
    for (let n = 1; n <= AVATAR_COUNT; n++) expect(avatarArtUrl(n) === null).toBe(!onDisk('avatars', avatarFileId(n)));
    for (const id of SCENE_IDS) expect(sceneArtUrl(id) === null, id).toBe(!onDisk('scenes', id));
    for (const id of UI_ART_IDS) expect(uiArtUrl(id) === null, id).toBe(!onDisk('ui', id));
  });

  it('rejects avatar numbers outside 1 to 36, and unknown roles', () => {
    expect(avatarArtUrl(0)).toBeNull();
    expect(avatarArtUrl(37)).toBeNull();
    expect(avatarArtUrl(1.5)).toBeNull();
    expect(roleArtUrl('not_a_role')).toBeNull();
  });

  it('serves converted WebP, not the PNG originals', () => {
    const url = roleArtUrl('alpha_wolf');
    if (url) expect(url).not.toMatch(/\.png$/);
  });

  it('counts what is present', () => {
    const coverage = artCoverage();
    expect(coverage.roles).toBe(DEFAULT_CATALOG.roles.filter((r) => onDisk('roles', r.id)).length);
  });
});
