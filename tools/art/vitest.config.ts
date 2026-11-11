import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Workspace packages export TypeScript source under the `source` condition; Node tests read `ssr.resolve`.
  resolve: { conditions: ['source'] },
  ssr: { resolve: { conditions: ['source'], externalConditions: ['source'] } },
  test: { include: ['test/**/*.test.ts'], testTimeout: 20_000 },
});
