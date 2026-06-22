FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# ── Dependencies ──────────────────────────────────────────────────────────────
FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/jobs-svc/package.json ./apps/jobs-svc/
COPY packages/contracts/package.json ./packages/contracts/
COPY packages/types/package.json ./packages/types/
COPY packages/eslint-config/package.json ./packages/eslint-config/
COPY packages/typescript-config/package.json ./packages/typescript-config/
RUN pnpm install --frozen-lockfile --filter jobs-svc...

# ── Builder ───────────────────────────────────────────────────────────────────
FROM deps AS builder
COPY . .
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
RUN pnpm --filter jobs-svc... build

# ── Runner ────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS runner
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/apps/jobs-svc/dist ./dist
COPY --from=builder /app/apps/jobs-svc/generated ./generated
COPY --from=builder /app/apps/jobs-svc/prisma ./prisma
COPY --from=builder /app/apps/jobs-svc/node_modules ./node_modules
COPY --from=builder /app/apps/jobs-svc/package.json ./package.json
COPY --from=builder /app/node_modules/.pnpm ./node_modules/.pnpm

EXPOSE 3002

CMD ["sh", "-c", "node node_modules/.bin/prisma migrate deploy && node dist/main"]
