import { defineConfig } from '@playwright/test';
import { PRIORITY_VIEWPORTS } from './src/game/layout/viewports';

/**
 * E2E-03: browser flows against the real API, not fixtures. Needs the API
 * (`pnpm dev:api`, with PostgreSQL) on E2E_API_URL, default
 * http://localhost:3000. Vite proxies the browser's /api and /socket.io to it,
 * and bot seats talk to it directly through @warewolf/e2e-tools.
 *
 * Flow scripts run in `desktop-fhd` and `phone-land`, as docs/werewolf/testing-plan.md
 * section 3 asks. Games are slow and share one server, so specs run one at a time.
 *
 * Run: `pnpm --filter @warewolf/web e2e:live` (add PW_CHANNEL=chrome to use the installed Chrome).
 */
const FLOW_PROJECTS = new Set(['desktop-fhd', 'phone-land']);

export default defineConfig({
  testDir: './e2e-live',
  fullyParallel: false,
  workers: 1,
  timeout: 180_000,
  expect: { timeout: 15_000 },
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:5173',
    // PW_CHANNEL=chrome uses the installed Google Chrome when Playwright's own browser is not downloaded.
    ...(process.env['PW_CHANNEL'] ? { channel: process.env['PW_CHANNEL'] } : {}),
    // A click that cannot land (something covers the control) fails fast instead of waiting out the test.
    actionTimeout: 15_000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'pnpm exec vite --host 127.0.0.1 --port 5173',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: true,
    timeout: 120_000,
  },
  projects: PRIORITY_VIEWPORTS.filter((v) => FLOW_PROJECTS.has(v.project)).map((viewport) => ({
    name: viewport.project,
    use: { viewport: { width: viewport.width, height: viewport.height } },
  })),
});
