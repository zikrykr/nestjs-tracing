import { Injectable, NestMiddleware } from "@nestjs/common";
import { Request, Response, NextFunction } from "express";

export interface CorsOptions {
  enabled?: boolean;
  origin?: string | string[] | boolean;
  methods?: string[];
  allowedHeaders?: string[];
  credentials?: boolean;
  maxAge?: number;
}

@Injectable()
export class CorsMiddleware implements NestMiddleware {
  private readonly options: Required<CorsOptions>;

  constructor(options: CorsOptions = {}) {
    this.options = {
      enabled: options.enabled ?? true,
      origin: options.origin ?? '*',
      methods: options.methods ?? ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: options.allowedHeaders ?? ['Content-Type', 'Authorization', 'X-Requested-With'],
      credentials: options.credentials ?? false,
      maxAge: options.maxAge ?? 86400 // 24 hours
    };
  }

  use(req: Request, res: Response, next: NextFunction) {
    if (!this.options.enabled) {
      return next();
    }

    // Handle preflight requests
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

    // Handle actual requests
    res.header('Access-Control-Allow-Origin', this.getOrigin(req));
    res.header('Access-Control-Allow-Methods', this.options.methods.join(', '));
    res.header('Access-Control-Allow-Headers', this.options.allowedHeaders.join(', '));
    
    if (this.options.credentials) {
      res.header('Access-Control-Allow-Credentials', 'true');
    }

    next();
  }

  private getOrigin(req: Request): string {
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
} 