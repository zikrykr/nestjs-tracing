"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Trace = Trace;
exports.TraceAsync = TraceAsync;
const api_1 = require("@opentelemetry/api");
const common_1 = require("@nestjs/common");
function Trace(options) {
    return function (target, propertyName, descriptor) {
        const method = descriptor.value;
        const tracer = api_1.trace.getTracer(target.constructor.name);
        const logger = new common_1.Logger('TraceDecorator');
        const config = typeof options === 'string'
            ? { spanName: options }
            : (options || {});
        const defaultOptions = {
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
        };
        const finalOptions = { ...defaultOptions, ...config };
        descriptor.value = async function (...args) {
            const finalSpanName = finalOptions.spanName;
            return tracer.startActiveSpan(finalSpanName, async (span) => {
                const spanId = span.spanContext().spanId;
                const traceId = span.spanContext().traceId;
                const startTime = Date.now();
                const spanData = {
                    spanId,
                    traceId,
                    spanName: finalSpanName,
                    startTime: new Date().toISOString(),
                    attributes: {},
                    events: [],
                    status: null,
                    error: null,
                    duration: null
                };
                try {
                    const attributes = {
                        'service.name': target.constructor.name,
                        'method.name': propertyName,
                        'method.args.count': args.length,
                        'teams.alert.enabled': true,
                        'teams.alert.severity': finalOptions.severity,
                        'teams.alert.business_impact': finalOptions.businessImpact,
                        'teams.alert.user_affected': finalOptions.userAffected,
                        ...finalOptions.customContext,
                    };
                    span.setAttributes(attributes);
                    spanData.attributes = { ...spanData.attributes, ...attributes };
                    if (finalOptions.includeArgs) {
                        args.forEach((arg, index) => {
                            if (arg && typeof arg === 'object' && !Buffer.isBuffer(arg)) {
                                const safeKeys = ['id', 'type', 'status', 'name', 'code', 'userId', 'companyId'];
                                const argAttributes = {};
                                safeKeys.forEach(key => {
                                    if (arg[key] !== undefined) {
                                        argAttributes[`method.arg.${index}.${key}`] = String(arg[key]);
                                    }
                                });
                                if (Object.keys(argAttributes).length > 0) {
                                    span.setAttributes(argAttributes);
                                    spanData.attributes = { ...spanData.attributes, ...argAttributes };
                                }
                            }
                        });
                    }
                    const startEvent = {
                        timestamp: new Date().toISOString(),
                    };
                    span.addEvent('method.execution.start', startEvent);
                    spanData.events.push({ name: 'method.execution.start', data: startEvent });
                    const result = await method.apply(this, args);
                    const successEvent = {
                        timestamp: new Date().toISOString(),
                    };
                    span.addEvent('method.execution.success', successEvent);
                    spanData.events.push({ name: 'method.execution.success', data: successEvent });
                    span.setStatus({ code: api_1.SpanStatusCode.OK });
                    spanData.status = { code: 'OK', message: 'Success' };
                    return result;
                }
                catch (error) {
                    const errorStatus = {
                        code: api_1.SpanStatusCode.ERROR,
                        message: error instanceof Error ? error.message : String(error),
                    };
                    span.setStatus(errorStatus);
                    spanData.status = { code: 'ERROR', message: error.message };
                    span.recordException(error);
                    spanData.error = {
                        message: error.message,
                        type: error.constructor.name,
                        stack: error.stack
                    };
                    const errorAttributes = {
                        'error': true,
                        'error.type': error.constructor.name,
                    };
                    span.setAttributes(errorAttributes);
                    spanData.attributes = { ...spanData.attributes, ...errorAttributes };
                    if (finalOptions.alertOnError) {
                        await this.sendUnifiedAlert(span, error, finalOptions, target.constructor.name, propertyName);
                    }
                    throw error;
                }
                finally {
                    spanData.duration = Date.now() - startTime;
                    logger.log(`Service Span Complete: ${JSON.stringify(spanData, null, 2)}`);
                    span.end();
                }
            });
        };
        descriptor.value.sendUnifiedAlert = async function (span, error, options, className, methodName) {
            try {
                const unifiedAlertService = this.unifiedAlertService;
                if (!unifiedAlertService) {
                    logger.warn('UnifiedAlertService not available, skipping alert');
                    return;
                }
                const spanContext = span.spanContext();
                const traceId = spanContext.traceId;
                const spanId = spanContext.spanId;
                const userContext = this.extractUserContext(span, options);
                const httpContext = this.extractHttpContext(span, options);
                const alertData = {
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
                const isCritical = this.isCriticalError(error, options);
                if (isCritical && options.alertOnCriticalError) {
                    await unifiedAlertService.sendCriticalErrorAlert(alertData);
                }
                else if (options.alertOnError) {
                    await unifiedAlertService.sendErrorAlert(alertData);
                }
            }
            catch (alertError) {
                logger.error('Failed to send unified alert:', alertError);
            }
        };
        descriptor.value.extractUserContext = function (span, options) {
            if (!options.includeUserContext)
                return {};
            const attributes = span.attributes || {};
            return {
                userId: attributes['user.id'] || attributes['user_id'] || attributes['userId'],
                companyId: attributes['company.id'] || attributes['company_id'] || attributes['companyId'],
            };
        };
        descriptor.value.extractHttpContext = function (span, options) {
            if (!options.includeHttpContext)
                return {};
            const attributes = span.attributes || {};
            return {
                httpMethod: attributes['http.method'],
                httpUrl: attributes['http.url'],
            };
        };
        descriptor.value.isCriticalError = function (error, options) {
            if (options.severity === 'critical' || options.businessImpact === 'critical') {
                return true;
            }
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
                if (criticalKeywords.some(keyword => error.message.toLowerCase().includes(keyword))) {
                    return true;
                }
            }
            if (error.critical === true || error.severity === 'critical') {
                return true;
            }
            return false;
        };
        return descriptor;
    };
}
function TraceAsync(spanName) {
    return Trace({ spanName });
}
//# sourceMappingURL=trace.decorator.js.map