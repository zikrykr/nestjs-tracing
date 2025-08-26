import { AlertProvider, ErrorAlertData } from './alert.interface';
export declare class UnifiedAlertService {
    private readonly logger;
    private readonly providers;
    constructor(providers: AlertProvider[]);
    sendErrorAlert(alertData: ErrorAlertData): Promise<void>;
    sendCriticalErrorAlert(alertData: ErrorAlertData): Promise<void>;
    sendBatchErrorAlerts(alerts: ErrorAlertData[]): Promise<void>;
    private getConfiguredProviders;
    private logAlertResults;
    private logAvailableProviders;
    getProvidersStatus(): Array<{
        name: string;
        configured: boolean;
    }>;
}
