import { ConfigService } from '@nestjs/config';
import { Injectable } from '@nestjs/common';
import { QueueOptions } from 'bull';

@Injectable()
export class QueueConfig {
  constructor(private configService: ConfigService) {}

  getRedisConfig(): QueueOptions['redis'] {
    return {
      host: this.configService.get<string>('REDIS_HOST', 'localhost'),
      port: this.configService.get<number>('REDIS_PORT', 6379),
      retryStrategy: (times: number) => {
        // Retry connection up to 10 times with exponential backoff
        if (times > 10) {
          return undefined; // Give up after 10 retries
        }
        return Math.min(times * 50, 2000);
      },
    };
  }

  getDefaultJobOptions(): QueueOptions['defaultJobOptions'] {
    return {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
      removeOnComplete: {
        age: 86400, // Keep completed jobs for 24 hours
        count: 1000, // Keep last 1000 completed jobs
      },
      removeOnFail: {
        age: 604800, // Keep failed jobs for 7 days
        count: 500, // Keep last 500 failed jobs
      },
    };
  }
}
