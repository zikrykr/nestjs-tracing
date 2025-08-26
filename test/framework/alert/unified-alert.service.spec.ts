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

// Mock alert services
const createMockTeamsService = (configured: boolean = true) => ({
  sendErrorAlert: jest.fn().mockResolvedValue(undefined),
  sendCriticalErrorAlert: jest.fn().mockResolvedValue(undefined),
  sendBatchErrorAlerts: jest.fn().mockResolvedValue(undefined),
  isConfigured: jest.fn().mockReturnValue(configured),
  getProviderName: jest.fn().mockReturnValue('Microsoft Teams'),
});

const createMockSlackService = (configured: boolean = true) => ({
  sendErrorAlert: jest.fn().mockResolvedValue(undefined),
  sendCriticalErrorAlert: jest.fn().mockResolvedValue(undefined),
  sendBatchErrorAlerts: jest.fn().mockResolvedValue(undefined),
  isConfigured: jest.fn().mockReturnValue(configured),
  getProviderName: jest.fn().mockReturnValue('Slack'),
});

const createMockGoogleChatService = (configured: boolean = true) => ({
  sendErrorAlert: jest.fn().mockResolvedValue(undefined),
  sendCriticalErrorAlert: jest.fn().mockResolvedValue(undefined),
  sendBatchErrorAlerts: jest.fn().mockResolvedValue(undefined),
  isConfigured: jest.fn().mockReturnValue(configured),
  getProviderName: jest.fn().mockReturnValue('Google Chat'),
});

