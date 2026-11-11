import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // SWC emits decorator metadata, which Nest dependency injection reads.
  plugins: [swc.vite({ module: { type: 'es6' } })],
  // Workspace packages export TypeScript source under the `source` condition. Vitest runs Node tests
  // in Vite's server environment, which reads `ssr.resolve`, not the top-level `resolve`.
  resolve: { conditions: ['source'] },
  ssr: { resolve: { conditions: ['source'], externalConditions: ['source'] } },
  test: {
    include: ['test/**/*.test.ts'],
    exclude: ['test/**/*.integration.test.ts'],
  },
});
