import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_CATALOG } from '@warewolf/domain';
import sharp from 'sharp';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ASPECTS, checkArt, evaluate, formatReport, readManifest } from '../src/check.mjs';

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));

type Asset = Parameters<typeof evaluate>[0];
const portrait: Asset = { id: 'seeker', category: 'roles', file: 'art/roles/seeker.png', aspect: '1:1', minShortSide: 900, transparent: true, optional: false, webWidth: 512 };
const scene: Asset = { id: 'square_day', category: 'scenes', file: 'art/scenes/square_day.png', aspect: '3:2', minShortSide: 900, transparent: false, optional: false, webWidth: 1536 };
const appIcon: Asset = { id: 'app_icon', category: 'ui', file: 'art/ui/app_icon.png', aspect: '1:1', minShortSide: 900, transparent: false, optional: false, webWidth: 768 };

/** A PNG whose outer ring is fully transparent, like a cut-out portrait. */
async function cutout(width: number, height: number): Promise<Buffer> {
  const inner = await sharp({ create: { width: Math.round(width * 0.6), height: Math.round(height * 0.6), channels: 4, background: { r: 120, g: 60, b: 200, alpha: 1 } } }).png().toBuffer();
  return sharp({ create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: inner, gravity: 'centre' }])
    .png()
    .toBuffer();
}

/** A PNG with an alpha channel but no transparent pixels: what a painted checkerboard looks like. */
const paintedCheckerboard = (size: number) =>
  sharp({ create: { width: size, height: size, channels: 4, background: { r: 200, g: 200, b: 200, alpha: 1 } } }).png().toBuffer();

const opaque = (width: number, height: number) =>
  sharp({ create: { width, height, channels: 3, background: { r: 40, g: 20, b: 70 } } }).png().toBuffer();

describe('evaluate', () => {
  it('accepts ChatGPT square portraits of any size above the minimum', () => {
    expect(evaluate(portrait, { width: 1254, height: 1254, hasAlpha: true, transparentFraction: 0.3 })).toEqual([]);
    expect(evaluate(portrait, { width: 1024, height: 1024, hasAlpha: true, transparentFraction: 0.3 })).toEqual([]);
  });

  it('rejects the wrong shape', () => {
    expect(evaluate(portrait, { width: 1536, height: 1024, hasAlpha: true, transparentFraction: 0.3 })[0]).toContain('should be 1:1 (square)');
    expect(evaluate(scene, { width: 1536, height: 1024, hasAlpha: false, transparentFraction: 0 })).toEqual([]);
    expect(evaluate(scene, { width: 1024, height: 1024, hasAlpha: false, transparentFraction: 0 })[0]).toContain('3:2 (landscape)');
  });

  it('tolerates a few pixels of drift in the ratio', () => {
    expect(evaluate(scene, { width: 1672, height: 1100, hasAlpha: false, transparentFraction: 0 })).toEqual([]);
  });

  it('rejects images that are too small', () => {
    expect(evaluate(portrait, { width: 512, height: 512, hasAlpha: true, transparentFraction: 0.3 })[0]).toContain('at least 900 px');
  });

  it('rejects fake transparency', () => {
    expect(evaluate(portrait, { width: 1254, height: 1254, hasAlpha: false, transparentFraction: 0 })[0]).toContain('no transparency at all');
    expect(evaluate(portrait, { width: 1254, height: 1254, hasAlpha: true, transparentFraction: 0.001 })[0]).toContain('checkerboard');
  });

  it('requires the app icon to be fully opaque', () => {
    expect(evaluate(appIcon, { width: 1024, height: 1024, hasAlpha: true, transparentFraction: 0.2 })[0]).toContain('fully opaque');
    expect(evaluate(appIcon, { width: 1024, height: 1024, hasAlpha: true, transparentFraction: 0 })).toEqual([]);
  });
});

