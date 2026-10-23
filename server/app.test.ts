import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { io as connect, type Socket } from 'socket.io-client';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from 'vitest';
import { createServer } from './app.ts';
import {
  INVALID_REQUEST,
  ROOM_NOT_FOUND,
  type ClientToServerEvents,
  type ErrorResponse,
  type RoomJson,
  type ServerToClientEvents,
} from './protocol.ts';

type ClientSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let server: ReturnType<typeof createServer>;
let baseUrl: string;
const clients: ClientSocket[] = [];

// A stand-in for the built client, so these tests do not depend on `yarn build`
const INDEX_HTML = '<!doctype html><div id="root"></div>';
let clientDir: string;

beforeAll(async () => {
  clientDir = await mkdtemp(path.join(tmpdir(), 'hatjitsu-client-'));
  await mkdir(path.join(clientDir, 'assets'));
  await writeFile(path.join(clientDir, 'index.html'), INDEX_HTML);
  await writeFile(path.join(clientDir, 'assets', 'index-abc123.js'), '');
  await writeFile(path.join(clientDir, 'robots.txt'), '');
});

afterAll(async () => {
  await rm(clientDir, { recursive: true, force: true });
});

beforeEach(async () => {
  server = createServer({ clientDir });
  await new Promise<void>((resolve) => {
    server.httpServer.listen(0, resolve);
  });
  const { port } = server.httpServer.address() as AddressInfo;
  baseUrl = `http://localhost:${port}`;
});

afterEach(async () => {
  for (const client of clients.splice(0)) {
    client.disconnect();
  }
  await server.io.close();
});

async function connectClient(): Promise<ClientSocket> {
  const socket: ClientSocket = connect(baseUrl, {
    transports: ['websocket'],
    forceNew: true,
  });
  clients.push(socket);
  await new Promise<void>((resolve) => {
    socket.once('connect', resolve);
  });
  return socket;
}

function nextEvent(
  socket: ClientSocket,
  event: keyof ServerToClientEvents,
): Promise<void> {
  return new Promise((resolve) => {
    socket.once(event, resolve);
  });
}

function expectRoom(response: RoomJson | ErrorResponse): RoomJson {
  if ('error' in response) throw new Error(response.error);
  return response;
}

async function createRoom(socket: ClientSocket): Promise<string> {
  const roomUrl = await socket.emitWithAck('create room', {});
  if (typeof roomUrl !== 'string') throw new Error(roomUrl.error);
  return roomUrl;
}

describe('HTTP routes', () => {
  test('serves the app shell at /', async () => {
    const res = await fetch(`${baseUrl}/`);

    expect(res.status).toBe(200);
    expect(await res.text()).toBe(INDEX_HTML);
  });

  test('serves the app shell for an open room', async () => {
    const roomUrl = server.lobby.createRoom();

    const res = await fetch(`${baseUrl}/${roomUrl}`);

    expect(res.status).toBe(200);
    expect(await res.text()).toBe(INDEX_HTML);
  });

  test('redirects unknown rooms to the lobby', async () => {
    const res = await fetch(`${baseUrl}/99999`, { redirect: 'manual' });

    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('/');
  });

  test('caches hashed assets forever and other static files not at all', async () => {
    const asset = await fetch(`${baseUrl}/assets/index-abc123.js`);
    const robots = await fetch(`${baseUrl}/robots.txt`);

    expect(asset.status).toBe(200);
    expect(asset.headers.get('cache-control')).toBe(
      'public, max-age=31536000, immutable',
    );
    expect(robots.status).toBe(200);
    expect(robots.headers.get('cache-control')).toBe('public, max-age=0');
  });

  test('/debug_state reports stats and rooms', async () => {
    const socket = await connectClient();
    const roomUrl = await createRoom(socket);

    const res = await fetch(`${baseUrl}/debug_state`);

    expect(await res.json()).toMatchObject({
      stats: { connectionCount: 1, currentSocketCount: 1 },
      rooms: [{ roomUrl }],
    });
  });
});

