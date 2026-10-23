---
name: unit-test
description: Create unit and integration tests for the server. Use when writing or editing Vitest tests for Room, Lobby, the socket protocol, or the HTTP routes, following this repo's testing conventions.
---

# Unit Tests

## Overview

Write Vitest tests for the server code in `server/`. The browser client in `app/` is covered by Playwright e2e tests instead (see the `e2e-test` skill).

## Steps

- **Create the test file**
  - File name: `{target file name}.test.ts`
  - Put it next to the file under test (e.g. `server/room.ts` → `server/room.test.ts`)
- Run the single file, then the project checks:

  ```bash
  yarn vitest run --disableConsoleIntercept server/room.test.ts
  yarn typecheck
  yarn eslint
  ```

- Check the new tests against the conventions below

## Configuration

- Config: @vitest.config.ts
- Environment: node
- Framework: Vitest (import `describe`, `test`, `expect`, `vi`, etc. from `vitest` explicitly)
- Tests are TypeScript run through Vitest, but follow the same rules as the server code: erasable syntax only, local imports with the `.ts` extension, `import type` for type-only imports

## Running tests

```bash
yarn vitest run --disableConsoleIntercept path/to/file.test.ts
```

`yarn test` (= `vitest run`) uses the default reporter, which swallows `console.warn` / `console.error` from inside tests. Disable console interception to see them. Run the target file rather than the whole suite so warnings from your change are not buried. Fix warnings caused by the tests you write; existing warnings in other files can be ignored.

## What to test where

### Room and Lobby — pure state

`Room` and `Lobby` hold state only; they never touch sockets. Test them directly by calling methods and asserting on `json()` / `info()` / `getRoom()`:

```ts
import { describe, expect, test } from 'vitest';
import { Room } from './room.ts';

describe('Room', () => {
  test('forceReveal clears a previous sort', () => {
    const room = new Room('12345');
    room.sortVotes();
    room.forceReveal();
    expect(room.json()).toMatchObject({
      forcedReveal: true,
      alreadySorted: false,
    });
  });
});
```

- Only connected participants appear in `json().connections`; use `enter(sessionId, socketId)` / `leave(socketId)` to set that up
- `info()` has a side effect (the first caller becomes admin) — use `json()` when you only want to read state

### Socket protocol — integration tests

Event handling lives in `server/sockets.ts` and is only meaningful end to end. Test it with a real server from `createServer()` bound to an ephemeral port and real `socket.io-client` connections:

```ts
import type { AddressInfo } from 'node:net';
import { io as connect, type Socket } from 'socket.io-client';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { createServer } from './app.ts';
import type { ClientToServerEvents, ServerToClientEvents } from './protocol.ts';

type ClientSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let server: ReturnType<typeof createServer>;
let url: string;
const clients: ClientSocket[] = [];

beforeEach(async () => {
  server = createServer();
  await new Promise<void>((resolve) => server.httpServer.listen(0, resolve));
  url = `http://localhost:${(server.httpServer.address() as AddressInfo).port}`;
});

afterEach(async () => {
  for (const client of clients.splice(0)) client.disconnect();
  await server.io.close();
});

const connectClient = async (): Promise<ClientSocket> => {
  const client: ClientSocket = connect(url, { forceNew: true });
  clients.push(client);
  await new Promise<void>((resolve) => client.once('connect', resolve));
  return client;
};

test('a second participant is told when someone joins', async () => {
  const alice = await connectClient();
  const roomUrl = await alice.emitWithAck('create room', {});
  if (typeof roomUrl !== 'string') throw new Error(roomUrl.error);
  await alice.emitWithAck('join room', { roomUrl, sessionId: 'alice' });

  const bob = await connectClient();
  const joined = new Promise<void>((resolve) =>
    alice.once('room joined', resolve),
  );
  await bob.emitWithAck('join room', { roomUrl, sessionId: 'bob' });
  await joined;
});
```

- Type the client socket with the protocol interfaces from `server/protocol.ts` so `emitWithAck` payloads and acknowledgements are type-checked
- Use `forceNew: true` so each client gets its own connection
- To assert that a broadcast did NOT reach a client, wait for a later event that is known to arrive (e.g. the sender's own acknowledgement plus another broadcast) instead of sleeping
- Always close clients and `server.io` in `afterEach` — leaked sockets keep Vitest from exiting
- Cover malformed payloads (`undefined`, wrong types, missing ack callback) for new events: the server must answer with `INVALID_REQUEST` and keep running

### HTTP routes

Use the same `createServer()` + ephemeral port setup and Node's global `fetch`. Pass `redirect: 'manual'` when asserting on redirects.

## Conventions

### Null checks

When a lookup may return `undefined` (e.g. `lobby.getRoom()`, `Array.prototype.find`), narrow it by throwing — not with `!` or `expect().toBeTruthy()`:

```ts
const room = lobby.getRoom(roomUrl);
if (!room) throw new Error(`room ${roomUrl} was not created`);
expect(room.json().connections).toHaveLength(1);
```

| Approach                 | Narrows the type | Error message | Debugging          |
| ------------------------ | ---------------- | ------------- | ------------------ |
| `throw new Error`        | ✅               | ✅ custom     | ✅ points at cause |
| `expect().toBeTruthy()`  | ❌               | ⚠️ generic    | ⚠️                 |
| non-null assertion (`!`) | only silences TS | ❌ unclear    | ❌                 |

A non-null assertion is fine only right after an explicit `expect(x).not.toBeNull()` / `.toBeDefined()` on the same value. Do not use `toBeDefined()` to wait for a variable initialised to `null` — `null` counts as defined.

### Avoid depending on order or index

Connections are returned in insertion order today, but tests should not rely on it. Find the entry you mean:

```ts
// ❌ brittle
expect(room.json().connections[1]?.vote).toBe('5');

// ✅ robust
const bob = room.json().connections.find((c) => c.sessionId === 'bob');
if (!bob) throw new Error('bob is not connected');
expect(bob.vote).toBe('5');
```

## Debugging

- If several tests fail the same way, fix one test first and run only that one
- If tests fail unexpectedly, also run `yarn typecheck`