describe('UnifiedAlertService', () => {
  let service: UnifiedAlertService;
  let mockTeamsService: any;
  let mockSlackService: any;
  let mockGoogleChatService: any;
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

    mockTeamsService = createMockTeamsService(true);
    mockSlackService = createMockSlackService(true);
    mockGoogleChatService = createMockGoogleChatService(true);

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
      service = new UnifiedAlertService(
        mockTeamsService,
        mockSlackService,
        mockGoogleChatService,
      );

      expect(mockLogger.log).toHaveBeenCalledWith(
        'Alert providers configured: Microsoft Teams, Slack, Google Chat',
      );
    });

    it('should log unconfigured providers', () => {
      const unconfiguredSlackService = createMockSlackService(false);
      service = new UnifiedAlertService(
        mockTeamsService,
        unconfiguredSlackService,
        mockGoogleChatService,
      );

      expect(mockLogger.log).toHaveBeenCalledWith(
        'Alert providers configured: Microsoft Teams, Google Chat',
      );
      expect(mockLogger.log).toHaveBeenCalledWith(
        'Alert providers not configured: Slack',
      );
    });

    it('should handle mixed configured/unconfigured providers', () => {
      const unconfiguredSlackService = createMockSlackService(false);
      service = new UnifiedAlertService(
        mockTeamsService,
        unconfiguredSlackService,
        mockGoogleChatService,
      );

      expect(mockLogger.log).toHaveBeenCalledWith(
        'Alert providers configured: Microsoft Teams, Google Chat',
      );
      expect(mockLogger.log).toHaveBeenCalledWith(
        'Alert providers not configured: Slack',
      );
    });
  });

  describe('sendErrorAlert', () => {
    it('should send error alert to all configured providers', async () => {
      service = new UnifiedAlertService(
        mockTeamsService,
        mockSlackService,
        mockGoogleChatService,
      );

      await service.sendErrorAlert(mockAlertData);

      expect(mockTeamsService.sendErrorAlert).toHaveBeenCalledWith(
        mockAlertData,
      );
      expect(mockSlackService.sendErrorAlert).toHaveBeenCalledWith(
        mockAlertData,
      );
      expect(mockGoogleChatService.sendErrorAlert).toHaveBeenCalledWith(
        mockAlertData,
      );
      expect(mockLogger.log).toHaveBeenCalledWith(
        'Error alert sent successfully via: Microsoft Teams, Slack, Google Chat',
      );
    });

    it('should skip alert when no providers are configured', async () => {
      const unconfiguredTeamsService = createMockTeamsService(false);
      const unconfiguredSlackService = createMockSlackService(false);
      const unconfiguredGoogleChatService = createMockGoogleChatService(false);

      service = new UnifiedAlertService(
        unconfiguredTeamsService,
        unconfiguredSlackService,
        unconfiguredGoogleChatService,
      );

      await service.sendErrorAlert(mockAlertData);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'No alert providers configured, skipping alert',
      );
      expect(unconfiguredTeamsService.sendErrorAlert).not.toHaveBeenCalled();
      expect(unconfiguredSlackService.sendErrorAlert).not.toHaveBeenCalled();
      expect(
        unconfiguredGoogleChatService.sendErrorAlert,
      ).not.toHaveBeenCalled();
    });

    it('should handle provider failures gracefully', async () => {
      mockTeamsService.sendErrorAlert.mockRejectedValueOnce(
        new Error('Teams service down'),
      );
      mockSlackService.sendErrorAlert.mockRejectedValueOnce(
        new Error('Slack service down'),
      );

      service = new UnifiedAlertService(
        mockTeamsService,
        mockSlackService,
        mockGoogleChatService,
      );

      await service.sendErrorAlert(mockAlertData);

      expect(mockTeamsService.sendErrorAlert).toHaveBeenCalledWith(
        mockAlertData,
      );
      expect(mockSlackService.sendErrorAlert).toHaveBeenCalledWith(
        mockAlertData,
      );
      expect(mockGoogleChatService.sendErrorAlert).toHaveBeenCalledWith(
        mockAlertData,
      );

      // Should log failures
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error alert failed via Microsoft Teams:',
        expect.any(Error),
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error alert failed via Slack:',
        expect.any(Error),
      );
    });

    it('should handle rejected promises from providers', async () => {
      mockTeamsService.sendErrorAlert.mockResolvedValueOnce(
        Promise.reject(new Error('Rejected promise')),
      );

      service = new UnifiedAlertService(
        mockTeamsService,
        mockSlackService,
        mockGoogleChatService,
      );

      await service.sendErrorAlert(mockAlertData);

      expect(mockTeamsService.sendErrorAlert).toHaveBeenCalledWith(
        mockAlertData,
      );
      expect(mockSlackService.sendErrorAlert).toHaveBeenCalledWith(
        mockAlertData,
      );
      expect(mockGoogleChatService.sendErrorAlert).toHaveBeenCalledWith(
        mockAlertData,
      );

      // Should log the failure
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error alert failed via Microsoft Teams:',
        expect.any(Error),
      );
    });
  });

  describe('sendCriticalErrorAlert', () => {
    it('should send critical error alert to all configured providers', async () => {
      service = new UnifiedAlertService(
        mockTeamsService,
        mockSlackService,
        mockGoogleChatService,
      );

      await service.sendCriticalErrorAlert(mockAlertData);

      expect(mockTeamsService.sendCriticalErrorAlert).toHaveBeenCalledWith(
        mockAlertData,
      );
      expect(mockSlackService.sendCriticalErrorAlert).toHaveBeenCalledWith(
        mockAlertData,
      );
      expect(mockGoogleChatService.sendCriticalErrorAlert).toHaveBeenCalledWith(
        mockAlertData,
      );
      expect(mockLogger.log).toHaveBeenCalledWith(
        'Critical error alert sent successfully via: Microsoft Teams, Slack, Google Chat',
      );
    });

    it('should skip critical alert when no providers are configured', async () => {
      const unconfiguredTeamsService = createMockTeamsService(false);
      const unconfiguredSlackService = createMockSlackService(false);
      const unconfiguredGoogleChatService = createMockGoogleChatService(false);

      service = new UnifiedAlertService(
        unconfiguredTeamsService,
        unconfiguredSlackService,
        unconfiguredGoogleChatService,
      );

      await service.sendCriticalErrorAlert(mockAlertData);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'No alert providers configured, skipping critical alert',
      );
      expect(
        unconfiguredTeamsService.sendCriticalErrorAlert,
      ).not.toHaveBeenCalled();
      expect(
        unconfiguredSlackService.sendCriticalErrorAlert,
      ).not.toHaveBeenCalled();
      expect(
        unconfiguredGoogleChatService.sendCriticalErrorAlert,
      ).not.toHaveBeenCalled();
    });
  });

  describe('sendBatchErrorAlerts', () => {
    it('should send batch alerts to all configured providers', async () => {
      const batchAlerts = [
        mockAlertData,
        { ...mockAlertData, error: new Error('Second error') },
      ];

      service = new UnifiedAlertService(
        mockTeamsService,
        mockSlackService,
        mockGoogleChatService,
      );

      await service.sendBatchErrorAlerts(batchAlerts);

      expect(mockTeamsService.sendBatchErrorAlerts).toHaveBeenCalledWith(
        batchAlerts,
      );
      expect(mockSlackService.sendBatchErrorAlerts).toHaveBeenCalledWith(
        batchAlerts,
      );
      expect(mockGoogleChatService.sendBatchErrorAlerts).toHaveBeenCalledWith(
        batchAlerts,
      );
      expect(mockLogger.log).toHaveBeenCalledWith(
        'Batch error alert sent successfully via: Microsoft Teams, Slack, Google Chat',
      );
    });

    it('should skip batch alerts when no providers are configured', async () => {
      const unconfiguredTeamsService = createMockTeamsService(false);
      const unconfiguredSlackService = createMockSlackService(false);
      const unconfiguredGoogleChatService = createMockGoogleChatService(false);

      service = new UnifiedAlertService(
        unconfiguredTeamsService,
        unconfiguredSlackService,
        unconfiguredGoogleChatService,
      );

      await service.sendBatchErrorAlerts([mockAlertData]);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'No alert providers configured, skipping batch alert',
      );
      expect(
        unconfiguredTeamsService.sendBatchErrorAlerts,
      ).not.toHaveBeenCalled();
      expect(
        unconfiguredSlackService.sendBatchErrorAlerts,
      ).not.toHaveBeenCalled();
      expect(
        unconfiguredGoogleChatService.sendBatchErrorAlerts,
      ).not.toHaveBeenCalled();
    });

    it('should handle empty batch alerts', async () => {
      service = new UnifiedAlertService(
        mockTeamsService,
        mockSlackService,
        mockGoogleChatService,
      );

      await service.sendBatchErrorAlerts([]);

      expect(mockTeamsService.sendBatchErrorAlerts).not.toHaveBeenCalled();
      expect(mockSlackService.sendBatchErrorAlerts).not.toHaveBeenCalled();
      expect(mockGoogleChatService.sendBatchErrorAlerts).not.toHaveBeenCalled();
    });
  });

  describe('getProvidersStatus', () => {
    it('should return status of all providers', () => {
      const unconfiguredSlackService = createMockSlackService(false);
      service = new UnifiedAlertService(
        mockTeamsService,
        unconfiguredSlackService,
        mockGoogleChatService,
      );

      const status = service.getProvidersStatus();

      expect(status).toEqual([
        { name: 'Microsoft Teams', configured: true },
        { name: 'Slack', configured: false },
        { name: 'Google Chat', configured: true },
      ]);
    });
  });

  describe('error handling', () => {
    it('should handle errors in alert sending gracefully', async () => {
      mockTeamsService.sendErrorAlert.mockRejectedValueOnce(
        new Error('Teams service error'),
      );
      mockSlackService.sendErrorAlert.mockRejectedValueOnce(
        new Error('Slack service error'),
      );

      service = new UnifiedAlertService(
        mockTeamsService,
        mockSlackService,
        mockGoogleChatService,
      );

      await service.sendErrorAlert(mockAlertData);

      // All providers should still be called
      expect(mockTeamsService.sendErrorAlert).toHaveBeenCalled();
      expect(mockSlackService.sendErrorAlert).toHaveBeenCalled();
      expect(mockGoogleChatService.sendErrorAlert).toHaveBeenCalled();

      // Errors should be logged
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error alert failed via Microsoft Teams:',
        expect.any(Error),
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error alert failed via Slack:',
        expect.any(Error),
      );
    });
  });
}); 