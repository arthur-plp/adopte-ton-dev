-- AlterTable
ALTER TABLE "Company" ADD COLUMN "siret" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Company_siret_key" ON "Company"("siret");
