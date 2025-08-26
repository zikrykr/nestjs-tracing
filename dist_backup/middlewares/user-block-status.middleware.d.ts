import { NestMiddleware } from "@nestjs/common";
import { Request, Response, NextFunction } from "express";
export interface UserBlockStatusOptions {
    enabled?: boolean;
    redisClient?: any;
    errorMessage?: string;
    jwtSecret?: string;
}
export declare class UserBlockStatusMiddleware implements NestMiddleware {
    private readonly options;
    constructor(options?: UserBlockStatusOptions);
    use(req: Request, res: Response, next: NextFunction): void;
    private decodeJWT;
}
