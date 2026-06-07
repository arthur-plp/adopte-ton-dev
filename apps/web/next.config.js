/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["pg", "pg-native", "@prisma/adapter-pg"],

  env: {
    DATABASE_URL:
      process.env.DATABASE_URL ??
      "postgresql://build:build@localhost:5432/build",
  },
};

export default nextConfig;
