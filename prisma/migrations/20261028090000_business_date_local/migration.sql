-- ວັນທີມື້ການຄ້າ: ຈາກ "ທ່ຽງຄືນທ້ອງຖິ່ນ" ມາເປັນ "ວັນທີທ້ອງຖິ່ນຈິງ"
--
-- ແຕ່ກ່ອນລະບົບສົ່ງທ່ຽງຄືນທ້ອງຖິ່ນ (UTC+07) ລົງຖັນ `date` ຊຶ່ງ Postgres ຕັດ
-- ເປັນວັນທີຕາມ UTC → ກາຍເປັນ 17:00 ຂອງ "ມື້ວານ" ແລ້ວເກັບເປັນມື້ວານ. ຜົນຄື
-- ປ້າຍວັນທີຊ້າໄປ 1 ມື້ ແລະ ການກອງຊ່ວງວັນທີ (ທີ່ສ້າງຂອບເປັນທ່ຽງຄືນ UTC)
-- ຫາແຖວຂອງມື້ນີ້ບໍ່ພົບ.
--
-- ດຽວນີ້ຂຽນເປັນທ່ຽງຄືນ UTC ຂອງວັນທີທ້ອງຖິ່ນ, ສະນັ້ນແຖວເກົ່າຕ້ອງເລື່ອນ +1 ມື້.
-- ເລື່ອນຜ່ານ "ບ່ອນພັກ" ໄກໆ ກ່ອນ ເພາະ business_days.date ເປັນ unique ແລະ
-- ການບວກ 1 ມື້ພ້ອມກັນຈະຊົນກັບແຖວທີ່ມີຢູ່ແລ້ວ (13 ຊົນ 14).
UPDATE business_days SET date = date + INTERVAL '10001 day';
UPDATE business_days SET date = date - INTERVAL '10000 day';

UPDATE stock_new_ledger   SET "businessDate" = "businessDate" + INTERVAL '1 day';
UPDATE stock_old_ledger   SET "businessDate" = "businessDate" + INTERVAL '1 day';
UPDATE gold_ap_ar_ledger  SET "businessDate" = "businessDate" + INTERVAL '1 day';
UPDATE cash_ap_ar_ledger  SET "businessDate" = "businessDate" + INTERVAL '1 day';
UPDATE advance_ledger     SET "businessDate" = "businessDate" + INTERVAL '1 day';
