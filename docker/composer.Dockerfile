# Build context: repository root  (docker build -f docker/composer.Dockerfile .)
FROM node:24-alpine AS build
ENV NG_CLI_ANALYTICS=false CI=true
RUN npm i -g pnpm@12.11.2
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile \
 && pnpm build:elements \
 && pnpm build:composer

# Runtime: built composer (incl. /elements bundle) + zero-dependency page server. No node_modules.
FROM node:24-alpine
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
