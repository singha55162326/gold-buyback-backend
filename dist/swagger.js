"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupSwagger = setupSwagger;
const swagger_1 = require("@nestjs/swagger");
/**
 * Swagger UI for the KPV API.
 *
 * Off by default in production: the document lists every route, its DTO shape
 * and its required role, which is a map of the shop's back office. Set
 * `SWAGGER_ENABLED=true` to turn it on there deliberately — in development it
 * is on unless explicitly disabled.
 *
 * Mounted at /api/docs, with the raw document at /api/docs-json so the
 * contract can be diffed in CI or fed to a client generator.
 */
function setupSwagger(app) {
    const explicit = process.env.SWAGGER_ENABLED;
    const enabled = explicit === 'true' || (explicit !== 'false' && process.env.NODE_ENV !== 'production');
    if (!enabled)
        return null;
    const config = new swagger_1.DocumentBuilder()
        .setTitle('ລະບົບບໍລິຫານຈັດການຮ້ານຄຳພູວົງ — API')
        .setDescription([
        'REST API ຂອງລະບົບບໍລິຫານຈັດການຮ້ານຄຳ (TOR v1.1).',
        '',
        '**ວິທີໃຊ້:** ເອີ້ນ `POST /api/auth/login` ກ່ອນ (ເຊັ່ນ `admin`),',
        'ເອົາ `accessToken` ທີ່ໄດ້ມາກົດປຸ່ມ **Authorize** ຢູ່ມຸມຂວາເທິງ,',
        'ແລ້ວຈຶ່ງທົດລອງ endpoint ອື່ນໄດ້.',
        '',
        '**ໝາຍເຫດ:** ທຸກຄ່າເງິນ ແລະ ນ້ຳໜັກສົ່ງເປັນ **string** ບໍ່ແມ່ນ number',
        '— ເພື່ອບໍ່ໃຫ້ຜ່ານ float ຂອງ JavaScript ແລ້ວເສຍຄວາມແມ່ນຍຳ (DECIMAL(18,4)).',
    ].join('\n'))
        .setVersion('1.1')
        .addBearerAuth({
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'ວາງສະເພາະ accessToken — ບໍ່ຕ້ອງພິມຄຳວ່າ Bearer',
    }, 'bearer')
        .addTag('auth', 'ເຂົ້າສູ່ລະບົບ ແລະ ອອກຈາກລະບົບ')
        .addTag('pricing', 'TOR §3.1 — ຕັ້ງລາຄາ ແລະ ສູດຄິດໄລ່')
        .addTag('fees', 'TOR §3.2, §3.4 — ລາຄາລົບອອກ, ຄ່າປ່ຽນ, ຄ່າອ່ອນ')
        .addTag('rates', 'TOR §3.3 — ອັດຕາແລກປ່ຽນ')
        .addTag('catalog', 'TOR §3.5, §3.7 — ປະເພດຄຳ, ລາຍການຄຳ, ຕູ້ເຄື່ອງ, Supplier')
        .addTag('skus', 'TOR §3.6 — SKU ນ້ຳໜັກຂອງຄຳ')
        .addTag('cash', 'TOR §3.7, §4 — Cash, Bank, ເບີກ/ມອບເງິນ')
        .addTag('finance', 'TOR §3.7, §9 — ລາຍຮັບລາຍຈ່າຍ, ຝາກສິນຄ້າ, Advance, AP/AR (Cash)')
        .addTag('ledger', 'TOR §3.7, §8, §9 — COH, Wealth, WAC, AP/AR')
        .addTag('shifts', 'TOR §4, §5 — ເປີດ/ປິດກະ')
        .addTag('buyback', 'TOR §5.1 — ການຊື້ຄຳຄືນ')
        .addTag('exchange', 'TOR §5.2 — ປ່ຽນເປັນເງິນ')
        .addTag('credit', 'TOR §5.3 — ສິນເຊື່ອ')
        .addTag('orders', 'TOR §7 — Order')
        .addTag('stock', 'TOR §7.2–7.4 — Stock NEW/OLD ແລະ ຕິດຕາມ FACTORY')
        .addTag('notifications', 'TOR §10 — ແຈ້ງເຕືອນ ແລະ WhatsApp')
        .addTag('admin', 'TOR §3.7 — User Setting, Deleted List, Audit Log')
        .addTag('system', 'Health ແລະ ຄວາມພ້ອມຂອງລະບົບ')
        .build();
    const document = swagger_1.SwaggerModule.createDocument(app, config);
    swagger_1.SwaggerModule.setup('api/docs', app, document, {
        jsonDocumentUrl: 'api/docs-json',
        customSiteTitle: 'KPV API — Swagger',
        swaggerOptions: {
            // Keep the token across reloads so a session of poking at the API does
            // not need re-authorising after every refresh.
            persistAuthorization: true,
            docExpansion: 'none',
            filter: true,
            tagsSorter: 'alpha',
            operationsSorter: 'alpha',
        },
    });
    return '/api/docs';
}
//# sourceMappingURL=swagger.js.map