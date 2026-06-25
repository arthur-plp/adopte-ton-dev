-- CreateTable
CREATE TABLE "ProcessedEvent" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProcessedEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProcessedEvent_messageId_key" ON "ProcessedEvent"("messageId");
