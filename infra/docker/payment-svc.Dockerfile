FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# ── Dependencies ──────────────────────────────────────────────────────────────
FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/payment-svc/package.json ./apps/payment-svc/
COPY packages/contracts/package.json ./packages/contracts/
COPY packages/types/package.json ./packages/types/
COPY packages/eslint-config/package.json ./packages/eslint-config/
COPY packages/typescript-config/package.json ./packages/typescript-config/
RUN pnpm install --frozen-lockfile --filter payment-svc...

# ── Builder ───────────────────────────────────────────────────────────────────
FROM deps AS builder
COPY . .
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
RUN pnpm --filter payment-svc... build

# ── Runner ────────────────────────────────────────────────────────────────────
# Conserver la même profondeur de dossiers que dans le builder (apps/payment-svc/…
# + node_modules/.pnpm à la racine) : pnpm crée des symlinks relatifs entre les deux,
# les aplatir casserait leur résolution (ex: node_modules/prisma -> ../../../node_modules/.pnpm/…).
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/node_modules/.pnpm ./node_modules/.pnpm
COPY --from=builder /app/packages/contracts ./packages/contracts
COPY --from=builder /app/packages/types ./packages/types
COPY --from=builder /app/apps/payment-svc/dist ./apps/payment-svc/dist
COPY --from=builder /app/apps/payment-svc/generated ./apps/payment-svc/generated
COPY --from=builder /app/apps/payment-svc/prisma ./apps/payment-svc/prisma
COPY --from=builder /app/apps/payment-svc/node_modules ./apps/payment-svc/node_modules
COPY --from=builder /app/apps/payment-svc/package.json ./apps/payment-svc/package.json
COPY --from=builder /app/apps/payment-svc/prisma.config.ts ./apps/payment-svc/prisma.config.ts

WORKDIR /app/apps/payment-svc

EXPOSE 3004

CMD ["sh", "-c", "node node_modules/prisma/build/index.js migrate deploy && node dist/src/main"]
