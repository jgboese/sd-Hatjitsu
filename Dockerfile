FROM node:24.22.1-alpine

ENV NODE_ENV=production
WORKDIR /app

# Production dependencies only. The root postinstall sets up git hooks with husky, a dev
# dependency that is not installed here, so drop it from the image's copy of package.json.
COPY package.json yarn.lock .yarnrc.yml ./
COPY .yarn/releases ./.yarn/releases
RUN npm pkg delete scripts.postinstall \
  && node .yarn/releases/yarn-4.18.1.cjs workspaces focus --production \
  && rm -rf .yarn/cache .yarn/install-state.gz

# The server runs straight from its TypeScript sources via Node's type stripping.
COPY server ./server
COPY app ./app

USER node
EXPOSE 5000
CMD ["node", "server/index.ts"]