describe('checkArt on a folder', () => {
  let root: string;
  const manifest = {
    version: 2,
    assets: [
      portrait,
      { ...portrait, id: 'guard', file: 'art/roles/guard.png' },
      { ...portrait, id: 'witch', file: 'art/roles/witch.png' },
      scene,
      { ...appIcon },
      { ...appIcon, id: 'ribbon_draw', file: 'art/ui/ribbon_draw.png', aspect: '3:2', transparent: true, optional: true },
    ] as Asset[],
  };
  const put = async (relative: string, data: Buffer) => {
    await mkdir(join(root, relative, '..'), { recursive: true });
    await writeFile(join(root, relative), data);
  };

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'warewolf-art-'));
    for (const c of ['roles', 'scenes', 'ui']) await mkdir(join(root, 'art', c), { recursive: true });
    await writeFile(join(root, 'art', 'manifest.json'), JSON.stringify(manifest));
    await writeFile(join(root, 'art', 'roles', '.gitkeep'), '');
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('passes correct files and reports the rest as still to generate', async () => {
    await put('art/roles/seeker.png', await cutout(1000, 1000));
    await put('art/scenes/square_day.png', await opaque(1536, 1024));
    const result = await checkArt(root, await readManifest(root));
    expect(result.errors).toEqual([]);
    expect(result.coverage).toEqual({
      roles: { present: 1, required: 3, total: 3 },
      scenes: { present: 1, required: 1, total: 1 },
      ui: { present: 0, required: 1, total: 2 },
    });
    expect(result.missing.map((a) => a.id)).toEqual(['guard', 'witch', 'app_icon', 'ribbon_draw']);
    const report = formatReport(result);
    expect(report.passed).toBe(true);
    expect(report.text).toContain('roles     1/3');
    expect(report.text).toContain('Still to generate: 3 required files');
  });

  it('fails strict mode while required art is missing', async () => {
    const result = await checkArt(root, await readManifest(root));
    expect(formatReport(result, { strict: true }).passed).toBe(false);
  });

  it('catches a painted checkerboard, a wrong shape, and a small image', async () => {
    await put('art/roles/seeker.png', await paintedCheckerboard(1000));
    await put('art/roles/guard.png', await cutout(1536, 1024));
    await put('art/roles/witch.png', await cutout(600, 600));
    const { errors } = await checkArt(root, await readManifest(root));
    expect(errors.map((e) => e.file)).toEqual(['art/roles/guard.png', 'art/roles/seeker.png', 'art/roles/witch.png']);
    expect(errors.find((e) => e.file.endsWith('seeker.png'))?.message).toContain('checkerboard');
  });

  it('explains misnamed and misplaced files', async () => {
    await put('art/roles/Seeker.png', await cutout(1000, 1000));
    await put('art/roles/guard.jpg', await opaque(1000, 1000));
    await put('art/scenes/witch.png', await cutout(1000, 1000));
    await put('art/stray.png', await cutout(1000, 1000));
    await put('art/incoming/roles/witch.png', await cutout(1000, 1000));
    const { errors } = await checkArt(root, await readManifest(root));
    const byFile = Object.fromEntries(errors.map((e) => [e.file, e.message]));
    expect(byFile['art/roles/Seeker.png']).toContain('rename it to seeker.png');
    expect(byFile['art/roles/guard.jpg']).toContain('rename it to guard.png');
    expect(byFile['art/scenes/witch.png']).toContain('belongs in art/roles/');
    expect(byFile['art/stray.png']).toContain('category folder');
    expect(byFile['art/incoming/']).toContain('no longer used');
  });

  it('reports a file that is not an image', async () => {
    await put('art/roles/seeker.png', Buffer.from('not a png'));
    const { errors } = await checkArt(root, await readManifest(root));
    expect(errors[0]?.message).toContain('cannot be read');
  });
});

describe('the real manifest', () => {
  it('lists every catalog role, 36 avatars, and 111 unique files', async () => {
    const manifest = await readManifest(repoRoot);
    const assets = manifest.assets as Asset[];
    expect(assets).toHaveLength(111);
    expect(new Set(assets.map((a) => a.file)).size).toBe(111);
    expect(assets.filter((a) => a.category === 'roles').map((a) => a.id).sort()).toEqual(DEFAULT_CATALOG.roles.map((r) => r.id).sort());
    expect(assets.filter((a) => a.category === 'avatars').map((a) => a.id)).toEqual(
      Array.from({ length: 36 }, (_, i) => `avatar_${String(i + 1).padStart(2, '0')}`),
    );
    for (const a of assets) {
      expect(a.file).toBe(`art/${a.category}/${a.id}.png`);
      expect(Object.keys(ASPECTS)).toContain(a.aspect);
    }
  });

  it('every image already in art/ passes', async () => {
    const result = await checkArt(repoRoot, await readManifest(repoRoot));
    expect(result.errors).toEqual([]);
  });
});
