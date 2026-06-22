import { defineConfig } from "prisma/config";

const proc = process as typeof process & { loadEnvFile?: (path?: string) => void };
if (typeof proc.loadEnvFile === "function") {
  try { proc.loadEnvFile(".env"); } catch { /* ignore */ }
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
