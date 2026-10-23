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

const APP_DIR = path.join(import.meta.dirname, '..', 'app');

/**
 * Builds the HTTP + Socket.IO server without listening, so tests can bind it to any port.
 * Room state lives in memory, so run a single instance.
 */
export function createServer() {
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
  app.use(express.static(APP_DIR, { index: false }));

  const sendIndex = (_req: express.Request, res: express.Response) => {
    res.sendFile('index.html', { root: APP_DIR });
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
  const io: HatjitsuServer = new Server(httpServer);
  registerSocketHandlers(io, lobby, stats);

  return { httpServer, io, lobby };
}
