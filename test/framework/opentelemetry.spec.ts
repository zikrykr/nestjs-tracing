import { setupOpenTelemetry, OpenTelemetryConfig } from '../../src/framework/trace/opentelemetry';
import { Logger } from '@nestjs/common';

// Mock OpenTelemetry SDK
jest.mock('@opentelemetry/sdk-node', () => ({
  NodeSDK: jest.fn().mockImplementation(() => ({
    start: jest.fn(),
    shutdown: jest.fn().mockResolvedValue(undefined),
  })),
}));

// Mock OpenTelemetry exporters and resources
jest.mock('@opentelemetry/exporter-trace-otlp-http', () => ({
  OTLPTraceExporter: jest.fn(),
}));

jest.mock('@opentelemetry/resources', () => ({
  Resource: jest.fn(),
}));

jest.mock('@opentelemetry/semantic-conventions', () => ({
  ATTR_SERVICE_NAME: 'service.name',
  ATTR_SERVICE_VERSION: 'service.version',
}));

jest.mock('@opentelemetry/instrumentation-http', () => ({
  HttpInstrumentation: jest.fn(),
}));

jest.mock('@opentelemetry/instrumentation-express', () => ({
  ExpressInstrumentation: jest.fn(),
}));

jest.mock('@opentelemetry/instrumentation-amqplib', () => ({
  AmqplibInstrumentation: jest.fn(),
}));

// Mock NestJS Logger
jest.mock('@nestjs/common', () => ({
  Logger: jest.fn().mockImplementation(() => ({
    log: jest.fn(),
    error: jest.fn(),
  })),
}));

