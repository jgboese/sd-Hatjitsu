import type { CardPack, Connection, RoomJson } from './protocol.ts';

/** State of a single planning poker room. Broadcasting changes is up to the caller. */
export class Room {
  readonly roomUrl: string;
  readonly createdAt = new Date().toISOString();
  private createAdmin = true;
  private hasAdmin = false;
  private cardPack: CardPack = 'goat';
  private forcedReveal = false;
  private alreadySorted = false;
  private readonly connections = new Map<string, Connection>();

  constructor(roomUrl: string) {
    this.roomUrl = roomUrl;
  }

  /**
   * Returns the room state for a client. The first caller is told to become the room's
   * admin (`createAdmin: true`); every later caller is not.
   */
  info(): RoomJson {
    this.createAdmin = !this.hasAdmin;
    this.hasAdmin = true;
    return this.json();
  }

  enter(sessionId: string, socketId: string): void {
    const connection = this.connections.get(sessionId);
    if (connection) {
      connection.socketId = socketId;
    } else {
      this.connections.set(sessionId, {
        sessionId,
        socketId,
        vote: null,
        voter: true,
      });
    }
  }

  /** Marks the participant on this socket as disconnected, keeping their vote and seat. */
  leave(socketId: string): void {
    for (const connection of this.connections.values()) {
      if (connection.socketId === socketId) {
        connection.socketId = null;
      }
    }
  }

  setCardPack(cardPack: CardPack): void {
    this.cardPack = cardPack;
  }

  toggleVoter(sessionId: string, voter: boolean): void {
    const connection = this.connections.get(sessionId);
    if (!connection) return;
    connection.voter = voter;
    if (!voter) {
      connection.vote = null;
    }
  }

  recordVote(sessionId: string, vote: string): void {
    const connection = this.connections.get(sessionId);
    if (connection) {
      connection.vote = vote;
    }
  }

  destroyVote(sessionId: string): void {
    const connection = this.connections.get(sessionId);
    if (connection) {
      connection.vote = null;
    }
  }

  resetVote(): void {
    for (const connection of this.connections.values()) {
      connection.vote = null;
    }
    this.forcedReveal = false;
    this.alreadySorted = false;
  }

  forceReveal(): void {
    this.forcedReveal = true;
    this.alreadySorted = false;
  }

  sortVotes(): void {
    this.alreadySorted = true;
  }

  get clientCount(): number {
    return this.connectedParticipants().length;
  }

  json(): RoomJson {
    return {
      roomUrl: this.roomUrl,
      createdAt: this.createdAt,
      createAdmin: this.createAdmin,
      hasAdmin: this.hasAdmin,
      cardPack: this.cardPack,
      forcedReveal: this.forcedReveal,
      alreadySorted: this.alreadySorted,
      connections: this.connectedParticipants().map((c) => ({ ...c })),
    };
  }

  private connectedParticipants(): Connection[] {
    return [...this.connections.values()].filter((c) => c.socketId != null);
  }
}
