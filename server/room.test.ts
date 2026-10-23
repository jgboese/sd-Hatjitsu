import { describe, expect, test } from 'vitest';
import { Room } from './room.ts';

function findConnection(room: Room, sessionId: string) {
  const connection = room
    .json()
    .connections.find((c) => c.sessionId === sessionId);
  if (!connection) throw new Error(`no connection for ${sessionId}`);
  return connection;
}

describe('Room', () => {
  test('a new room uses the Mountain Goat pack and has no participants', () => {
    const room = new Room('12345');

    expect(room.json()).toMatchObject({
      roomUrl: '12345',
      cardPack: 'goat',
      forcedReveal: false,
      alreadySorted: false,
      connections: [],
    });
    expect(room.clientCount).toBe(0);
  });

  test('info() makes only the first caller the admin', () => {
    const room = new Room('12345');

    expect(room.info()).toMatchObject({ createAdmin: true, hasAdmin: true });
    expect(room.info()).toMatchObject({ createAdmin: false, hasAdmin: true });
  });

  test('a participant re-entering on a new socket keeps their vote', () => {
    const room = new Room('12345');
    room.enter('alice', 'socket-1');
    room.recordVote('alice', '5');

    room.leave('socket-1');
    expect(room.clientCount).toBe(0);
    room.enter('alice', 'socket-2');

    expect(findConnection(room, 'alice')).toEqual({
      sessionId: 'alice',
      socketId: 'socket-2',
      vote: '5',
      voter: true,
    });
  });

  test('disconnected participants are left out of json()', () => {
    const room = new Room('12345');
    room.enter('alice', 'socket-1');
    room.enter('bob', 'socket-2');

    room.leave('socket-1');

    expect(room.json().connections.map((c) => c.sessionId)).toEqual(['bob']);
  });

  test('recordVote and destroyVote ignore unknown sessions', () => {
    const room = new Room('12345');
    room.enter('alice', 'socket-1');

    room.recordVote('mallory', '8');
    room.destroyVote('mallory');

    expect(room.json().connections).toHaveLength(1);
  });

  test('destroyVote clears the vote', () => {
    const room = new Room('12345');
    room.enter('alice', 'socket-1');
    room.recordVote('alice', '3');

    room.destroyVote('alice');

    expect(findConnection(room, 'alice').vote).toBeNull();
  });

  test('becoming an observer clears the vote', () => {
    const room = new Room('12345');
    room.enter('alice', 'socket-1');
    room.recordVote('alice', '13');

    room.toggleVoter('alice', false);

    expect(findConnection(room, 'alice')).toMatchObject({
      voter: false,
      vote: null,
    });
  });

  test('resetVote clears every vote and the reveal/sort flags', () => {
    const room = new Room('12345');
    room.enter('alice', 'socket-1');
    room.enter('bob', 'socket-2');
    room.recordVote('alice', '1');
    room.recordVote('bob', '2');
    room.forceReveal();
    room.sortVotes();

    room.resetVote();

    expect(room.json()).toMatchObject({
      forcedReveal: false,
      alreadySorted: false,
    });
    expect(room.json().connections.map((c) => c.vote)).toEqual([null, null]);
  });

  test('forceReveal clears a previous sort', () => {
    const room = new Room('12345');
    room.sortVotes();

    room.forceReveal();

    expect(room.json()).toMatchObject({
      forcedReveal: true,
      alreadySorted: false,
    });
  });

  test('json() returns copies, not the live connection objects', () => {
    const room = new Room('12345');
    room.enter('alice', 'socket-1');

    findConnection(room, 'alice').vote = 'tampered';

    expect(findConnection(room, 'alice').vote).toBeNull();
  });
});
