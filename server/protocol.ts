import { z } from 'zod';

/** Card decks a room can switch between. The card values themselves live in the client. */
const CARD_PACKS = ['goat', 'fib', 'seq', 'play', 'tshirt'] as const;

/** Name of one of the card decks in {@link CARD_PACKS}. */
export type CardPack = (typeof CARD_PACKS)[number];

/** One participant in a room, keyed by the sessionId the browser keeps in a cookie. */
export interface Connection {
  sessionId: string;
  /** null while the participant is disconnected, so their seat survives a page reload */
  socketId: string | null;
  vote: string | null;
  voter: boolean;
}

/** Room state sent to clients in response to `join room` and `room info`. */
export interface RoomJson {
  roomUrl: string;
  createdAt: string;
  createAdmin: boolean;
  hasAdmin: boolean;
  cardPack: CardPack;
  forcedReveal: boolean;
  alreadySorted: boolean;
  /** Connected participants only */
  connections: Connection[];
}

/** Acknowledgement payload for a request that failed. The client shows `error` to the user. */
export interface ErrorResponse {
  error: string;
}

/** Acknowledgement payload for a room action that succeeded. */
export type OkResponse = Record<string, never>;

export const ROOM_NOT_FOUND: ErrorResponse = {
  error: 'Sorry, this room no longer exists ...',
};

export const INVALID_REQUEST: ErrorResponse = {
  error: 'Sorry, that request was not understood.',
};

// Payloads arrive from untrusted clients, so every event is validated before use.
// sessionId is nullish because the client can emit before its first connect has set it.
export const roomRequest = z.object({ roomUrl: z.string() });
export const sessionRequest = roomRequest.extend({
  sessionId: z.string().nullish(),
});
export const setCardPackRequest = roomRequest.extend({
  cardPack: z.enum(CARD_PACKS),
});
export const voteRequest = sessionRequest.extend({ vote: z.string() });
export const toggleVoterRequest = sessionRequest.extend({
  voter: z.boolean(),
});

type Ack<T> = (response: T) => void;

/** Events the browser emits. Every event takes a payload and an acknowledgement callback. */
export interface ClientToServerEvents {
  'create room': (data: unknown, ack: Ack<string | ErrorResponse>) => void;
  'join room': (
    data: z.input<typeof sessionRequest>,
    ack: Ack<RoomJson | ErrorResponse>,
  ) => void;
  'room info': (
    data: z.input<typeof roomRequest>,
    ack: Ack<RoomJson | ErrorResponse>,
  ) => void;
  'set card pack': (
    data: z.input<typeof setCardPackRequest>,
    ack: Ack<OkResponse | ErrorResponse>,
  ) => void;
  vote: (
    data: z.input<typeof voteRequest>,
    ack: Ack<OkResponse | ErrorResponse>,
  ) => void;
  unvote: (
    data: z.input<typeof sessionRequest>,
    ack: Ack<OkResponse | ErrorResponse>,
  ) => void;
  'reset vote': (
    data: z.input<typeof roomRequest>,
    ack: Ack<OkResponse | ErrorResponse>,
  ) => void;
  'force reveal': (
    data: z.input<typeof roomRequest>,
    ack: Ack<OkResponse | ErrorResponse>,
  ) => void;
  'sort votes': (
    data: z.input<typeof roomRequest>,
    ack: Ack<OkResponse | ErrorResponse>,
  ) => void;
  'toggle voter': (
    data: z.input<typeof toggleVoterRequest>,
    ack: Ack<OkResponse | ErrorResponse>,
  ) => void;
}

/**
 * Notifications the server broadcasts to a room. They carry no data; clients respond by
 * requesting `room info`.
 */
export interface ServerToClientEvents {
  'room joined': () => void;
  'room left': () => void;
  'card pack set': () => void;
  'voter status changed': () => void;
  voted: () => void;
  unvoted: () => void;
  'vote reset': () => void;
  reveal: () => void;
}
