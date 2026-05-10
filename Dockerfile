# Multi-stage Dockerfile for the photo-edit-fusion API server.
# Builds @pef/shared and @pef/font-match (the only deps the server needs)
# then ships a slim production image running apps/server.

FROM node:20-slim AS base
ENV PNPM_HOME=/usr/local/share/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /app

# --- deps ---
FROM base AS deps
COPY package.json pnpm-workspace.yaml ./
COPY apps/server/package.json apps/server/
COPY packages/shared/package.json packages/shared/
COPY packages/font-match/package.json packages/font-match/
RUN pnpm install --no-frozen-lockfile \
    --filter @pef/server... \
    --filter @pef/shared... \
    --filter @pef/font-match...

# --- builder ---
FROM base AS builder
COPY --from=deps /app/node_modules /app/node_modules
COPY --from=deps /app/apps/server/node_modules /app/apps/server/node_modules
COPY --from=deps /app/packages/shared/node_modules /app/packages/shared/node_modules
COPY --from=deps /app/packages/font-match/node_modules /app/packages/font-match/node_modules
COPY tsconfig.base.json ./
COPY package.json pnpm-workspace.yaml ./
COPY apps/server apps/server
COPY packages/shared packages/shared
COPY packages/font-match packages/font-match
RUN pnpm --filter @pef/shared build \
 && pnpm --filter @pef/font-match build \
 && pnpm --filter @pef/server build

# --- runner ---
FROM node:20-slim AS runner
ENV NODE_ENV=production
ENV PEF_SERVER_HOST=0.0.0.0
ENV PEF_LOG_LEVEL=info
WORKDIR /app
# minimal runtime: node_modules + compiled JS
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared/dist packages/shared/dist
COPY --from=builder /app/packages/shared/package.json packages/shared/package.json
COPY --from=builder /app/packages/font-match/dist packages/font-match/dist
COPY --from=builder /app/packages/font-match/package.json packages/font-match/package.json
COPY --from=builder /app/apps/server/dist apps/server/dist
COPY --from=builder /app/apps/server/package.json apps/server/package.json
EXPOSE 4317
CMD ["node", "apps/server/dist/index.js"]
