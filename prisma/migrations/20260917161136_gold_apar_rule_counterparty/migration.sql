-- AlterTable
ALTER TABLE "gold_ap_ar_posting_rules" ADD COLUMN     "counterpartyId" TEXT;

-- AddForeignKey
ALTER TABLE "gold_ap_ar_posting_rules" ADD CONSTRAINT "gold_ap_ar_posting_rules_counterpartyId_fkey" FOREIGN KEY ("counterpartyId") REFERENCES "partner_sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;
