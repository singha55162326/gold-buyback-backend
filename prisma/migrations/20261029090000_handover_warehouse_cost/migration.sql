-- ຕົ້ນທຶນເຂົ້າສາງ ຂອງແຕ່ລະການມອບຄຳ — ຖ່າຍໄວ້ຕອນມອບ.
ALTER TABLE "gold_handovers" ADD COLUMN "warehouseCost" DECIMAL(18,4);

-- ແຖວເກົ່າ: ຄຳຕົ້ມ ຄິດຄືນໄດ້ຈາກລາຍການທີ່ມອບ (ລາຄາທີ່ຈ່າຍຕໍ່ລາຍການ).
-- ຄຳດີ/ຫຍຸບ/ແທ່ງ ປະໄວ້ NULL ເພາະສະເລ່ຍຂອງມື້ນັ້ນຄິດຄືນບໍ່ໄດ້ແລ້ວ.
UPDATE "gold_handovers" h
SET "warehouseCost" = i.total
FROM (
  SELECT "handoverId", SUM("payableAmount") AS total
  FROM "gold_handover_items"
  GROUP BY "handoverId"
) i
WHERE i."handoverId" = h.id;
