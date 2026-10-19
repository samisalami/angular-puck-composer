# Build context: repository root  (docker build -f docker/storybook.Dockerfile .)
# Node version = .node-version (override in CI: --build-arg NODE_VERSION=22.x.y).
ARG NODE_VERSION=22.15.0
FROM node:${NODE_VERSION}-alpine AS build
ENV NG_CLI_ANALYTICS=false CI=true
WORKDIR /repo
COPY . .
RUN npm ci && npm run build:storybook

# Static files only.
FROM nginx:1.29-alpine
COPY --from=build /repo/dist/storybook /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1
