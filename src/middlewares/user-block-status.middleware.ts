import { Injectable, NestMiddleware } from "@nestjs/common";
import { Request, Response, NextFunction } from "express";
import { USER_BLOCK_STATUS_KEY } from "../constants/redis-key";
import * as jwt from 'jsonwebtoken';

export interface UserBlockStatusOptions {
  enabled?: boolean;
  redisClient?: any; // Redis client instance
  errorMessage?: string;
  jwtSecret?: string; // JWT secret for token verification
}

@Injectable()
export class UserBlockStatusMiddleware implements NestMiddleware {
  private readonly options: UserBlockStatusOptions & {
    enabled: boolean;
    errorMessage: string;
    jwtSecret?: string;
  };

  constructor(options: UserBlockStatusOptions = {}) {
    this.options = {
      enabled: options.enabled ?? true,
      redisClient: options.redisClient,
      errorMessage: options.errorMessage ?? 'User is blocked',
      jwtSecret: options.jwtSecret ?? process.env.JWT_SECRET
    };
  }

  use(req: Request, res: Response, next: NextFunction) {
    if (!this.options.enabled || !this.options.redisClient) {
      return next();
    }

    try {
      // Extract JWT token from Authorization header
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return next();
      }

      const token = authHeader.substring(7); // Remove 'Bearer ' prefix
      
      // Decode JWT token to get company_id
      const decodedToken = this.decodeJWT(token);
      if (!decodedToken || !decodedToken.company_id) {
        return next();
      }

      const companyId = decodedToken.company_id;
      
      // Generate Redis key by replacing $COMPANY_ID
      const redisKey = USER_BLOCK_STATUS_KEY.replace('$COMPANY_ID', companyId);
      
      // Check Redis for user block status
      this.options.redisClient.get(redisKey, (err: any, result: any) => {
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
          } catch (parseError) {
            console.error('Error parsing Redis data:', parseError);
          }
        }

        next();
      });
    } catch (error) {
      console.error('Error in UserBlockStatusMiddleware:', error);
      next();
    }
  }

  private decodeJWT(token: string): any {
    try {
      const secret = this.options.jwtSecret;
      if (!secret) {
        console.error('JWT secret is not provided in options or JWT_SECRET environment variable');
        return null;
      }

      // Verify and decode JWT using the secret
      const decoded = jwt.verify(token, secret);
      return decoded;
    } catch (error) {
      console.error('Error decoding JWT:', error);
      return null;
    }
  }
}