import { BaseQueueJobData } from '../../../shared/queue/interfaces/queue-job.interface';

/**
 * Job data for automation execution
 */
export interface AutomationJobData extends BaseQueueJobData {
  automationKey: string;
  eventData: any;
  config: any;
  ctx: any;
}
