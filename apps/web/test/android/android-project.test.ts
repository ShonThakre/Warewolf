import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import config from '../../capacitor.config';

/**
 * WW-1601, OD-71: the APK is the same Vite client in a WebView. These checks
 * keep the generated Android project honest when someone edits it by hand or
 * re-runs `cap add`: the bundled build is what loads, the activity rotates,
 * and the only permission is INTERNET.
 */

// Vitest runs from apps/web. (import.meta.url is an http URL under happy-dom.)
const android = resolve(process.cwd(), 'android');
const read = (path: string) => readFileSync(resolve(android, path), 'utf8');
const manifest = read('app/src/main/AndroidManifest.xml');

describe('capacitor config', () => {
  it('wraps the Vite build and never a dev server', () => {
    expect(config.webDir).toBe('dist');
    expect(config.server?.url).toBeUndefined();
    expect(config.appName).toBe('Werewolf');
  });

  it('uses one app id everywhere Android reads it', () => {
    const gradle = read('app/build.gradle');
    expect(gradle).toContain(`applicationId "${config.appId}"`);
    expect(gradle).toContain(`namespace = "${config.appId}"`);
    expect(read('app/src/main/res/values/strings.xml')).toContain(`<string name="package_name">${config.appId}</string>`);
    expect(read(`app/src/main/java/${config.appId!.replaceAll('.', '/')}/MainActivity.java`)).toContain(`package ${config.appId};`);
  });
});

describe('AndroidManifest.xml', () => {
  it('does not lock orientation (OD-71)', () => {
    expect(manifest).not.toMatch(/screenOrientation/);
    // The activity handles rotation itself, so the game keeps its state when the phone turns.
    expect(manifest).toMatch(/android:configChanges="[^"]*\borientation\b[^"]*\bscreenSize\b/);
  });

  it('declares INTERNET and no other permission', () => {
    const permissions = [...manifest.matchAll(/<uses-permission\s+android:name="([^"]+)"/g)].map((m) => m[1]);
    expect(permissions).toEqual(['android.permission.INTERNET']);
  });

  it('allows cleartext in debug builds only (WW-1602)', () => {
    expect(manifest).not.toMatch(/usesCleartextTraffic/);
    const debug = read('app/src/debug/AndroidManifest.xml');
    expect(debug).toMatch(/android:usesCleartextTraffic="true"/);
    expect(debug).not.toMatch(/uses-permission/);
    expect(() => read('app/src/release/AndroidManifest.xml')).toThrow();
  });
});

describe('launcher icon (WW-1605)', () => {
  // Capacitor's template launcher icon at xxxhdpi, before apps/web/scripts/android-icons.sh.
  const CAPACITOR_DEFAULT_MD5 = '9e029293ab1ae8e3a6a7b7d0b7177e46';
  const png = (path: string) => readFileSync(resolve(android, 'app/src/main/res', path));

  it('uses the game art, not the Capacitor default', () => {
    const icon = png('mipmap-xxxhdpi/ic_launcher.png');
    expect(createHash('md5').update(icon).digest('hex')).not.toBe(CAPACITOR_DEFAULT_MD5);
    expect([icon.readUInt32BE(16), icon.readUInt32BE(20)]).toEqual([192, 192]);
    const foreground = png('mipmap-xxxhdpi/ic_launcher_foreground.png');
    expect([foreground.readUInt32BE(16), foreground.readUInt32BE(20)]).toEqual([432, 432]);
  });

  it('gives the adaptive icon the art\'s purple background', () => {
    expect(read('app/src/main/res/values/ic_launcher_background.xml')).toMatch(
      /<color name="ic_launcher_background">#160350<\/color>/,
    );
  });
});

describe('signing', () => {
  it('keeps keystores out of the Android project', () => {
    const ignored = read('.gitignore');
    expect(ignored).toMatch(/^\*\.jks$/m);
    expect(ignored).toMatch(/^\*\.keystore$/m);
  });
});
