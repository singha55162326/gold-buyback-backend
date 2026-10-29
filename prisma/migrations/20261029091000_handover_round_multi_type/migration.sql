-- ຮອບດຽວມອບໄດ້ຫຼາຍປະເພດຄຳ: ຍ້າຍ unique ຈາກ (ມື້, ຮອບ) ເປັນ (ມື້, ຮອບ, ປະເພດຄຳ).
DROP INDEX IF EXISTS "gold_handovers_businessDayId_roundNo_key";
CREATE UNIQUE INDEX "gold_handovers_businessDayId_roundNo_goldTypeId_key"
  ON "gold_handovers" ("businessDayId", "roundNo", "goldTypeId");
