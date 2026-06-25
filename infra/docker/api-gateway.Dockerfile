FROM node:26-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# ── Dependencies ──────────────────────────────────────────────────────────────
FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/api-gateway/package.json ./apps/api-gateway/
COPY packages/contracts/package.json ./packages/contracts/
COPY packages/types/package.json ./packages/types/
COPY packages/eslint-config/package.json ./packages/eslint-config/
COPY packages/typescript-config/package.json ./packages/typescript-config/
RUN pnpm install --frozen-lockfile --filter api-gateway...

# ── Builder ───────────────────────────────────────────────────────────────────
FROM deps AS builder
COPY . .
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
RUN pnpm --filter api-gateway... build

# ── Runner ────────────────────────────────────────────────────────────────────
# Conserver la même profondeur de dossiers que dans le builder (apps/api-gateway/…
# + node_modules/.pnpm à la racine) : pnpm crée des symlinks relatifs entre les deux,
# les aplatir casserait leur résolution (ex: node_modules/prisma -> ../../../node_modules/.pnpm/…).
FROM node:26-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/node_modules/.pnpm ./node_modules/.pnpm
COPY --from=builder /app/packages/contracts ./packages/contracts
COPY --from=builder /app/packages/types ./packages/types
COPY --from=builder /app/apps/api-gateway/dist ./apps/api-gateway/dist
COPY --from=builder /app/apps/api-gateway/generated ./apps/api-gateway/generated
COPY --from=builder /app/apps/api-gateway/prisma ./apps/api-gateway/prisma
COPY --from=builder /app/apps/api-gateway/node_modules ./apps/api-gateway/node_modules
COPY --from=builder /app/apps/api-gateway/package.json ./apps/api-gateway/package.json
COPY --from=builder /app/apps/api-gateway/prisma.config.ts ./apps/api-gateway/prisma.config.ts

WORKDIR /app/apps/api-gateway

EXPOSE 4000 4001

CMD ["node", "dist/src/main"]
