import type { CapacitorConfig } from '@capacitor/cli';

/**
 * The Android shell (WW-1601, OD-71, APK-01). The APK is this same Vite client
 * in a WebView. There are no Android-only screens.
 *
 * The WebView loads the deployed site (`server.url`), not a copy built into
 * the APK, so every deploy reaches installed apps on their next launch, with
 * no new APK. The page and the API share one origin, so no `VITE_API_ORIGIN`
 * or `CORS_ORIGINS` entry is needed. Only native changes (icon, permissions,
 * plugins, this file) need a new APK.
 *
 * `CAP_SERVER_URL` overrides the site at `cap sync`, for example
 * `http://<lan-ip>:5173` to point a debug APK at the Vite dev server on the
 * developer machine. Cleartext HTTP is allowed only by the debug manifest
 * (`android/app/src/debug/AndroidManifest.xml`), so a release build with an
 * http URL fails closed.
 *
 * `pnpm android:sync` still copies `dist/` into the APK. It supplies
 * `offline.html` (from `native/offline.html`, written by the Vite build with
 * this URL), which Capacitor shows when the site cannot be loaded (no
 * network, or the server is down or restarting).
 *
 * The checks are in `test/android/android-project.test.ts`.
 */
export const LIVE_SITE_URL = 'https://warewolf-hi18.onrender.com';

/** The site the APK opens. Read by `cap sync` here and by the Vite build for `offline.html`. */
export const serverUrl = (process.env.CAP_SERVER_URL?.trim() || LIVE_SITE_URL).replace(/\/+$/, '');

const config: CapacitorConfig = {
  // Reverse-domain id. Android treats a changed id as a different app, so keep it.
  appId: 'com.warewolf.werewolf',
  appName: 'Werewolf',
  webDir: 'dist',
  server: {
    url: serverUrl,
    errorPath: 'offline.html',
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
