# CLAUDE.md

## Development commands

### Setup

- Node.js 24 (`.node-version`), Yarn 4 (committed in `.yarn/releases`)
- `yarn install`, then `yarn dev` for a server on http://localhost:5000 that restarts on changes
- Before the first `yarn e2e`: `yarn playwright install chromium`

### Tests

- All unit/integration tests: `yarn test`
- Single file: `yarn vitest run --disableConsoleIntercept server/room.test.ts`
- E2E (starts its own server on port 5055): `yarn e2e`, or `yarn e2e e2e/room.e2e.ts`

### Code quality

Run `yarn format`, `yarn typecheck` and `yarn eslint` after writing or changing code. Run `yarn stylelint` after editing CSS. Run `yarn e2e` after changing anything in `app/` or the socket protocol.

- Everything CI runs: `yarn ci` (typecheck → format:check → eslint → stylelint → test)
- `yarn typecheck` uses the TypeScript 7 native compiler (the `typescript7` alias). Editors and typescript-eslint use TypeScript 6 (`typescript`), because typescript-eslint does not support TS 7 yet
- Unused code and dependencies: `yarn knip`

## Top-level directories

- `server/`: Node.js server (TypeScript, Express 5 + Socket.IO 4)
- `app/`: browser client served as static files (AngularJS 1.0, plain JavaScript)
  - `app/js/`: application scripts; `app/lib/`, `app/js/prism.js` and `app/js/sg.js` are vendored and excluded from lint/format
  - `app/partials/`: AngularJS route templates
  - `app/css/app.css`: all app styles
- `e2e/`: Playwright tests (`*.e2e.ts`) and shared fixtures
- `.github/`: CI workflows and the PR template. Follow `.github/PULL_REQUEST_TEMPLATE.md` when opening a PR
- `resources/`: design source files (PSD)

## Architecture

### Server

- `server/index.ts`: entry point; reads `PORT`, listens, shuts down cleanly on SIGINT/SIGTERM
- `server/app.ts`: `createServer()` builds the Express app, HTTP server and Socket.IO server without listening (tests bind it to port 0)
- `server/sockets.ts`: the socket protocol. One handler per client event in a typed handler table; broadcasts happen here
- `server/protocol.ts`: zod schemas for client payloads, the `ClientToServerEvents` / `ServerToClientEvents` interfaces, and shared types
- `server/lobby.ts`, `server/room.ts`: pure in-memory state (no socket access), unit-tested directly

State lives in process memory: rooms are lost on restart, and the app must run as a single instance.

### Socket protocol

The client emits events with an acknowledgement callback (`create room`, `join room`, `room info`, `vote`, ...). The server broadcasts payload-less notifications (`voted`, `reveal`, `room left`, ...) and clients respond by requesting `room info`.

- The wire protocol must stay compatible with `app/js/controllers.js` and `app/js/services.js`. Changing an event name, payload field or acknowledgement shape means changing both sides
- Every client payload is validated with zod in `parse()`; an invalid one is answered with `INVALID_REQUEST`. A handler must never throw: an uncaught throw in a socket handler takes down the whole process
- To add a client event: add its schema and signature to `server/protocol.ts`, add a handler to the table in `server/sockets.ts`, and cover it (including a malformed payload) in `server/app.test.ts`

### Client

- AngularJS 1.0.3, Zepto and Socket.IO client loaded with `<script>` tags in `app/index.html`; no bundler
- Files are classic scripts sharing globals. Declare cross-file globals with `/* global ... */` and top-level functions used by other files with `/* exported ... */`
- AngularJS 1.0 infers dependencies by parsing `function (...)` source and throws on arrow functions. Anything passed to the injector (controllers, factories, directives, filters, config blocks) must use the array annotation, e.g. `['$scope', ($scope) => {...}]`, or `$inject`, even when it has no dependencies
- Session identity (`sessionId`) and admin status (`admin-<room>`) are cookies set by the client

## Conventions

### TypeScript (server)

- Node runs the `.ts` sources directly with type stripping, so only erasable syntax is allowed: no `enum`, `namespace` or constructor parameter properties (`tsconfig.json` has `erasableSyntaxOnly`)
- Import local modules with the `.ts` extension (`import { Room } from './room.ts'`) and use `import type` for type-only imports
- `strict` and `noUncheckedIndexedAccess` are on
- Exported functions, classes, interfaces and type aliases need a JSDoc comment (ESLint `jsdoc/require-jsdoc`)
- `no-console` allows only `console.info` / `console.error` on the server

### Tests

- Unit tests sit next to the code as `server/*.test.ts`. Test Room/Lobby as plain objects and the socket protocol end to end with `socket.io-client` (see the `unit-test` skill)
- E2E tests use the fixtures in `e2e/fixtures.ts`, which fail a test on any page error or `console.error` (see the `e2e-test` skill)

### CSS

- Stylelint (`stylelint-config-standard`) and Prettier both run on `app/css`; `yarn stylelint:fix` and `yarn format` resolve most issues
- No vendor prefixes: target current browsers
