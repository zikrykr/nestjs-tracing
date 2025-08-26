"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupService = setupService;
const opentelemetry_1 = require("./trace/opentelemetry");
const teams_alert_service_1 = require("./alert/teams-alert.service");
function setupService(config) {
    (0, opentelemetry_1.setupOpenTelemetry)({
        serviceName: config.serviceName,
        serviceVersion: config.serviceVersion,
        environment: config.environment,
        otlpEndpoint: config.otlpEndpoint,
        otlpHeaders: config.otlpHeaders,
    });
    return {
        imports: [
            ...(config.globalImports || []),
        ],
        providers: [
            teams_alert_service_1.TeamsAlertService,
            ...(config.globalProviders || []),
        ],
        exports: [
            teams_alert_service_1.TeamsAlertService,
            ...(config.globalProviders || []),
        ],
        getTeamsAlertService: () => teams_alert_service_1.TeamsAlertService,
    };
}
//# sourceMappingURL=setup.js.map