import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defaultClientConditions, type Plugin } from 'vite';
import { imagetools } from 'vite-imagetools';
import { defineConfig } from 'vitest/config';
import { serverUrl } from './capacitor.config';

const artDir = fileURLToPath(new URL('../../art', import.meta.url));

/**
 * `art/` sits outside this app's root, so the dev watcher does not see files
 * added there and `import.meta.glob` in src/assets/art.ts keeps the list it
 * had at startup. Watching the folder lets new portraits appear without a restart.
 */
function watchArt(): Plugin {
  return {
    name: 'warewolf-watch-art',
    apply: 'serve',
    configureServer(server) {
      server.watcher.add(artDir);
    },
  };
}

/**
 * APK-01. Writes `native/offline.html` to `dist/offline.html` with the APK's
 * server URL filled in. Capacitor serves that page from https://localhost
 * when the live site cannot load, so it needs the site's absolute URL.
 */
function offlinePage(): Plugin {
  return {
    name: 'warewolf-offline-page',
    apply: 'build',
    generateBundle() {
      const template = readFileSync(fileURLToPath(new URL('./native/offline.html', import.meta.url)), 'utf8');
      this.emitFile({ type: 'asset', fileName: 'offline.html', source: template.replaceAll('__APP_SERVER_URL__', serverUrl) });
    },
  };
}

export default defineConfig({
  // imagetools turns the PNGs in art/ into WebP at the widths requested in src/assets/art.ts.
  plugins: [react(), tailwindcss(), imagetools(), watchArt(), offlinePage()],
  // Workspace packages expose TypeScript source under the `source` condition.
  resolve: { conditions: ['source', ...defaultClientConditions] },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
      '/socket.io': { target: 'http://localhost:3000', ws: true },
    },
  },
  test: {
    environment: 'happy-dom',
    include: ['test/**/*.test.{ts,tsx}'],
  },
});
