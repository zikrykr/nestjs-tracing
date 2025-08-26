import { AlertProvider, AlertProviderConfig, ErrorAlertData } from './alert.interface';
export interface TeamsAlertConfig extends AlertProviderConfig {
    webhookUrl: string;
}
export declare class TeamsAlertService implements AlertProvider {
    private readonly logger;
    private readonly config;
    constructor();
    isConfigured(): boolean;
    getProviderName(): string;
    sendErrorAlert(alertData: ErrorAlertData): Promise<void>;
    private buildTeamsMessage;
    private buildJaegerUrl;
    private getThemeColor;
    private formatErrorDetails;
    sendCriticalErrorAlert(alertData: ErrorAlertData): Promise<void>;
    sendBatchErrorAlerts(alerts: ErrorAlertData[]): Promise<void>;
    private buildBatchMessage;
    private formatBatchErrorSummary;
}
