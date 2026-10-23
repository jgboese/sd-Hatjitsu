import type { KnipConfig } from 'knip';

// The server's entry point comes from the `start` script; knip's Vite plugin finds the client's
// through client/index.html.
const config: KnipConfig = {
  project: ['server/**/*.ts', 'e2e/**/*.ts', 'client/src/**/*.{ts,tsx}'],
  ignoreDependencies: [
    // Provides the `playwright-cli` binary used by the playwright-cli Claude skill
    '@playwright/cli',
  ],
};

export default config;
