-- AlterTable
ALTER TABLE "gold_handovers" ADD COLUMN     "businessDayId" TEXT NOT NULL,
ADD COLUMN     "glassWeightG" DECIMAL(18,4),
ADD COLUMN     "grossWeightG" DECIMAL(18,4),
ADD COLUMN     "pureWeightG" DECIMAL(18,4),
ADD COLUMN     "roundNo" INTEGER,
ADD COLUMN     "shortfallG" DECIMAL(18,4);

-- CreateTable
CREATE TABLE "gold_handover_items" (
    "id" TEXT NOT NULL,
    "handoverId" TEXT NOT NULL,
    "buybackId" TEXT NOT NULL,
    "weightG" DECIMAL(18,4) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "goldPercent" DECIMAL(18,4),
    "payableAmount" DECIMAL(18,4) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gold_handover_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "gold_handover_items_buybackId_key" ON "gold_handover_items"("buybackId");

-- CreateIndex
CREATE INDEX "gold_handover_items_handoverId_idx" ON "gold_handover_items"("handoverId");

-- CreateIndex
CREATE UNIQUE INDEX "gold_handovers_businessDayId_roundNo_key" ON "gold_handovers"("businessDayId", "roundNo");

-- AddForeignKey
ALTER TABLE "gold_handovers" ADD CONSTRAINT "gold_handovers_businessDayId_fkey" FOREIGN KEY ("businessDayId") REFERENCES "business_days"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gold_handover_items" ADD CONSTRAINT "gold_handover_items_handoverId_fkey" FOREIGN KEY ("handoverId") REFERENCES "gold_handovers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gold_handover_items" ADD CONSTRAINT "gold_handover_items_buybackId_fkey" FOREIGN KEY ("buybackId") REFERENCES "buybacks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

