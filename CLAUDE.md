# CLAUDE.md

## Development commands

### Setup

- Node.js 24 (`.node-version`), Yarn 4 (committed in `.yarn/releases`)
- `yarn install`, then `yarn dev`: the server (restarts on changes) plus the Vite dev server on http://localhost:5173, which proxies the socket and `/debug_state` to the server on `PORT` (default 5000; on macOS the AirPlay Receiver may hold 5000, so use `PORT=5001 yarn dev`)
- `yarn build` builds the client into `dist/`; `yarn start` serves it, so build first
- Before the first `yarn e2e`: `yarn playwright install chromium`

### Tests

- All unit/integration tests: `yarn test`
- Single file: `yarn vitest run --disableConsoleIntercept server/room.test.ts`
- Single client test file: `yarn vitest run --disableConsoleIntercept client/src/voting.test.ts`
- E2E (builds the client and starts its own server on port 5055): `yarn e2e`, or `yarn e2e e2e/room.e2e.ts`

### Code quality

Run `yarn format`, `yarn typecheck` and `yarn eslint` after writing or changing code. Run `yarn stylelint` after editing CSS. Run `yarn e2e` after changing anything in `client/` or the socket protocol.

- Everything CI runs: `yarn ci` (typecheck → format:check → eslint → stylelint → test → build)
- `yarn typecheck` uses the TypeScript 7 native compiler (the `typescript7` alias) on both `tsconfig.json` (server, e2e, config files) and `client/tsconfig.json`. Editors and typescript-eslint use TypeScript 6 (`typescript`), because typescript-eslint does not support TS 7 yet
- Unused code and dependencies: `yarn knip`

## Top-level directories

- `server/`: Node.js server (TypeScript, Express 5 + Socket.IO 4)
- `client/`: browser client (React 19, React Router, TypeScript), the Vite root (`vite.config.ts` at the repo root)
  - `client/index.html`: page shell; `client/public/`: favicon, icons and images served as-is
  - `client/src/`: application code; `client/src/app.css`: all app styles
- `dist/`: client build output (gitignored), served by the server in production
- `e2e/`: Playwright tests (`*.e2e.ts`) and shared fixtures
- `.github/`: CI workflows and the PR template. Follow `.github/PULL_REQUEST_TEMPLATE.md` when opening a PR
- `resources/`: design source files (PSD)

## Architecture

### Server

- `server/index.ts`: entry point; reads `PORT`, listens, shuts down cleanly on SIGINT/SIGTERM
- `server/app.ts`: `createServer()` builds the Express app, HTTP server and Socket.IO server without listening (tests bind it to port 0, and point `clientDir` at a stub instead of `dist/`)
- `server/sockets.ts`: the socket protocol. One handler per client event in a typed handler table; broadcasts happen here
- `server/protocol.ts`: zod schemas for client payloads, the `ClientToServerEvents` / `ServerToClientEvents` interfaces, and shared types
- `server/lobby.ts`, `server/room.ts`: pure in-memory state (no socket access), unit-tested directly

State lives in process memory: rooms are lost on restart, and the app must run as a single instance.

### Socket protocol

The client emits events with an acknowledgement callback (`create room`, `join room`, `room info`, `vote`, ...). The server broadcasts payload-less notifications (`voted`, `reveal`, `room left`, ...) and clients respond by requesting `room info`.

- The client emits and listens through the typed socket in `client/src/socket.ts` (mainly from `client/src/useRoom.ts`), typed with the interfaces in `server/protocol.ts`, so `yarn typecheck` catches most protocol mismatches. Changing an event name, payload field or acknowledgement shape still means changing both sides
- Every client payload is validated with zod in `parse()`; an invalid one is answered with `INVALID_REQUEST`. A handler must never throw: an uncaught throw in a socket handler takes down the whole process
- To add a client event: add its schema and signature to `server/protocol.ts`, add a handler to the table in `server/sockets.ts`, and cover it (including a malformed payload) in `server/app.test.ts`

### Client

Files below are in `client/src/`.

- `main.tsx` mounts `App.tsx` (layout, alert bar, routes `/` → `pages/Lobby.tsx`, `/:roomId` → `pages/Room.tsx`) inside React Router's `BrowserRouter`
- `socket.ts`: the one Socket.IO connection, its status texts and `request()` (an `emitWithAck` that drives the activity indicator)
- `useRoom.ts`: a room's state for one participant. Joins on mount and on every (re)connect, refetches `room info` on each broadcast, removes its listeners on unmount, and applies the participant's own actions locally before the server confirms them
- `voting.ts`: pure vote logic (card packs, hidden votes, average, outcome), unit-tested in `voting.test.ts`
- Import only types from `server/` (`import type`); ESLint rejects value imports, which would bundle server code and zod
- Session identity (`sessionId`) and admin status (`admin-<room>`) are session cookies set by the client (`cookies.ts`)
- Keep markup and class names stable: `app.css` and the e2e locators depend on them

## Conventions

### TypeScript

- Node runs the server's `.ts` sources directly with type stripping, so only erasable syntax is allowed: no `enum`, `namespace` or constructor parameter properties. Both tsconfigs set `erasableSyntaxOnly`, so the client follows the same rule
- Import local modules with their extension (`import { Room } from './room.ts'`, `import { Lobby } from './pages/Lobby.tsx'`) and use `import type` for type-only imports
- `strict` and `noUncheckedIndexedAccess` are on
- Exported functions (including React components), classes, interfaces and type aliases need a JSDoc comment (ESLint `jsdoc/require-jsdoc`)
- `no-console` allows only `console.info` / `console.error` on the server, and only `console.error` in the client

### Tests

- Unit tests sit next to the code as `server/*.test.ts` and `client/src/*.test.ts`. Test Room/Lobby and the client's vote logic as plain objects and the socket protocol end to end with `socket.io-client` (see the `unit-test` skill). Components are covered by the e2e tests
- E2E tests use the fixtures in `e2e/fixtures.ts`, which fail a test on any page error or `console.error` (see the `e2e-test` skill)

### CSS

- Stylelint (`stylelint-config-standard`) and Prettier both run on `client/`; `yarn stylelint:fix` and `yarn format` resolve most issues
- No vendor prefixes: target current browsers
