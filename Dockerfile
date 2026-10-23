# The root postinstall sets up git hooks with husky, which neither stage needs, so both drop it
# from their copy of package.json.

# Build the client with Vite. Its libraries are dev dependencies: they end up in the bundle.
FROM node:24.22.1-alpine AS client

WORKDIR /app
COPY package.json yarn.lock .yarnrc.yml ./
COPY .yarn/releases ./.yarn/releases
RUN npm pkg delete scripts.postinstall \
  && node .yarn/releases/yarn-4.18.1.cjs install --immutable

COPY vite.config.ts ./
COPY client ./client
RUN node .yarn/releases/yarn-4.18.1.cjs build

# The server, with production dependencies only.
FROM node:24.22.1-alpine

ENV NODE_ENV=production
WORKDIR /app

COPY package.json yarn.lock .yarnrc.yml ./
COPY .yarn/releases ./.yarn/releases
RUN npm pkg delete scripts.postinstall \
  && node .yarn/releases/yarn-4.18.1.cjs workspaces focus --production \
  && rm -rf .yarn/cache .yarn/install-state.gz

# The server runs straight from its TypeScript sources via Node's type stripping.
COPY server ./server
COPY --from=client /app/dist ./dist

USER node
EXPOSE 5000
CMD ["node", "server/index.ts"]
