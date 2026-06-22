-- CreateTable
CREATE TABLE "JobOfferEvent" (
    "id" TEXT NOT NULL,
    "jobOfferId" TEXT NOT NULL,
    "status" "JobStatus" NOT NULL,
    "note" TEXT,
    "actorRole" TEXT NOT NULL,
    "actorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobOfferEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "JobOfferEvent_jobOfferId_createdAt_idx" ON "JobOfferEvent"("jobOfferId", "createdAt");

-- AddForeignKey
ALTER TABLE "JobOfferEvent" ADD CONSTRAINT "JobOfferEvent_jobOfferId_fkey" FOREIGN KEY ("jobOfferId") REFERENCES "JobOffer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
