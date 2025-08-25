export interface ErrorAlertData {
  error: Error | string;
  traceId: string;
  spanId: string;
  serviceName: string;
  methodName?: string;
  controllerName?: string;
  httpMethod?: string;
  httpUrl?: string;
  userId?: string;
  companyId?: string;
  additionalContext?: Record<string, any>;
}

export interface AlertProvider {
  /**
   * Send a single error alert
   */
  sendErrorAlert(alertData: ErrorAlertData): Promise<void>;

  /**
   * Send a critical error alert
   */
  sendCriticalErrorAlert(alertData: ErrorAlertData): Promise<void>;

  /**
   * Send batch error alerts
   */
  sendBatchErrorAlerts(alerts: ErrorAlertData[]): Promise<void>;

  /**
   * Check if the provider is properly configured
   */
  isConfigured(): boolean;

  /**
   * Get provider name for logging
   */
  getProviderName(): string;
}

export interface AlertProviderConfig {
  environment: string;
  serviceName: string;
  jaegerBaseUrl: string;
} 