import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Response } from 'express';

/**
 * ຂໍ້ຜິດພາດຂອງ Prisma ທີ່ເກີດຈາກການແຂ່ງກັນ ບໍ່ແມ່ນລະບົບລົ້ມ.
 *
 * ການກວດຢູ່ service ເປັນແບບ "ອ່ານແລ້ວຈຶ່ງຂຽນ": ສອງຄຳຂໍທີ່ມາພ້ອມກັນຜ່ານການ
 * ກວດໄດ້ທັງຄູ່ ແລ້ວດັດສະນີຢູ່ຖານຂໍ້ມູນຈຶ່ງເປັນຕົວກັນແຖວທີ 2. ແຖວທີ 2 ນັ້ນ
 * ຕ້ອງເຫັນຂໍ້ຄວາມທີ່ອ່ານຮູ້ເລື່ອງ ບໍ່ແມ່ນ 500.
 */
const PRISMA_ERRORS: Record<string, { status: HttpStatus; message: string }> = {
  // ລະເມີດດັດສະນີ unique — ສ່ວນຫຼາຍແປວ່າມີແຖວນີ້ຢູ່ແລ້ວ
  P2002: {
    status: HttpStatus.CONFLICT,
    message: 'ລາຍການນີ້ມີຢູ່ແລ້ວ — ກະລຸນາໂຫຼດຂໍ້ມູນຄືນ ແລ້ວລອງອີກຄັ້ງ',
  },
  // ອັບເດດ/ລຶບແຖວທີ່ບໍ່ມີ ຫຼື ຖືກຄົນອື່ນແກ້ໄປກ່ອນແລ້ວ
  P2025: {
    status: HttpStatus.CONFLICT,
    message: 'ລາຍການນີ້ຖືກແກ້ໄຂ ຫຼື ລຶບໄປແລ້ວ — ກະລຸນາໂຫຼດຂໍ້ມູນຄືນ',
  },
  // ອ້າງອີງແຖວທີ່ບໍ່ມີ
  P2003: {
    status: HttpStatus.BAD_REQUEST,
    message: 'ອ້າງອີງລາຍການທີ່ບໍ່ມີຢູ່ — ກະລຸນາເລືອກຄືນ',
  },
};

/** Uniform error envelope so the web client can render Lao messages directly. */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const known =
      exception instanceof Prisma.PrismaClientKnownRequestError
        ? PRISMA_ERRORS[exception.code]
        : undefined;

    const status = exception instanceof HttpException
      ? exception.getStatus()
      : (known?.status ?? HttpStatus.INTERNAL_SERVER_ERROR);

    const payload = exception instanceof HttpException
      ? exception.getResponse()
      : { message: known?.message ?? 'ເກີດຂໍ້ຜິດພາດພາຍໃນລະບົບ' };

    /*
     * ບັນທຶກ Prisma error ທີ່ແປແລ້ວໄວ້ເປັນ warn: ຜູ້ໃຊ້ໄດ້ຂໍ້ຄວາມທີ່ດີແລ້ວ ແຕ່
     * ຖ້າມັນເກີດຖີ່ແປວ່າມີການແຂ່ງກັນທີ່ຄວນແກ້ຢູ່ service.
     */
    if (known) {
      const code = (exception as Prisma.PrismaClientKnownRequestError).code;
      this.logger.warn(`Prisma ${code} → ${status}: ${known.message}`);
    }

    if (status >= 500) {
      this.logger.error(exception instanceof Error ? exception.stack : String(exception));
    }

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      ...(typeof payload === 'object' ? payload : { message: payload }),
    });
  }
}
