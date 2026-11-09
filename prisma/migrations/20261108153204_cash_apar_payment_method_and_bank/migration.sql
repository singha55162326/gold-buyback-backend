-- AlterTable
ALTER TABLE "cash_ap_ar_ledger" ADD COLUMN     "bankAccountId" TEXT,
ADD COLUMN     "method" "PaymentMethod";

-- CreateIndex
CREATE INDEX "cash_ap_ar_ledger_bankAccountId_idx" ON "cash_ap_ar_ledger"("bankAccountId");

-- AddForeignKey
ALTER TABLE "cash_ap_ar_ledger" ADD CONSTRAINT "cash_ap_ar_ledger_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "bank_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

