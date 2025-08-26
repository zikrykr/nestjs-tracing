import { NestMiddleware } from "@nestjs/common";
import { Request, Response, NextFunction } from "express";
export interface CorsOptions {
    enabled?: boolean;
    origin?: string | string[] | boolean;
    methods?: string[];
    allowedHeaders?: string[];
    credentials?: boolean;
    maxAge?: number;
}
export declare class CorsMiddleware implements NestMiddleware {
    private readonly options;
    constructor(options?: CorsOptions);
    use(req: Request, res: Response, next: NextFunction): void | Response<any, Record<string, any>>;
    private getOrigin;
}
