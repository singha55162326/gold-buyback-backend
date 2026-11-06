-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "currency" "Currency" NOT NULL DEFAULT 'LAK',
ADD COLUMN     "exchangeRate" DECIMAL(18,6),
ADD COLUMN     "originalTotalAmount" DECIMAL(18,4);
