FROM node:25-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# ── Dependencies ──────────────────────────────────────────────────────────────
FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/web/package.json ./apps/web/
COPY packages/contracts/package.json ./packages/contracts/
COPY packages/types/package.json ./packages/types/
COPY packages/ui/package.json ./packages/ui/
COPY packages/eslint-config/package.json ./packages/eslint-config/
COPY packages/typescript-config/package.json ./packages/typescript-config/
RUN pnpm install --frozen-lockfile --filter web...

# ── Builder ───────────────────────────────────────────────────────────────────
FROM deps AS builder
COPY . .
# DATABASE_URL factice uniquement pour prisma generate (pas de connexion réelle)
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
# Next.js inline les variables NEXT_PUBLIC_* dans le bundle client au moment du
# build (pas au runtime) : il faut donc les recevoir en ARG ici, pas seulement
# via env_file dans docker-compose (qui ne s'applique qu'au conteneur final).
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_BETTER_AUTH_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_BETTER_AUTH_URL=$NEXT_PUBLIC_BETTER_AUTH_URL
RUN pnpm --filter web... build

# ── Runner ────────────────────────────────────────────────────────────────────
FROM node:25-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Next.js standalone
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "apps/web/server.js"]
