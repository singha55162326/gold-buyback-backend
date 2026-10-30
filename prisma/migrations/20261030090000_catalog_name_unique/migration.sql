-- ຊື່ຂໍ້ມູນຫຼັກຊ້ຳກັນບໍ່ໄດ້ — ບັງຄັບທີ່ຖານຂໍ້ມູນ.
--
-- Service ກວດຊື່ຊ້ຳດ້ວຍ "ອ່ານແລ້ວຈຶ່ງຂຽນ" ເຊິ່ງສອງຄຳຂໍທີ່ມາພ້ອມກັນຜ່ານໄດ້ທັງຄູ່
-- (ກວດກ່ອນ ຍັງບໍ່ມີໃຜ → ຂຽນທັງສອງ). ມີແຕ່ດັດສະນີຢູ່ຖານຂໍ້ມູນຈຶ່ງກັນໄດ້ແທ້.
--
-- ດັດສະນີນີ້ແທນກົດຂອງ service ແບບກົງກັນ:
--   lower(name_lo)        — ບໍ່ສົນໂຕພິມໃຫຍ່ນ້ອຍ (ຄືກັບ mode: 'insensitive')
--   WHERE deleted_at IS NULL — ຊື່ທີ່ລຶບໄປແລ້ວ ເອົາມາໃຊ້ຄືນໄດ້

CREATE UNIQUE INDEX "gold_types_name_lo_active_key"
  ON "gold_types" (lower("nameLo")) WHERE "deletedAt" IS NULL;

CREATE UNIQUE INDEX "gold_items_name_lo_active_key"
  ON "gold_items" (lower("nameLo")) WHERE "deletedAt" IS NULL;

CREATE UNIQUE INDEX "cabinets_name_lo_active_key"
  ON "cabinets" (lower("nameLo")) WHERE "deletedAt" IS NULL;

CREATE UNIQUE INDEX "partner_sources_name_lo_active_key"
  ON "partner_sources" (lower("nameLo")) WHERE "deletedAt" IS NULL;

CREATE UNIQUE INDEX "income_expense_categories_name_lo_active_key"
  ON "income_expense_categories" (lower("nameLo")) WHERE "deletedAt" IS NULL;

CREATE UNIQUE INDEX "ap_ar_cash_categories_name_lo_active_key"
  ON "ap_ar_cash_categories" (lower("nameLo")) WHERE "deletedAt" IS NULL;

-- ບັນຊີທະນາຄານບໍ່ມີ deleted_at — ກວດທຸກແຖວ.
CREATE UNIQUE INDEX "bank_accounts_name_lo_key"
  ON "bank_accounts" (lower("nameLo"));
