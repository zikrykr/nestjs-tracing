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
var SlackAlertService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SlackAlertService = void 0;
const common_1 = require("@nestjs/common");
let SlackAlertService = SlackAlertService_1 = class SlackAlertService {
    logger = new common_1.Logger(SlackAlertService_1.name);
    config;
    constructor() {
        this.config = {
            webhookUrl: process.env.SLACK_WEBHOOK_URL || '',
            channel: process.env.SLACK_CHANNEL || '#alerts',
            username: process.env.SLACK_USERNAME || 'Error Bot',
            environment: process.env.NODE_ENV || 'development',
            serviceName: process.env.APP_NAME || 'ce-service',
            jaegerBaseUrl: process.env.JAEGER_BASE_URL || 'http://localhost:16686',
        };
    }
    isConfigured() {
        return !!this.config.webhookUrl;
    }
    getProviderName() {
        return 'Slack';
    }
    async sendErrorAlert(alertData) {
        try {
            if (!this.isConfigured()) {
                this.logger.warn('Slack webhook URL not configured, skipping alert');
                return;
            }
            const slackMessage = this.buildSlackMessage(alertData);
            const response = await fetch(this.config.webhookUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(slackMessage),
            });
            if (!response.ok) {
                throw new Error(`Slack API responded with status: ${response.status}`);
            }
            this.logger.log(`Error alert sent to Slack successfully for trace: ${alertData.traceId}`);
        }
        catch (error) {
            this.logger.error('Failed to send Slack alert:', error);
        }
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
            if (!this.isConfigured()) {
                this.logger.warn('Slack webhook URL not configured, skipping batch alert');
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
                throw new Error(`Slack API responded with status: ${response.status}`);
            }
            this.logger.log(`Batch error alert sent to Slack successfully for ${alerts.length} errors`);
        }
        catch (error) {
            this.logger.error('Failed to send batch Slack alert:', error);
        }
    }
    buildSlackMessage(alertData) {
        const errorMessage = alertData.error instanceof Error
            ? alertData.error.message
            : String(alertData.error);
        const errorType = alertData.error instanceof Error
            ? alertData.error.constructor.name
            : 'Unknown';
        const jaegerUrl = this.buildJaegerUrl(alertData.traceId);
        const fields = [
            {
                title: 'Environment',
                value: this.config.environment,
                short: true,
            },
            {
                title: 'Service',
                value: this.config.serviceName,
                short: true,
            },
            {
                title: 'Error Type',
                value: errorType,
                short: true,
            },
            {
                title: 'Trace ID',
                value: alertData.traceId,
                short: true,
            },
        ];
        if (alertData.methodName) {
            fields.push({
                title: 'Method',
                value: alertData.methodName,
                short: true,
            });
        }
        if (alertData.httpMethod && alertData.httpUrl) {
            fields.push({
                title: 'HTTP Request',
                value: `${alertData.httpMethod} ${alertData.httpUrl}`,
                short: false,
            });
        }
        return {
            channel: this.config.channel,
            username: this.config.username,
            icon_emoji: ':warning:',
            attachments: [
                {
                    color: this.getColor(this.config.environment),
                    title: '🚨 Error Alert',
                    text: `An error occurred in *${this.config.serviceName}* service.`,
                    fields: fields,
                    actions: [
                        {
                            type: 'button',
                            text: 'View in Jaeger',
                            url: jaegerUrl,
                            style: 'primary',
                        },
                    ],
                    footer: 'Error Alert System',
                    ts: Math.floor(Date.now() / 1000),
                },
            ],
        };
    }
    buildBatchMessage(alerts) {
        const uniqueTraces = [...new Set(alerts.map(a => a.traceId))];
        const jaegerUrls = uniqueTraces.map(traceId => this.buildJaegerUrl(traceId));
        return {
            channel: this.config.channel,
            username: this.config.username,
            icon_emoji: ':rotating_light:',
            attachments: [
                {
                    color: '#FF0000',
                    title: '🚨 Batch Error Alert',
                    text: `*${alerts.length} errors* detected in *${this.config.serviceName}* service.`,
                    fields: [
                        {
                            title: 'Environment',
                            value: this.config.environment,
                            short: true,
                        },
                        {
                            title: 'Error Count',
                            value: alerts.length.toString(),
                            short: true,
                        },
                        {
                            title: 'Unique Traces',
                            value: uniqueTraces.length.toString(),
                            short: true,
                        },
                    ],
                    actions: uniqueTraces.map((traceId, index) => ({
                        type: 'button',
                        text: `Trace ${index + 1}`,
                        url: jaegerUrls[index],
                        style: 'primary',
                    })),
                    footer: 'Error Alert System',
                    ts: Math.floor(Date.now() / 1000),
                },
            ],
        };
    }
    buildJaegerUrl(traceId) {
        return `${this.config.jaegerBaseUrl}/trace/${traceId}`;
    }
    getColor(environment) {
        switch (environment.toLowerCase()) {
            case 'production':
                return '#FF0000';
            case 'staging':
                return '#FF8C00';
            case 'development':
                return '#FFD700';
            default:
                return '#808080';
        }
    }
};
exports.SlackAlertService = SlackAlertService;
exports.SlackAlertService = SlackAlertService = SlackAlertService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], SlackAlertService);
//# sourceMappingURL=slack-alert.service.js.map