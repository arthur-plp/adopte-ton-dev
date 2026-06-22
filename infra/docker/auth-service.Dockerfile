FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# ── Dependencies ──────────────────────────────────────────────────────────────
FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/auth-service/package.json ./apps/auth-service/
COPY packages/contracts/package.json ./packages/contracts/
COPY packages/types/package.json ./packages/types/
COPY packages/eslint-config/package.json ./packages/eslint-config/
COPY packages/typescript-config/package.json ./packages/typescript-config/
RUN pnpm install --frozen-lockfile --filter auth-service...

# ── Builder ───────────────────────────────────────────────────────────────────
FROM deps AS builder
COPY . .
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
RUN pnpm --filter auth-service... build

# ── Runner ────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS runner
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/apps/auth-service/dist ./dist
COPY --from=builder /app/apps/auth-service/generated ./generated
COPY --from=builder /app/apps/auth-service/prisma ./prisma
COPY --from=builder /app/apps/auth-service/node_modules ./node_modules
COPY --from=builder /app/apps/auth-service/package.json ./package.json
COPY --from=builder /app/node_modules/.pnpm ./node_modules/.pnpm

EXPOSE 3001

# Lance les migrations puis démarre le service
CMD ["sh", "-c", "node node_modules/.bin/prisma migrate deploy && node dist/main"]
