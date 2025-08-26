import { TeamsAlertService } from '../../../src/framework/alert/teams-alert.service';
import { ErrorAlertData } from '../../../src/framework/alert/alert.interface';

// Mock fetch globally
global.fetch = jest.fn();

// Mock NestJS Logger but preserve Injectable decorator
jest.mock('@nestjs/common', () => {
  const originalModule = jest.requireActual('@nestjs/common');
  return {
    ...originalModule,
    Logger: jest.fn().mockImplementation(() => ({
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    })),
  };
});

describe('TeamsAlertService', () => {
  let service: TeamsAlertService;
  let mockFetch: jest.MockedFunction<typeof fetch>;
  let mockLogger: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset environment variables
    delete process.env.TEAMS_WEBHOOK_URL;
    delete process.env.NODE_ENV;
    delete process.env.APP_NAME;
    delete process.env.JAEGER_BASE_URL;

    mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
    mockLogger = {
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    // Mock Logger constructor
    const { Logger } = require('@nestjs/common');
    Logger.mockImplementation(() => mockLogger);

    service = new TeamsAlertService();
  });

  describe('constructor and configuration', () => {
    it('should initialize with environment variables', () => {
      process.env.TEAMS_WEBHOOK_URL = 'https://test-webhook.com';
      process.env.NODE_ENV = 'staging';
      process.env.APP_NAME = 'test-app';
      process.env.JAEGER_BASE_URL = 'https://test-jaeger.com';

      const newService = new TeamsAlertService();

      expect(newService.isConfigured()).toBe(true);
      expect(newService.getProviderName()).toBe('Microsoft Teams');
    });

    it('should use default values when environment variables are not set', () => {
      expect(service.isConfigured()).toBe(false);
      expect(service.getProviderName()).toBe('Microsoft Teams');
    });

    it('should handle empty webhook URL', () => {
      process.env.TEAMS_WEBHOOK_URL = '';
      
      const newService = new TeamsAlertService();
      expect(newService.isConfigured()).toBe(false);
    });
  });

  describe('isConfigured', () => {
    it('should return true when webhook URL is configured', () => {
      process.env.TEAMS_WEBHOOK_URL = 'https://test-webhook.com';
      const newService = new TeamsAlertService();
      
      expect(newService.isConfigured()).toBe(true);
    });

    it('should return false when webhook URL is not configured', () => {
      expect(service.isConfigured()).toBe(false);
    });
  });

  describe('sendErrorAlert', () => {
    const mockAlertData: ErrorAlertData = {
      error: new Error('Test error'),
      traceId: 'test-trace-id',
      spanId: 'test-span-id',
      serviceName: 'TestService',
      methodName: 'testMethod',
      controllerName: 'TestController',
      httpMethod: 'POST',
      httpUrl: '/api/test',
      userId: 'user123',
      companyId: 'company456',
      additionalContext: {
        operation: 'test-operation',
        businessUnit: 'test-unit',
      },
    };

    it('should send error alert when properly configured', async () => {
      process.env.TEAMS_WEBHOOK_URL = 'https://test-webhook.com';
      const newService = new TeamsAlertService();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
      } as Response);

      await newService.sendErrorAlert(mockAlertData);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://test-webhook.com',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: expect.any(String),
        })
      );

      const requestBody = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);
      expect(requestBody).toMatchObject({
        '@type': 'MessageCard',
        '@context': 'http://schema.org/extensions',
        themeColor: expect.any(String),
        summary: 'Error Alert: Test error',
        sections: expect.arrayContaining([
          expect.objectContaining({
            activityTitle: '🚨 Error Alert',
            facts: expect.arrayContaining([
              { name: 'Environment', value: 'development' },
              { name: 'Service', value: 'ce-service' },
              { name: 'Error Type', value: 'Error' },
              { name: 'Trace ID', value: 'test-trace-id' },
              { name: 'Span ID', value: 'test-span-id' },
              { name: 'Method', value: 'testMethod' },
              { name: 'Controller', value: 'TestController' },
              { name: 'HTTP Request', value: 'POST /api/test' },
              { name: 'User ID', value: 'user123' },
              { name: 'Company ID', value: 'company456' },
              { name: 'Operation', value: 'test-operation' },
              { name: 'BusinessUnit', value: 'test-unit' },
            ]),
          }),
        ]),
      });
    });

    it('should skip alert when webhook URL is not configured', async () => {
      await service.sendErrorAlert(mockAlertData);

      expect(mockFetch).not.toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Teams webhook URL not configured, skipping alert'
      );
    });

    it('should handle fetch errors gracefully', async () => {
      process.env.TEAMS_WEBHOOK_URL = 'https://test-webhook.com';
      const newService = new TeamsAlertService();

      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await newService.sendErrorAlert(mockAlertData);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to send Teams alert:',
        expect.any(Error)
      );
    });

    it('should handle non-OK response status', async () => {
      process.env.TEAMS_WEBHOOK_URL = 'https://test-webhook.com';
      const newService = new TeamsAlertService();

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      } as Response);

      await newService.sendErrorAlert(mockAlertData);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to send Teams alert:',
        expect.any(Error)
      );
    });

    it('should handle string errors', async () => {
      process.env.TEAMS_WEBHOOK_URL = 'https://test-webhook.com';
      const newService = new TeamsAlertService();

      const stringErrorData: ErrorAlertData = {
        ...mockAlertData,
        error: 'String error message',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
      } as Response);

      await newService.sendErrorAlert(stringErrorData);

      expect(mockFetch).toHaveBeenCalled();
      const requestBody = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);
      expect(requestBody.summary).toBe('Error Alert: String error message');
    });
  });

  describe('sendCriticalErrorAlert', () => {
    const mockAlertData: ErrorAlertData = {
      error: new Error('Critical error'),
      traceId: 'critical-trace-id',
      spanId: 'critical-span-id',
      serviceName: 'TestService',
    };

    it('should send critical error alert with enhanced context', async () => {
      process.env.TEAMS_WEBHOOK_URL = 'https://test-webhook.com';
      const newService = new TeamsAlertService();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
      } as Response);

      await newService.sendCriticalErrorAlert(mockAlertData);

      expect(mockFetch).toHaveBeenCalled();
      const requestBody = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);
      
      // Should include critical indicators
      expect(requestBody.sections[0].facts).toEqual(
        expect.arrayContaining([
          { name: 'Severity', value: 'CRITICAL' },
          { name: 'RequiresImmediateAttention', value: 'true' },
        ])
      );
    });
  });

  describe('sendBatchErrorAlerts', () => {
    const mockAlerts: ErrorAlertData[] = [
      {
        error: new Error('Error 1'),
        traceId: 'trace-1',
        spanId: 'span-1',
        serviceName: 'TestService',
      },
      {
        error: new Error('Error 2'),
        traceId: 'trace-2',
        spanId: 'span-2',
        serviceName: 'TestService',
      },
    ];

    it('should send batch error alert when properly configured', async () => {
      process.env.TEAMS_WEBHOOK_URL = 'https://test-webhook.com';
      const newService = new TeamsAlertService();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
      } as Response);

      await newService.sendBatchErrorAlerts(mockAlerts);

      expect(mockFetch).toHaveBeenCalled();
      const requestBody = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);
      
      expect(requestBody.summary).toBe('Batch Error Alert: 2 errors detected');
      expect(requestBody.sections[0].facts).toEqual(
        expect.arrayContaining([
          { name: 'Error Count', value: '2' },
          { name: 'Unique Traces', value: '2' },
        ])
      );
    });

    it('should skip batch alert when webhook URL is not configured', async () => {
      await service.sendBatchErrorAlerts(mockAlerts);

      expect(mockFetch).not.toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Teams webhook URL not configured, skipping batch alert'
      );
    });

    it('should handle empty alerts array', async () => {
      process.env.TEAMS_WEBHOOK_URL = 'https://test-webhook.com';
      const newService = new TeamsAlertService();

      await newService.sendBatchErrorAlerts([]);

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should handle duplicate trace IDs in batch', async () => {
      process.env.TEAMS_WEBHOOK_URL = 'https://test-webhook.com';
      const newService = new TeamsAlertService();

      const duplicateAlerts: ErrorAlertData[] = [
        { ...mockAlerts[0], traceId: 'same-trace' },
        { ...mockAlerts[1], traceId: 'same-trace' },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
      } as Response);

      await newService.sendBatchErrorAlerts(duplicateAlerts);

      const requestBody = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);
      expect(requestBody.sections[0].facts).toEqual(
        expect.arrayContaining([
          { name: 'Unique Traces', value: '1' },
        ])
      );
    });
  });

  describe('message building', () => {
    it('should build message with correct theme color for different environments', () => {
      const testCases = [
        { env: 'production', expectedColor: 'FF0000' },
        { env: 'staging', expectedColor: 'FF8C00' },
        { env: 'development', expectedColor: 'FFD700' },
        { env: 'unknown', expectedColor: '808080' },
      ];

      testCases.forEach(({ env, expectedColor }) => {
        process.env.NODE_ENV = env;
        const newService = new TeamsAlertService();
        
        // Access private method through any type
        const serviceAny = newService as any;
        const themeColor = serviceAny.getThemeColor(env);
        
        expect(themeColor).toBe(expectedColor);
      });
    });

    it('should build Jaeger URL correctly', () => {
      process.env.JAEGER_BASE_URL = 'https://jaeger.example.com';
      const newService = new TeamsAlertService();
      
      const serviceAny = newService as any;
      const jaegerUrl = serviceAny.buildJaegerUrl('test-trace-id');
      
      expect(jaegerUrl).toBe('https://jaeger.example.com/trace/test-trace-id');
    });

    it('should format error details correctly', () => {
      const error = new Error('Test error message');
      (error as any).code = 'TEST_ERROR_CODE';
      
      const serviceAny = service as any;
      const formattedDetails = serviceAny.formatErrorDetails(error);
      
      expect(formattedDetails).toContain('**Message:** Test error message');
      expect(formattedDetails).toContain('**Error Code:** TEST_ERROR_CODE');
      expect(formattedDetails).toContain('**Stack Trace:**');
    });

    it('should handle errors without stack trace', () => {
      const error = new Error('Test error');
      delete (error as any).stack;
      
      const serviceAny = service as any;
      const formattedDetails = serviceAny.formatErrorDetails(error);
      
      expect(formattedDetails).toContain('**Message:** Test error');
      expect(formattedDetails).not.toContain('**Stack Trace:**');
    });
  });

  describe('error handling edge cases', () => {
    it('should handle errors with circular references', async () => {
      process.env.TEAMS_WEBHOOK_URL = 'https://test-webhook.com';
      const newService = new TeamsAlertService();

      const circularError = new Error('Circular error');
      (circularError as any).circular = circularError;

      const alertData: ErrorAlertData = {
        error: circularError,
        traceId: 'test-trace',
        spanId: 'test-span',
        serviceName: 'TestService',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
      } as Response);

      // Should not throw when serializing
      await expect(newService.sendErrorAlert(alertData)).resolves.not.toThrow();
    });

    it('should handle very long error messages', async () => {
      process.env.TEAMS_WEBHOOK_URL = 'https://test-webhook.com';
      const newService = new TeamsAlertService();

      const longMessage = 'A'.repeat(10000); // Very long message
      const longError = new Error(longMessage);

      const alertData: ErrorAlertData = {
        error: longError,
        traceId: 'test-trace',
        spanId: 'test-span',
        serviceName: 'TestService',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
      } as Response);

      await expect(newService.sendErrorAlert(alertData)).resolves.not.toThrow();
    });
  });
}); 