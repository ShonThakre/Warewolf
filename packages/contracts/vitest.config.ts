import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Workspace packages export TypeScript source under the `source` condition. Vitest runs Node tests
  // in Vite's server environment, which reads `ssr.resolve`, not the top-level `resolve`. Without it
  // these tests load the domain package's last build from dist/ instead of its current source.
  resolve: { conditions: ['source'] },
  ssr: { resolve: { conditions: ['source'], externalConditions: ['source'] } },
  test: {
    include: ['test/**/*.test.ts'],
  },
});
