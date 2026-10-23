import { test as base, expect, type Page } from '@playwright/test';

interface Participant {
  page: Page;
  /** Card the participant can vote with */
  card: (value: string) => ReturnType<Page['locator']>;
  /** Votes laid out on the table */
  votes: ReturnType<Page['locator']>;
}

interface Fixtures {
  /**
   * Opens the app as a new participant. Each participant gets its own browser context, because
   * the session id and the admin flag live in cookies.
   */
  joinAs: (path?: string) => Promise<Participant>;
}

/**
 * `test` with a `joinAs` fixture. Any uncaught error or console error on a participant's page
 * fails the test, so client-side breakage (for example an error React only logs) is caught even
 * when the assertions would otherwise pass.
 */
export const test = base.extend<Fixtures>({
  joinAs: async ({ browser }, use) => {
    const contexts: Array<Awaited<ReturnType<typeof browser.newContext>>> = [];
    const pageErrors: string[] = [];

    await use(async (path = '/') => {
      const context = await browser.newContext();
      contexts.push(context);
      const page = await context.newPage();
      page.on('pageerror', (error) => pageErrors.push(error.message));
      // React reports errors it recovers from (and failed renders) through console.error
      page.on('console', (message) => {
        if (message.type() === 'error') pageErrors.push(message.text());
      });
      await page.goto(path);
      return {
        page,
        card: (value) =>
          page
            .locator('.cardPanel .card')
            .filter({ hasText: new RegExp(`^\\s*${value}\\s*$`) }),
        votes: page.locator('#chosenCards .vote .card--side-2'),
      };
    });

    await Promise.all(contexts.map((context) => context.close()));
    expect(pageErrors).toEqual([]);
  },
});

export { expect };

/** Creates a room from the lobby and returns its 5-digit number. */
export async function createRoom(page: Page): Promise<string> {
  // The lobby's `<label for="createRoom">or</label>` gives this button the accessible name
  // "or", so match on its text instead of its role name.
  await page.getByText('Create new room').click();
  await expect(page).toHaveURL(/\/\d{5}$/);
  const roomId = new URL(page.url()).pathname.slice(1);
  await expect(page.getByText(`Room: ${roomId}`)).toBeVisible();
  return roomId;
}
