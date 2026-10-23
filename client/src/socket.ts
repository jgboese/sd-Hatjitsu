import { useSyncExternalStore } from 'react';
import { io, type Socket } from 'socket.io-client';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from '../../server/protocol.ts';
import { ensureSessionId } from './cookies.ts';

/** The one connection to the server, typed with the Hatjitsu protocol. */
export const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io({
  reconnectionDelay: 500,
  reconnectionAttempts: 10,
});

interface ConnectionState {
  /** Connection problem to show in the alert bar, or null while connected */
  status: string | null;
  /** Requests still waiting for their acknowledgement */
  pending: number;
}

let state: ConnectionState = { status: 'Connecting...', pending: 0 };
const listeners = new Set<() => void>();

function update(change: Partial<ConnectionState>): void {
  state = { ...state, ...change };
  for (const listener of listeners) listener();
}

socket.on('connect', () => {
  // Registered before any room's listener, so the room rejoins with this session id
  if (socket.id) ensureSessionId(socket.id);
  update({ status: null });
});
socket.on('connect_error', (error) => {
  update({ status: `:-(  Error = ${error.message}` });
});
socket.on('disconnect', () => {
  update({ status: ':-(  Disconnected' });
});
socket.io.on('reconnect_attempt', () => {
  update({ status: 'Reconnecting...' });
});
socket.io.on('reconnect', () => {
  update({ status: null });
});
socket.io.on('reconnect_failed', () => {
  update({ status: ':-( Reconnect failed' });
});

/**
 * Emits a client event and resolves with the server's acknowledgement. The activity
 * indicator is lit until it arrives.
 */
export const request: typeof socket.emitWithAck = async (...args) => {
  update({ pending: state.pending + 1 });
  try {
    return await socket.emitWithAck(...args);
  } finally {
    update({ pending: state.pending - 1 });
  }
};

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The connection status and whether any request is in flight, for the alert bar. */
export function useConnectionState(): ConnectionState {
  return useSyncExternalStore(subscribe, () => state);
}
