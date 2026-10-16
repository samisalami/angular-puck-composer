# Build context: repository root  (docker build -f docker/storybook.Dockerfile .)
FROM node:24-alpine AS build
ENV NG_CLI_ANALYTICS=false CI=true
RUN npm i -g pnpm@12.11.2
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile && pnpm build:storybook

# Static files only.
FROM nginx:1.29-alpine
COPY --from=build /repo/dist/storybook /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1
