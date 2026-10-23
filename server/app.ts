import { createServer as createHttpServer } from 'node:http';
import path from 'node:path';
import compression from 'compression';
import express from 'express';
import { Server } from 'socket.io';
import { Lobby } from './lobby.ts';
import {
  registerSocketHandlers,
  type HatjitsuServer,
  type Stats,
} from './sockets.ts';

/** Options for {@link createServer}. */
export interface ServerOptions {
  /** The built client to serve; defaults to the output of `yarn build` */
  clientDir?: string;
}

/**
 * Builds the HTTP + Socket.IO server without listening, so tests can bind it to any port.
 * Room state lives in memory, so run a single instance.
 */
export function createServer({
  clientDir = path.join(import.meta.dirname, '..', 'dist'),
}: ServerOptions = {}) {
  const lobby = new Lobby();
  const stats: Stats = {
    connectionCount: 0,
    disconnectCount: 0,
    currentSocketCount: 0,
    socketMessagesReceived: 0,
  };

  const app = express();
  app.disable('x-powered-by');
  app.use(compression());
  // Vite puts a content hash in every file name under assets/, so they can be cached forever
  app.use(
    '/assets',
    express.static(path.join(clientDir, 'assets'), {
      immutable: true,
      maxAge: '1y',
    }),
  );
  app.use(express.static(clientDir, { index: false }));

  const sendIndex = (_req: express.Request, res: express.Response) => {
    res.sendFile('index.html', { root: clientDir });
  };

  app.get('/', sendIndex);

  app.get('/debug_state', (_req, res) => {
    res.json({
      stats,
      rooms: [...lobby.rooms.values()].map((room) => room.json()),
    });
  });

  app.get('/:id', (req, res) => {
    if (lobby.getRoom(req.params.id)) {
      sendIndex(req, res);
    } else {
      res.redirect('/');
    }
  });

  const httpServer = createHttpServer(app);
  // The client bundles socket.io-client, so the server does not need to serve it
  const io: HatjitsuServer = new Server(httpServer, { serveClient: false });
  registerSocketHandlers(io, lobby, stats);

  return { httpServer, io, lobby };
}
