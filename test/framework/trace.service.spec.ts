import { Test, TestingModule } from '@nestjs/testing';
import { TracingService } from '../../src/framework/trace/trace.service';
import { trace, SpanStatusCode, Span } from '@opentelemetry/api';

// Mock OpenTelemetry API
jest.mock('@opentelemetry/api', () => ({
  trace: {
    getTracer: jest.fn(() => ({
      startSpan: jest.fn(),
      startActiveSpan: jest.fn(),
    })),
    getActiveSpan: jest.fn(),
    setSpan: jest.fn(),
  },
  SpanStatusCode: {
    OK: 'OK',
    ERROR: 'ERROR',
  },
  context: {
    active: jest.fn(),
  },
}));

describe('TracingService', () => {
  let service: TracingService;
  let mockTracer: any;
  let mockSpan: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TracingService],
    }).compile();

    service = module.get<TracingService>(TracingService);
    mockTracer = trace.getTracer('ce-service-event-bridge');
    mockSpan = {
      setStatus: jest.fn(),
      recordException: jest.fn(),
      end: jest.fn(),
      setAttributes: jest.fn(),
      addEvent: jest.fn(),
      spanContext: jest.fn(() => ({
        spanId: 'test-span-id',
        traceId: 'test-trace-id',
      })),
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createSpan', () => {
    it('should create a span with the given name', () => {
      const spanName = 'test.operation';
      const attributes = { 'test.attr': 'value' };
      
      mockTracer.startSpan.mockReturnValue(mockSpan);
      
      const result = service.createSpan(spanName, attributes);
      
      expect(mockTracer.startSpan).toHaveBeenCalledWith(spanName, { attributes });
      expect(result).toBe(mockSpan);
    });

    it('should create a span without attributes', () => {
      const spanName = 'test.operation';
      
      mockTracer.startSpan.mockReturnValue(mockSpan);
      
      const result = service.createSpan(spanName);
      
      expect(mockTracer.startSpan).toHaveBeenCalledWith(spanName, { attributes: undefined });
      expect(result).toBe(mockSpan);
    });
  });

  describe('executeInSpan', () => {
    it('should execute function within a span successfully', async () => {
      const spanName = 'test.operation';
      const attributes = { 'test.attr': 'value' };
      const mockFn = jest.fn().mockResolvedValue('test result');
      
      mockTracer.startActiveSpan.mockImplementation((name, options, fn) => {
        return fn(mockSpan);
      });
      
      const result = await service.executeInSpan(spanName, mockFn, attributes);
      
      expect(mockTracer.startActiveSpan).toHaveBeenCalledWith(spanName, { attributes }, expect.any(Function));
      expect(mockFn).toHaveBeenCalledWith(mockSpan);
      expect(mockSpan.setStatus).toHaveBeenCalledWith({ code: SpanStatusCode.OK });
      expect(mockSpan.end).toHaveBeenCalled();
      expect(result).toBe('test result');
    });

    it('should handle errors in span execution', async () => {
      const spanName = 'test.operation';
      const error = new Error('Test error');
      const mockFn = jest.fn().mockRejectedValue(error);
      
      mockTracer.startActiveSpan.mockImplementation((name, options, fn) => {
        return fn(mockSpan);
      });
      
      await expect(service.executeInSpan(spanName, mockFn)).rejects.toThrow('Test error');
      
      expect(mockSpan.setStatus).toHaveBeenCalledWith({
        code: SpanStatusCode.ERROR,
        message: 'Test error',
      });
      expect(mockSpan.recordException).toHaveBeenCalledWith(error);
      expect(mockSpan.end).toHaveBeenCalled();
    });

    it('should handle non-Error exceptions', async () => {
      const spanName = 'test.operation';
      const error = 'String error';
      const mockFn = jest.fn().mockRejectedValue(error);
      
      mockTracer.startActiveSpan.mockImplementation((name, options, fn) => {
        return fn(mockSpan);
      });
      
      await expect(service.executeInSpan(spanName, mockFn)).rejects.toBe(error);
      
      expect(mockSpan.setStatus).toHaveBeenCalledWith({
        code: SpanStatusCode.ERROR,
        message: 'String error',
      });
      expect(mockSpan.recordException).toHaveBeenCalledWith(error);
      expect(mockSpan.end).toHaveBeenCalled();
    });
  });

  describe('addEvent', () => {
    it('should add event to current span when span exists', () => {
      const eventName = 'test.event';
      const eventAttributes = { 'event.attr': 'value' };
      
      trace.getActiveSpan.mockReturnValue(mockSpan);
      
      service.addEvent(eventName, eventAttributes);
      
      expect(mockSpan.addEvent).toHaveBeenCalledWith(eventName, eventAttributes);
    });

    it('should not add event when no active span', () => {
      const eventName = 'test.event';
      
      trace.getActiveSpan.mockReturnValue(undefined);
      
      service.addEvent(eventName);
      
      expect(mockSpan.addEvent).not.toHaveBeenCalled();
    });
  });

  describe('setAttributes', () => {
    it('should set attributes on current span when span exists', () => {
      const attributes = { 'test.attr': 'value' };
      
      trace.getActiveSpan.mockReturnValue(mockSpan);
      
      service.setAttributes(attributes);
      
      expect(mockSpan.setAttributes).toHaveBeenCalledWith(attributes);
    });

    it('should not set attributes when no active span', () => {
      const attributes = { 'test.attr': 'value' };
      
      trace.getActiveSpan.mockReturnValue(undefined);
      
      service.setAttributes(attributes);
      
      expect(mockSpan.setAttributes).not.toHaveBeenCalled();
    });
  });

  describe('getCurrentSpan', () => {
    it('should return current span when it exists', () => {
      trace.getActiveSpan.mockReturnValue(mockSpan);
      
      const result = service.getCurrentSpan();
      
      expect(result).toBe(mockSpan);
    });

    it('should return undefined when no active span', () => {
      trace.getActiveSpan.mockReturnValue(undefined);
      
      const result = service.getCurrentSpan();
      
      expect(result).toBeUndefined();
    });
  });

  describe('createChildSpan', () => {
    it('should create child span when parent span exists', () => {
      const spanName = 'child.operation';
      const attributes = { 'child.attr': 'value' };
      const mockContext = { active: 'context' };
      
      trace.getActiveSpan.mockReturnValue(mockSpan);
      trace.setSpan.mockReturnValue('setSpanResult');
      trace.context.active.mockReturnValue(mockContext);
      mockTracer.startSpan.mockReturnValue(mockSpan);
      
      const result = service.createChildSpan(spanName, attributes);
      
      expect(trace.setSpan).toHaveBeenCalledWith(mockContext, mockSpan);
      expect(mockTracer.startSpan).toHaveBeenCalledWith(spanName, { attributes }, 'setSpanResult');
      expect(result).toBe(mockSpan);
    });

    it('should create standalone span when no parent span', () => {
      const spanName = 'standalone.operation';
      const attributes = { 'standalone.attr': 'value' };
      
      trace.getActiveSpan.mockReturnValue(undefined);
      mockTracer.startSpan.mockReturnValue(mockSpan);
      
      const result = service.createChildSpan(spanName, attributes);
      
      expect(mockTracer.startSpan).toHaveBeenCalledWith(spanName, { attributes });
      expect(result).toBe(mockSpan);
    });
  });
}); 