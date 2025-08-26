"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var TeamsAlertService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.TeamsAlertService = void 0;
const common_1 = require("@nestjs/common");
let TeamsAlertService = TeamsAlertService_1 = class TeamsAlertService {
    logger = new common_1.Logger(TeamsAlertService_1.name);
    config;
    constructor() {
        this.config = {
            webhookUrl: process.env.TEAMS_WEBHOOK_URL || '',
            environment: process.env.NODE_ENV || 'development',
            serviceName: process.env.APP_NAME || 'ce-service',
            jaegerBaseUrl: process.env.JAEGER_BASE_URL || 'http://localhost:16686',
        };
    }
    isConfigured() {
        return !!this.config.webhookUrl;
    }
    getProviderName() {
        return 'Microsoft Teams';
    }
    async sendErrorAlert(alertData) {
        try {
            if (!this.config.webhookUrl) {
                this.logger.warn('Teams webhook URL not configured, skipping alert');
                return;
            }
            const teamsMessage = this.buildTeamsMessage(alertData);
            const response = await fetch(this.config.webhookUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(teamsMessage),
            });
            if (!response.ok) {
                throw new Error(`Teams API responded with status: ${response.status}`);
            }
            this.logger.log(`Error alert sent to Teams successfully for trace: ${alertData.traceId}`);
        }
        catch (error) {
            this.logger.error('Failed to send Teams alert:', error);
        }
    }
    buildTeamsMessage(alertData) {
        const errorMessage = alertData.error instanceof Error
            ? alertData.error.message
            : String(alertData.error);
        const errorType = alertData.error instanceof Error
            ? alertData.error.constructor.name
            : 'Unknown';
        const jaegerUrl = this.buildJaegerUrl(alertData.traceId);
        const facts = [
            {
                name: 'Environment',
                value: this.config.environment,
            },
            {
                name: 'Service',
                value: this.config.serviceName,
            },
            {
                name: 'Error Type',
                value: errorType,
            },
            {
                name: 'Trace ID',
                value: alertData.traceId,
            },
            {
                name: 'Span ID',
                value: alertData.spanId,
            },
        ];
        if (alertData.methodName) {
            facts.push({
                name: 'Method',
                value: alertData.methodName,
            });
        }
        if (alertData.controllerName) {
            facts.push({
                name: 'Controller',
                value: alertData.controllerName,
            });
        }
        if (alertData.httpMethod && alertData.httpUrl) {
            facts.push({
                name: 'HTTP Request',
                value: `${alertData.httpMethod} ${alertData.httpUrl}`,
            });
        }
        if (alertData.userId) {
            facts.push({
                name: 'User ID',
                value: alertData.userId,
            });
        }
        if (alertData.companyId) {
            facts.push({
                name: 'Company ID',
                value: alertData.companyId,
            });
        }
        if (alertData.additionalContext) {
            Object.entries(alertData.additionalContext).forEach(([key, value]) => {
                facts.push({
                    name: key.charAt(0).toUpperCase() + key.slice(1),
                    value: String(value),
                });
            });
        }
        return {
            '@type': 'MessageCard',
            '@context': 'http://schema.org/extensions',
            themeColor: this.getThemeColor(this.config.environment),
            summary: `Error Alert: ${errorMessage}`,
            sections: [
                {
                    activityTitle: '🚨 Error Alert',
                    activitySubtitle: new Date().toISOString(),
                    text: `An error occurred in **${this.config.serviceName}** service.`,
                    facts: facts,
                },
                {
                    title: '🔍 View in Jaeger',
                    text: `Click the link below to view the complete trace in Jaeger:`,
                    potentialAction: [
                        {
                            '@type': 'OpenUri',
                            name: 'Open in Jaeger',
                            targets: [
                                {
                                    os: 'default',
                                    uri: jaegerUrl,
                                },
                            ],
                        },
                    ],
                },
                {
                    title: '📋 Error Details',
                    text: this.formatErrorDetails(alertData.error),
                },
            ],
        };
    }
    buildJaegerUrl(traceId) {
        return `${this.config.jaegerBaseUrl}/trace/${traceId}`;
    }
    getThemeColor(environment) {
        switch (environment.toLowerCase()) {
            case 'production':
                return 'FF0000';
            case 'staging':
                return 'FF8C00';
            case 'development':
                return 'FFD700';
            default:
                return '808080';
        }
    }
    formatErrorDetails(error) {
        if (error instanceof Error) {
            let details = `**Message:** ${error.message}\n`;
            if (error.stack) {
                const stackLines = error.stack.split('\n').slice(0, 5);
                details += `**Stack Trace:**\n\`\`\`\n${stackLines.join('\n')}\n\`\`\``;
            }
            if (error.code) {
                details += `\n**Error Code:** ${error.code}`;
            }
            return details;
        }
        return `**Error:** ${String(error)}`;
    }
    async sendCriticalErrorAlert(alertData) {
        const criticalData = {
            ...alertData,
            additionalContext: {
                ...alertData.additionalContext,
                severity: 'CRITICAL',
                requiresImmediateAttention: true,
            },
        };
        await this.sendErrorAlert(criticalData);
    }
    async sendBatchErrorAlerts(alerts) {
        if (alerts.length === 0)
            return;
        try {
            if (!this.config.webhookUrl) {
                this.logger.warn('Teams webhook URL not configured, skipping batch alert');
                return;
            }
            const batchMessage = this.buildBatchMessage(alerts);
            const response = await fetch(this.config.webhookUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(batchMessage),
            });
            if (!response.ok) {
                throw new Error(`Teams API responded with status: ${response.status}`);
            }
            this.logger.log(`Batch error alert sent to Teams successfully for ${alerts.length} errors`);
        }
        catch (error) {
            this.logger.error('Failed to send batch Teams alert:', error);
        }
    }
    buildBatchMessage(alerts) {
        const uniqueTraces = [...new Set(alerts.map(a => a.traceId))];
        const jaegerUrls = uniqueTraces.map(traceId => this.buildJaegerUrl(traceId));
        return {
            '@type': 'MessageCard',
            '@context': 'http://schema.org/extensions',
            themeColor: 'FF0000',
            summary: `Batch Error Alert: ${alerts.length} errors detected`,
            sections: [
                {
                    activityTitle: '🚨 Batch Error Alert',
                    activitySubtitle: new Date().toISOString(),
                    text: `**${alerts.length} errors** detected in **${this.config.serviceName}** service.`,
                    facts: [
                        {
                            name: 'Environment',
                            value: this.config.environment,
                        },
                        {
                            name: 'Service',
                            value: this.config.serviceName,
                        },
                        {
                            name: 'Error Count',
                            value: alerts.length.toString(),
                        },
                        {
                            name: 'Unique Traces',
                            value: uniqueTraces.length.toString(),
                        },
                    ],
                },
                {
                    title: '🔍 View Traces in Jaeger',
                    text: `Click the links below to view the traces in Jaeger:`,
                    potentialAction: uniqueTraces.map((traceId, index) => ({
                        '@type': 'OpenUri',
                        name: `Trace ${index + 1}`,
                        targets: [
                            {
                                os: 'default',
                                uri: jaegerUrls[index],
                            },
                        ],
                    })),
                },
                {
                    title: '📋 Error Summary',
                    text: this.formatBatchErrorSummary(alerts),
                },
            ],
        };
    }
    formatBatchErrorSummary(alerts) {
        const errorTypes = alerts.reduce((acc, alert) => {
            const type = alert.error instanceof Error ? alert.error.constructor.name : 'Unknown';
            acc[type] = (acc[type] || 0) + 1;
            return acc;
        }, {});
        let summary = '**Error Types:**\n';
        Object.entries(errorTypes).forEach(([type, count]) => {
            summary += `• ${type}: ${count}\n`;
        });
        return summary;
    }
};
exports.TeamsAlertService = TeamsAlertService;
exports.TeamsAlertService = TeamsAlertService = TeamsAlertService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], TeamsAlertService);
//# sourceMappingURL=teams-alert.service.js.map