// TEMPORARY (UX-PHONE): screenshot harness for the portrait mockup pass. Delete when done.
import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './e2e-capture',
  workers: 1,
  timeout: 300_000,
  expect: { timeout: 15_000 },
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5173',
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    actionTimeout: 15_000,
    ...(process.env['PW_CHANNEL'] ? { channel: process.env['PW_CHANNEL'] } : {}),
  },
});
