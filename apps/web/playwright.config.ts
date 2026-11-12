import { defineConfig } from '@playwright/test';
import { PRIORITY_VIEWPORTS } from './src/game/layout/viewports';

/**
 * One project per priority viewport (docs/werewolf/ui-ux-plan.md, section 12).
 * The mode for each size lives in `PRIORITY_VIEWPORTS`, the same list the unit tests use.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: 'http://127.0.0.1:5173',
    // PW_CHANNEL=chrome uses the installed Google Chrome when Playwright's own browser is not downloaded.
    ...(process.env['PW_CHANNEL'] ? { channel: process.env['PW_CHANNEL'] } : {}),
  },
  webServer: {
    command: 'pnpm exec vite --host 127.0.0.1 --port 5173',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: PRIORITY_VIEWPORTS.map((viewport) => ({
    name: viewport.project,
    use: { viewport: { width: viewport.width, height: viewport.height } },
  })),
});
