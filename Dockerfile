# Multi-stage Dockerfile for the photo-edit-fusion API server.
# Builds @pef/shared and @pef/font-match (the only workspace deps the server uses)
# then assembles a slim production image. The runner stage installs production
# dependencies fresh against the built workspace packages so pnpm's symlink layout
# does not have to survive a cross-stage COPY.

FROM node:20-slim AS base
ENV PNPM_HOME=/usr/local/share/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /app

# --- builder: install everything, build the three workspace packages ---
FROM base AS builder
COPY package.json pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/server/package.json apps/server/
COPY packages/shared/package.json packages/shared/
COPY packages/font-match/package.json packages/font-match/
RUN pnpm install --no-frozen-lockfile \
    --filter @pef/server... \
    --filter @pef/shared... \
    --filter @pef/font-match...
COPY apps/server apps/server
COPY packages/shared packages/shared
COPY packages/font-match packages/font-match
RUN pnpm --filter @pef/shared build \
 && pnpm --filter @pef/font-match build \
 && pnpm --filter @pef/server build

# --- runner: copy only what the server needs to run, then re-install --prod ---
FROM base AS runner
ENV NODE_ENV=production
ENV PEF_SERVER_HOST=0.0.0.0
ENV PEF_LOG_LEVEL=info
WORKDIR /app
COPY --from=builder /app/package.json /app/pnpm-workspace.yaml ./
COPY --from=builder /app/apps/server/package.json apps/server/package.json
COPY --from=builder /app/apps/server/dist apps/server/dist
COPY --from=builder /app/packages/shared/package.json packages/shared/package.json
COPY --from=builder /app/packages/shared/dist packages/shared/dist
COPY --from=builder /app/packages/font-match/package.json packages/font-match/package.json
COPY --from=builder /app/packages/font-match/dist packages/font-match/dist
RUN pnpm install --prod --no-frozen-lockfile --filter @pef/server...
EXPOSE 4317
CMD ["node", "apps/server/dist/index.js"]
