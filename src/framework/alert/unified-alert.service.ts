import { Injectable, Logger } from '@nestjs/common';
import { AlertProvider, ErrorAlertData } from './alert.interface';
import { TeamsAlertService } from './teams-alert.service';
import { SlackAlertService } from './slack-alert.service';
import { GoogleChatAlertService } from './google-chat-alert.service';

@Injectable()
export class UnifiedAlertService {
  private readonly logger = new Logger(UnifiedAlertService.name);
  private readonly providers: AlertProvider[];

  constructor(
    private teamsAlertService: TeamsAlertService,
    private slackAlertService: SlackAlertService,
    private googleChatAlertService: GoogleChatAlertService,
  ) {
    this.providers = [
      teamsAlertService,
      slackAlertService,
      googleChatAlertService,
    ];
    this.logAvailableProviders();
  }

  /**
   * Send error alert to all configured providers
   */
  async sendErrorAlert(alertData: ErrorAlertData): Promise<void> {
    const configuredProviders = this.getConfiguredProviders();
    if (configuredProviders.length === 0) {
      this.logger.warn('No alert providers configured, skipping alert');
      return;
    }

    const results = await Promise.allSettled(
      configuredProviders.map((provider) =>
        provider
          .sendErrorAlert(alertData)
          .then(() => ({ provider: provider.getProviderName(), success: true }))
          .catch((error) => ({
            provider: provider.getProviderName(),
            success: false,
            error,
          })),
      ),
    );

    this.logAlertResults(results, 'Error alert');
  }

  /**
   * Send critical error alert to all configured providers
   */
  async sendCriticalErrorAlert(alertData: ErrorAlertData): Promise<void> {
    const configuredProviders = this.getConfiguredProviders();
    if (configuredProviders.length === 0) {
      this.logger.warn(
        'No alert providers configured, skipping critical alert',
      );
      return;
    }

    const results = await Promise.allSettled(
      configuredProviders.map((provider) =>
        provider
          .sendCriticalErrorAlert(alertData)
          .then(() => ({ provider: provider.getProviderName(), success: true }))
          .catch((error) => ({
            provider: provider.getProviderName(),
            success: false,
            error,
          })),
      ),
    );

    this.logAlertResults(results, 'Critical error alert');
  }

  /**
   * Send batch error alerts to all configured providers
   */
  async sendBatchErrorAlerts(alerts: ErrorAlertData[]): Promise<void> {
    if (alerts.length === 0) return;

    const configuredProviders = this.getConfiguredProviders();
    if (configuredProviders.length === 0) {
      this.logger.warn('No alert providers configured, skipping batch alert');
      return;
    }

    const results = await Promise.allSettled(
      configuredProviders.map((provider) =>
        provider
          .sendBatchErrorAlerts(alerts)
          .then(() => ({ provider: provider.getProviderName(), success: true }))
          .catch((error) => ({
            provider: provider.getProviderName(),
            success: false,
            error,
          })),
      ),
    );

    this.logAlertResults(results, 'Batch error alert');
  }

  /**
   * Get all configured providers
   */
  private getConfiguredProviders(): AlertProvider[] {
    return this.providers.filter((p) => p.isConfigured());
  }

  /**
   * Log the results of sending alerts to all providers
   */
  private logAlertResults(
    results: PromiseSettledResult<any>[],
    alertType: string,
  ): void {
    const successful = results.filter(
      (r): r is PromiseFulfilledResult<any> =>
        r.status === 'fulfilled' && r.value.success,
    );
    const failed = results.filter(
      (r): r is PromiseFulfilledResult<any> =>
        r.status === 'fulfilled' && !r.value.success,
    );
    const rejected = results.filter(
      (r): r is PromiseRejectedResult => r.status === 'rejected',
    );

    if (successful.length > 0) {
      const providerNames = successful.map((r) => r.value.provider).join(', ');
      this.logger.log(`${alertType} sent successfully via: ${providerNames}`);
    }

    if (failed.length > 0) {
      failed.forEach((result) => {
        this.logger.error(
          `${alertType} failed via ${result.value.provider}:`,
          result.value.error,
        );
      });
    }

    if (rejected.length > 0) {
      rejected.forEach((result) => {
        this.logger.error(`${alertType} rejected via provider:`, result.reason);
      });
    }

    // Log summary
    const total = results.length;
    const successCount = successful.length;
    const failureCount = failed.length + rejected.length;

    if (failureCount > 0) {
      this.logger.warn(
        `${alertType} summary: ${successCount}/${total} providers succeeded, ${failureCount}/${total} failed`,
      );
    } else {
      this.logger.log(`${alertType} summary: All ${total} providers succeeded`);
    }
  }

  /**
   * Log available providers for debugging
   */
  private logAvailableProviders(): void {
    const configuredProviders = this.providers.filter((p) => p.isConfigured());
    const unconfiguredProviders = this.providers.filter(
      (p) => !p.isConfigured(),
    );

    if (configuredProviders.length > 0) {
      this.logger.log(
        `Alert providers configured: ${configuredProviders.map((p) => p.getProviderName()).join(', ')}`,
      );
    }

    if (unconfiguredProviders.length > 0) {
      this.logger.log(
        `Alert providers not configured: ${unconfiguredProviders.map((p) => p.getProviderName()).join(', ')}`,
      );
    }

    if (this.providers.length === 0) {
      this.logger.warn('No alert providers registered');
    }
  }

  /**
   * Get status of all providers
   */
  getProvidersStatus(): Array<{ name: string; configured: boolean }> {
    return this.providers.map((provider) => ({
      name: provider.getProviderName(),
      configured: provider.isConfigured(),
    }));
  }
} 