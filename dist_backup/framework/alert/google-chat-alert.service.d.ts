import { AlertProvider, AlertProviderConfig, ErrorAlertData } from './alert.interface';
export interface GoogleChatAlertConfig extends AlertProviderConfig {
    webhookUrl: string;
    threadKey?: string;
}
export declare class GoogleChatAlertService implements AlertProvider {
    private readonly logger;
    private readonly config;
    constructor();
    isConfigured(): boolean;
    getProviderName(): string;
    sendErrorAlert(alertData: ErrorAlertData): Promise<void>;
    sendCriticalErrorAlert(alertData: ErrorAlertData): Promise<void>;
    sendBatchErrorAlerts(alerts: ErrorAlertData[]): Promise<void>;
    private buildChatMessage;
    private buildBatchMessage;
    private buildJaegerUrl;
}
