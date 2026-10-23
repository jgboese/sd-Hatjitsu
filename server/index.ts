import { createServer } from './app.ts';

const port = Number(process.env.PORT ?? 5000);
const { httpServer, io } = createServer();

httpServer.listen(port, () => {
  console.info(
    `Hatjitsu listening on port ${port} in ${process.env.NODE_ENV ?? 'development'} mode`,
  );
});

// Close sockets and stop accepting connections so container restarts are clean.
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    void io.close(() => process.exit(0));
  });
}
