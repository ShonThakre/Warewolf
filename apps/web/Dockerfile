FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.0.0 --activate
COPY . .
RUN pnpm install --frozen-lockfile \
  && pnpm --filter @warewolf/domain build \
  && pnpm --filter @warewolf/contracts build \
  && pnpm --filter @warewolf/web build

FROM nginx:1.27-alpine
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
