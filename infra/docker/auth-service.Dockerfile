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
# Conserver la même profondeur de dossiers que dans le builder (apps/auth-service/…
# + node_modules/.pnpm à la racine) : pnpm crée des symlinks relatifs entre les deux,
# les aplatir casserait leur résolution (ex: node_modules/prisma -> ../../../node_modules/.pnpm/…).
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/node_modules/.pnpm ./node_modules/.pnpm
COPY --from=builder /app/apps/auth-service/dist ./apps/auth-service/dist
COPY --from=builder /app/apps/auth-service/generated ./apps/auth-service/generated
COPY --from=builder /app/apps/auth-service/prisma ./apps/auth-service/prisma
COPY --from=builder /app/apps/auth-service/node_modules ./apps/auth-service/node_modules
COPY --from=builder /app/apps/auth-service/package.json ./apps/auth-service/package.json
COPY --from=builder /app/apps/auth-service/prisma.config.ts ./apps/auth-service/prisma.config.ts

WORKDIR /app/apps/auth-service

EXPOSE 3001

# Lance les migrations puis démarre le service
CMD ["sh", "-c", "node node_modules/.bin/prisma migrate deploy && node dist/main"]
