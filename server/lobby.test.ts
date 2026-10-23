import { describe, expect, test } from 'vitest';
import { Lobby, randomRoomId } from './lobby.ts';

/** Room number generator that hands out the given ids in order. */
function idsInOrder(...ids: string[]): () => string {
  return () => {
    const id = ids.shift();
    if (id === undefined) throw new Error('ran out of room ids');
    return id;
  };
}

describe('randomRoomId', () => {
  test('returns 5 digits', () => {
    for (let i = 0; i < 100; i++) {
      expect(randomRoomId()).toMatch(/^\d{5}$/);
    }
  });
});

describe('Lobby', () => {
  test('createRoom never reuses the number of an open room', () => {
    const lobby = new Lobby(idsInOrder('11111', '11111', '22222'));
    const first = lobby.createRoom();
    lobby.getRoom(first)?.enter('alice', 'socket-1');

    const second = lobby.createRoom();

    expect([first, second]).toEqual(['11111', '22222']);
    expect(lobby.rooms.size).toBe(2);
  });

  test('createRoom discards rooms nobody is connected to', () => {
    const lobby = new Lobby(idsInOrder('00001', '00002', '00003'));
    const occupied = lobby.createRoom();
    lobby.getRoom(occupied)?.enter('alice', 'socket-1');
    const empty = lobby.createRoom();

    lobby.createRoom();

    expect(lobby.getRoom(occupied)).toBeDefined();
    expect(lobby.getRoom(empty)).toBeUndefined();
  });

  test('getRoom does not resolve Object.prototype keys as rooms', () => {
    const lobby = new Lobby();

    expect(lobby.getRoom('constructor')).toBeUndefined();
    expect(lobby.getRoom('__proto__')).toBeUndefined();
  });
});
