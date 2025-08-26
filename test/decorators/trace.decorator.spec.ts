import { Trace, TraceAsync } from '../../src/decorators/trace.decorator';
import { trace, SpanStatusCode } from '@opentelemetry/api';

// Mock OpenTelemetry API
jest.mock('@opentelemetry/api', () => ({
  trace: {
    getTracer: jest.fn(),
  },
  SpanStatusCode: {
    OK: 'OK',
    ERROR: 'ERROR',
  },
}));

// Mock NestJS Logger
jest.mock('@nestjs/common', () => ({
  Logger: jest.fn().mockImplementation(() => ({
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  })),
}));

describe('Trace Decorators', () => {
  let mockTracer: any;
  let mockSpan: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockSpan = {
      setAttributes: jest.fn(),
      addEvent: jest.fn(),
      setStatus: jest.fn(),
      recordException: jest.fn(),
      end: jest.fn(),
      spanContext: jest.fn(() => ({
        spanId: 'test-span-id',
        traceId: 'test-trace-id',
      })),
    };

    mockTracer = {
      startActiveSpan: jest.fn(),
    };

    (trace.getTracer as jest.Mock).mockReturnValue(mockTracer);
  });

  describe('@Trace decorator', () => {
    it('should create a decorator function', () => {
      expect(typeof Trace).toBe('function');
      expect(typeof TraceAsync).toBe('function');
    });

    it('should handle string parameter (legacy style)', () => {
      const decorator = Trace('custom.span.name');
      expect(typeof decorator).toBe('function');
    });

    it('should handle object parameter (new style)', () => {
      const decorator = Trace({
        severity: 'critical',
        businessImpact: 'high',
        spanName: 'custom.operation',
      });
      expect(typeof decorator).toBe('function');
    });

    it('should handle no parameter (default options)', () => {
      const decorator = Trace();
      expect(typeof decorator).toBe('function');
    });

    it('should return a descriptor modifier function', () => {
      const decorator = Trace();
      const target = {};
      const propertyName = 'testMethod';
      const descriptor = {
        value: jest.fn(),
        configurable: true,
        enumerable: true,
        writable: true,
      };

      const result = decorator(target, propertyName, descriptor);
      expect(result).toBe(descriptor);
    });
  });

  describe('@TraceAsync decorator', () => {
    it('should be an alias for @Trace with span name', () => {
      const decorator = TraceAsync('async.operation');
      expect(typeof decorator).toBe('function');
    });

    it('should return a descriptor modifier function', () => {
      const decorator = TraceAsync('async.test');
      const target = {};
      const propertyName = 'testMethod';
      const descriptor = {
        value: jest.fn(),
        configurable: true,
        enumerable: true,
        writable: true,
      };

      const result = decorator(target, propertyName, descriptor);
      expect(result).toBe(descriptor);
    });
  });

  describe('Decorator configuration', () => {
    it('should handle default options correctly', () => {
      const decorator = Trace();
      const target = {};
      const propertyName = 'testMethod';
      const descriptor = {
        value: jest.fn(),
        configurable: true,
        enumerable: true,
        writable: true,
      };

      // Mock the span execution
      mockTracer.startActiveSpan.mockImplementation((name, options, fn) => {
        expect(name).toBe('Object.testMethod'); // Default span name
        return fn(mockSpan);
      });

      const result = decorator(target, propertyName, descriptor);

      // Verify the descriptor was modified
      expect(result.value).toBeDefined();
      expect(typeof result.value).toBe('function');
    });

    it('should handle custom span name', () => {
      const decorator = Trace('custom.operation');
      const target = {};
      const propertyName = 'testMethod';
      const descriptor = {
        value: jest.fn(),
        configurable: true,
        enumerable: true,
        writable: true,
      };

      mockTracer.startActiveSpan.mockImplementation((name, options, fn) => {
        expect(name).toBe('custom.operation');
        return fn(mockSpan);
      });

      const result = decorator(target, propertyName, descriptor);
      expect(result.value).toBeDefined();
    });

    it('should handle custom options', () => {
      const decorator = Trace({
        severity: 'critical',
        businessImpact: 'critical',
        userAffected: true,
        customContext: { operation: 'payment' },
      });

      const target = {};
      const propertyName = 'testMethod';
      const descriptor = {
        value: jest.fn(),
        configurable: true,
        enumerable: true,
        writable: true,
      };

      mockTracer.startActiveSpan.mockImplementation((name, options, fn) => {
        return fn(mockSpan);
      });

      const result = decorator(target, propertyName, descriptor);
      expect(result.value).toBeDefined();
    });
  });

  describe('Decorator functionality', () => {
    it('should add sendUnifiedAlert method to decorated function', () => {
      const decorator = Trace();
      const target = {};
      const propertyName = 'testMethod';
      const descriptor = {
        value: jest.fn(),
        configurable: true,
        enumerable: true,
        writable: true,
      };

      const result = decorator(target, propertyName, descriptor);

      // Check that sendUnifiedAlert method was added
      expect(result.value.sendUnifiedAlert).toBeDefined();
      expect(typeof result.value.sendUnifiedAlert).toBe('function');
    });

    it('should add helper methods to decorated function', () => {
      const decorator = Trace();
      const target = {};
      const propertyName = 'testMethod';
      const descriptor = {
        value: jest.fn(),
        configurable: true,
        enumerable: true,
        writable: true,
      };

      const result = decorator(target, propertyName, descriptor);

      // Check that helper methods were added
      expect(result.value.extractUserContext).toBeDefined();
      expect(result.value.extractHttpContext).toBeDefined();
      expect(result.value.isCriticalError).toBeDefined();
    });
  });

  describe('Error classification', () => {
    it('should identify critical errors correctly', () => {
      const decorator = Trace();
      const target = {};
      const propertyName = 'testMethod';
      const descriptor = {
        value: jest.fn(),
        configurable: true,
        enumerable: true,
        writable: true,
      };

      const result = decorator(target, propertyName, descriptor);
      const isCriticalError = result.value.isCriticalError;

      // Test critical error types
      const criticalError = new Error('Database connection failed');
      // Create a custom error class for testing
      class DatabaseConnectionError extends Error {
        constructor(message: string) {
          super(message);
          this.name = 'DatabaseConnectionError';
        }
      }
      const dbError = new DatabaseConnectionError('Database connection failed');

      expect(isCriticalError(dbError, { severity: 'critical' })).toBe(true);
      expect(isCriticalError(dbError, { businessImpact: 'critical' })).toBe(
        true,
      );
      expect(isCriticalError(dbError, { severity: 'medium' })).toBe(true); // Due to error type
    });

    it('should identify non-critical errors correctly', () => {
      const decorator = Trace();
      const target = {};
      const propertyName = 'testMethod';
      const descriptor = {
        value: jest.fn(),
        configurable: true,
        enumerable: true,
        writable: true,
      };

      const result = decorator(target, propertyName, descriptor);
      const isCriticalError = result.value.isCriticalError;

      // Test non-critical error
      const normalError = new Error('User not found');

      expect(isCriticalError(normalError, { severity: 'medium' })).toBe(false);
      expect(isCriticalError(normalError, { businessImpact: 'low' })).toBe(
        false,
      );
    });
  });
}); 