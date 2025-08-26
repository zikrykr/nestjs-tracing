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
var UnifiedAlertService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.UnifiedAlertService = void 0;
const common_1 = require("@nestjs/common");
let UnifiedAlertService = UnifiedAlertService_1 = class UnifiedAlertService {
    logger = new common_1.Logger(UnifiedAlertService_1.name);
    providers;
    constructor(providers) {
        this.providers = providers;
        this.logAvailableProviders();
    }
    async sendErrorAlert(alertData) {
        const configuredProviders = this.getConfiguredProviders();
        if (configuredProviders.length === 0) {
            this.logger.warn('No alert providers configured, skipping alert');
            return;
        }
        const results = await Promise.allSettled(configuredProviders.map(provider => provider.sendErrorAlert(alertData)
            .then(() => ({ provider: provider.getProviderName(), success: true }))
            .catch(error => ({ provider: provider.getProviderName(), success: false, error }))));
        this.logAlertResults(results, 'Error alert');
    }
    async sendCriticalErrorAlert(alertData) {
        const configuredProviders = this.getConfiguredProviders();
        if (configuredProviders.length === 0) {
            this.logger.warn('No alert providers configured, skipping critical alert');
            return;
        }
        const results = await Promise.allSettled(configuredProviders.map(provider => provider.sendCriticalErrorAlert(alertData)
            .then(() => ({ provider: provider.getProviderName(), success: true }))
            .catch(error => ({ provider: provider.getProviderName(), success: false, error }))));
        this.logAlertResults(results, 'Critical error alert');
    }
    async sendBatchErrorAlerts(alerts) {
        if (alerts.length === 0)
            return;
        const configuredProviders = this.getConfiguredProviders();
        if (configuredProviders.length === 0) {
            this.logger.warn('No alert providers configured, skipping batch alert');
            return;
        }
        const results = await Promise.allSettled(configuredProviders.map(provider => provider.sendBatchErrorAlerts(alerts)
            .then(() => ({ provider: provider.getProviderName(), success: true }))
            .catch(error => ({ provider: provider.getProviderName(), success: false, error }))));
        this.logAlertResults(results, 'Batch error alert');
    }
    getConfiguredProviders() {
        return this.providers.filter(p => p.isConfigured());
    }
    logAlertResults(results, alertType) {
        const successful = results.filter((r) => r.status === 'fulfilled' && r.value.success);
        const failed = results.filter((r) => r.status === 'fulfilled' && !r.value.success);
        const rejected = results.filter((r) => r.status === 'rejected');
        if (successful.length > 0) {
            const providerNames = successful.map(r => r.value.provider).join(', ');
            this.logger.log(`${alertType} sent successfully via: ${providerNames}`);
        }
        if (failed.length > 0) {
            failed.forEach(result => {
                this.logger.error(`${alertType} failed via ${result.value.provider}:`, result.value.error);
            });
        }
        if (rejected.length > 0) {
            rejected.forEach(result => {
                this.logger.error(`${alertType} rejected via provider:`, result.reason);
            });
        }
        const total = results.length;
        const successCount = successful.length;
        const failureCount = failed.length + rejected.length;
        if (failureCount > 0) {
            this.logger.warn(`${alertType} summary: ${successCount}/${total} providers succeeded, ${failureCount}/${total} failed`);
        }
        else {
            this.logger.log(`${alertType} summary: All ${total} providers succeeded`);
        }
    }
    logAvailableProviders() {
        const configuredProviders = this.providers.filter(p => p.isConfigured());
        const unconfiguredProviders = this.providers.filter(p => !p.isConfigured());
        if (configuredProviders.length > 0) {
            this.logger.log(`Alert providers configured: ${configuredProviders.map(p => p.getProviderName()).join(', ')}`);
        }
        if (unconfiguredProviders.length > 0) {
            this.logger.log(`Alert providers not configured: ${unconfiguredProviders.map(p => p.getProviderName()).join(', ')}`);
        }
        if (this.providers.length === 0) {
            this.logger.warn('No alert providers registered');
        }
    }
    getProvidersStatus() {
        return this.providers.map(provider => ({
            name: provider.getProviderName(),
            configured: provider.isConfigured(),
        }));
    }
};
exports.UnifiedAlertService = UnifiedAlertService;
exports.UnifiedAlertService = UnifiedAlertService = UnifiedAlertService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [Array])
], UnifiedAlertService);
//# sourceMappingURL=unified-alert.service.js.map