-- CreateEnum
CREATE TYPE "DocumentRequestStatus" AS ENUM ('PENDING', 'FULFILLED');

-- CreateTable
CREATE TABLE "DocumentRequest" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "note" TEXT,
    "status" "DocumentRequestStatus" NOT NULL DEFAULT 'PENDING',
    "fileKey" TEXT,
    "fileName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fulfilledAt" TIMESTAMP(3),

    CONSTRAINT "DocumentRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DocumentRequest_applicationId_idx" ON "DocumentRequest"("applicationId");

-- AddForeignKey
ALTER TABLE "DocumentRequest" ADD CONSTRAINT "DocumentRequest_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;
