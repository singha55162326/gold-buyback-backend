"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DecimalSerializerInterceptor = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const rxjs_1 = require("rxjs");
/**
 * Prisma Decimals serialise to JSON as objects, and JS numbers cannot hold
 * DECIMAL(18,4) safely. Every Decimal therefore leaves the API as a STRING,
 * and the web client parses it back into a Decimal — money and weight never
 * pass through a float on the way to the browser.
 */
function serialize(value) {
    if (value === null || value === undefined)
        return value;
    if (client_1.Prisma.Decimal.isDecimal(value))
        return value.toFixed();
    if (value instanceof Date)
        return value.toISOString();
    if (Array.isArray(value))
        return value.map(serialize);
    if (typeof value === 'object') {
        const out = {};
        for (const [k, v] of Object.entries(value)) {
            out[k] = serialize(v);
        }
        return out;
    }
    return value;
}
let DecimalSerializerInterceptor = class DecimalSerializerInterceptor {
    intercept(_context, next) {
        return next.handle().pipe((0, rxjs_1.map)(serialize));
    }
};
exports.DecimalSerializerInterceptor = DecimalSerializerInterceptor;
exports.DecimalSerializerInterceptor = DecimalSerializerInterceptor = __decorate([
    (0, common_1.Injectable)()
], DecimalSerializerInterceptor);
//# sourceMappingURL=decimal-serializer.interceptor.js.map