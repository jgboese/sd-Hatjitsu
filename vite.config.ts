import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// In development (`yarn dev`) Vite proxies the socket and the debug endpoint to the Node server,
// which listens on PORT like in production (where it also serves the built dist/).
const SERVER = `http://localhost:${process.env.PORT ?? 4000}`;

export default defineConfig({
  root: 'client',
  plugins: [react()],
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
  server: {
    proxy: {
      '/socket.io': { target: SERVER, ws: true },
      '/debug_state': SERVER,
    },
  },
});
