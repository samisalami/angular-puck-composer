# Build context: repository root  (docker build -f docker/composer.Dockerfile .)
# Node version = .node-version (override in CI: --build-arg NODE_VERSION=22.x.y).
ARG NODE_VERSION=22.15.0
FROM node:${NODE_VERSION}-alpine AS build
ENV NG_CLI_ANALYTICS=false CI=true
WORKDIR /repo
COPY . .
RUN npm ci \
 && npm run build:elements \
 && npm run build:composer

# Runtime: built composer (incl. /elements bundle) + zero-dependency page server. No node_modules.
FROM node:${NODE_VERSION}-alpine
WORKDIR /app
COPY --from=build /repo/server ./server
COPY --from=build /repo/composer/dist ./dist
ENV PORT=3000 STATIC_DIR=/app/dist DATA_DIR=/data
RUN mkdir /data && chown node:node /data
VOLUME /data
USER node
EXPOSE 3000
HEALTHCHECK CMD wget -qO- http://127.0.0.1:3000/healthz >/dev/null || exit 1
CMD ["node", "server/server.mjs"]
