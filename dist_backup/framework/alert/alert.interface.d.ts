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
    sendErrorAlert(alertData: ErrorAlertData): Promise<void>;
    sendCriticalErrorAlert(alertData: ErrorAlertData): Promise<void>;
    sendBatchErrorAlerts(alerts: ErrorAlertData[]): Promise<void>;
    isConfigured(): boolean;
    getProviderName(): string;
}
export interface AlertProviderConfig {
    environment: string;
    serviceName: string;
    jaegerBaseUrl: string;
}
