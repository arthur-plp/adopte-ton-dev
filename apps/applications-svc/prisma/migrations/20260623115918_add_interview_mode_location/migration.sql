-- CreateEnum
CREATE TYPE "InterviewMode" AS ENUM ('REMOTE', 'IN_PERSON');

-- AlterTable
ALTER TABLE "Application" ADD COLUMN     "interviewLocation" TEXT,
ADD COLUMN     "interviewMode" "InterviewMode";
