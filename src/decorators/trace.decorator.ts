import { trace, SpanStatusCode } from '@opentelemetry/api';
import { Logger } from '@nestjs/common';
import { UnifiedAlertService } from '../framework/alert/unified-alert.service';
import { ErrorAlertData } from '../framework/alert/alert.interface';

interface SpanEvent {
  name: string;
  data: any;
}

interface SpanStatus {
  code: string;
  message: string;
}

interface SpanError {
  message: string;
  type: string;
  stack?: string;
}

interface SpanData {
  spanId: string;
  traceId: string;
  spanName: string;
  startTime: string;
  attributes: Record<string, any>;
  events: SpanEvent[];
  status: SpanStatus | null;
  error: SpanError | null;
  duration: number | null;
}

export interface TraceOptions {
  // Teams alerting options (enabled by default)
  alertOnError?: boolean;
  alertOnCriticalError?: boolean;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  businessImpact?: 'low' | 'medium' | 'high' | 'critical';
  userAffected?: boolean;
  customContext?: Record<string, any>;

  // Tracing options
  spanName?: string;
  includeArgs?: boolean;
  includeUserContext?: boolean;
  includeHttpContext?: boolean;

  // Body capture options
  includeRequestBody?: boolean;
  includeResponseBody?: boolean;
  includeErrorBody?: boolean;
  maxBodySize?: number; // Maximum size of body to capture (in characters)
  sensitiveFields?: string[]; // Fields to redact from bodies
}

/**
 * Decorator to automatically trace service methods with Teams alerting enabled by default
 * Usage: @Trace() or @Trace({ severity: 'critical', businessImpact: 'high' })
 */
