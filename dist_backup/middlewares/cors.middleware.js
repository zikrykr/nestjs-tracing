"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CorsMiddleware = void 0;
const common_1 = require("@nestjs/common");
let CorsMiddleware = class CorsMiddleware {
    options;
    constructor(options = {}) {
        this.options = {
            enabled: options.enabled ?? true,
            origin: options.origin ?? '*',
            methods: options.methods ?? ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
            allowedHeaders: options.allowedHeaders ?? ['Content-Type', 'Authorization', 'X-Requested-With'],
            credentials: options.credentials ?? false,
            maxAge: options.maxAge ?? 86400
        };
    }
    use(req, res, next) {
        if (!this.options.enabled) {
            return next();
        }
        if (req.method === 'OPTIONS') {
            res.header('Access-Control-Allow-Origin', this.getOrigin(req));
            res.header('Access-Control-Allow-Methods', this.options.methods.join(', '));
            res.header('Access-Control-Allow-Headers', this.options.allowedHeaders.join(', '));
            res.header('Access-Control-Max-Age', this.options.maxAge.toString());
            if (this.options.credentials) {
                res.header('Access-Control-Allow-Credentials', 'true');
            }
            return res.status(200).end();
        }
        res.header('Access-Control-Allow-Origin', this.getOrigin(req));
        res.header('Access-Control-Allow-Methods', this.options.methods.join(', '));
        res.header('Access-Control-Allow-Headers', this.options.allowedHeaders.join(', '));
        if (this.options.credentials) {
            res.header('Access-Control-Allow-Credentials', 'true');
        }
        next();
    }
    getOrigin(req) {
        if (this.options.origin === '*') {
            return '*';
        }
        if (typeof this.options.origin === 'string') {
            return this.options.origin;
        }
        if (Array.isArray(this.options.origin)) {
            const requestOrigin = req.headers.origin;
            if (requestOrigin && this.options.origin.includes(requestOrigin)) {
                return requestOrigin;
            }
            return this.options.origin[0] || '*';
        }
        return '*';
    }
};
exports.CorsMiddleware = CorsMiddleware;
exports.CorsMiddleware = CorsMiddleware = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [Object])
], CorsMiddleware);
//# sourceMappingURL=cors.middleware.js.map