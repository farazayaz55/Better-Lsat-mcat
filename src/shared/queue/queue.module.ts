import { Module, Global } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bull';
import { QueueConfig } from './queue.config';

@Global()
@Module({
  imports: [
    ConfigModule,
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const queueConfig = new QueueConfig(configService);
        return {
          redis: queueConfig.getRedisConfig(),
          defaultJobOptions: queueConfig.getDefaultJobOptions(),
        };
      },
      inject: [ConfigService],
    }),
  ],
  providers: [QueueConfig],
  exports: [QueueConfig, BullModule],
})
export class QueueModule {}

/**
 * Helper function to register a queue for any feature module
 * Usage in your feature module:
 * imports: [
 *   createQueueAsync('my-queue-name'),
 * ]
 */
export function createQueueAsync(name: string) {
  return BullModule.registerQueueAsync({
    name,
    imports: [ConfigModule],
    inject: [ConfigService],
    useFactory: (configService: ConfigService) => {
      const queueConfig = new QueueConfig(configService);
      return {
        redis: queueConfig.getRedisConfig(),
        defaultJobOptions: queueConfig.getDefaultJobOptions(),
      };
    },
  });
}
