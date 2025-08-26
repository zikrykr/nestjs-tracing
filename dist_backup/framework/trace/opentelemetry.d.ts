import { NodeSDK } from '@opentelemetry/sdk-node';
export interface OpenTelemetryConfig {
    serviceName: string;
    serviceVersion?: string;
    environment: string;
    otlpEndpoint: string;
    otlpHeaders?: string;
}
export declare function setupOpenTelemetry(config?: Partial<OpenTelemetryConfig>): NodeSDK;
