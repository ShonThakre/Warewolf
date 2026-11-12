FROM node:22-bookworm-slim
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.0.0 --activate
COPY . .
RUN pnpm install --frozen-lockfile \
  && pnpm --filter @warewolf/domain build \
  && pnpm --filter @warewolf/contracts build \
  && pnpm --filter @warewolf/api build
ENV PORT=3000
EXPOSE 3000
CMD ["sh", "-c", "node apps/api/dist/db/cli.js up && node apps/api/dist/main.js"]
