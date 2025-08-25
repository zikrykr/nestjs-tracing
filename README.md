# @ce-service/core

A comprehensive NestJS utility package that provides **core infrastructure components** for building robust, production-ready services. Currently includes tracing, monitoring, and alerting capabilities, with a modular architecture designed for future expansion.

## 🎯 **What This Package Does**

- ✅ **Core Infrastructure**: Provides essential building blocks for production services
- ✅ **Observability**: OpenTelemetry integration with automatic tracing and metrics
- ✅ **Intelligent Alerting**: Teams integration with automatic error detection and context capture
- ✅ **Zero Code Changes**: Your existing business logic remains unchanged
- ✅ **Modular Design**: Easy to extend with additional functionality
- ✅ **Production Ready**: Built with enterprise-grade reliability and performance

## 🚀 **Quick Start**

### 1. Install the package

```bash
npm install @ce-service/core
# or
yarn add @ce-service/core
```

### 2. Setup Service (Core Infrastructure)

```typescript
// app.module.ts - minimal changes
import { Module } from '@nestjs/common';
import { 
  TeamsAlertService, 
  SlackAlertService, 
  GoogleChatAlertService,
  UnifiedAlertService 
} from '@ce-service/core';

@Module({
  imports: [
    // ... your existing imports stay exactly the same
  ],
  providers: [
    // ... your existing providers stay exactly the same
    
    // Choose your alert provider(s):
    TeamsAlertService,     // Microsoft Teams
    SlackAlertService,     // Slack
    GoogleChatAlertService, // Google Chat
    
    // Or use the unified service (recommended):
    {
      provide: UnifiedAlertService,
      useFactory: (teams, slack, googleChat) => 
        new UnifiedAlertService([teams, slack, googleChat]),
      inject: [TeamsAlertService, SlackAlertService, GoogleChatAlertService],
    },
  ],
  exports: [
    // ... your existing exports stay exactly the same
    UnifiedAlertService, // or individual providers
  ],
})
export class AppModule {}
```

### 3. Initialize Observability (in main.ts)

```typescript
// main.ts
import { setupOpenTelemetry } from '@ce-service/core';

// Option 1: Use environment variables (simplest)
setupOpenTelemetry(); // Automatically reads from env vars

// Option 2: Explicit configuration
setupOpenTelemetry({
  serviceName: 'my-service',
  environment: 'production',
  otlpEndpoint: 'http://localhost:4318/v1/traces'
});

// Option 3: Partial configuration (mix of env vars and explicit)
setupOpenTelemetry({
  serviceName: 'my-service' // Only override what you need
});

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(3000);
}
bootstrap();
```

### 4. Use Infrastructure Decorators

```typescript
import { Injectable } from '@nestjs/common';
import { Trace } from '@ce-service/core';

@Injectable()
export class UserService {
  // Basic tracing with Teams alerts enabled by default
  @Trace()
  async findUser(id: string) {
    // Your existing code - NO CHANGES NEEDED!
    // Teams alerts are automatically sent when errors occur
    const user = await this.database.findUser(id);
    if (!user) {
      throw new Error(`User not found: ${id}`);
    }
    return user;
  }

  // Custom configuration with Teams alerting
  @Trace({
    severity: 'critical',
    businessImpact: 'critical',
    customContext: {
      operation: 'payment_processing',
      businessUnit: 'finance'
    }
  })
  async processPayment(paymentData: any) {
    // Your existing code - NO CHANGES NEEDED!
    // Teams alerts are automatically sent when errors occur
    return await this.paymentGateway.process(paymentData);
  }
}
```

## 🎨 **Available Decorators**

### `@Trace()` - Observability Decorator

The main decorator that provides tracing, monitoring, and Teams alerting:

```typescript
// Basic usage (Teams alerts enabled by default)
@Trace()
async basicMethod() { /* ... */ }

// Custom span name
@Trace('custom.operation.name')
async customMethod() { /* ... */ }

// Full configuration
@Trace({
  severity: 'critical',
  businessImpact: 'critical',
  userAffected: true,
  customContext: { operation: 'payment' }
})
async criticalMethod() { /* ... */ }
```

### `@TraceAsync()` - Async Operations

```typescript
@TraceAsync('custom.operation.name')
async asyncMethod() { /* ... */ }
```

## 🔧 **Configuration Options**

### OpenTelemetry Configuration
```typescript
interface OpenTelemetryConfig {
  serviceName: string;
  environment: string;
  otlpEndpoint: string;
  serviceVersion?: string;
  otlpHeaders?: string;
}
```

### Teams Alerting Configuration
The `TeamsAlertService` automatically reads from environment variables:

```typescript
// Environment variables (set in .env file or system)
TEAMS_WEBHOOK_URL=https://your-webhook-url
JAEGER_BASE_URL=https://your-jaeger-url
APP_NAME=my-service
NODE_ENV=production
```

### Setup Examples

```typescript
// Minimal setup - just add TeamsAlertService to your module
@Module({
  providers: [
    // ... your existing providers
    TeamsAlertService, // add this line
  ],
  exports: [TeamsAlertService],
})
export class AppModule {}

// OpenTelemetry setup in main.ts
setupOpenTelemetry({
  serviceName: 'my-service',
  environment: 'production',
  otlpEndpoint: 'http://localhost:4318/v1/traces'
});

// Environment variables for Teams alerts
TEAMS_WEBHOOK_URL=https://your-webhook-url
JAEGER_BASE_URL=https://your-jaeger-url
APP_NAME=my-service
NODE_ENV=production
```

## 📱 **Alerting Features**

When errors occur, you automatically get:
- 🚨 Error details and stack trace
- 🔍 Direct link to Jaeger trace
- 👤 User context (if available)
- 🌐 HTTP context (if available)
- 📊 Business impact and severity
- 🕒 Timestamp and duration

