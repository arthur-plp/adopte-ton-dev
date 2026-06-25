/*
  Warnings:

  - Made the column `jobOfferId` on table `Conversation` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Conversation" ALTER COLUMN "jobOfferId" SET NOT NULL,
ALTER COLUMN "jobOfferId" SET DEFAULT '';
