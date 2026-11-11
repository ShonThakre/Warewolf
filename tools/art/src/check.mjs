// Checks the art in art/<category>/ against art/manifest.json.
//
// Missing files are reported as coverage, not as errors, because the art is
// generated a few images at a time. Anything that would show up wrong in the
// game is an error: a misnamed file, the wrong shape, too small, or a
// "transparent" image whose background is actually painted in.

import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';

/** Width divided by height for each manifest aspect. */
export const ASPECTS = { '1:1': 1, '3:2': 3 / 2, '2:3': 2 / 3 };

/** How far a file's ratio may drift from its aspect, as a fraction. */
export const ASPECT_TOLERANCE = 0.03;

/**
 * Share of fully transparent pixels a transparent asset must have. A real cut-out
 * portrait has far more. A checkerboard painted into the image has none.
 */
export const MIN_TRANSPARENT_FRACTION = 0.02;

/** Files that may sit in art/ itself. */
const ROOT_FILES = new Set(['README.md', 'manifest.json']);

/** @typedef {{ id: string, category: string, file: string, aspect: '1:1' | '3:2' | '2:3', minShortSide: number, transparent: boolean, optional: boolean, webWidth: number }} Asset */
/** @typedef {{ width: number, height: number, hasAlpha: boolean, transparentFraction: number }} ImageInfo */
/** @typedef {{ file: string, message: string }} Problem */

export async function readManifest(root) {
  return JSON.parse(await readFile(join(root, 'art', 'manifest.json'), 'utf8'));
}

/** Reads the facts the checks need. The alpha channel is sampled at 256 px wide, which is plenty for a fraction. */
export async function inspectImage(path) {
  const meta = await sharp(path).metadata();
  const info = { width: meta.width ?? 0, height: meta.height ?? 0, hasAlpha: Boolean(meta.hasAlpha), transparentFraction: 0 };
  if (info.hasAlpha) {
    const alpha = await sharp(path).resize({ width: 256 }).ensureAlpha().extractChannel(3).raw().toBuffer();
    let clear = 0;
    for (const value of alpha) if (value < 8) clear++;
    info.transparentFraction = clear / alpha.length;
  }
  return info;
}

/**
 * The problems with one image, given its manifest entry. Pure, so it can be
 * tested without files.
 * @param {Asset} asset
 * @param {ImageInfo} info
 * @returns {string[]}
 */
export function evaluate(asset, info) {
  const problems = [];
  const expected = ASPECTS[asset.aspect];
  const ratio = info.width / info.height;
  if (Math.abs(ratio - expected) / expected > ASPECT_TOLERANCE) {
    problems.push(`is ${info.width}×${info.height}, but should be ${asset.aspect} (${describeAspect(asset.aspect)})`);
  }
  const shortSide = Math.min(info.width, info.height);
  if (shortSide < asset.minShortSide) {
    problems.push(`is ${info.width}×${info.height}; the short side must be at least ${asset.minShortSide} px`);
  }
  if (asset.transparent) {
    if (!info.hasAlpha) {
      problems.push('needs a transparent background, but the file has no transparency at all');
    } else if (info.transparentFraction < MIN_TRANSPARENT_FRACTION) {
      problems.push('needs a transparent background, but the background is solid (often a checkerboard painted into the image)');
    }
  } else if (asset.id === 'app_icon' && info.hasAlpha && info.transparentFraction > 0) {
    problems.push('must be fully opaque: app icons cannot have transparent areas');
  }
  return problems;
}

function describeAspect(aspect) {
  return { '1:1': 'square', '3:2': 'landscape', '2:3': 'portrait' }[aspect];
}

async function listFiles(dir) {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    return entries.filter((e) => e.isFile() && !e.name.startsWith('.')).map((e) => e.name);
  } catch {
    return [];
  }
}

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

