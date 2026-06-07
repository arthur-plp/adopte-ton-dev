import { defineConfig } from "prisma/config";

// Prisma CLI ne charge pas .env.local (c'est Next.js qui le fait au runtime).
// On le charge manuellement ici pour que les commandes CLI (db push, migrate…) fonctionnent.
const proc = process as typeof process & { loadEnvFile?: (path?: string) => void };
if (typeof proc.loadEnvFile === "function") {
  try { proc.loadEnvFile(".env.local"); } catch { /* fichier absent ou Node < 20.12 */ }
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
