-- CreateEnum
CREATE TYPE "DocumentRequestSource" AS ENUM ('RECRUITER', 'DEVELOPER');

-- AlterTable
ALTER TABLE "DocumentRequest" ADD COLUMN     "source" "DocumentRequestSource" NOT NULL DEFAULT 'RECRUITER';
