import { randomInt } from 'node:crypto';
import { Room } from './room.ts';

const ROOM_ID_LENGTH = 5;

/** Returns a random, zero-padded 5-digit room number. */
export function randomRoomId(): string {
  return String(randomInt(10 ** ROOM_ID_LENGTH)).padStart(ROOM_ID_LENGTH, '0');
}

/** All open rooms, keyed by their 5-digit room number. */
export class Lobby {
  readonly rooms = new Map<string, Room>();
  private readonly generateRoomId: () => string;

  constructor(generateRoomId: () => string = randomRoomId) {
    this.generateRoomId = generateRoomId;
  }

  /** Opens a new room under an unused room number, discarding rooms nobody is connected to. */
  createRoom(): string {
    for (const [roomUrl, room] of this.rooms) {
      if (room.clientCount === 0) {
        this.rooms.delete(roomUrl);
      }
    }

    let roomUrl: string;
    do {
      roomUrl = this.generateRoomId();
    } while (this.rooms.has(roomUrl));

    this.rooms.set(roomUrl, new Room(roomUrl));
    return roomUrl;
  }

  getRoom(roomUrl: string): Room | undefined {
    return this.rooms.get(roomUrl);
  }
}
