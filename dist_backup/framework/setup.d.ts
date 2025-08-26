import { OpenTelemetryConfig } from './trace/opentelemetry';
import { TeamsAlertService } from './alert/teams-alert.service';
export interface ServiceSetupConfig extends OpenTelemetryConfig {
    teamsWebhookUrl?: string;
    jaegerBaseUrl?: string;
    teamsAlertsEnabled?: boolean;
    teamsAlertOnError?: boolean;
    teamsAlertOnCriticalError?: boolean;
    globalProviders?: any[];
    globalImports?: any[];
}
export declare function setupService(config: ServiceSetupConfig): {
    imports: any[];
    providers: any[];
    exports: any[];
    getTeamsAlertService: () => typeof TeamsAlertService;
};
