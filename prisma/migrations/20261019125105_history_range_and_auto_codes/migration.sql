-- CreateTable
CREATE TABLE "code_sequences" (
    "scope" TEXT NOT NULL,
    "next" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "code_sequences_pkey" PRIMARY KEY ("scope")
);

-- CreateIndex
CREATE INDEX "bank_transactions_createdAt_idx" ON "bank_transactions"("createdAt");

-- CreateIndex
CREATE INDEX "buybacks_createdAt_idx" ON "buybacks"("createdAt");

-- CreateIndex
CREATE INDEX "cash_ap_ar_ledger_businessDate_idx" ON "cash_ap_ar_ledger"("businessDate");

-- CreateIndex
CREATE INDEX "cash_transactions_createdAt_idx" ON "cash_transactions"("createdAt");

-- CreateIndex
CREATE INDEX "consignments_createdAt_idx" ON "consignments"("createdAt");

-- CreateIndex
CREATE INDEX "factory_out_tracking_createdAt_idx" ON "factory_out_tracking"("createdAt");

-- CreateIndex
CREATE INDEX "gold_ap_ar_ledger_businessDate_idx" ON "gold_ap_ar_ledger"("businessDate");

-- CreateIndex
CREATE INDEX "gold_credits_createdAt_idx" ON "gold_credits"("createdAt");

-- CreateIndex
CREATE INDEX "gold_exchanges_createdAt_idx" ON "gold_exchanges"("createdAt");

-- CreateIndex
CREATE INDEX "gold_handovers_createdAt_idx" ON "gold_handovers"("createdAt");

-- CreateIndex
CREATE INDEX "income_expense_transactions_createdAt_idx" ON "income_expense_transactions"("createdAt");

-- CreateIndex
CREATE INDEX "orders_createdAt_idx" ON "orders"("createdAt");

-- CreateIndex
CREATE INDEX "stock_new_ledger_businessDate_idx" ON "stock_new_ledger"("businessDate");

-- CreateIndex
CREATE INDEX "stock_old_ledger_businessDate_idx" ON "stock_old_ledger"("businessDate");
