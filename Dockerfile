# Single-image deployment (HOST-01, Render). Builds the web client and the API;
# the API serves the client from WEB_DIST_DIR next to /api and Socket.IO, so
# the whole game is one origin. Migrations run before the API listens.
# The two-container nginx stack in compose.prod.yaml is unchanged.
FROM node:22-bookworm-slim
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.0.0 --activate
COPY . .
RUN pnpm install --frozen-lockfile \
  && pnpm --filter @warewolf/domain build \
  && pnpm --filter @warewolf/contracts build \
  && pnpm --filter @warewolf/api build \
  && pnpm --filter @warewolf/web build
ENV NODE_ENV=production \
    PORT=3000 \
    WEB_DIST_DIR=/app/apps/web/dist
EXPOSE 3000
CMD ["sh", "-c", "node apps/api/dist/db/cli.js up && node apps/api/dist/main.js"]