/** A hint for a file whose name is close to an expected one. */
function suggest(name, category, assets) {
  const stem = name.replace(/\.[^.]+$/, '');
  const normalized = stem.toLowerCase().replace(/[\s-]+/g, '_');
  const match = assets.find((a) => a.id === normalized);
  if (match && match.category === category) return `rename it to ${match.id}.png`;
  if (match) return `it belongs in art/${match.category}/ as ${match.id}.png`;
  return 'it is not in art/manifest.json; check the name in docs/ART-PROMPTS.md';
}

/**
 * Checks every category folder.
 * @returns {Promise<{ coverage: Record<string, { present: number, required: number, total: number }>, missing: Asset[], errors: Problem[] }>}
 */
export async function checkArt(root, manifest) {
  /** @type {Asset[]} */
  const assets = manifest.assets;
  const categories = [...new Set(assets.map((a) => a.category))];
  /** @type {Problem[]} */
  const errors = [];
  /** @type {Asset[]} */
  const missing = [];
  const coverage = {};

  for (const category of categories) {
    const inCategory = assets.filter((a) => a.category === category);
    const expected = new Map(inCategory.map((a) => [`${a.id}.png`, a]));
    const files = await listFiles(join(root, 'art', category));
    let present = 0;

    for (const name of files) {
      const asset = expected.get(name);
      if (!asset) {
        errors.push({ file: `art/${category}/${name}`, message: `unexpected file: ${suggest(name, category, assets)}` });
        continue;
      }
      present++;
      try {
        for (const message of evaluate(asset, await inspectImage(join(root, asset.file)))) {
          errors.push({ file: asset.file, message });
        }
      } catch {
        errors.push({ file: asset.file, message: 'cannot be read as an image; save it again as a PNG' });
      }
    }
    for (const asset of inCategory) if (!files.includes(`${asset.id}.png`)) missing.push(asset);
    coverage[category] = { present, required: inCategory.filter((a) => !a.optional).length, total: inCategory.length };
  }

  for (const name of await listFiles(join(root, 'art'))) {
    if (!ROOT_FILES.has(name)) {
      errors.push({ file: `art/${name}`, message: `images go in a category folder: ${suggest(name, '', assets)}` });
    }
  }
  if (await exists(join(root, 'art', 'incoming'))) {
    errors.push({ file: 'art/incoming/', message: 'this old folder is no longer used; move its images to art/roles/, art/avatars/, art/scenes/, or art/ui/' });
  }

  return { coverage, missing, errors };
}

/** Human-readable report. Returns the text and whether the check passed. */
export function formatReport(result, { strict = false } = {}) {
  const lines = ['Art check', ''];
  for (const [category, c] of Object.entries(result.coverage)) {
    const optional = c.total - c.required;
    lines.push(`  ${category.padEnd(8)} ${String(c.present).padStart(2)}/${c.total}${optional ? ` (${optional} optional)` : ''}`);
  }
  const requiredMissing = result.missing.filter((a) => !a.optional);
  lines.push('');
  if (result.errors.length > 0) {
    lines.push(`Problems (${result.errors.length}):`);
    for (const e of result.errors) lines.push(`  ✗ ${e.file}: ${e.message}`);
    lines.push('');
  }
  if (requiredMissing.length > 0) {
    const shown = requiredMissing.slice(0, 12).map((a) => a.file.replace(/^art\//, ''));
    lines.push(`Still to generate: ${requiredMissing.length} required file${requiredMissing.length === 1 ? '' : 's'}${strict ? ' (strict mode: this fails the check)' : ''}`);
    lines.push(`  ${shown.join(', ')}${requiredMissing.length > shown.length ? ', …' : ''}`);
    lines.push('');
  }
  const passed = result.errors.length === 0 && (!strict || requiredMissing.length === 0);
  lines.push(passed ? 'OK: every file present is correct.' : 'Fix the problems above.');
  return { text: lines.join('\n'), passed };
}
