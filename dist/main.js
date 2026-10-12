"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const app_module_1 = require("./app.module");
const swagger_1 = require("./swagger");
const shop_timezone_1 = require("./common/shop-timezone");
async function bootstrap() {
    // Before anything can record a transaction,
    // make sure the host can date it.
    (0, shop_timezone_1.assertShopTimezone)();
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    // Global API prefix
    app.setGlobalPrefix('api');
    // CORS
    const allowedOrigins = (process.env.CORS_ORIGIN ?? '')
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean);
    app.enableCors({
        origin: (origin, callback) => {
            // Allow requests without Origin header
            if (!origin) {
                return callback(null, true);
            }
            if (allowedOrigins.includes(origin)) {
                return callback(null, true);
            }
            return callback(new Error(`CORS blocked: ${origin}`), false);
        },
        credentials: true,
        methods: [
            'GET',
            'HEAD',
            'PUT',
            'PATCH',
            'POST',
            'DELETE',
            'OPTIONS',
        ],
        allowedHeaders: [
            'Content-Type',
            'Authorization',
            'Accept',
            'Origin',
            'X-Requested-With',
        ],
    });
    // Global validation
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
    }));
    // Swagger
    (0, swagger_1.setupSwagger)(app);
    // Listen on all network interfaces
    const port = process.env.API_PORT || 4000;
    await app.listen(port, '0.0.0.0');
    common_1.Logger.log(`API running on http://0.0.0.0:${port}`);
    common_1.Logger.log(`Allowed CORS origins: ${allowedOrigins.join(', ')}`);
}
bootstrap();
//# sourceMappingURL=main.js.map