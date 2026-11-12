import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defaultClientConditions } from 'vite';
import { imagetools } from 'vite-imagetools';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // imagetools turns the PNGs in art/ into WebP at the widths requested in src/assets/art.ts.
  plugins: [react(), tailwindcss(), imagetools()],
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
