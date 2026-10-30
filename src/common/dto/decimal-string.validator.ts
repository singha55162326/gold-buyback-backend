import { registerDecorator, type ValidationOptions } from 'class-validator';

/**
 * ຕົວເລກບວກ ຫຼື ສູນ ທີ່ສົ່ງມາເປັນ string.
 *
 * ບໍ່ຮັບ `-5`, `1e5`, `.5`, ` 5 ` ຫຼື ຊ່ອງຫວ່າງ — ຮູບແບບເຫຼົ່ານີ້ `@IsNumberString`
 * ຮັບໝົດ ແລ້ວກາຍເປັນຄ່າຕິດລົບ ຫຼື ຄ່າມະຫາສານໃນບັນຊີ. ຈຳກັດ 15 ຫຼັກ ແລະ 4
 * ທົດສະນິຍົມ ໃຫ້ກົງກັບ `DECIMAL(18,4)` ຂອງຖານຂໍ້ມູນ.
 */
const DECIMAL = /^\d{1,15}(\.\d{1,4})?$/;

export interface DecimalStringOptions {
  /** ຊື່ຊ່ອງເປັນພາສາລາວ — ໃຊ້ຂຶ້ນຕົ້ນຂໍ້ຄວາມ error. */
  labelLo: string;
  /** ຄ່າຕ່ຳສຸດທີ່ຍອມຮັບ (ລວມຄ່ານີ້). ຄ່າເລີ່ມຕົ້ນ 0. */
  min?: number;
  /** ຄ່າສູງສຸດທີ່ຍອມຮັບ (ລວມຄ່ານີ້). */
  max?: number;
}

/**
 * ກວດວ່າຊ່ອງເປັນຕົວເລກທີ່ໃຊ້ໄດ້ຈິງ — ບໍ່ແມ່ນພຽງ "ເປັນຕົວເລກ".
 *
 * ໃຊ້ແທນ `@IsNumberString` ທຸກບ່ອນທີ່ເປັນ ເງິນ · ນ້ຳໜັກ · ຄ່າທຳນຽມ · ອັດຕາ,
 * ເພາະຄ່າຕິດລົບຢູ່ຊ່ອງເຫຼົ່ານັ້ນບໍ່ມີຄວາມໝາຍທາງທຸລະກິດ ແລະ ການກວດ `> 0`
 * ຢູ່ service ກວດແຕ່ຍອດລວມ ບໍ່ແມ່ນແຕ່ລະແຖວ.
 */
export function IsDecimalString(
  options: DecimalStringOptions,
  validationOptions?: ValidationOptions,
) {
  const { labelLo, min = 0, max } = options;

  return function (object: object, propertyName: string): void {
    registerDecorator({
      name: 'isDecimalString',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown): boolean {
          if (typeof value !== 'string' || !DECIMAL.test(value)) return false;
          const parsed = Number(value);
          if (!Number.isFinite(parsed)) return false;
          if (parsed < min) return false;
          return max === undefined || parsed <= max;
        },
        defaultMessage(): string {
          if (max !== undefined) return `${labelLo}ຕ້ອງເປັນຕົວເລກ ${min} ຫາ ${max}`;
          if (min > 0) return `${labelLo}ຕ້ອງເປັນຕົວເລກ ແລະ ບໍ່ນ້ອຍກວ່າ ${min}`;
          return `${labelLo}ຕ້ອງເປັນຕົວເລກ ແລະ ບໍ່ຕິດລົບ`;
        },
      },
    });
  };
}
