import { createRoom, expect, test } from './fixtures.ts';

test('votes stay hidden until everyone has voted, then are revealed with the average', async ({
  joinAs,
}) => {
  const alice = await joinAs();
  const roomId = await createRoom(alice.page);
  const bob = await joinAs(`/${roomId}`);
  await expect(bob.page.getByText(`Room: ${roomId}`)).toBeVisible();

  await alice.card('5').click();
  await expect(alice.page.getByText('Your current estimate: 5')).toBeVisible();
  await expect(bob.votes).toHaveText(['oi!']);

  await bob.card('8').click();

  for (const { page, votes } of [alice, bob]) {
    await expect(votes).toHaveText(['5', '8']);
    await expect(page.getByText('Average: 6.5 (StdDev = 1.50)')).toBeVisible();
  }
});

test('only the room creator gets the admin controls', async ({ joinAs }) => {
  const alice = await joinAs();
  const roomId = await createRoom(alice.page);
  const bob = await joinAs(`/${roomId}`);
  await expect(bob.page.getByText(`Room: ${roomId}`)).toBeVisible();

  await expect(alice.page.getByRole('button', { name: 'Reset' })).toBeVisible();
  await expect(bob.page.getByRole('button', { name: 'Reset' })).toHaveCount(0);
});

test('the admin can force a reveal and reset the vote', async ({ joinAs }) => {
  const alice = await joinAs();
  const roomId = await createRoom(alice.page);
  const bob = await joinAs(`/${roomId}`);
  await expect(bob.page.getByText(`Room: ${roomId}`)).toBeVisible();

  await bob.card('13').click();
  await expect(alice.votes).toHaveText(['oi!']);

  await alice.page.getByRole('button', { name: 'Reveal' }).click();
  await expect(alice.votes).toHaveText(['13']);

  await alice.page.getByRole('button', { name: 'Reset' }).click();
  for (const { page, votes } of [alice, bob]) {
    await expect(votes).toHaveCount(0);
    await expect(page.getByText("You haven't estimated yet")).toBeVisible();
  }
});

test('the admin can switch card packs for everyone', async ({ joinAs }) => {
  const alice = await joinAs();
  const roomId = await createRoom(alice.page);
  const bob = await joinAs(`/${roomId}`);
  await expect(bob.card('100')).toBeVisible();

  await alice.page.getByText('Mountain Goat pack').click();
  await alice.page.getByRole('link', { name: 'T-Shirt' }).click();

  await expect(bob.card('XL')).toBeVisible();
  await expect(bob.card('100')).toHaveCount(0);
  await expect(bob.page.getByText('Card pack changed...')).toBeVisible();
});

test('a participant can join from the lobby by room number', async ({
  joinAs,
}) => {
  const alice = await joinAs();
  const roomId = await createRoom(alice.page);
  const bob = await joinAs();

  await bob.page.getByLabel('Enter room number').fill(roomId);
  await bob.page.getByRole('button', { name: 'Join room' }).click();

  await expect(bob.page).toHaveURL(`/${roomId}`);
  await expect(bob.page.getByText(`Room: ${roomId}`)).toBeVisible();
});

test('joining a room that does not exist shows an error', async ({
  joinAs,
}) => {
  const bob = await joinAs();

  await bob.page.getByLabel('Enter room number').fill('99999');
  await bob.page.getByRole('button', { name: 'Join room' }).click();

  await expect(
    bob.page.getByText('Sorry, this room no longer exists ...'),
  ).toBeVisible();
  await expect(bob.page).toHaveURL('/');
});

test('a participant can take back their vote by clicking it on the table', async ({
  joinAs,
}) => {
  const alice = await joinAs();
  const roomId = await createRoom(alice.page);
  const bob = await joinAs(`/${roomId}`);
  await expect(bob.page.getByText(`Room: ${roomId}`)).toBeVisible();

  await alice.card('5').click();
  await expect(bob.votes).toHaveCount(1);

  await alice.page.locator('#chosenCards .vote.card--selected').click();

  await expect(alice.page.getByText("You haven't estimated yet")).toBeVisible();
  await expect(alice.votes).toHaveCount(0);
  await expect(bob.votes).toHaveCount(0);
});

test('a participant can stop voting', async ({ joinAs }) => {
  const alice = await joinAs();
  const roomId = await createRoom(alice.page);
  const bob = await joinAs(`/${roomId}`);
  await expect(bob.page.getByText(`Room: ${roomId}`)).toBeVisible();
  const placeholders = alice.page.locator('#chosenCards .card--placeholder');
  await expect(placeholders).toHaveCount(2);

  await bob.page.getByRole('checkbox').uncheck();

  await expect(
    bob.page.getByText('You have chosen not to vote.'),
  ).toBeVisible();
  await expect(placeholders).toHaveCount(1);
});

test('the admin can sort revealed votes in deck order', async ({ joinAs }) => {
  const alice = await joinAs();
  const roomId = await createRoom(alice.page);
  const bob = await joinAs(`/${roomId}`);
  await expect(bob.page.getByText(`Room: ${roomId}`)).toBeVisible();

  await alice.card('8').click();
  await expect(bob.votes).toHaveCount(1);
  await bob.card('3').click();
  await expect(alice.votes).toHaveText(['8', '3']);

  await alice.page.getByRole('button', { name: 'Sort votes' }).click();

  for (const { votes } of [alice, bob]) {
    await expect(votes).toHaveText(['3', '8']);
  }
});

test('reloading the page keeps the vote and the admin controls', async ({
  joinAs,
}) => {
  const alice = await joinAs();
  const roomId = await createRoom(alice.page);
  await alice.card('5').click();
  await expect(alice.page.getByText('Your current estimate: 5')).toBeVisible();

  await alice.page.reload();

  await expect(alice.page.getByText('Your current estimate: 5')).toBeVisible();
  await expect(alice.votes).toHaveText(['5']);
  await expect(alice.page.getByRole('button', { name: 'Reset' })).toBeVisible();
  await expect(alice.page.getByText(`Room: ${roomId}`)).toBeVisible();
});

test('the logo turns green for a unanimous vote and red when nobody agrees', async ({
  joinAs,
}) => {
  const alice = await joinAs();
  const roomId = await createRoom(alice.page);
  const bob = await joinAs(`/${roomId}`);
  await expect(bob.page.getByText(`Room: ${roomId}`)).toBeVisible();
  const logo = bob.page.locator('.header__logo');

  await alice.card('5').click();
  await expect(bob.votes).toHaveCount(1);
  await bob.card('5').click();
  await expect(logo).toHaveClass(/header__logo--green/);
  await expect(bob.page.locator('.body')).toHaveClass(/body--green/);

  await alice.page.getByRole('button', { name: 'Reset' }).click();
  await expect(logo).not.toHaveClass(/header__logo--/);

  await alice.card('5').click();
  await expect(bob.votes).toHaveCount(1);
  await bob.card('8').click();
  await expect(logo).toHaveClass(/header__logo--red/);
  await expect(bob.page.locator('.body')).toHaveClass(/body--red/);
});

test('pressing Enter in the room number field joins the room', async ({
  joinAs,
}) => {
  const alice = await joinAs();
  const roomId = await createRoom(alice.page);
  const bob = await joinAs();

  const roomField = bob.page.getByLabel('Enter room number');
  await roomField.fill(roomId);
  await roomField.press('Enter');

  await expect(bob.page).toHaveURL(`/${roomId}`);
  await expect(bob.page.getByText(`Room: ${roomId}`)).toBeVisible();
});
