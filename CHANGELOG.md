# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2024-01-01

### Added
- Initial release of @ce-service/core
- OpenTelemetry tracing setup with configuration
- Tracing decorators (@Trace, @TraceAsync)
- TracingService for manual span management
- TracingInterceptor for automatic HTTP request/response tracing
- RequestLoggingMiddleware for HTTP request logging
- CorsMiddleware for CORS handling
- UserBlockStatusMiddleware for user block status checking
- Full TypeScript support with proper type definitions
- Comprehensive documentation and usage examples

### Features
- 🔍 OpenTelemetry Tracing with decorators, interceptors, and service utilities
- 🛡️ Security middlewares for user block status checking and request logging
- 🎯 Easy-to-use tracing decorators for automatic span creation
- 📊 Built-in request/response logging and performance monitoring
- 🔧 Full TypeScript support with proper type definitions 