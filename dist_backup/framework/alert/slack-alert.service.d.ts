import { AlertProvider, AlertProviderConfig, ErrorAlertData } from './alert.interface';
export interface SlackAlertConfig extends AlertProviderConfig {
    webhookUrl: string;
    channel?: string;
    username?: string;
}
export declare class SlackAlertService implements AlertProvider {
    private readonly logger;
    private readonly config;
    constructor();
    isConfigured(): boolean;
    getProviderName(): string;
    sendErrorAlert(alertData: ErrorAlertData): Promise<void>;
    sendCriticalErrorAlert(alertData: ErrorAlertData): Promise<void>;
    sendBatchErrorAlerts(alerts: ErrorAlertData[]): Promise<void>;
    private buildSlackMessage;
    private buildBatchMessage;
    private buildJaegerUrl;
    private getColor;
}
