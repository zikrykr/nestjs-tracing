import { setupOpenTelemetry, OpenTelemetryConfig } from './trace/opentelemetry';
import { TeamsAlertService } from './alert/teams-alert.service';

export interface ServiceSetupConfig extends OpenTelemetryConfig {
  // Teams alert configuration (all optional with sensible defaults)
  teamsWebhookUrl?: string;
  jaegerBaseUrl?: string;
  teamsAlertsEnabled?: boolean;
  teamsAlertOnError?: boolean;
  teamsAlertOnCriticalError?: boolean;
  
  // Module configuration
  globalProviders?: any[];
  globalImports?: any[];
}

/**
 * Unified function to setup both OpenTelemetry and Teams alert service
 * Usage: setupService({ serviceName: 'my-service', environment: 'production', ... })
 */
export function setupService(config: ServiceSetupConfig) {
  // Setup OpenTelemetry first
  setupOpenTelemetry({
    serviceName: config.serviceName,
    serviceVersion: config.serviceVersion,
    environment: config.environment,
    otlpEndpoint: config.otlpEndpoint,
    otlpHeaders: config.otlpHeaders,
  });

  // Return module configuration
  return {
    imports: [
      ...(config.globalImports || []),
    ],
    
    providers: [
      TeamsAlertService,
      ...(config.globalProviders || []),
    ],
    
    exports: [
      TeamsAlertService,
      ...(config.globalProviders || []),
    ],
    
    // Helper function to get TeamsAlertService
    getTeamsAlertService: () => TeamsAlertService,
  };
} 