import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * WW-1605: the browser client installs to a phone's home screen and opens
 * without browser chrome. iOS reads the apple-* tags and the touch icon;
 * Android Chrome reads the manifest.
 */

// Vitest runs from apps/web. (import.meta.url is an http URL under happy-dom.)
const web = process.cwd();
const publicDir = resolve(web, 'public');
const html = readFileSync(resolve(web, 'index.html'), 'utf8');

interface Icon {
  readonly src: string;
  readonly sizes: string;
  readonly type: string;
  readonly purpose?: string;
}
const manifest = JSON.parse(readFileSync(resolve(publicDir, 'manifest.webmanifest'), 'utf8')) as {
  name: string;
  start_url: string;
  display: string;
  display_override?: string[];
  orientation?: string;
  icons: Icon[];
};

/** Width and height from a PNG's IHDR chunk. */
function pngSize(path: string): { width: number; height: number } {
  const bytes = readFileSync(path);
  expect(bytes.subarray(1, 4).toString('ascii')).toBe('PNG');
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

describe('web app manifest', () => {
  it('opens full screen from the home screen and leaves rotation free (OD-71)', () => {
    expect(manifest.name).toBe('Werewolf');
    expect(manifest.start_url).toBe('/');
    expect(manifest.display).toBe('standalone');
    expect(manifest.display_override?.[0]).toBe('fullscreen');
    expect(manifest.orientation).toBeUndefined();
  });

  it('lists 192 and 512 icons, one of them maskable, each at its declared size', () => {
    const sizes = manifest.icons.map((icon) => icon.sizes);
    expect(sizes).toContain('192x192');
    expect(sizes).toContain('512x512');
    expect(manifest.icons.some((icon) => icon.purpose === 'maskable')).toBe(true);
    for (const icon of manifest.icons) {
      const file = resolve(publicDir, icon.src.replace(/^\//, ''));
      expect(existsSync(file), icon.src).toBe(true);
      const { width, height } = pngSize(file);
      expect(`${width}x${height}`).toBe(icon.sizes);
      expect(icon.type).toBe('image/png');
    }
  });
});

describe('index.html', () => {
  it('links the manifest and the iOS touch icon', () => {
    expect(html).toContain('<link rel="manifest" href="/manifest.webmanifest" />');
    expect(html).toContain('<link rel="apple-touch-icon" href="/apple-touch-icon.png" />');
    expect(pngSize(resolve(publicDir, 'apple-touch-icon.png'))).toEqual({ width: 180, height: 180 });
  });

  it('runs without Safari chrome from the iOS home screen, drawing under the status bar', () => {
    expect(html).toMatch(/<meta name="apple-mobile-web-app-capable" content="yes" \/>/);
    expect(html).toMatch(/<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" \/>/);
    expect(html).toMatch(/<meta name="apple-mobile-web-app-title" content="Werewolf" \/>/);
    // black-translucent puts content under the status bar, so the page must honour the insets.
    expect(html).toMatch(/viewport-fit=cover/);
  });
});