export function Trace(options?: TraceOptions | string) {
  return function (
    target: any,
    propertyName: string,
    descriptor: PropertyDescriptor,
  ) {
    const method = descriptor.value;
    const tracer = trace.getTracer(target.constructor.name);
    const logger = new Logger('TraceDecorator');

    // Handle both string (legacy) and object (new) parameter styles
    const config: TraceOptions =
      typeof options === 'string' ? { spanName: options } : options || {};

    // Default options
    const defaultOptions: Required<TraceOptions> = {
      alertOnError: true,
      alertOnCriticalError: true,
      severity: 'medium',
      businessImpact: 'medium',
      userAffected: false,
      customContext: {},
      spanName: `${target.constructor.name}.${propertyName}`,
      includeArgs: true,
      includeUserContext: true,
      includeHttpContext: true,
      includeRequestBody: true,
      includeResponseBody: true,
      includeErrorBody: true,
      maxBodySize: 1000, // Default max body size
      sensitiveFields: ['password', 'token', 'secret', 'key', 'authorization'],
    };

    const finalOptions = { ...defaultOptions, ...config };

    descriptor.value = async function (...args: any[]) {
      const finalSpanName = finalOptions.spanName;

      return tracer.startActiveSpan(finalSpanName, async (span) => {
        const spanId = span.spanContext().spanId;
        const traceId = span.spanContext().traceId;
        const startTime = Date.now();

        // Collect span data for logging
        const spanData: SpanData = {
          spanId,
          traceId,
          spanName: finalSpanName,
          startTime: new Date().toISOString(),
          attributes: {},
          events: [],
          status: null,
          error: null,
          duration: null,
        };

        try {
          // Add method-specific attributes
          const attributes = {
            'service.name': target.constructor.name,
            'method.name': propertyName,
            'method.args.count': args.length,
            // Teams alert attributes (always enabled)
            'teams.alert.enabled': true,
            'teams.alert.severity': finalOptions.severity,
            'teams.alert.business_impact': finalOptions.businessImpact,
            'teams.alert.user_affected': finalOptions.userAffected,
            ...finalOptions.customContext,
          };

          span.setAttributes(attributes);
          spanData.attributes = { ...spanData.attributes, ...attributes };

          // Add method arguments as attributes (be careful with sensitive data)
          if (finalOptions.includeArgs) {
            args.forEach((arg, index) => {
              if (arg && typeof arg === 'object' && !Buffer.isBuffer(arg)) {
                // Only add safe attributes
                const safeKeys = [
                  'id',
                  'type',
                  'status',
                  'name',
                  'code',
                  'userId',
                  'companyId',
                ];
                const argAttributes: Record<string, any> = {};
                safeKeys.forEach((key) => {
                  if (arg[key] !== undefined) {
                    argAttributes[`method.arg.${index}.${key}`] = String(
                      arg[key],
                    );
                  }
                });
                if (Object.keys(argAttributes).length > 0) {
                  span.setAttributes(argAttributes);
                  spanData.attributes = {
                    ...spanData.attributes,
                    ...argAttributes,
                  };
                }

                // Extract request body if this looks like a request object
                if (
                  finalOptions.includeRequestBody &&
                  this.isRequestObject(arg)
                ) {
                  const requestBody = this.extractAndSanitizeBody(
                    arg,
                    finalOptions,
                  );
                  if (requestBody) {
                    const bodyAttributes = {
                      'request.body': requestBody,
                      'request.body.size': requestBody.length,
                    };
                    span.setAttributes(bodyAttributes);
                    spanData.attributes = {
                      ...spanData.attributes,
                      ...bodyAttributes,
                    };
                  }
                }
              }
            });
          }

          const startEvent = {
            timestamp: new Date().toISOString(),
          };
          span.addEvent('method.execution.start', startEvent);
          spanData.events.push({
            name: 'method.execution.start',
            data: startEvent,
          });

          const result = await method.apply(this, args);

          // Extract response body if enabled
          if (finalOptions.includeResponseBody && result) {
            const responseBody = this.extractAndSanitizeBody(
              result,
              finalOptions,
            );
            if (responseBody) {
              const bodyAttributes = {
                'response.body': responseBody,
                'response.body.size': responseBody.length,
              };
              span.setAttributes(bodyAttributes);
              spanData.attributes = {
                ...spanData.attributes,
                ...bodyAttributes,
              };
            }
          }

          const successEvent = {
            timestamp: new Date().toISOString(),
          };
          span.addEvent('method.execution.success', successEvent);
          spanData.events.push({
            name: 'method.execution.success',
            data: successEvent,
          });

          span.setStatus({ code: SpanStatusCode.OK });
          spanData.status = { code: 'OK', message: 'Success' };

          return result;
        } catch (error) {
          const errorStatus = {
            code: SpanStatusCode.ERROR,
            message: error instanceof Error ? error.message : String(error),
          };
          span.setStatus(errorStatus);
          spanData.status = { code: 'ERROR', message: error.message };

          span.recordException(error);
          spanData.error = {
            message: error.message,
            type: error.constructor.name,
            stack: error.stack,
          };

          const errorAttributes = {
            error: true,
            'error.type': error.constructor.name,
          };

          // Extract error body if enabled
          if (finalOptions.includeErrorBody && error) {
            const errorBody = this.extractAndSanitizeBody(error, finalOptions);
            if (errorBody) {
              errorAttributes['error.body'] = errorBody;
              errorAttributes['error.body.size'] = errorBody.length;
            }
          }

          span.setAttributes(errorAttributes);
          spanData.attributes = { ...spanData.attributes, ...errorAttributes };

          // Send unified alert (always enabled by default)
          if (finalOptions.alertOnError) {
            await this.sendUnifiedAlert(
              span,
              error,
              finalOptions,
              target.constructor.name,
              propertyName,
            );
          }

          throw error;
        } finally {
          spanData.duration = Date.now() - startTime;
          logger.log(
            `Service Span Complete: ${JSON.stringify(spanData, null, 2)}`,
          );
          span.end();
        }
      });
    };

    // Add unified alert method to the decorated function
    descriptor.value.sendUnifiedAlert = async function (
      span: any,
      error: any,
      options: TraceOptions,
      className: string,
      methodName: string,
    ): Promise<void> {
      try {
        // Try to get UnifiedAlertService from the instance
        const unifiedAlertService = (this as any).unifiedAlertService;

        if (!unifiedAlertService) {
          logger.warn('UnifiedAlertService not available, skipping alert');
          return;
        }

        const spanContext = span.spanContext();
        const traceId = spanContext.traceId;
        const spanId = spanContext.spanId;

        // Extract context from span attributes
        const userContext = this.extractUserContext(span, options);
        const httpContext = this.extractHttpContext(span, options);

        const alertData: ErrorAlertData = {
          error,
          traceId,
          spanId,
          serviceName: className,
          methodName,
          ...userContext,
          ...httpContext,
          additionalContext: {
            spanName: span.name,
            spanStartTime: span.startTime?.toString(),
            spanEndTime: span.endTime?.toString(),
            severity: options.severity,
            businessImpact: options.businessImpact,
            userAffected: options.userAffected,
            ...options.customContext,
          },
        };

        // Determine if this is a critical error
        const isCritical = this.isCriticalError(error, options);

        if (isCritical && options.alertOnCriticalError) {
          await unifiedAlertService.sendCriticalErrorAlert(alertData);
        } else if (options.alertOnError) {
          await unifiedAlertService.sendErrorAlert(alertData);
        }
      } catch (alertError) {
        logger.error('Failed to send unified alert:', alertError);
      }
    };

    // Add helper methods to the class instance (target) instead of descriptor.value
    if (!target.extractUserContext) {
      target.extractUserContext = function (
        span: any,
        options: TraceOptions,
      ): { userId?: string; companyId?: string } {
        if (!options.includeUserContext) return {};

        const attributes = span.attributes || {};

        return {
          userId:
            attributes['user.id'] ||
            attributes['user_id'] ||
            attributes['userId'],
          companyId:
            attributes['company.id'] ||
            attributes['company_id'] ||
            attributes['companyId'],
        };
      };
    }

    if (!target.extractHttpContext) {
      target.extractHttpContext = function (
        span: any,
        options: TraceOptions,
      ): { httpMethod?: string; httpUrl?: string } {
        if (!options.includeHttpContext) return {};

        const attributes = span.attributes || {};

        return {
          httpMethod: attributes['http.method'],
          httpUrl: attributes['http.url'],
        };
      };
    }

    if (!target.isCriticalError) {
      target.isCriticalError = function (
        error: any,
        options: TraceOptions,
      ): boolean {
        // Check if explicitly marked as critical
        if (
          options.severity === 'critical' ||
          options.businessImpact === 'critical'
        ) {
          return true;
        }

        // Check error type
        if (error instanceof Error) {
          const criticalErrorTypes = [
            'DatabaseConnectionError',
            'AuthenticationError',
            'AuthorizationError',
            'ValidationError',
            'TimeoutError',
            'NetworkError',
            'PaymentProcessingError',
            'CriticalBusinessError',
          ];

          if (criticalErrorTypes.includes(error.constructor.name)) {
            return true;
          }

          // Check error message for critical keywords
          const criticalKeywords = [
            'connection failed',
            'authentication failed',
            'authorization failed',
            'timeout',
            'network error',
            'database error',
            'critical',
            'fatal',
            'payment failed',
            'transaction failed',
          ];

          if (
            criticalKeywords.some((keyword) =>
              error.message.toLowerCase().includes(keyword),
            )
          ) {
            return true;
          }
        }

        // Check if error has critical indicators
        if (
          (error as any).critical === true ||
          (error as any).severity === 'critical'
        ) {
          return true;
        }

        return false;
      };
    }

    // Add body extraction helper methods to the class instance
    if (!target.isRequestObject) {
      target.isRequestObject = function (obj: any): boolean {
        // Check if this looks like a request object
        return (
          obj &&
          (obj.body !== undefined ||
            obj.params !== undefined ||
            obj.query !== undefined ||
            obj.headers !== undefined ||
            obj.method !== undefined ||
            obj.url !== undefined ||
            obj.path !== undefined)
        );
      };
    }

    if (!target.extractAndSanitizeBody) {
      target.extractAndSanitizeBody = function (
        obj: any,
        options: TraceOptions,
      ): string | null {
        if (!obj || typeof obj !== 'object') {
          return null;
        }

        let body: any = null;

        // Extract body from different possible locations
        if (obj.body !== undefined) {
          body = obj.body;
        } else if (obj.data !== undefined) {
          body = obj.data;
        } else if (obj.payload !== undefined) {
          body = obj.payload;
        } else if (obj.requestBody !== undefined) {
          body = obj.requestBody;
        } else if (obj.responseBody !== undefined) {
          body = obj.responseBody;
        } else if (obj.errorBody !== undefined) {
          body = obj.errorBody;
        } else {
          // If no specific body field, try to use the object itself
          body = obj;
        }

        if (!body) {
          return null;
        }

        // Convert to string if it's not already
        let bodyString: string;
        if (typeof body === 'string') {
          bodyString = body;
        } else if (typeof body === 'object') {
          try {
            bodyString = JSON.stringify(body);
          } catch {
            bodyString = String(body);
          }
        } else {
          bodyString = String(body);
        }

        // Sanitize sensitive fields
        if (options.sensitiveFields && options.sensitiveFields.length > 0) {
          try {
            const bodyObj = JSON.parse(bodyString);
            const sanitized = this.sanitizeSensitiveFields(
              bodyObj,
              options.sensitiveFields,
            );
            bodyString = JSON.stringify(sanitized);
          } catch {
            // If parsing fails, try to sanitize as string
            bodyString = this.sanitizeString(
              bodyString,
              options.sensitiveFields,
            );
          }
        }

        // Truncate if too long
        if (options.maxBodySize && bodyString.length > options.maxBodySize) {
          bodyString =
            bodyString.substring(0, options.maxBodySize) + '... [truncated]';
        }

        return bodyString;
      };
    }

    if (!target.sanitizeSensitiveFields) {
      target.sanitizeSensitiveFields = function (
        obj: any,
        sensitiveFields: string[],
      ): any {
        if (Array.isArray(obj)) {
          return obj.map((item) =>
            this.sanitizeSensitiveFields(item, sensitiveFields),
          );
        }

        if (obj && typeof obj === 'object') {
          const sanitized: any = {};
          for (const [key, value] of Object.entries(obj)) {
            if (
              sensitiveFields.some((field) =>
                key.toLowerCase().includes(field.toLowerCase()),
              )
            ) {
              sanitized[key] = '[REDACTED]';
            } else {
              sanitized[key] = this.sanitizeSensitiveFields(
                value,
                sensitiveFields,
              );
            }
          }
          return sanitized;
        }

        return obj;
      };
    }

    if (!target.sanitizeString) {
      target.sanitizeString = function (
        str: string,
        sensitiveFields: string[],
      ): string {
        let sanitized = str;
        for (const field of sensitiveFields) {
          const regex = new RegExp(`"${field}"\\s*:\\s*"[^"]*"`, 'gi');
          sanitized = sanitized.replace(regex, `"${field}": "[REDACTED]"`);
        }
        return sanitized;
      };
    }

    return descriptor;
  };
}

/**
 * Decorator to trace async operations with custom span name
 * Usage: @TraceAsync('custom.operation.name')
 */
export function TraceAsync(spanName: string) {
  return Trace({ spanName });
}

// All unified alerting is now enabled by default in the main @Trace decorator 