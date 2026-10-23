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
yarn dev        # http://localhost:5000, restarts on server changes
```

The server is TypeScript and runs directly with Node's built-in type stripping; there is no build step.

| Command          | What it does                                                        |
| ---------------- | ------------------------------------------------------------------- |
| `yarn start`     | Run the server (`PORT`, default 5000)                               |
| `yarn dev`       | Run the server with `--watch`                                       |
| `yarn ci`        | typecheck → format check → ESLint → Stylelint → unit tests          |
| `yarn test`      | Vitest unit and socket integration tests                            |
| `yarn e2e`       | Playwright browser tests (`yarn playwright install chromium` first) |
| `yarn format`    | Prettier                                                            |
| `yarn eslint`    | ESLint (`yarn eslint:fix` to autofix)                               |
| `yarn stylelint` | Stylelint for `app/css` (`yarn stylelint:fix` to autofix)           |
| `yarn typecheck` | TypeScript 7 type check                                             |
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
