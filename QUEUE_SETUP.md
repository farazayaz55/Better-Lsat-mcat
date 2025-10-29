# Bull Queue Implementation

This document describes the Bull Queue implementation for background job processing.

## Overview

Bull Queue is a Redis-based job queue system that provides:

- **Reliable job execution**: Jobs persist in Redis across server restarts
- **Automatic retries**: Failed jobs are retried with exponential backoff
- **Monitoring dashboard**: Bull Board UI for real-time queue monitoring
- **Job scheduling**: Delayed jobs with precise timing
- **Scalable architecture**: Can handle multiple workers

## Architecture

### Loosely Coupled Design

The queue infrastructure is designed to be reusable across different features:

```
src/
├── shared/
│   └── queue/              # Reusable queue infrastructure
│       ├── queue.config.ts # Queue configuration
│       └── queue.module.ts # Global queue module
│
└── automation/
    └── queues/             # Feature-specific queue
        ├── automation-queue.module.ts
        ├── automation.processor.ts
        └── interfaces/
```

## Environment Variables

Add these to your `.env` file:

```env
# Redis Configuration
REDIS_HOST=redis
REDIS_PORT=6379
```

For local development:

```env
REDIS_HOST=localhost
REDIS_PORT=6379
```

## Docker Setup

The `docker-compose.yml` has been updated to include Redis:

```yaml
services:
  redis:
    image: redis:7-alpine
    ports:
      - '6379:6379'
    volumes:
      - redisdata:/data
```

## Usage

### For Automation Module

The automation queue is already set up. When a delayed automation needs to run:

1. **Job is added to queue**: When an automation with `delayMinutes > 0` is triggered
2. **Job stored in Redis**: Survives server restarts
3. **Job processed**: By the `AutomationProcessor` after the delay
4. **Automatic retries**: Up to 3 attempts with exponential backoff

### For Other Features

To add Bull Queue to any feature:

1. **Create queue module**:

```typescript
import { Module } from '@nestjs/common';
import { createQueueAsync } from '../../shared/queue/queue.module';
import { BullBoardModule } from '@bull-board/nestjs';

@Module({
  imports: [
    createQueueAsync('my-feature'), // Create queue
    BullBoardModule.forFeature({ name: 'my-feature' }), // Register with Bull Board
  ],
})
export class MyFeatureQueueModule {}
```

2. **Create processor**:

```typescript
import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';

@Processor('my-feature')
export class MyFeatureProcessor {
  @Process('my-job')
  async handleMyJob(job: Job<any>) {
    // Process job
  }
}
```

3. **Inject queue in service**:

```typescript
import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';

@Injectable()
export class MyService {
  constructor(@InjectQueue('my-feature') private queue: Queue) {}

  async scheduleJob(data: any) {
    await this.queue.add('my-job', data, {
      delay: 5000, // 5 seconds delay
      attempts: 3, // Retry 3 times
    });
  }
}
```

## Monitoring

Access the Bull Board dashboard at:

```
http://localhost:3000/admin/queues
```

The dashboard provides:

- **Real-time job status**: See active, pending, completed, and failed jobs
- **Job details**: View job data, logs, and execution history
- **Queue metrics**: Monitor queue health and processing rates
- **Job management**: Retry failed jobs, clean up queues

## Default Job Options

Configured in `QueueConfig`:

- **Attempts**: 3 retries
- **Backoff**: Exponential (2s, 4s, 8s)
- **Completed jobs**: Keep for 24 hours
- **Failed jobs**: Keep for 7 days

## Queue Features

### Job Scheduling

```typescript
// Immediate execution
await queue.add('job-name', data);

// Delayed execution (24 hours)
await queue.add('job-name', data, { delay: 86400000 });

// Scheduled execution (cron)
await queue.add('job-name', data, { repeat: { cron: '0 9 * * *' } });
```

### Job Priority

```typescript
// High priority job
await queue.add('job-name', data, { priority: 10 });

// Low priority job
await queue.add('job-name', data, { priority: 1 });
```

### Job Removal

```typescript
// Remove completed jobs
await queue.clean(86400, 1000, 'completed');

// Remove failed jobs
await queue.clean(604800, 500, 'failed');
```

## Benefits Over setTimeout

| Feature             | setTimeout | Bull Queue |
| ------------------- | ---------- | ---------- |
| Restart persistence | ❌         | ✅         |
| Job monitoring      | ❌         | ✅         |
| Automatic retries   | ❌         | ✅         |
| Job priorities      | ❌         | ✅         |
| Scalable            | ❌         | ✅         |
| Production-ready    | ❌         | ✅         |

## Troubleshooting

### Redis Connection Issues

Check Redis is running:

```bash
docker-compose ps redis
```

Check Redis logs:

```bash
docker-compose logs redis
```

### Jobs Not Processing

1. Check Bull Board dashboard
2. Verify Redis connection
3. Check job processor is registered
4. Review application logs

### Memory Issues

Configure job cleanup in `queue.config.ts`:

```typescript
removeOnComplete: {
  age: 86400, // Reduce to keep less jobs
  count: 500, // Reduce count
}
```

## References

- [Bull Queue Documentation](https://github.com/OptimalBits/bull)
- [NestJS Bull Module](https://docs.nestjs.com/techniques/queues)
- [Bull Board](https://github.com/felixmosh/bull-board)
