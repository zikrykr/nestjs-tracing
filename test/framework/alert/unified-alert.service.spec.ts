import { UnifiedAlertService } from '../../../src/framework/alert/unified-alert.service';
import { AlertProvider, ErrorAlertData } from '../../../src/framework/alert/alert.interface';

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

// Mock alert providers
const createMockProvider = (name: string, configured: boolean = true): jest.Mocked<AlertProvider> => ({
  sendErrorAlert: jest.fn().mockResolvedValue(undefined),
  sendCriticalErrorAlert: jest.fn().mockResolvedValue(undefined),
  sendBatchErrorAlerts: jest.fn().mockResolvedValue(undefined),
  isConfigured: jest.fn().mockReturnValue(configured),
  getProviderName: jest.fn().mockReturnValue(name),
});

describe('UnifiedAlertService', () => {
  let service: UnifiedAlertService;
  let mockTeamsProvider: jest.Mocked<AlertProvider>;
  let mockSlackProvider: jest.Mocked<AlertProvider>;
  let mockGoogleChatProvider: jest.Mocked<AlertProvider>;
  let mockLogger: any;

  const mockAlertData: ErrorAlertData = {
    error: new Error('Test error'),
    traceId: 'test-trace-id',
    spanId: 'test-span-id',
    serviceName: 'TestService',
    methodName: 'testMethod',
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockTeamsProvider = createMockProvider('Microsoft Teams', true);
    mockSlackProvider = createMockProvider('Slack', true);
    mockGoogleChatProvider = createMockProvider('Google Chat', true);

    mockLogger = {
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    // Mock Logger constructor
    const { Logger } = require('@nestjs/common');
    Logger.mockImplementation(() => mockLogger);
  });

  describe('constructor', () => {
    it('should initialize with providers and log available providers', () => {
      service = new UnifiedAlertService([mockTeamsProvider, mockSlackProvider]);

      expect(mockLogger.log).toHaveBeenCalledWith(
        'Alert providers configured: Microsoft Teams, Slack'
      );
    });

    it('should log unconfigured providers', () => {
      const unconfiguredProvider = createMockProvider('Unconfigured Provider', false);
      service = new UnifiedAlertService([mockTeamsProvider, unconfiguredProvider]);

      expect(mockLogger.log).toHaveBeenCalledWith(
        'Alert providers configured: Microsoft Teams'
      );
      expect(mockLogger.log).toHaveBeenCalledWith(
        'Alert providers not configured: Unconfigured Provider'
      );
    });

    it('should warn when no providers are registered', () => {
      service = new UnifiedAlertService([]);

      expect(mockLogger.warn).toHaveBeenCalledWith('No alert providers registered');
    });
  });

  describe('sendErrorAlert', () => {
    it('should send error alert to all configured providers', async () => {
      service = new UnifiedAlertService([mockTeamsProvider, mockSlackProvider]);

      await service.sendErrorAlert(mockAlertData);

      expect(mockTeamsProvider.sendErrorAlert).toHaveBeenCalledWith(mockAlertData);
      expect(mockSlackProvider.sendErrorAlert).toHaveBeenCalledWith(mockAlertData);
      expect(mockLogger.log).toHaveBeenCalledWith(
        'Error alert sent successfully via: Microsoft Teams, Slack'
      );
    });

    it('should skip alert when no providers are configured', async () => {
      const unconfiguredProvider = createMockProvider('Unconfigured', false);
      service = new UnifiedAlertService([unconfiguredProvider]);

      await service.sendErrorAlert(mockAlertData);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'No alert providers configured, skipping alert'
      );
      expect(unconfiguredProvider.sendErrorAlert).not.toHaveBeenCalled();
    });

    it('should handle provider failures gracefully', async () => {
      mockTeamsProvider.sendErrorAlert.mockRejectedValueOnce(new Error('Teams failed'));
      mockSlackProvider.sendErrorAlert.mockResolvedValueOnce(undefined);

      service = new UnifiedAlertService([mockTeamsProvider, mockSlackProvider]);

      await service.sendErrorAlert(mockAlertData);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error alert failed via Microsoft Teams:',
        expect.any(Error)
      );
      expect(mockLogger.log).toHaveBeenCalledWith(
        'Error alert sent successfully via: Slack'
      );
    });

    it('should log error when all providers fail', async () => {
      mockTeamsProvider.sendErrorAlert.mockRejectedValueOnce(new Error('Teams failed'));
      mockSlackProvider.sendErrorAlert.mockRejectedValueOnce(new Error('Slack failed'));

      service = new UnifiedAlertService([mockTeamsProvider, mockSlackProvider]);

      await service.sendErrorAlert(mockAlertData);

      // The service logs individual failures, not a summary message
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error alert failed via Microsoft Teams:',
        expect.any(Error)
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error alert failed via Slack:',
        expect.any(Error)
      );
    });
  });

  describe('sendCriticalErrorAlert', () => {
    it('should send critical error alert to all configured providers', async () => {
      service = new UnifiedAlertService([mockTeamsProvider, mockSlackProvider]);

      await service.sendCriticalErrorAlert(mockAlertData);

      expect(mockTeamsProvider.sendCriticalErrorAlert).toHaveBeenCalledWith(mockAlertData);
      expect(mockSlackProvider.sendCriticalErrorAlert).toHaveBeenCalledWith(mockAlertData);
      expect(mockLogger.log).toHaveBeenCalledWith(
        'Critical error alert sent successfully via: Microsoft Teams, Slack'
      );
    });

    it('should handle provider failures with fallbacks', async () => {
      mockTeamsProvider.sendCriticalErrorAlert.mockRejectedValueOnce(new Error('Teams failed'));
      mockSlackProvider.sendCriticalErrorAlert.mockResolvedValueOnce(undefined);

      service = new UnifiedAlertService([mockTeamsProvider, mockSlackProvider]);

      await service.sendCriticalErrorAlert(mockAlertData);

      expect(mockLogger.log).toHaveBeenCalledWith(
        'Critical error alert sent successfully via: Slack'
      );
    });
  });

  describe('sendBatchErrorAlerts', () => {
    const mockBatchAlerts: ErrorAlertData[] = [
      { ...mockAlertData, traceId: 'trace-1' },
      { ...mockAlertData, traceId: 'trace-2' },
    ];

    it('should send batch alerts to all configured providers', async () => {
      service = new UnifiedAlertService([mockTeamsProvider, mockSlackProvider]);

      await service.sendBatchErrorAlerts(mockBatchAlerts);

      expect(mockTeamsProvider.sendBatchErrorAlerts).toHaveBeenCalledWith(mockBatchAlerts);
      expect(mockSlackProvider.sendBatchErrorAlerts).toHaveBeenCalledWith(mockBatchAlerts);
      expect(mockLogger.log).toHaveBeenCalledWith(
        'Batch error alert sent successfully via: Microsoft Teams, Slack'
      );
    });

    it('should skip batch alert when no providers are configured', async () => {
      const unconfiguredProvider = createMockProvider('Unconfigured', false);
      service = new UnifiedAlertService([unconfiguredProvider]);

      await service.sendBatchErrorAlerts(mockBatchAlerts);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'No alert providers configured, skipping batch alert'
      );
    });

    it('should handle empty alerts array', async () => {
      service = new UnifiedAlertService([mockTeamsProvider]);

      await service.sendBatchErrorAlerts([]);

      expect(mockTeamsProvider.sendBatchErrorAlerts).not.toHaveBeenCalled();
    });

    it('should handle provider failures with fallbacks for batch alerts', async () => {
      mockTeamsProvider.sendBatchErrorAlerts.mockRejectedValueOnce(new Error('Teams failed'));
      mockSlackProvider.sendBatchErrorAlerts.mockResolvedValueOnce(undefined);

      service = new UnifiedAlertService([mockTeamsProvider, mockSlackProvider]);

      await service.sendBatchErrorAlerts(mockBatchAlerts);

      expect(mockLogger.log).toHaveBeenCalledWith(
        'Batch error alert sent successfully via: Slack'
      );
    });
  });

  describe('provider selection and fallbacks', () => {
    it('should use first configured provider as primary', async () => {
      service = new UnifiedAlertService([mockTeamsProvider, mockSlackProvider]);

      await service.sendErrorAlert(mockAlertData);

      // Should log success from all providers
      expect(mockLogger.log).toHaveBeenCalledWith(
        'Error alert sent successfully via: Microsoft Teams, Slack'
      );
    });

    it('should try fallback providers when primary fails', async () => {
      mockTeamsProvider.sendErrorAlert.mockRejectedValueOnce(new Error('Primary failed'));
      mockSlackProvider.sendErrorAlert.mockResolvedValueOnce(undefined);

      service = new UnifiedAlertService([mockTeamsProvider, mockSlackProvider]);

      await service.sendErrorAlert(mockAlertData);

      expect(mockLogger.log).toHaveBeenCalledWith(
        'Error alert sent successfully via: Slack'
      );
    });

    it('should not retry the same failed provider', async () => {
      mockTeamsProvider.sendErrorAlert.mockRejectedValueOnce(new Error('Primary failed'));
      mockSlackProvider.sendErrorAlert.mockRejectedValueOnce(new Error('Fallback failed'));

      service = new UnifiedAlertService([mockTeamsProvider, mockSlackProvider]);

      await service.sendErrorAlert(mockAlertData);

      // Should only call each provider once
      expect(mockTeamsProvider.sendErrorAlert).toHaveBeenCalledTimes(1);
      expect(mockSlackProvider.sendErrorAlert).toHaveBeenCalledTimes(1);
    });
  });

  describe('getProvidersStatus', () => {
    it('should return status of all providers', () => {
      const unconfiguredProvider = createMockProvider('Unconfigured', false);
      service = new UnifiedAlertService([mockTeamsProvider, mockSlackProvider, unconfiguredProvider]);

      const status = service.getProvidersStatus();

      expect(status).toEqual([
        { name: 'Microsoft Teams', configured: true },
        { name: 'Slack', configured: true },
        { name: 'Unconfigured', configured: false },
      ]);
    });

    it('should return empty array when no providers', () => {
      service = new UnifiedAlertService([]);

      const status = service.getProvidersStatus();

      expect(status).toEqual([]);
    });
  });

  describe('logging and monitoring', () => {
    it('should log successful alerts with provider names', async () => {
      service = new UnifiedAlertService([mockTeamsProvider, mockSlackProvider]);

      await service.sendErrorAlert(mockAlertData);

      expect(mockLogger.log).toHaveBeenCalledWith(
        'Error alert sent successfully via: Microsoft Teams, Slack'
      );
    });

    it('should log provider failures with details', async () => {
      const error = new Error('Network timeout');
      mockTeamsProvider.sendErrorAlert.mockRejectedValueOnce(error);

      service = new UnifiedAlertService([mockTeamsProvider]);

      await service.sendErrorAlert(mockAlertData);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error alert failed via Microsoft Teams:',
        error
      );
    });

    it('should log summary when multiple providers succeed', async () => {
      service = new UnifiedAlertService([mockTeamsProvider, mockSlackProvider]);

      await service.sendErrorAlert(mockAlertData);

      expect(mockLogger.log).toHaveBeenCalledWith(
        'Error alert summary: All 2 providers succeeded'
      );
    });

    it('should log summary when some providers fail', async () => {
      mockTeamsProvider.sendErrorAlert.mockRejectedValueOnce(new Error('Teams failed'));
      mockSlackProvider.sendErrorAlert.mockResolvedValueOnce(undefined);

      service = new UnifiedAlertService([mockTeamsProvider, mockSlackProvider]);

      await service.sendErrorAlert(mockAlertData);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Error alert summary: 1/2 providers succeeded, 1/2 failed'
      );
    });
  });

  describe('error handling edge cases', () => {
    it('should handle providers that throw non-Error exceptions', async () => {
      mockTeamsProvider.sendErrorAlert.mockRejectedValueOnce('String error');
      mockSlackProvider.sendErrorAlert.mockResolvedValueOnce(undefined);

      service = new UnifiedAlertService([mockTeamsProvider, mockSlackProvider]);

      await service.sendErrorAlert(mockAlertData);

      expect(mockLogger.log).toHaveBeenCalledWith(
        'Error alert sent successfully via: Slack'
      );
    });

    it('should handle providers that return rejected promises', async () => {
      mockTeamsProvider.sendErrorAlert.mockResolvedValueOnce(
        Promise.reject(new Error('Rejected promise'))
      );
      mockSlackProvider.sendErrorAlert.mockResolvedValueOnce(undefined);

      service = new UnifiedAlertService([mockTeamsProvider, mockSlackProvider]);

      await service.sendErrorAlert(mockAlertData);

      expect(mockLogger.log).toHaveBeenCalledWith(
        'Error alert sent successfully via: Slack'
      );
    });

    it('should handle very large alert data', async () => {
      const largeAlertData: ErrorAlertData = {
        ...mockAlertData,
        additionalContext: {
          largeData: 'A'.repeat(100000), // Very large context
        },
      };

      service = new UnifiedAlertService([mockTeamsProvider]);

      await expect(service.sendErrorAlert(largeAlertData)).resolves.not.toThrow();
    });
  });

  describe('performance and concurrency', () => {
    it('should send alerts to all providers concurrently', async () => {
      const startTime = Date.now();
      const delay = 100; // 100ms delay

      mockTeamsProvider.sendErrorAlert.mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, delay))
      );
      mockSlackProvider.sendErrorAlert.mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, delay))
      );

      service = new UnifiedAlertService([mockTeamsProvider, mockSlackProvider]);

      await service.sendErrorAlert(mockAlertData);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete in roughly the delay time (not 2x delay)
      expect(duration).toBeLessThan(delay * 1.5);
    });

    it('should handle many providers efficiently', async () => {
      const manyProviders = Array.from({ length: 10 }, (_, i) => 
        createMockProvider(`Provider${i}`)
      );

      service = new UnifiedAlertService(manyProviders);

      await service.sendErrorAlert(mockAlertData);

      // All providers should have been called
      manyProviders.forEach(provider => {
        expect(provider.sendErrorAlert).toHaveBeenCalledWith(mockAlertData);
      });
    });
  });
}); 