import { Injectable } from '@nestjs/common';
import { RequestContext } from '../request-context/request-context.dto';

/**
 * Factory service for creating RequestContext instances
 */
@Injectable()
export class RequestContextFactory {
  /**
   * Creates a system context for background jobs and automated processes
   */
  createSystemContext(): RequestContext {
    return {
      user: { id: 0, username: 'system', roles: [] },
      requestID: 'automation-system',
      url: '/automation',
      ip: '127.0.0.1',
    } as RequestContext;
  }
}
