-- AlterTable: add phone field to DeveloperProfile
ALTER TABLE "DeveloperProfile" ADD COLUMN IF NOT EXISTS "phone" TEXT;
