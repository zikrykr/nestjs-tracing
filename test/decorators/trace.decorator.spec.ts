import { Trace, TraceAsync } from '../../src/decorators/trace.decorator';
import { trace, SpanStatusCode } from '@opentelemetry/api';

// Mock OpenTelemetry API
jest.mock('@opentelemetry/api', () => ({
  trace: {
    getTracer: jest.fn(() => ({
      startActiveSpan: jest.fn(),
    })),
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
  })),
}));

describe('Trace Decorators', () => {
  let mockTracer: any;
  let mockSpan: any;
  let mockLogger: any;

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

    mockLogger = {
      log: jest.fn(),
    };

    trace.getTracer.mockReturnValue(mockTracer);
  });

  describe('@Trace decorator', () => {
    it('should trace method execution with default span name', async () => {
      class TestService {
        @Trace()
        async testMethod(arg1: string, arg2: number) {
          return `result: ${arg1} ${arg2}`;
        }
      }

      const service = new TestService();
      const expectedSpanName = 'TestService.testMethod';

      mockTracer.startActiveSpan.mockImplementation((name, options, fn) => {
        expect(name).toBe(expectedSpanName);
        return fn(mockSpan);
      });

      const result = await service.testMethod('hello', 42);

      expect(mockTracer.startActiveSpan).toHaveBeenCalledWith(
        expectedSpanName,
        { attributes: undefined },
        expect.any(Function)
      );
      expect(mockSpan.setAttributes).toHaveBeenCalledWith({
        'service.name': 'TestService',
        'method.name': 'testMethod',
        'method.args.count': 2,
      });
      expect(mockSpan.addEvent).toHaveBeenCalledWith('method.execution.start', {
        timestamp: expect.any(String),
      });
      expect(mockSpan.addEvent).toHaveBeenCalledWith('method.execution.success', {
        timestamp: expect.any(String),
      });
      expect(mockSpan.setStatus).toHaveBeenCalledWith({ code: SpanStatusCode.OK });
      expect(mockSpan.end).toHaveBeenCalled();
      expect(result).toBe('result: hello 42');
    });

    it('should trace method execution with custom span name', async () => {
      class TestService {
        @Trace('custom.operation.name')
        async testMethod() {
          return 'custom result';
        }
      }

      const service = new TestService();

      mockTracer.startActiveSpan.mockImplementation((name, options, fn) => {
        expect(name).toBe('custom.operation.name');
        return fn(mockSpan);
      });

      const result = await service.testMethod();

      expect(mockTracer.startActiveSpan).toHaveBeenCalledWith(
        'custom.operation.name',
        { attributes: undefined },
        expect.any(Function)
      );
      expect(result).toBe('custom result');
    });

    it('should handle method arguments as attributes', async () => {
      class TestService {
        @Trace()
        async testMethod(user: any, config: any) {
          return 'result';
        }
      }

      const service = new TestService();
      const user = { id: 123, name: 'John', email: 'john@example.com' };
      const config = { type: 'admin', status: 'active' };

      mockTracer.startActiveSpan.mockImplementation((name, options, fn) => {
        return fn(mockSpan);
      });

      await service.testMethod(user, config);

      // Should add safe attributes from arguments
      expect(mockSpan.setAttributes).toHaveBeenCalledWith(
        expect.objectContaining({
          'service.name': 'TestService',
          'method.name': 'testMethod',
          'method.args.count': 2,
          'method.arg.0.id': '123',
          'method.arg.0.name': 'John',
          'method.arg.0.status': 'active',
          'method.arg.1.type': 'admin',
          'method.arg.1.status': 'active',
        })
      );
    });

    it('should handle method execution errors', async () => {
      class TestService {
        @Trace()
        async testMethod() {
          throw new Error('Test error');
        }
      }

      const service = new TestService();

      mockTracer.startActiveSpan.mockImplementation((name, options, fn) => {
        return fn(mockSpan);
      });

      await expect(service.testMethod()).rejects.toThrow('Test error');

      expect(mockSpan.setStatus).toHaveBeenCalledWith({
        code: SpanStatusCode.ERROR,
        message: 'Test error',
      });
      expect(mockSpan.recordException).toHaveBeenCalledWith(expect.any(Error));
      expect(mockSpan.end).toHaveBeenCalled();
    });

    it('should handle non-Error exceptions', async () => {
      class TestService {
        @Trace()
        async testMethod() {
          throw 'String error';
        }
      }

      const service = new TestService();

      mockTracer.startActiveSpan.mockImplementation((name, options, fn) => {
        return fn(mockSpan);
      });

      await expect(service.testMethod()).rejects.toBe('String error');

      expect(mockSpan.setStatus).toHaveBeenCalledWith({
        code: SpanStatusCode.ERROR,
        message: 'String error',
      });
      expect(mockSpan.recordException).toHaveBeenCalledWith('String error');
    });

    it('should handle methods with no arguments', async () => {
      class TestService {
        @Trace()
        async testMethod() {
          return 'no args result';
        }
      }

      const service = new TestService();

      mockTracer.startActiveSpan.mockImplementation((name, options, fn) => {
        return fn(mockSpan);
      });

      const result = await service.testMethod();

      expect(mockSpan.setAttributes).toHaveBeenCalledWith({
        'service.name': 'TestService',
        'method.name': 'testMethod',
        'method.args.count': 0,
      });
      expect(result).toBe('no args result');
    });

    it('should handle Buffer arguments safely', async () => {
      class TestService {
        @Trace()
        async testMethod(buffer: Buffer) {
          return 'buffer result';
        }
      }

      const service = new TestService();
      const buffer = Buffer.from('test');

      mockTracer.startActiveSpan.mockImplementation((name, options, fn) => {
        return fn(mockSpan);
      });

      const result = await service.testMethod(buffer);

      // Should not add Buffer attributes
      expect(mockSpan.setAttributes).toHaveBeenCalledWith({
        'service.name': 'TestService',
        'method.name': 'testMethod',
        'method.args.count': 1,
      });
      expect(result).toBe('buffer result');
    });
  });

  describe('@TraceAsync decorator', () => {
    it('should be an alias for @Trace with explicit span name', async () => {
      class TestService {
        @TraceAsync('explicit.span.name')
        async testMethod() {
          return 'async result';
        }
      }

      const service = new TestService();

      mockTracer.startActiveSpan.mockImplementation((name, options, fn) => {
        expect(name).toBe('explicit.span.name');
        return fn(mockSpan);
      });

      const result = await service.testMethod();

      expect(mockTracer.startActiveSpan).toHaveBeenCalledWith(
        'explicit.span.name',
        { attributes: undefined },
        expect.any(Function)
      );
      expect(result).toBe('async result');
    });

    it('should handle errors in async operations', async () => {
      class TestService {
        @TraceAsync('async.error.test')
        async testMethod() {
          throw new Error('Async error');
        }
      }

      const service = new TestService();

      mockTracer.startActiveSpan.mockImplementation((name, options, fn) => {
        return fn(mockSpan);
      });

      await expect(service.testMethod()).rejects.toThrow('Async error');

      expect(mockSpan.setStatus).toHaveBeenCalledWith({
        code: SpanStatusCode.ERROR,
        message: 'Async error',
      });
      expect(mockSpan.recordException).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('Span data logging', () => {
    it('should log span data with correct structure', async () => {
      class TestService {
        @Trace()
        async testMethod() {
          return 'logged result';
        }
      }

      const service = new TestService();

      mockTracer.startActiveSpan.mockImplementation((name, options, fn) => {
        return fn(mockSpan);
      });

      await service.testMethod();

      expect(mockLogger.log).toHaveBeenCalledWith(
        expect.stringContaining('Service Span Complete:')
      );
      
      const logCall = mockLogger.log.mock.calls.find(call => 
        call[0].includes('Service Span Complete:')
      );
      
      if (logCall) {
        const logData = JSON.parse(logCall[0].replace('Service Span Complete: ', ''));
        expect(logData).toMatchObject({
          spanId: 'test-span-id',
          traceId: 'test-trace-id',
          spanName: 'TestService.testMethod',
          startTime: expect.any(String),
          attributes: expect.any(Object),
          events: expect.any(Array),
          status: { code: 'OK', message: 'Success' },
          error: null,
          duration: expect.any(Number),
        });
      }
    });

    it('should log error data when method fails', async () => {
      class TestService {
        @Trace()
        async testMethod() {
          throw new Error('Logged error');
        }
      }

      const service = new TestService();

      mockTracer.startActiveSpan.mockImplementation((name, options, fn) => {
        return fn(mockSpan);
      });

      await expect(service.testMethod()).rejects.toThrow('Logged error');

      const logCall = mockLogger.log.mock.calls.find(call => 
        call[0].includes('Service Span Complete:')
      );
      
      if (logCall) {
        const logData = JSON.parse(logCall[0].replace('Service Span Complete: ', ''));
        expect(logData).toMatchObject({
          status: { code: 'ERROR', message: 'Logged error' },
          error: {
            message: 'Logged error',
            type: 'Error',
            stack: expect.any(String),
          },
        });
      }
    });
  });
}); 