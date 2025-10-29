import { Module } from '@nestjs/common';

/**
 * Automation Queue Module
 * This module exists to organize queue-related functionality.
 * The queue itself is registered in AutomationModule.
 * Bull Board monitoring is configured in main.ts
 */
@Module({
  imports: [],
  providers: [],
  exports: [],
})
export class AutomationQueueModule {}
