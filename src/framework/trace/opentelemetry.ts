import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { Resource } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';
import { AmqplibInstrumentation } from '@opentelemetry/instrumentation-amqplib';
import { Logger } from '@nestjs/common';

export interface OpenTelemetryConfig {
  serviceName: string;
  serviceVersion?: string;
  environment: string;
  otlpEndpoint: string;
  otlpHeaders?: string;
}

export function setupOpenTelemetry(config?: Partial<OpenTelemetryConfig>) {
  const logger = new Logger('OpenTelemetry');
  logger.log('Initializing OpenTelemetry tracing...');
  
  // Use provided config or fall back to environment variables
  const finalConfig: OpenTelemetryConfig = {
    serviceName: config?.serviceName || process.env.SERVICE_NAME || process.env.APP_NAME || 'unknown-service',
    serviceVersion: config?.serviceVersion || process.env.SERVICE_VERSION || process.env.APP_VERSION || '1.0.0',
    environment: config?.environment || process.env.NODE_ENV || process.env.ENVIRONMENT || 'development',
    otlpEndpoint: config?.otlpEndpoint || process.env.OTLP_ENDPOINT || 'http://localhost:4318/v1/traces',
    otlpHeaders: config?.otlpHeaders || process.env.OTLP_HEADERS || '',
  };
  
  const sdk = new NodeSDK({
    resource: new Resource({
      [ATTR_SERVICE_NAME]: finalConfig.serviceName,
      [ATTR_SERVICE_VERSION]: finalConfig.serviceVersion,
      'deployment.environment': finalConfig.environment,
    }),
    traceExporter: new OTLPTraceExporter({
      url: finalConfig.otlpEndpoint,
      headers: finalConfig.otlpHeaders ? {
        'Authorization': finalConfig.otlpHeaders,
      } : undefined,
    }),
    instrumentations: [
      new HttpInstrumentation(),
      new ExpressInstrumentation(),
      new AmqplibInstrumentation(),
    ],
  });

  // Initialize the SDK and register with the OpenTelemetry API
  sdk.start();
  logger.log('OpenTelemetry tracing initialized successfully');
  logger.log(`Service name: ${finalConfig.serviceName}`);
  logger.log(`Traces will be sent to: ${finalConfig.otlpEndpoint}`);
  logger.log('Instrumentations enabled: HTTP, Express, RabbitMQ');

  // Gracefully shut down the SDK on process exit
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