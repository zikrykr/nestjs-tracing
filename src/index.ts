// Main entry point for the middleware package
export * from './middlewares';

// Export decorators
export * from './decorators/trace.decorator';

// Export trace framework
export * from './framework/trace/opentelemetry';
export * from './framework/alert/teams-alert.service';
export * from './framework/alert/slack-alert.service';
export * from './framework/alert/google-chat-alert.service';
export * from './framework/alert/unified-alert.service';
export * from './framework/alert/alert.interface';
export * from './framework/setup';

// Export constants
export * from './constants/redis-key';

// Re-export common NestJS types that might be needed
export { Injectable, NestMiddleware } from '@nestjs/common';
export type { NextFunction } from 'express';

// Export version for consumers
export const VERSION = '1.0.0'; 