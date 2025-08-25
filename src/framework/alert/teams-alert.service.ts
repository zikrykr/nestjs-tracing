import { Injectable, Logger } from '@nestjs/common';
import { AlertProvider, AlertProviderConfig, ErrorAlertData } from './alert.interface';

export interface TeamsAlertConfig extends AlertProviderConfig {
  webhookUrl: string;
}

@Injectable()
export class TeamsAlertService implements AlertProvider {
  private readonly logger = new Logger(TeamsAlertService.name);
  private readonly config: TeamsAlertConfig;

  constructor() {
    this.config = {
      webhookUrl: process.env.TEAMS_WEBHOOK_URL || '',
      environment: process.env.NODE_ENV || 'development',
      serviceName: process.env.APP_NAME || 'ce-service',
      jaegerBaseUrl: process.env.JAEGER_BASE_URL || 'http://localhost:16686',
    };
  }

  isConfigured(): boolean {
    return !!this.config.webhookUrl;
  }

  getProviderName(): string {
    return 'Microsoft Teams';
  }

  /**
   * Send error alert to Microsoft Teams
   */
  async sendErrorAlert(alertData: ErrorAlertData): Promise<void> {
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
    } catch (error) {
      this.logger.error('Failed to send Teams alert:', error);
    }
  }

  /**
   * Build Microsoft Teams message card
   */
  private buildTeamsMessage(alertData: ErrorAlertData): any {
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

    // Add additional context
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

  /**
   * Build Jaeger trace URL
   */
  private buildJaegerUrl(traceId: string): string {
    return `${this.config.jaegerBaseUrl}/trace/${traceId}`;
  }

  /**
   * Get theme color based on environment
   */
  private getThemeColor(environment: string): string {
    switch (environment.toLowerCase()) {
      case 'production':
        return 'FF0000'; // Red
      case 'staging':
        return 'FF8C00'; // Orange
      case 'development':
        return 'FFD700'; // Gold
      default:
        return '808080'; // Gray
    }
  }

  /**
   * Format error details for Teams message
   */
  private formatErrorDetails(error: Error | string): string {
    if (error instanceof Error) {
      let details = `**Message:** ${error.message}\n`;
      
      if (error.stack) {
        // Limit stack trace to first few lines to avoid message size issues
        const stackLines = error.stack.split('\n').slice(0, 5);
        details += `**Stack Trace:**\n\`\`\`\n${stackLines.join('\n')}\n\`\`\``;
      }

      if ((error as any).code) {
        details += `\n**Error Code:** ${(error as any).code}`;
      }

      return details;
    }

    return `**Error:** ${String(error)}`;
  }

  /**
   * Send critical error alert (for production issues)
   */
  async sendCriticalErrorAlert(alertData: ErrorAlertData): Promise<void> {
    // Add critical flag to trigger immediate attention
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

  /**
   * Send batch error alerts (for multiple errors)
   */
  async sendBatchErrorAlerts(alerts: ErrorAlertData[]): Promise<void> {
    if (alerts.length === 0) return;

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
    } catch (error) {
      this.logger.error('Failed to send batch Teams alert:', error);
    }
  }

  /**
   * Build batch error message
   */
  private buildBatchMessage(alerts: ErrorAlertData[]): any {
    const uniqueTraces = [...new Set(alerts.map(a => a.traceId))];
    const jaegerUrls = uniqueTraces.map(traceId => this.buildJaegerUrl(traceId));

    return {
      '@type': 'MessageCard',
      '@context': 'http://schema.org/extensions',
      themeColor: 'FF0000', // Red for batch errors
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

  /**
   * Format batch error summary
   */
  private formatBatchErrorSummary(alerts: ErrorAlertData[]): string {
    const errorTypes = alerts.reduce((acc, alert) => {
      const type = alert.error instanceof Error ? alert.error.constructor.name : 'Unknown';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    let summary = '**Error Types:**\n';
    Object.entries(errorTypes).forEach(([type, count]) => {
      summary += `• ${type}: ${count}\n`;
    });

    return summary;
  }
} 