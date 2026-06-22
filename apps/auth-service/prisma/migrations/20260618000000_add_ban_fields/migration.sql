-- AlterTable: add BetterAuth admin plugin fields (nullable, no data loss)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "banned" BOOLEAN;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "banReason" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "banExpires" TIMESTAMP(3);
