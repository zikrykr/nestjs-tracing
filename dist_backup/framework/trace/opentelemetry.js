"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupOpenTelemetry = setupOpenTelemetry;
const sdk_node_1 = require("@opentelemetry/sdk-node");
const exporter_trace_otlp_http_1 = require("@opentelemetry/exporter-trace-otlp-http");
const resources_1 = require("@opentelemetry/resources");
const semantic_conventions_1 = require("@opentelemetry/semantic-conventions");
const instrumentation_http_1 = require("@opentelemetry/instrumentation-http");
const instrumentation_express_1 = require("@opentelemetry/instrumentation-express");
const instrumentation_amqplib_1 = require("@opentelemetry/instrumentation-amqplib");
const common_1 = require("@nestjs/common");
function setupOpenTelemetry(config) {
    const logger = new common_1.Logger('OpenTelemetry');
    logger.log('Initializing OpenTelemetry tracing...');
    const finalConfig = {
        serviceName: config?.serviceName || process.env.SERVICE_NAME || process.env.APP_NAME || 'unknown-service',
        serviceVersion: config?.serviceVersion || process.env.SERVICE_VERSION || process.env.APP_VERSION || '1.0.0',
        environment: config?.environment || process.env.NODE_ENV || process.env.ENVIRONMENT || 'development',
        otlpEndpoint: config?.otlpEndpoint || process.env.OTLP_ENDPOINT || 'http://localhost:4318/v1/traces',
        otlpHeaders: config?.otlpHeaders || process.env.OTLP_HEADERS || '',
    };
    const sdk = new sdk_node_1.NodeSDK({
        resource: new resources_1.Resource({
            [semantic_conventions_1.ATTR_SERVICE_NAME]: finalConfig.serviceName,
            [semantic_conventions_1.ATTR_SERVICE_VERSION]: finalConfig.serviceVersion,
            'deployment.environment': finalConfig.environment,
        }),
        traceExporter: new exporter_trace_otlp_http_1.OTLPTraceExporter({
            url: finalConfig.otlpEndpoint,
            headers: finalConfig.otlpHeaders ? {
                'Authorization': finalConfig.otlpHeaders,
            } : undefined,
        }),
        instrumentations: [
            new instrumentation_http_1.HttpInstrumentation(),
            new instrumentation_express_1.ExpressInstrumentation(),
            new instrumentation_amqplib_1.AmqplibInstrumentation(),
        ],
    });
    sdk.start();
    logger.log('OpenTelemetry tracing initialized successfully');
    logger.log(`Service name: ${finalConfig.serviceName}`);
    logger.log(`Traces will be sent to: ${finalConfig.otlpEndpoint}`);
    logger.log('Instrumentations enabled: HTTP, Express, RabbitMQ');
    process.on('SIGTERM', () => {
        logger.log('Shutting down OpenTelemetry tracing...');
        sdk
            .shutdown()
            .then(() => logger.log('Tracing terminated successfully'))
            .catch((error) => logger.error('Error terminating tracing:', error))
            .finally(() => process.exit(0));
    });
    return sdk;
}
//# sourceMappingURL=opentelemetry.js.map