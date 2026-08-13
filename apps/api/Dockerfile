# ─────────────────────────────────────────────
# Casheer API — production image
# ─────────────────────────────────────────────
FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
WORKDIR /app

FROM base AS build
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json .npmrc ./
COPY apps/ ./apps/
COPY packages/ ./packages/
# node-linker=hoisted (set in the root .npmrc) produces a real, flat
# node_modules without pnpm symlinks, so the multi-stage COPY below yields a
# runtime image where require('@prisma/client') actually resolves.
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @casheer/api exec prisma generate
RUN pnpm --filter @casheer/api build

FROM base AS runtime
ENV NODE_ENV=production
ENV NODE_PATH=/app/node_modules
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api/package.json ./apps/api/package.json
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/prisma ./apps/api/prisma
WORKDIR /app/apps/api
EXPOSE 3001
CMD ["node", "dist/main.js"]
