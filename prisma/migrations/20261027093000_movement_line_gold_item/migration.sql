-- AlterTable
ALTER TABLE "stock_movement_lines" ADD COLUMN     "goldItemId" TEXT;

-- AddForeignKey
ALTER TABLE "stock_movement_lines" ADD CONSTRAINT "stock_movement_lines_goldItemId_fkey" FOREIGN KEY ("goldItemId") REFERENCES "gold_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

