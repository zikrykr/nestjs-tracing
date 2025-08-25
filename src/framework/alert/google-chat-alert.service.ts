import { Injectable, Logger } from '@nestjs/common';
import { AlertProvider, AlertProviderConfig, ErrorAlertData } from './alert.interface';

export interface GoogleChatAlertConfig extends AlertProviderConfig {
  webhookUrl: string;
  threadKey?: string;
}

@Injectable()
export class GoogleChatAlertService implements AlertProvider {
  private readonly logger = new Logger(GoogleChatAlertService.name);
  private readonly config: GoogleChatAlertConfig;

  constructor() {
    this.config = {
      webhookUrl: process.env.GOOGLE_CHAT_WEBHOOK_URL || '',
      threadKey: process.env.GOOGLE_CHAT_THREAD_KEY || '',
      environment: process.env.NODE_ENV || 'development',
      serviceName: process.env.APP_NAME || 'ce-service',
      jaegerBaseUrl: process.env.JAEGER_BASE_URL || 'http://localhost:16686',
    };
  }

  isConfigured(): boolean {
    return !!this.config.webhookUrl;
  }

  getProviderName(): string {
    return 'Google Chat';
  }

  async sendErrorAlert(alertData: ErrorAlertData): Promise<void> {
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
    } catch (error) {
      this.logger.error('Failed to send Google Chat alert:', error);
    }
  }

  async sendCriticalErrorAlert(alertData: ErrorAlertData): Promise<void> {
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

  async sendBatchErrorAlerts(alerts: ErrorAlertData[]): Promise<void> {
    if (alerts.length === 0) return;

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
    } catch (error) {
      this.logger.error('Failed to send batch Google Chat alert:', error);
    }
  }

  private buildChatMessage(alertData: ErrorAlertData): any {
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

    const message: any = {
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

    // Add thread key if configured
    if (this.config.threadKey) {
      message.thread = {
        name: this.config.threadKey,
      };
    }

    return message;
  }

  private buildBatchMessage(alerts: ErrorAlertData[]): any {
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

    const message: any = {
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

    // Add thread key if configured
    if (this.config.threadKey) {
      message.thread = {
        name: this.config.threadKey,
      };
    }

    return message;
  }

  private buildJaegerUrl(traceId: string): string {
    return `${this.config.jaegerBaseUrl}/trace/${traceId}`;
  }
} 