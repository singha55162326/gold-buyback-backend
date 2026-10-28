-- CreateTable
CREATE TABLE "buyback_lines" (
    "id" TEXT NOT NULL,
    "buybackId" TEXT NOT NULL,
    "goldTypeId" TEXT NOT NULL,
    "goldItemId" TEXT,
    "weightG" DECIMAL(18,4) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "goldPercent" DECIMAL(18,4),
    "shopBuybackPrice" DECIMAL(18,4) NOT NULL,
    "deduction" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "payableAmount" DECIMAL(18,4) NOT NULL,
    "branch" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "buyback_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_lines" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "goldItemId" TEXT NOT NULL,
    "weightG" DECIMAL(18,4) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "amount" DECIMAL(18,4),
    "note" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "order_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "buyback_lines_buybackId_idx" ON "buyback_lines"("buybackId");

-- CreateIndex
CREATE INDEX "order_lines_orderId_idx" ON "order_lines"("orderId");

-- AddForeignKey
ALTER TABLE "buyback_lines" ADD CONSTRAINT "buyback_lines_buybackId_fkey" FOREIGN KEY ("buybackId") REFERENCES "buybacks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "buyback_lines" ADD CONSTRAINT "buyback_lines_goldTypeId_fkey" FOREIGN KEY ("goldTypeId") REFERENCES "gold_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "buyback_lines" ADD CONSTRAINT "buyback_lines_goldItemId_fkey" FOREIGN KEY ("goldItemId") REFERENCES "gold_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_goldItemId_fkey" FOREIGN KEY ("goldItemId") REFERENCES "gold_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ຍ້າຍບິນເກົ່າ (ແຖວດຽວ) ເຂົ້າເປັນແຖວລາຍການ ເພື່ອໃຫ້ທຸກບິນອ່ານຜ່ານ lines ໄດ້ຄືກັນ.
INSERT INTO buyback_lines (
  id, "buybackId", "goldTypeId", "goldItemId", "weightG", quantity,
  "goldPercent", "shopBuybackPrice", deduction, "payableAmount", "sortOrder"
)
SELECT
  md5(random()::text || clock_timestamp()::text)::uuid::text,
  b.id, b."goldTypeId", b."goldItemId", b."weightG", b.quantity,
  b."goldPercent", b."shopBuybackPrice", b.deduction, b."payableAmount", 0
FROM buybacks b;

INSERT INTO order_lines (id, "orderId", "goldItemId", "weightG", quantity, amount, "sortOrder")
SELECT
  md5(random()::text || clock_timestamp()::text)::uuid::text,
  o.id, o."goldItemId", o."weightG", o.quantity, o."totalAmount", 0
FROM orders o;
