FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# ── Dependencies ──────────────────────────────────────────────────────────────
FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/matching-svc/package.json ./apps/matching-svc/
COPY packages/contracts/package.json ./packages/contracts/
COPY packages/types/package.json ./packages/types/
COPY packages/eslint-config/package.json ./packages/eslint-config/
COPY packages/typescript-config/package.json ./packages/typescript-config/
RUN pnpm install --frozen-lockfile --filter matching-svc...

# ── Builder ───────────────────────────────────────────────────────────────────
FROM deps AS builder
COPY . .
RUN pnpm --filter matching-svc... build

# ── Runner ────────────────────────────────────────────────────────────────────
# matching-svc est stateless (pas de Prisma/DB) : pas de migration au démarrage,
# contrairement aux autres micro-services NestJS du repo.
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/node_modules/.pnpm ./node_modules/.pnpm
COPY --from=builder /app/packages/contracts ./packages/contracts
COPY --from=builder /app/packages/types ./packages/types
COPY --from=builder /app/apps/matching-svc/dist ./apps/matching-svc/dist
COPY --from=builder /app/apps/matching-svc/node_modules ./apps/matching-svc/node_modules
COPY --from=builder /app/apps/matching-svc/package.json ./apps/matching-svc/package.json

WORKDIR /app/apps/matching-svc

EXPOSE 3005

CMD ["node", "dist/main"]
