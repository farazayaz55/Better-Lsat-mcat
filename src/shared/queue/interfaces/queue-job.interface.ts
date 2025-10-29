/**
 * Base interface for all queue job data
 * Extend this for specific job types
 */
export interface BaseQueueJobData {
  /**
   * Unique identifier for the job (e.g., orderId, userId, etc.)
   */
  jobId?: string;

  /**
   * Timestamp when the job was created
   */
  createdAt: Date;

  /**
   * Optional metadata
   */
  metadata?: Record<string, any>;
}

/**
 * Options for adding jobs to the queue
 */
export interface QueueJobOptions {
  /**
   * Delay before processing in milliseconds
   */
  delay?: number;

  /**
   * Number of retry attempts
   */
  attempts?: number;

  /**
   * Backoff strategy for retries
   */
  backoff?: {
    type: 'fixed' | 'exponential';
    delay: number;
  };

  /**
   * Priority of the job (higher number = higher priority)
   */
  priority?: number;

  /**
   * Repeat pattern (cron expression or repeat every X ms)
   */
  repeat?: {
    every?: number;
    cron?: string;
  };
}
