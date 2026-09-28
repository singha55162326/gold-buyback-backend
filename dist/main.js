"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const app_module_1 = require("./app.module");
const swagger_1 = require("./swagger");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    app.setGlobalPrefix('api');
    app.enableCors({
        origin: process.env.CORS_ORIGIN?.split(',') ?? ['http://localhost:3000'],
        credentials: true,
    });
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
    }));
    const docsPath = (0, swagger_1.setupSwagger)(app);
    const port = Number(process.env.API_PORT ?? 4000);
    await app.listen(port);
    const log = new common_1.Logger('Bootstrap');
    log.log(`KPV API listening on http://localhost:${port}/api`);
    if (docsPath)
        log.log(`Swagger UI      http://localhost:${port}${docsPath}`);
}
void bootstrap();
//# sourceMappingURL=main.js.map