-- CreateEnum
CREATE TYPE "OldGoldCategory" AS ENUM ('JEWELRY', 'BAR');

-- AlterTable
ALTER TABLE "stock_movement_lines" ADD COLUMN     "oldCategory" "OldGoldCategory";

