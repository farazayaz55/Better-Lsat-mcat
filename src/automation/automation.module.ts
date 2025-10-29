import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bull';
import { AutomationConfig } from './entities/automation-config.entity';
import { AutomationLog } from './entities/automation-log.entity';
import { AutomationConfigService } from './services/automation-config.service';
import { AutomationRegistryService } from './services/automation-registry.service';
import { ToolRegistryService } from './services/tool-registry.service';
import { AutomationExecutorService } from './services/automation-executor.service';
import { AutomationConfigController } from './controllers/automation-config.controller';
import { EmailTool } from './tools/email/email.tool';
import { SmsTool } from './tools/sms/sms.tool';
import { SlackTool } from './tools/slack/slack.tool';
import { OrderConfirmationAutomation } from './automations/order-confirmation.automation';
import { Reminder24hAutomation } from './automations/reminder-24h.automation';
import { Reminder30minAutomation } from './automations/reminder-30min.automation';
import { SlackOrderNotificationAutomation } from './automations/slack-order-notification.automation';
import { OrderConfirmationSmsAutomation } from './automations/order-confirmation-sms.automation';
import { Reminder24hSmsAutomation } from './automations/reminder-24h-sms.automation';
import { Reminder30minSmsAutomation } from './automations/reminder-30min-sms.automation';
import { SharedModule } from '../shared/shared.module';
import { AutomationProcessor } from './queues/automation.processor';
import { QueueConfig } from '../shared/queue/queue.config';

@Module({
  imports: [
    TypeOrmModule.forFeature([AutomationConfig, AutomationLog]),
    ConfigModule,
    // Register the automation queue with Bull
    BullModule.registerQueueAsync({
      name: 'automation',
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const queueConfig = new QueueConfig(configService);
        return {
          redis: queueConfig.getRedisConfig(),
          defaultJobOptions: queueConfig.getDefaultJobOptions(),
        };
      },
    }),
    SharedModule,
  ],
  providers: [
    // Services
    AutomationConfigService,
    AutomationRegistryService,
    ToolRegistryService,
    AutomationExecutorService,
    // Queue Processor
    AutomationProcessor, // Processor is registered here to access all services
    // Tools
    EmailTool,
    SmsTool,
    SlackTool,
    // Automations
    OrderConfirmationAutomation,
    Reminder24hAutomation,
    Reminder30minAutomation,
    SlackOrderNotificationAutomation,
    // SMS Automations
    OrderConfirmationSmsAutomation,
    Reminder24hSmsAutomation,
    Reminder30minSmsAutomation,
  ],
  controllers: [AutomationConfigController],
  exports: [
    AutomationConfigService,
    AutomationRegistryService,
    ToolRegistryService,
    AutomationExecutorService,
  ],
})
export class AutomationModule {}