## 🌍 **Environment Variables**

```bash
# Teams Alerting
TEAMS_WEBHOOK_URL=https://your-org.webhook.office.com/webhookb2/your-url

# Slack Alerting
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/your-webhook
SLACK_CHANNEL=#alerts
SLACK_USERNAME=Error Bot

# Google Chat Alerting
GOOGLE_CHAT_WEBHOOK_URL=https://chat.googleapis.com/v1/spaces/your-space/webhooks/your-webhook
GOOGLE_CHAT_THREAD_KEY=your-thread-key

# Required for Jaeger Integration
JAEGER_BASE_URL=https://your-jaeger-instance.com

# OpenTelemetry Configuration (all optional with defaults)
SERVICE_NAME=my-service
SERVICE_VERSION=1.0.0
NODE_ENV=production
OTLP_ENDPOINT=http://localhost:4318/v1/traces
OTLP_HEADERS=Bearer your-token

# Alternative names (for compatibility)
APP_NAME=my-service
APP_VERSION=1.0.0
ENVIRONMENT=production
```

## 📊 **What Gets Captured Automatically**

The decorator automatically captures:

```typescript
// Method information
{
  'service.name': 'UserService',
  'method.name': 'findUser',
  'method.args.count': 1,
  'method.arg.0.id': 'user123',
  
  // Alert attributes
  'teams.alert.enabled': true,
  'teams.alert.severity': 'critical',
  'teams.alert.business_impact': 'critical',
  'teams.alert.user_affected': true,
  
  // Custom context
  'operation': 'user_lookup',
  'businessUnit': 'onboarding'
}
```

## 🚨 **Error Classification**

The decorator automatically detects critical errors:

- **Error Types**: `DatabaseConnectionError`, `AuthenticationError`, `PaymentProcessingError`
- **Keywords**: `connection failed`, `authentication failed`, `payment failed`, `critical`, `fatal`
- **HTTP Status**: 5xx, 401, 403

## 🔧 **Troubleshooting**

### Alerts not working?
- Verify `TEAMS_WEBHOOK_URL` is set in environment variables
- Check Teams channel permissions
- Ensure `TeamsAlertService` is added to your module providers

### Missing context in alerts?
- Use `customContext` in decorators
- Ensure method arguments have safe properties (id, type, status, etc.)

### Too many alerts?
- Use appropriate severity levels
- Set `alertOnError: false` for specific methods

### TeamsAlertService not found?
- Make sure `TeamsAlertService` is in your module's providers array
- No need to install `@nestjs/config` - it reads from `process.env` directly

## 🎉 **Benefits**

- **Core Infrastructure**: Provides essential utilities every production service needs
- **Zero Business Logic Changes**: Your core business logic remains untouched
- **Automatic Error Handling**: Teams alerts are sent automatically when errors occur
- **Rich Context**: Method arguments are automatically captured and included in alerts
- **Consistent Behavior**: All decorated methods behave the same way
- **Easy Maintenance**: Infrastructure logic is centralized and reusable
- **Team Adoption**: Developers can easily add infrastructure capabilities to any method

## 🔔 **Modular Alerting System**

The alerting system is designed to be completely modular and extensible:

### **Available Alert Providers**

- **Microsoft Teams**: `TeamsAlertService` - Rich message cards with buttons
- **Slack**: `SlackAlertService` - Slack webhook integration with attachments
- **Google Chat**: `GoogleChatAlertService` - Google Chat cards with widgets

### **Unified Alert Service**

Use `UnifiedAlertService` to send alerts to ALL configured providers simultaneously:

```typescript
// Sends to all configured providers at once
const unifiedAlert = app.get(UnifiedAlertService);

// Sends to Teams, Slack, and Google Chat simultaneously
await unifiedAlert.sendErrorAlert(alertData);
```

### **Easy to Add New Providers**

Create a new alert provider by implementing the `AlertProvider` interface:

```typescript
@Injectable()
export class DiscordAlertService implements AlertProvider {
  // Implement the required methods
  async sendErrorAlert(alertData: ErrorAlertData): Promise<void> { /* ... */ }
  async sendCriticalErrorAlert(alertData: ErrorAlertData): Promise<void> { /* ... */ }
  async sendBatchErrorAlerts(alerts: ErrorAlertData[]): Promise<void> { /* ... */ }
  isConfigured(): boolean { /* ... */ }
  getProviderName(): string { return 'Discord'; }
}
```

### **Environment-Based Configuration**

Set which providers to use via environment variables:

```bash
# Use Teams
TEAMS_WEBHOOK_URL=https://your-webhook

# Use Slack
SLACK_WEBHOOK_URL=https://your-slack-webhook

# Use Google Chat
GOOGLE_CHAT_WEBHOOK_URL=https://your-google-chat-webhook

# Use multiple providers for redundancy and maximum coverage
TEAMS_WEBHOOK_URL=https://your-webhook
SLACK_WEBHOOK_URL=https://your-slack-webhook
GOOGLE_CHAT_WEBHOOK_URL=https://your-google-chat-webhook

### **Benefits of Multi-Provider Approach**

- **🚀 Maximum Coverage**: Alerts are sent to all configured platforms simultaneously
- **🔄 Redundancy**: If one provider fails, others still deliver the alert
- **👥 Team Flexibility**: Different teams can use their preferred platform
- **📱 Multi-Device**: Alerts appear on Teams, Slack, and Google Chat at the same time
- **⚡ Parallel Delivery**: All providers are contacted simultaneously, not sequentially
- **📊 Detailed Logging**: See which providers succeeded and which failed

## 🤝 **Contributing**

## 📄 **License**

MIT License - see [LICENSE](LICENSE) file for details.
