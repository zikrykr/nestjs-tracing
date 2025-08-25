import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { TracingInterceptor } from '../../src/interceptors/trace.interceptor';
import { trace, SpanStatusCode } from '@opentelemetry/api';
import { Observable, of, throwError } from 'rxjs';

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
  ...jest.requireActual('@nestjs/common'),
  Logger: jest.fn().mockImplementation(() => ({
    log: jest.fn(),
  })),
}));

describe('TracingInterceptor', () => {
  let interceptor: TracingInterceptor;
  let mockExecutionContext: ExecutionContext;
  let mockCallHandler: CallHandler;
  let mockTracer: any;
  let mockSpan: any;
  let mockLogger: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TracingInterceptor],
    }).compile();

    interceptor = module.get<TracingInterceptor>(TracingInterceptor);
    mockTracer = trace.getTracer('ce-service-event-bridge');
    mockLogger = new Logger(TracingInterceptor.name);

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

    // Mock execution context
    mockExecutionContext = {
      switchToHttp: jest.fn(() => ({
        getRequest: jest.fn(() => ({
          method: 'GET',
          url: '/test',
          route: { path: '/test' },
          headers: {
            'user-agent': 'test-agent',
            'x-request-id': 'req-123',
          },
          body: { test: 'data' },
          id: 'req-123',
        })),
        getResponse: jest.fn(() => ({
          statusCode: 200,
          setHeader: jest.fn(),
        })),
      })),
      getHandler: jest.fn(() => ({ name: 'testHandler' })),
      getClass: jest.fn(() => ({ name: 'TestController' })),
    } as any;

    // Mock call handler
    mockCallHandler = {
      handle: jest.fn(() => of({ result: 'success' })),
    } as any;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('intercept', () => {
    it('should trace successful HTTP request', (done) => {
      mockTracer.startActiveSpan.mockImplementation((name, options, fn) => {
        expect(name).toBe('TestController.testHandler');
        return fn(mockSpan);
      });

      const result = interceptor.intercept(mockExecutionContext, mockCallHandler);

      result.subscribe({
        next: (data) => {
          expect(data).toEqual({ result: 'success' });
          expect(mockSpan.setAttributes).toHaveBeenCalledWith({
            'http.method': 'GET',
            'http.url': '/test',
            'http.route': '/test',
            'http.user_agent': 'test-agent',
            'http.request_id': 'req-123',
            'controller.name': 'TestController',
            'method.name': 'testHandler',
          });
          expect(mockSpan.addEvent).toHaveBeenCalledWith('http.request.start', {
            timestamp: expect.any(String),
          });
          expect(mockSpan.addEvent).toHaveBeenCalledWith('http.request.success', {
            timestamp: expect.any(String),
          });
          expect(mockSpan.setStatus).toHaveBeenCalledWith({ code: SpanStatusCode.OK });
          expect(mockSpan.end).toHaveBeenCalled();
          done();
        },
        error: done,
      });
    });

    it('should handle request with sanitized body', (done) => {
      const requestWithSensitiveData = {
        method: 'POST',
        url: '/login',
        route: { path: '/login' },
        headers: { 'user-agent': 'test-agent' },
        body: {
          username: 'testuser',
          password: 'secret123',
          token: 'sensitive-token',
          normalData: 'safe',
        },
      };

      mockExecutionContext.switchToHttp = jest.fn(() => ({
        getRequest: jest.fn(() => requestWithSensitiveData),
        getResponse: jest.fn(() => ({ statusCode: 200, setHeader: jest.fn() })),
      }));

      mockTracer.startActiveSpan.mockImplementation((name, options, fn) => {
        return fn(mockSpan);
      });

      const result = interceptor.intercept(mockExecutionContext, mockCallHandler);

      result.subscribe({
        next: () => {
          // Check that sensitive fields are redacted
          const bodyAttributesCall = mockSpan.setAttributes.mock.calls.find(
            call => call[0]['http.request.body']
          );
          
          if (bodyAttributesCall) {
            const bodyData = JSON.parse(bodyAttributesCall[0]['http.request.body']);
            expect(bodyData.password).toBe('[REDACTED]');
            expect(bodyData.token).toBe('[REDACTED]');
            expect(bodyData.username).toBe('testuser');
            expect(bodyData.normalData).toBe('safe');
          }
          done();
        },
        error: done,
      });
    });

    it('should handle request without body', (done) => {
      const requestWithoutBody = {
        method: 'GET',
        url: '/health',
        route: { path: '/health' },
        headers: { 'user-agent': 'test-agent' },
      };

      mockExecutionContext.switchToHttp = jest.fn(() => ({
        getRequest: jest.fn(() => requestWithoutBody),
        getResponse: jest.fn(() => ({ statusCode: 200, setHeader: jest.fn() })),
      }));

      mockTracer.startActiveSpan.mockImplementation((name, options, fn) => {
        return fn(mockSpan);
      });

      const result = interceptor.intercept(mockExecutionContext, mockCallHandler);

      result.subscribe({
        next: () => {
          // Should not have body-related attributes
          const bodyAttributesCall = mockSpan.setAttributes.mock.calls.find(
            call => call[0]['http.request.body']
          );
          expect(bodyAttributesCall).toBeUndefined();
          done();
        },
        error: done,
      });
    });

    it('should handle request errors', (done) => {
      const error = new Error('Request failed');
      mockCallHandler.handle = jest.fn(() => throwError(() => error));

      mockTracer.startActiveSpan.mockImplementation((name, options, fn) => {
        return fn(mockSpan);
      });

      const result = interceptor.intercept(mockExecutionContext, mockCallHandler);

      result.subscribe({
        next: () => done(new Error('Should have thrown error')),
        error: (err) => {
          expect(err).toBe(error);
          expect(mockSpan.setStatus).toHaveBeenCalledWith({
            code: SpanStatusCode.ERROR,
            message: 'Request failed',
          });
          expect(mockSpan.recordException).toHaveBeenCalledWith(error);
          expect(mockSpan.end).toHaveBeenCalled();
          done();
        },
      });
    });

    it('should handle non-Error exceptions', (done) => {
      const error = 'String error';
      mockCallHandler.handle = jest.fn(() => throwError(() => error));

      mockTracer.startActiveSpan.mockImplementation((name, options, fn) => {
        return fn(mockSpan);
      });

      const result = interceptor.intercept(mockExecutionContext, mockCallHandler);

      result.subscribe({
        next: () => done(new Error('Should have thrown error')),
        error: (err) => {
          expect(err).toBe(error);
          expect(mockSpan.setStatus).toHaveBeenCalledWith({
            code: SpanStatusCode.ERROR,
            message: 'String error',
          });
          expect(mockSpan.recordException).toHaveBeenCalledWith(error);
          done();
        },
      });
    });

    it('should set response headers with trace information', (done) => {
      const mockSetHeader = jest.fn();
      mockExecutionContext.switchToHttp = jest.fn(() => ({
        getRequest: jest.fn(() => ({
          method: 'GET',
          url: '/test',
          route: { path: '/test' },
          headers: {},
        })),
        getResponse: jest.fn(() => ({ 
          statusCode: 200, 
          setHeader: mockSetHeader 
        })),
      }));

      mockTracer.startActiveSpan.mockImplementation((name, options, fn) => {
        return fn(mockSpan);
      });

      const result = interceptor.intercept(mockExecutionContext, mockCallHandler);

      result.subscribe({
        next: () => {
          expect(mockSetHeader).toHaveBeenCalledWith('X-Trace-ID', 'test-trace-id');
          expect(mockSetHeader).toHaveBeenCalledWith('X-Span-ID', 'test-span-id');
          done();
        },
        error: done,
      });
    });

    it('should handle response with body', (done) => {
      const responseData = { 
        user: { id: 123, name: 'John', email: 'john@example.com' },
        token: 'sensitive-token',
        normalData: 'safe',
      };

      mockCallHandler.handle = jest.fn(() => of(responseData));

      mockTracer.startActiveSpan.mockImplementation((name, options, fn) => {
        return fn(mockSpan);
      });

      const result = interceptor.intercept(mockExecutionContext, mockCallHandler);

      result.subscribe({
        next: (data) => {
          expect(data).toEqual(responseData);
          
          // Check that response body is sanitized
          const responseAttributesCall = mockSpan.setAttributes.mock.calls.find(
            call => call[0]['http.response.body']
          );
          
          if (responseAttributesCall) {
            const bodyData = JSON.parse(responseAttributesCall[0]['http.response.body']);
            expect(bodyData.token).toBe('[REDACTED]');
            expect(bodyData.user.name).toBe('John');
            expect(bodyData.normalData).toBe('safe');
          }
          done();
        },
        error: done,
      });
    });

    it('should handle nested sensitive data in objects', (done) => {
      const requestWithNestedSensitiveData = {
        method: 'POST',
        url: '/api/data',
        route: { path: '/api/data' },
        headers: {},
        body: {
          user: {
            profile: {
              password: 'nested-secret',
              api_key: 'nested-key',
            },
            credentials: {
              access_token: 'nested-token',
            },
            normalField: 'safe',
          },
        },
      };

      mockExecutionContext.switchToHttp = jest.fn(() => ({
        getRequest: jest.fn(() => requestWithNestedSensitiveData),
        getResponse: jest.fn(() => ({ statusCode: 200, setHeader: jest.fn() })),
      }));

      mockTracer.startActiveSpan.mockImplementation((name, options, fn) => {
        return fn(mockSpan);
      });

      const result = interceptor.intercept(mockExecutionContext, mockCallHandler);

      result.subscribe({
        next: () => {
          const bodyAttributesCall = mockSpan.setAttributes.mock.calls.find(
            call => call[0]['http.request.body']
          );
          
          if (bodyAttributesCall) {
            const bodyData = JSON.parse(bodyAttributesCall[0]['http.request.body']);
            expect(bodyData.user.profile.password).toBe('[REDACTED]');
            expect(bodyData.user.profile.api_key).toBe('[REDACTED]');
            expect(bodyData.user.credentials.access_token).toBe('[REDACTED]');
            expect(bodyData.user.normalField).toBe('safe');
          }
          done();
        },
        error: done,
      });
    });

    it('should log span data with correct structure', (done) => {
      mockTracer.startActiveSpan.mockImplementation((name, options, fn) => {
        return fn(mockSpan);
      });

      const result = interceptor.intercept(mockExecutionContext, mockCallHandler);

      result.subscribe({
        next: () => {
          expect(mockLogger.log).toHaveBeenCalledWith(
            expect.stringContaining('HTTP Span Complete:')
          );
          
          const logCall = mockLogger.log.mock.calls.find(call => 
            call[0].includes('HTTP Span Complete:')
          );
          
          if (logCall) {
            const logData = JSON.parse(logCall[0].replace('HTTP Span Complete: ', ''));
            expect(logData).toMatchObject({
              spanId: 'test-span-id',
              traceId: 'test-trace-id',
              spanName: 'TestController.testHandler',
              startTime: expect.any(String),
              attributes: expect.any(Object),
              events: expect.any(Array),
              status: { code: 'OK', message: 'Success' },
              error: null,
              duration: expect.any(Number),
            });
          }
          done();
        },
        error: done,
      });
    });

    it('should handle error responses with response body', (done) => {
      const errorResponse = {
        statusCode: 400,
        message: 'Bad Request',
        errors: [
          { field: 'email', message: 'Invalid email' },
          { field: 'password', message: 'Password too short' },
        ],
      };

      const error = new Error('Validation failed');
      (error as any).response = errorResponse;
      (error as any).status = 400;

      mockCallHandler.handle = jest.fn(() => throwError(() => error));

      mockTracer.startActiveSpan.mockImplementation((name, options, fn) => {
        return fn(mockSpan);
      });

      const result = interceptor.intercept(mockExecutionContext, mockCallHandler);

      result.subscribe({
        next: () => done(new Error('Should have thrown error')),
        error: (err) => {
          expect(err).toBe(error);
          
          // Check that error response body is captured
          const errorAttributesCall = mockSpan.setAttributes.mock.calls.find(
            call => call[0]['error.response.body']
          );
          
          if (errorAttributesCall) {
            const responseData = JSON.parse(errorAttributesCall[0]['error.response.body']);
            expect(responseData.statusCode).toBe(400);
            expect(responseData.message).toBe('Bad Request');
            expect(responseData.errors).toHaveLength(2);
          }
          done();
        },
      });
    });
  });

  describe('sanitizeRequestBody', () => {
    it('should redact sensitive fields at top level', () => {
      const body = {
        username: 'testuser',
        password: 'secret123',
        token: 'sensitive-token',
        normalData: 'safe',
      };

      const result = (interceptor as any).sanitizeRequestBody(body);

      expect(result.password).toBe('[REDACTED]');
      expect(result.token).toBe('[REDACTED]');
      expect(result.username).toBe('testuser');
      expect(result.normalData).toBe('safe');
    });

    it('should redact sensitive fields in nested objects', () => {
      const body = {
        user: {
          profile: {
            password: 'nested-secret',
            api_key: 'nested-key',
          },
          credentials: {
            access_token: 'nested-token',
          },
          normalField: 'safe',
        },
      };

      const result = (interceptor as any).sanitizeRequestBody(body);

      expect(result.user.profile.password).toBe('[REDACTED]');
      expect(result.user.profile.api_key).toBe('[REDACTED]');
      expect(result.user.credentials.access_token).toBe('[REDACTED]');
      expect(result.user.normalField).toBe('safe');
    });

    it('should handle null and undefined values', () => {
      const body = {
        password: null,
        token: undefined,
        normalData: 'safe',
      };

      const result = (interceptor as any).sanitizeRequestBody(body);

      expect(result.password).toBe(null);
      expect(result.token).toBe(undefined);
      expect(result.normalData).toBe('safe');
    });

    it('should handle non-object values', () => {
      expect((interceptor as any).sanitizeRequestBody(null)).toBe(null);
      expect((interceptor as any).sanitizeRequestBody(undefined)).toBe(undefined);
      expect((interceptor as any).sanitizeRequestBody('string')).toBe('string');
      expect((interceptor as any).sanitizeRequestBody(123)).toBe(123);
    });
  });
}); 