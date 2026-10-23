---
name: e2e-test
description: Create or edit Playwright e2e tests. Use when writing end-to-end tests, adding new e2e spec files, or working with the e2e test suite.
---

# E2E Tests

## Overview

Playwright tests drive the real AngularJS client against a locally started server. They are the main safety net for the browser client and for the client/server socket protocol.

## Environment

- Config: @playwright.config.ts
  - `webServer` starts the app on port 5055 before the run; tests use the configured `baseURL`, so navigate with relative paths
  - Browser: Chromium only
  - `workers: 1`: creating a room discards every room nobody has joined yet, so parallel tests against the shared server would delete each other's rooms
- Install the browser once per Playwright version: `yarn playwright install chromium`
- No login: anyone can create or join a room

## File naming

- Spec files: `e2e/{feature}.e2e.ts` (e.g. @e2e/room.e2e.ts)
- Shared fixtures and helpers: @e2e/fixtures.ts

## Writing tests

### Imports

Always import `test` and `expect` from the fixtures, not from `@playwright/test`:

```ts
import { createRoom, expect, test } from './fixtures.ts';
```

The fixture's `test` fails any test whose pages log an uncaught error **or a `console.error`**. AngularJS swallows its own exceptions (e.g. injector errors) and only reports them via `console.error`, so without this guard a broken client can still pass every assertion. Do not filter these errors out to make a test pass; fix the cause.

### Several participants: `joinAs`

Each participant needs its own cookies (the client stores `sessionId` and the `admin-<room>` flag in cookies), so `joinAs(path)` opens a new browser context per participant and closes them all after the test. It returns:

- `page`: the participant's page
- `card(value)`: the card with exactly that value in the participant's deck
- `votes`: the vote cards laid out on the table (their visible face)

```ts
test('votes are revealed once everyone has voted', async ({ joinAs }) => {
  const alice = await joinAs();
  const roomId = await createRoom(alice.page); // Alice becomes the admin
  const bob = await joinAs(`/${roomId}`);
  await expect(bob.page.getByText(`Room: ${roomId}`)).toBeVisible();

  await alice.card('5').click();
  await expect(bob.votes).toHaveText(['oi!']); // hidden until everyone has voted

  await bob.card('8').click();
  await expect(alice.votes).toHaveText(['5', '8']);
});
```

- The first participant to load a room becomes its admin (Reset / Reveal / Sort buttons and the deck menu); later participants do not
- Wait for the second participant's room to render before acting, otherwise their join may race the first participant's vote
- Real-time updates arrive over socket.io, so assert on the other participant's page with web-first assertions rather than reading state immediately

### Locators

- Prefer role-based locators: `getByRole('button', { name: ... })`, then `getByLabel`, then `getByText`
- Check the accessible name before using it. For example, the lobby's `<label for="createRoom">or</label>` gives the "Create new room" button the accessible name "or", which is why `createRoom()` clicks it by text
- Fall back to CSS selectors only for elements without an accessible role or name (e.g. the `.card` divs); keep such selectors short and scoped, and put reusable ones in the fixtures
- Use web-first assertions (`toBeVisible`, `toHaveText`, `toHaveCount`, `toHaveURL`) and never `waitForTimeout` to wait for UI state

## Verifying

After creating or editing a spec, run it:

```bash
yarn e2e e2e/room.e2e.ts
```

If it fails, read the error and the `error-context.md` page snapshot under `test-results/`, fix the test or the code, and re-run. Once it passes, check that it is stable:

```bash
yarn e2e e2e/room.e2e.ts --repeat-each=5
```

To debug interactively, use the `playwright-cli` skill.