describe('OpenTelemetry Setup', () => {
  let mockLogger: any;
  let mockNodeSDK: any;
  let mockOTLPTraceExporter: any;
  let mockResource: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockLogger = {
      log: jest.fn(),
      error: jest.fn(),
    };
    (Logger as jest.Mock).mockReturnValue(mockLogger);

    mockNodeSDK = {
      start: jest.fn(),
      shutdown: jest.fn().mockResolvedValue(undefined),
    };

    mockOTLPTraceExporter = jest.fn();
    mockResource = jest.fn();

    const { NodeSDK } = require('@opentelemetry/sdk-node');
    const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');
    const { Resource } = require('@opentelemetry/resources');

    NodeSDK.mockImplementation(() => mockNodeSDK);
    OTLPTraceExporter.mockImplementation(() => mockOTLPTraceExporter);
    Resource.mockImplementation(() => mockResource);
  });

  afterEach(() => {
    // Clean up process listeners
    const listeners = process.listeners('SIGTERM');
    listeners.forEach(listener => {
      if (listener.toString().includes('shutdown')) {
        process.removeListener('SIGTERM', listener);
      }
    });
  });

  describe('setupOpenTelemetry', () => {
    it('should initialize OpenTelemetry with provided configuration', () => {
      const config: OpenTelemetryConfig = {
        serviceName: 'test-service',
        environment: 'production',
        otlpEndpoint: 'https://collector.com/v1/traces',
        serviceVersion: '2.0.0',
        otlpHeaders: 'Bearer token123',
      };

      const result = setupOpenTelemetry(config);

      expect(mockLogger.log).toHaveBeenCalledWith('Initializing OpenTelemetry tracing...');
      expect(mockLogger.log).toHaveBeenCalledWith('OpenTelemetry tracing initialized successfully');
      expect(mockLogger.log).toHaveBeenCalledWith('Service name: test-service');
      expect(mockLogger.log).toHaveBeenCalledWith('Traces will be sent to: https://collector.com/v1/traces');
      expect(mockLogger.log).toHaveBeenCalledWith('Instrumentations enabled: HTTP, Express, RabbitMQ');
      expect(mockNodeSDK.start).toHaveBeenCalled();
      expect(result).toBe(mockNodeSDK);
    });

    it('should use default values when optional config is not provided', () => {
      const config: OpenTelemetryConfig = {
        serviceName: 'test-service',
        environment: 'development',
        otlpEndpoint: 'http://localhost:4318/v1/traces',
      };

      setupOpenTelemetry(config);

      expect(mockLogger.log).toHaveBeenCalledWith('Service name: test-service');
      expect(mockLogger.log).toHaveBeenCalledWith('Traces will be sent to: http://localhost:4318/v1/traces');
    });

    it('should set up SIGTERM handler for graceful shutdown', () => {
      const config: OpenTelemetryConfig = {
        serviceName: 'test-service',
        environment: 'production',
        otlpEndpoint: 'https://collector.com/v1/traces',
      };

      setupOpenTelemetry(config);

      // Verify SIGTERM handler is set up
      const sigtermListeners = process.listeners('SIGTERM');
      expect(sigtermListeners.length).toBeGreaterThan(0);
    });

    it('should handle SIGTERM shutdown gracefully', async () => {
      const config: OpenTelemetryConfig = {
        serviceName: 'test-service',
        environment: 'production',
        otlpEndpoint: 'https://collector.com/v1/traces',
      };

      setupOpenTelemetry(config);

      // Find and call the SIGTERM handler
      const sigtermListeners = process.listeners('SIGTERM');
      const shutdownHandler = sigtermListeners.find(listener => 
        listener.toString().includes('shutdown')
      );

      if (shutdownHandler) {
        await shutdownHandler();
      }

      expect(mockLogger.log).toHaveBeenCalledWith('Shutting down OpenTelemetry tracing...');
      expect(mockNodeSDK.shutdown).toHaveBeenCalled();
    });

    it('should handle shutdown errors gracefully', async () => {
      const config: OpenTelemetryConfig = {
        serviceName: 'test-service',
        environment: 'production',
        otlpEndpoint: 'https://collector.com/v1/traces',
      };

      const shutdownError = new Error('Shutdown failed');
      mockNodeSDK.shutdown.mockRejectedValue(shutdownError);

      setupOpenTelemetry(config);

      // Find and call the SIGTERM handler
      const sigtermListeners = process.listeners('SIGTERM');
      const shutdownHandler = sigtermListeners.find(listener => 
        listener.toString().includes('shutdown')
      );

      if (shutdownHandler) {
        await shutdownHandler();
      }

      expect(mockLogger.error).toHaveBeenCalledWith('Error terminating tracing:', shutdownError);
    });

    it('should create NodeSDK with correct configuration', () => {
      const config: OpenTelemetryConfig = {
        serviceName: 'test-service',
        environment: 'staging',
        otlpEndpoint: 'https://staging-collector.com/v1/traces',
        serviceVersion: '1.5.0',
        otlpHeaders: 'Bearer staging-token',
      };

      const { NodeSDK } = require('@opentelemetry/sdk-node');
      const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');
      const { Resource } = require('@opentelemetry/resources');

      setupOpenTelemetry(config);

      expect(NodeSDK).toHaveBeenCalledWith({
        resource: mockResource,
        traceExporter: mockOTLPTraceExporter,
        instrumentations: expect.arrayContaining([
          expect.any(Object), // HttpInstrumentation
          expect.any(Object), // ExpressInstrumentation
          expect.any(Object), // AmqplibInstrumentation
        ]),
      });

      expect(OTLPTraceExporter).toHaveBeenCalledWith({
        url: 'https://staging-collector.com/v1/traces',
        headers: {
          'Authorization': 'Bearer staging-token',
        },
      });

      expect(Resource).toHaveBeenCalledWith({
        'service.name': 'test-service',
        'service.version': '1.5.0',
        'deployment.environment': 'staging',
      });
    });
  });

  describe('OpenTelemetryConfig interface', () => {
    it('should enforce required properties', () => {
      // This test ensures TypeScript compilation works correctly
      const validConfig: OpenTelemetryConfig = {
        serviceName: 'required-service',
        environment: 'required-environment',
        otlpEndpoint: 'required-endpoint',
      };

      expect(validConfig.serviceName).toBe('required-service');
      expect(validConfig.environment).toBe('required-environment');
      expect(validConfig.otlpEndpoint).toBe('required-endpoint');
    });
  });
}); 