import type { CapacitorConfig } from '@capacitor/cli';

/**
 * The Android shell (WW-1601, WW-1602, OD-71). The APK is this same Vite
 * client in a WebView: `pnpm android:sync` builds `dist/` and copies it into
 * `android/app/src/main/assets/public`. There are no Android-only screens.
 *
 * The API origin is a build-time setting, `VITE_API_ORIGIN`, read here at
 * `cap sync` and by Vite at build. A phone cannot reach `localhost` on the
 * developer machine, so an APK needs it set.
 *
 * - `https://…` (release, or a debug build against a real server): the
 *   WebView keeps Capacitor's default `https://localhost` origin.
 * - `http://…` (a LAN debug server): the WebView is served from
 *   `http://localhost`, because an https page may not call an http API. The
 *   cleartext permission that this needs exists only in the debug manifest
 *   (`android/app/src/debug/AndroidManifest.xml`), so a release build with an
 *   http origin fails closed.
 *
 * The API must list the WebView origin in `CORS_ORIGINS`.
 *
 * Not set on purpose: `server.url` (the WebView loads the bundled build,
 * never a dev server) and any orientation (OD-71). The checks are in
 * `test/android/android-project.test.ts`.
 */
const apiOrigin = process.env.VITE_API_ORIGIN?.trim() ?? '';
const lanDebug = apiOrigin.startsWith('http://');

const config: CapacitorConfig = {
  // Reverse-domain id. Android treats a changed id as a different app, so keep it.
  appId: 'com.warewolf.werewolf',
  appName: 'Werewolf',
  webDir: 'dist',
  ...(lanDebug ? { server: { androidScheme: 'http' } } : {}),
  android: {
    allowMixedContent: false,
  },
};

export default config;
