import type { KnipConfig } from 'knip';

// The entry point comes from the `start` script; the browser client in app/ is loaded through
// <script> tags, which knip does not follow.
const config: KnipConfig = {
  project: ['server/**/*.ts', 'e2e/**/*.ts'],
  ignoreDependencies: [
    // Provides the `playwright-cli` binary used by the playwright-cli Claude skill
    '@playwright/cli',
  ],
};

export default config;
