FROM node:26-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# ── Dependencies ──────────────────────────────────────────────────────────────
FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/messaging-svc/package.json ./apps/messaging-svc/
COPY packages/contracts/package.json ./packages/contracts/
COPY packages/types/package.json ./packages/types/
COPY packages/eslint-config/package.json ./packages/eslint-config/
COPY packages/typescript-config/package.json ./packages/typescript-config/
RUN pnpm install --frozen-lockfile --filter messaging-svc...

# ── Builder ───────────────────────────────────────────────────────────────────
FROM deps AS builder
COPY . .
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
RUN pnpm --filter messaging-svc... build

# ── Runner ────────────────────────────────────────────────────────────────────
# Conserver la même profondeur de dossiers que dans le builder (apps/messaging-svc/…
# + node_modules/.pnpm à la racine) : pnpm crée des symlinks relatifs entre les deux,
# les aplatir casserait leur résolution (ex: node_modules/prisma -> ../../../node_modules/.pnpm/…).
FROM node:26-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/node_modules/.pnpm ./node_modules/.pnpm
COPY --from=builder /app/packages/contracts ./packages/contracts
COPY --from=builder /app/packages/types ./packages/types
COPY --from=builder /app/apps/messaging-svc/dist ./apps/messaging-svc/dist
COPY --from=builder /app/apps/messaging-svc/generated ./apps/messaging-svc/generated
COPY --from=builder /app/apps/messaging-svc/prisma ./apps/messaging-svc/prisma
COPY --from=builder /app/apps/messaging-svc/node_modules ./apps/messaging-svc/node_modules
COPY --from=builder /app/apps/messaging-svc/package.json ./apps/messaging-svc/package.json
COPY --from=builder /app/apps/messaging-svc/prisma.config.ts ./apps/messaging-svc/prisma.config.ts

WORKDIR /app/apps/messaging-svc

EXPOSE 3006

CMD ["sh", "-c", "node node_modules/prisma/build/index.js migrate deploy && node dist/src/main"]
