-- AlterTable
ALTER TABLE "gold_skus" ADD COLUMN     "code" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "gold_skus_code_key" ON "gold_skus"("code");


-- ເຕີມລະຫັດໃຫ້ແຖວເກົ່າ ຕາມລຳດັບການສ້າງ, ແລ້ວດັນຕົວນັບໃຫ້ພົ້ນເລກທີ່ໃຊ້ໄປ
-- ເພື່ອບໍ່ໃຫ້ລະຫັດທີ່ອອກໃໝ່ຊ້ຳກັບຂອງເກົ່າ.
WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY "createdAt", id) AS n FROM gold_skus
)
UPDATE gold_skus g
SET code = 'SKU-' || LPAD(numbered.n::text, 3, '0')
FROM numbered
WHERE g.id = numbered.id AND g.code IS NULL;

INSERT INTO code_sequences (scope, next, "updatedAt")
VALUES ('GOLD_SKU', (SELECT COUNT(*) + 1 FROM gold_skus), NOW())
ON CONFLICT (scope) DO NOTHING;
