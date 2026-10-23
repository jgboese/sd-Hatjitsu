# Hatjitsu

Create disposable online [Planning Poker](http://en.wikipedia.org/wiki/Planning_poker) rooms for quick and easy estimations.

## Features

- Simple interface
- No login/signup required
- Votes are kept hidden until all have voted to prevent coercion
- 'Observer feature' - watch the planning session without having to vote
- Multiple planning card decks
- Adaptive design allows to work on desktop, tablet and mobile

## Development

Requires Node.js 24 (see `.node-version`). Yarn 4 is committed to the repo (`.yarn/releases`), so any `yarn` on your PATH will hand off to it.

```sh
yarn install
yarn dev        # http://localhost:5173
```

`yarn dev` runs the server with `--watch` and the Vite dev server (hot reload for the client), which proxies the socket to the server on `PORT` (default 5000). On macOS, the AirPlay Receiver may already be listening on port 5000; use `PORT=5001 yarn dev`.

The server is TypeScript and runs directly with Node's built-in type stripping. The React client in `client/` is built by Vite into `dist/`, which the server serves in production: run `yarn build` before `yarn start`.

| Command          | What it does                                                        |
| ---------------- | ------------------------------------------------------------------- |
| `yarn start`     | Run the server and serve the built client (`PORT`, default 5000)    |
| `yarn dev`       | Run the server with `--watch` and the Vite dev server               |
| `yarn build`     | Build the client into `dist/`                                       |
| `yarn ci`        | typecheck → format check → ESLint → Stylelint → unit tests → build  |
| `yarn test`      | Vitest unit and socket integration tests                            |
| `yarn e2e`       | Playwright browser tests (`yarn playwright install chromium` first) |
| `yarn format`    | Prettier                                                            |
| `yarn eslint`    | ESLint (`yarn eslint:fix` to autofix)                               |
| `yarn stylelint` | Stylelint for `client/` (`yarn stylelint:fix` to autofix)           |
| `yarn typecheck` | TypeScript 7 type check of the server and the client                |
| `yarn knip`      | Find unused files, exports and dependencies                         |

A pre-commit hook (husky + lint-staged) runs ESLint, Prettier and Stylelint on staged files.

## Running with Docker

```sh
docker compose up -d
```

[http://localhost:5000](http://localhost:5000)

Rooms live in memory, so run a single instance.

## TODOs

- [x] Collapsible card view / jump to votes on vote
- [x] Update favicon, iOS splash page, Twitter avatar etc with new design
- [ ] Unicode symbol fallback (coffee/ace/king)
- [x] Improve CTA buttons
- [x] Testing harness
