// Export all middlewares
export * from './user-block-status.middleware';
export * from './cors.middleware';

// Export middleware types and interfaces
export interface MiddlewareOptions {
  // Add common middleware options here
  enabled?: boolean;
  priority?: number;
}

// Export middleware factory functions for easier usage
export { UserBlockStatusMiddleware } from './user-block-status.middleware';
export { CorsMiddleware } from './cors.middleware';
