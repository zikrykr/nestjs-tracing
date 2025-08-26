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
exports.UserBlockStatusMiddleware = void 0;
const common_1 = require("@nestjs/common");
const redis_key_1 = require("../constants/redis-key");
const jwt = require("jsonwebtoken");
let UserBlockStatusMiddleware = class UserBlockStatusMiddleware {
    options;
    constructor(options = {}) {
        this.options = {
            enabled: options.enabled ?? true,
            redisClient: options.redisClient,
            errorMessage: options.errorMessage ?? 'User is blocked',
            jwtSecret: options.jwtSecret ?? process.env.JWT_SECRET
        };
    }
    use(req, res, next) {
        if (!this.options.enabled || !this.options.redisClient) {
            return next();
        }
        try {
            const authHeader = req.headers.authorization;
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                return next();
            }
            const token = authHeader.substring(7);
            const decodedToken = this.decodeJWT(token);
            if (!decodedToken || !decodedToken.company_id) {
                return next();
            }
            const companyId = decodedToken.company_id;
            const redisKey = redis_key_1.USER_BLOCK_STATUS_KEY.replace('$COMPANY_ID', companyId);
            this.options.redisClient.get(redisKey, (err, result) => {
                if (err) {
                    console.error('Redis error:', err);
                    return next();
                }
                if (result) {
                    try {
                        const userData = JSON.parse(result);
                        if (userData.is_blocked === true) {
                            return res.status(403).json({
                                error: 'Forbidden',
                                message: this.options.errorMessage,
                                timestamp: new Date().toISOString(),
                                company_id: companyId
                            });
                        }
                    }
                    catch (parseError) {
                        console.error('Error parsing Redis data:', parseError);
                    }
                }
                next();
            });
        }
        catch (error) {
            console.error('Error in UserBlockStatusMiddleware:', error);
            next();
        }
    }
    decodeJWT(token) {
        try {
            const secret = this.options.jwtSecret;
            if (!secret) {
                console.error('JWT secret is not provided in options or JWT_SECRET environment variable');
                return null;
            }
            const decoded = jwt.verify(token, secret);
            return decoded;
        }
        catch (error) {
            console.error('Error decoding JWT:', error);
            return null;
        }
    }
};
exports.UserBlockStatusMiddleware = UserBlockStatusMiddleware;
exports.UserBlockStatusMiddleware = UserBlockStatusMiddleware = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [Object])
], UserBlockStatusMiddleware);
//# sourceMappingURL=user-block-status.middleware.js.map