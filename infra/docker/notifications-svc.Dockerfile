FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# ── Dependencies ──────────────────────────────────────────────────────────────
FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/notifications-svc/package.json ./apps/notifications-svc/
COPY packages/contracts/package.json ./packages/contracts/
COPY packages/types/package.json ./packages/types/
COPY packages/eslint-config/package.json ./packages/eslint-config/
COPY packages/typescript-config/package.json ./packages/typescript-config/
RUN pnpm install --frozen-lockfile --filter notifications-svc...

# ── Builder ───────────────────────────────────────────────────────────────────
FROM deps AS builder
COPY . .
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
RUN pnpm --filter notifications-svc... build

# ── Runner ────────────────────────────────────────────────────────────────────
# Conserver la même profondeur de dossiers que dans le builder (apps/notifications-svc/…
# + node_modules/.pnpm à la racine) : pnpm crée des symlinks relatifs entre les deux,
# les aplatir casserait leur résolution (ex: node_modules/prisma -> ../../../node_modules/.pnpm/…).
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/node_modules/.pnpm ./node_modules/.pnpm
COPY --from=builder /app/packages/contracts ./packages/contracts
COPY --from=builder /app/packages/types ./packages/types
COPY --from=builder /app/apps/notifications-svc/dist ./apps/notifications-svc/dist
COPY --from=builder /app/apps/notifications-svc/generated ./apps/notifications-svc/generated
COPY --from=builder /app/apps/notifications-svc/prisma ./apps/notifications-svc/prisma
COPY --from=builder /app/apps/notifications-svc/node_modules ./apps/notifications-svc/node_modules
COPY --from=builder /app/apps/notifications-svc/package.json ./apps/notifications-svc/package.json
COPY --from=builder /app/apps/notifications-svc/prisma.config.ts ./apps/notifications-svc/prisma.config.ts

WORKDIR /app/apps/notifications-svc

EXPOSE 3007

CMD ["sh", "-c", "node node_modules/prisma/build/index.js migrate deploy && node dist/src/main"]