describe('socket protocol', () => {
  test('the first participant to join becomes the admin', async () => {
    const alice = await connectClient();
    const bob = await connectClient();
    const roomUrl = await createRoom(alice);

    const aliceJoin = expectRoom(
      await alice.emitWithAck('join room', { roomUrl, sessionId: 'alice' }),
    );
    const roomJoined = nextEvent(alice, 'room joined');
    const bobJoin = expectRoom(
      await bob.emitWithAck('join room', { roomUrl, sessionId: 'bob' }),
    );
    await roomJoined;

    expect(aliceJoin.createAdmin).toBe(true);
    expect(bobJoin.createAdmin).toBe(false);
    expect(bobJoin.connections.map((c) => c.sessionId)).toEqual([
      'alice',
      'bob',
    ]);
  });

  test('a vote is recorded and announced to everyone except the voter', async () => {
    const alice = await connectClient();
    const bob = await connectClient();
    const roomUrl = await createRoom(alice);
    await alice.emitWithAck('join room', { roomUrl, sessionId: 'alice' });
    await bob.emitWithAck('join room', { roomUrl, sessionId: 'bob' });
    const aliceHeard = vi.fn();
    alice.on('voted', aliceHeard);
    const bobHeard = nextEvent(bob, 'voted');

    const ack = await alice.emitWithAck('vote', {
      roomUrl,
      sessionId: 'alice',
      vote: '8',
    });
    await bobHeard;

    expect(ack).toEqual({});
    expect(aliceHeard).not.toHaveBeenCalled();
    const info = expectRoom(await bob.emitWithAck('room info', { roomUrl }));
    expect(info.connections.find((c) => c.sessionId === 'alice')?.vote).toBe(
      '8',
    );
  });

  test('admin actions are broadcast to the whole room', async () => {
    const alice = await connectClient();
    const roomUrl = await createRoom(alice);
    await alice.emitWithAck('join room', { roomUrl, sessionId: 'alice' });

    const cardPackSet = nextEvent(alice, 'card pack set');
    await alice.emitWithAck('set card pack', { roomUrl, cardPack: 'fib' });
    await cardPackSet;

    const reveal = nextEvent(alice, 'reveal');
    await alice.emitWithAck('force reveal', { roomUrl });
    await reveal;

    const reset = nextEvent(alice, 'vote reset');
    await alice.emitWithAck('reset vote', { roomUrl });
    await reset;

    expect(
      expectRoom(await alice.emitWithAck('room info', { roomUrl })),
    ).toMatchObject({ cardPack: 'fib', forcedReveal: false });
  });

  test('leaving a room tells the others and drops the participant', async () => {
    const alice = await connectClient();
    const bob = await connectClient();
    const roomUrl = await createRoom(alice);
    await alice.emitWithAck('join room', { roomUrl, sessionId: 'alice' });
    await bob.emitWithAck('join room', { roomUrl, sessionId: 'bob' });

    const roomLeft = nextEvent(alice, 'room left');
    bob.disconnect();
    await roomLeft;

    const info = expectRoom(await alice.emitWithAck('room info', { roomUrl }));
    expect(info.connections.map((c) => c.sessionId)).toEqual(['alice']);
  });

  test('actions on a room that no longer exists report an error', async () => {
    const alice = await connectClient();

    expect(await alice.emitWithAck('room info', { roomUrl: '99999' })).toEqual(
      ROOM_NOT_FOUND,
    );
    expect(await alice.emitWithAck('reset vote', { roomUrl: '99999' })).toEqual(
      ROOM_NOT_FOUND,
    );
  });

  test('malformed payloads are rejected without crashing the server', async () => {
    const alice = await connectClient();
    const raw = alice as unknown as {
      emit: (...args: unknown[]) => void;
      emitWithAck: (...args: unknown[]) => Promise<unknown>;
    };

    raw.emit('room info');
    raw.emit('vote', null, 'not a callback');
    expect(await raw.emitWithAck('room info', undefined)).toEqual(
      INVALID_REQUEST,
    );
    expect(
      await raw.emitWithAck('set card pack', {
        roomUrl: '1',
        cardPack: 'nope',
      }),
    ).toEqual(INVALID_REQUEST);

    expect(typeof (await createRoom(alice))).toBe('string');
  });
});
