import { defineConfig, devices } from '@playwright/test';

const PORT = 5055;

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.ts',
  // Creating a room discards every room nobody has joined yet, so tests that run at the same
  // time against one server would delete each other's rooms.
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'node server/index.ts',
    url: `http://localhost:${PORT}`,
    env: { PORT: String(PORT) },
    reuseExistingServer: !process.env.CI,
  },
});
