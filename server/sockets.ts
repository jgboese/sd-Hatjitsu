import type { Server } from 'socket.io';
import type { z } from 'zod';
import type { Lobby } from './lobby.ts';
import {
  INVALID_REQUEST,
  ROOM_NOT_FOUND,
  roomRequest,
  sessionRequest,
  setCardPackRequest,
  toggleVoterRequest,
  voteRequest,
  type ClientToServerEvents,
  type ErrorResponse,
  type OkResponse,
  type ServerToClientEvents,
} from './protocol.ts';
import type { Room } from './room.ts';

/** Socket.IO server typed with the Hatjitsu protocol. */
export type HatjitsuServer = Server<ClientToServerEvents, ServerToClientEvents>;

/** Counters exposed on /debug_state. */
export interface Stats {
  connectionCount: number;
  disconnectCount: number;
  currentSocketCount: number;
  socketMessagesReceived: number;
}

type ClientEvent = keyof ClientToServerEvents;
type AckResponse<E extends ClientEvent> = Parameters<
  Parameters<ClientToServerEvents[E]>[1]
>[0];
type Handlers = { [E in ClientEvent]: (data: unknown) => AckResponse<E> };

const OK: OkResponse = {};

/**
 * Wires the planning poker protocol onto a Socket.IO server. Event names and payloads are
 * unchanged from the original socket.io 0.9 server, so the existing client keeps working.
 */
export function registerSocketHandlers(
  io: HatjitsuServer,
  lobby: Lobby,
  stats: Stats,
): void {
  // Runs `action` against the room named in the request, or reports that it is gone.
  const roomAction =
    <S extends z.ZodType<{ roomUrl: string }>>(
      schema: S,
      action: (room: Room, request: z.output<S>) => void,
    ) =>
    (data: unknown): OkResponse | ErrorResponse =>
      parse(schema, data, (request) => {
        const room = lobby.getRoom(request.roomUrl);
        if (!room) return ROOM_NOT_FOUND;
        action(room, request);
        return OK;
      });

  io.on('connection', (socket) => {
    stats.connectionCount += 1;
    stats.currentSocketCount += 1;

    socket.on('disconnecting', () => {
      for (const roomUrl of socket.rooms) {
        if (roomUrl === socket.id) continue;
        lobby.getRoom(roomUrl)?.leave(socket.id);
        socket.to(roomUrl).emit('room left');
      }
    });

    socket.on('disconnect', () => {
      stats.disconnectCount += 1;
      stats.currentSocketCount -= 1;
    });

    const handlers: Handlers = {
      'create room': () => lobby.createRoom(),

      'join room': (data) =>
        parse(sessionRequest, data, ({ roomUrl, sessionId }) => {
          const room = lobby.getRoom(roomUrl);
          if (!room) return ROOM_NOT_FOUND;
          if (sessionId != null) {
            room.enter(sessionId, socket.id);
            void socket.join(roomUrl);
            socket.to(roomUrl).emit('room joined');
          }
          return room.info();
        }),

      'room info': (data) =>
        parse(
          roomRequest,
          data,
          ({ roomUrl }) => lobby.getRoom(roomUrl)?.info() ?? ROOM_NOT_FOUND,
        ),

      'set card pack': roomAction(setCardPackRequest, (room, { cardPack }) => {
        room.setCardPack(cardPack);
        io.to(room.roomUrl).emit('card pack set');
      }),

      vote: roomAction(voteRequest, (room, { sessionId, vote }) => {
        if (sessionId != null) room.recordVote(sessionId, vote);
        socket.to(room.roomUrl).emit('voted');
      }),

      unvote: roomAction(sessionRequest, (room, { sessionId }) => {
        if (sessionId != null) room.destroyVote(sessionId);
        socket.to(room.roomUrl).emit('unvoted');
      }),

      'reset vote': roomAction(roomRequest, (room) => {
        room.resetVote();
        io.to(room.roomUrl).emit('vote reset');
      }),

      'force reveal': roomAction(roomRequest, (room) => {
        room.forceReveal();
        io.to(room.roomUrl).emit('reveal');
      }),

      'sort votes': roomAction(roomRequest, (room) => {
        room.sortVotes();
        io.to(room.roomUrl).emit('reveal');
      }),

      'toggle voter': roomAction(
        toggleVoterRequest,
        (room, { sessionId, voter }) => {
          if (sessionId != null) room.toggleVoter(sessionId, voter);
          io.to(room.roomUrl).emit('voter status changed');
        },
      ),
    };

    for (const event of Object.keys(handlers) as ClientEvent[]) {
      // The acknowledgement callback is optional and untrusted: a client that sends no
      // callback (or something else) still gets its event handled.
      socket.on(event, (data: unknown, ack: unknown) => {
        stats.socketMessagesReceived += 1;
        const response = handlers[event](data);
        if (typeof ack === 'function') {
          (ack as (response: unknown) => void)(response);
        }
      });
    }
  });
}

// Payloads come from untrusted clients; a malformed one is answered with an error instead of
// throwing inside the event handler, which would take the whole process down.
function parse<S extends z.ZodType, R>(
  schema: S,
  data: unknown,
  handler: (request: z.output<S>) => R,
): R | ErrorResponse {
  const request = schema.safeParse(data);
  return request.success ? handler(request.data) : INVALID_REQUEST;
}
