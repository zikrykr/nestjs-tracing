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
var GoogleChatAlertService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.GoogleChatAlertService = void 0;
const common_1 = require("@nestjs/common");
let GoogleChatAlertService = GoogleChatAlertService_1 = class GoogleChatAlertService {
    logger = new common_1.Logger(GoogleChatAlertService_1.name);
    config;
    constructor() {
        this.config = {
            webhookUrl: process.env.GOOGLE_CHAT_WEBHOOK_URL || '',
            threadKey: process.env.GOOGLE_CHAT_THREAD_KEY || '',
            environment: process.env.NODE_ENV || 'development',
            serviceName: process.env.APP_NAME || 'ce-service',
            jaegerBaseUrl: process.env.JAEGER_BASE_URL || 'http://localhost:16686',
        };
    }
    isConfigured() {
        return !!this.config.webhookUrl;
    }
    getProviderName() {
        return 'Google Chat';
    }
    async sendErrorAlert(alertData) {
        try {
            if (!this.isConfigured()) {
                this.logger.warn('Google Chat webhook URL not configured, skipping alert');
                return;
            }
            const chatMessage = this.buildChatMessage(alertData);
            const response = await fetch(this.config.webhookUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(chatMessage),
            });
            if (!response.ok) {
                throw new Error(`Google Chat API responded with status: ${response.status}`);
            }
            this.logger.log(`Error alert sent to Google Chat successfully for trace: ${alertData.traceId}`);
        }
        catch (error) {
            this.logger.error('Failed to send Google Chat alert:', error);
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
                this.logger.warn('Google Chat webhook URL not configured, skipping batch alert');
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
                throw new Error(`Google Chat API responded with status: ${response.status}`);
            }
            this.logger.log(`Batch error alert sent to Google Chat successfully for ${alerts.length} errors`);
        }
        catch (error) {
            this.logger.error('Failed to send batch Google Chat alert:', error);
        }
    }
    buildChatMessage(alertData) {
        const errorMessage = alertData.error instanceof Error
            ? alertData.error.message
            : String(alertData.error);
        const errorType = alertData.error instanceof Error
            ? alertData.error.constructor.name
            : 'Unknown';
        const jaegerUrl = this.buildJaegerUrl(alertData.traceId);
        const widgets = [
            {
                keyValue: {
                    topLabel: 'Environment',
                    content: this.config.environment,
                },
            },
            {
                keyValue: {
                    topLabel: 'Service',
                    content: this.config.serviceName,
                },
            },
            {
                keyValue: {
                    topLabel: 'Error Type',
                    content: errorType,
                },
            },
            {
                keyValue: {
                    topLabel: 'Trace ID',
                    content: alertData.traceId,
                },
            },
        ];
        if (alertData.methodName) {
            widgets.push({
                keyValue: {
                    topLabel: 'Method',
                    content: alertData.methodName,
                },
            });
        }
        if (alertData.httpMethod && alertData.httpUrl) {
            widgets.push({
                keyValue: {
                    topLabel: 'HTTP Request',
                    content: `${alertData.httpMethod} ${alertData.httpUrl}`,
                },
            });
        }
        const message = {
            cards: [
                {
                    header: {
                        title: '🚨 Error Alert',
                        subtitle: new Date().toLocaleString(),
                    },
                    sections: [
                        {
                            widgets: [
                                {
                                    textParagraph: {
                                        text: `An error occurred in <b>${this.config.serviceName}</b> service.`,
                                    },
                                },
                                ...widgets,
                            ],
                        },
                        {
                            widgets: [
                                {
                                    buttons: [
                                        {
                                            textButton: {
                                                text: 'View in Jaeger',
                                                onClick: {
                                                    openLink: {
                                                        url: jaegerUrl,
                                                    },
                                                },
                                            },
                                        },
                                    ],
                                },
                            ],
                        },
                    ],
                },
            ],
        };
        if (this.config.threadKey) {
            message.thread = {
                name: this.config.threadKey,
            };
        }
        return message;
    }
    buildBatchMessage(alerts) {
        const uniqueTraces = [...new Set(alerts.map(a => a.traceId))];
        const jaegerUrls = uniqueTraces.map(traceId => this.buildJaegerUrl(traceId));
        const widgets = [
            {
                keyValue: {
                    topLabel: 'Environment',
                    content: this.config.environment,
                },
            },
            {
                keyValue: {
                    topLabel: 'Service',
                    content: this.config.serviceName,
                },
            },
            {
                keyValue: {
                    topLabel: 'Error Count',
                    content: alerts.length.toString(),
                },
            },
            {
                keyValue: {
                    topLabel: 'Unique Traces',
                    content: uniqueTraces.length.toString(),
                },
            },
        ];
        const buttons = uniqueTraces.map((traceId, index) => ({
            textButton: {
                text: `Trace ${index + 1}`,
                onClick: {
                    openLink: {
                        url: jaegerUrls[index],
                    },
                },
            },
        }));
        const message = {
            cards: [
                {
                    header: {
                        title: '🚨 Batch Error Alert',
                        subtitle: new Date().toLocaleString(),
                    },
                    sections: [
                        {
                            widgets: [
                                {
                                    textParagraph: {
                                        text: `<b>${alerts.length} errors</b> detected in <b>${this.config.serviceName}</b> service.`,
                                    },
                                },
                                ...widgets,
                            ],
                        },
                        {
                            widgets: [
                                {
                                    buttons: buttons,
                                },
                            ],
                        },
                    ],
                },
            ],
        };
        if (this.config.threadKey) {
            message.thread = {
                name: this.config.threadKey,
            };
        }
        return message;
    }
    buildJaegerUrl(traceId) {
        return `${this.config.jaegerBaseUrl}/trace/${traceId}`;
    }
};
exports.GoogleChatAlertService = GoogleChatAlertService;
exports.GoogleChatAlertService = GoogleChatAlertService = GoogleChatAlertService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], GoogleChatAlertService);
//# sourceMappingURL=google-chat-alert.service.js.map