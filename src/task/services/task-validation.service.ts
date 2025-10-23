import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { RequestContext } from '../../shared/request-context/request-context.dto';
import { UserService } from '../../user/services/user.service';
import { UserOutput } from '../../user/dtos/user-output.dto';
import { TaskInputDto } from '../dto/task-input.dto';
import { TaskQueryDto } from '../dto/task-query.dto';
import { Task } from '../entities/task.entity';
import { ROLE } from '../../auth/constants/role.constant';
import { Action } from '../../shared/acl/action.constant';
import { IActor } from '../../shared/acl/actor.constant';
import { TaskAclService } from '../service/task-acl.service';

@Injectable()
export class TaskValidationService {
  constructor(
    private readonly userService: UserService,
    private readonly taskAclService: TaskAclService,
  ) {}

  /**
   * Validates user permissions for task creation
   */
  validateCreatePermissions(ctx: RequestContext, dto: TaskInputDto): void {
    // Use ACL to check if user can create tasks
    if (
      !this.taskAclService
        .forActor(ctx.user as IActor)
        .canDoAction(Action.CREATE)
    ) {
      throw new UnauthorizedException(
        'You do not have permission to create tasks',
      );
    }

    // For non-admin users, ensure they can only create tasks for themselves
    if (ctx.user!.roles.includes(ROLE.USER) && dto.tutorId !== ctx.user!.id) {
      throw new UnauthorizedException('You can only create tasks for yourself');
    }
  }

  /**
   * Validates tutor exists and returns tutor data
   */
  async validateAndGetTutor(
    ctx: RequestContext,
    tutorId: number,
  ): Promise<UserOutput> {
    try {
      return await this.userService.getUserById(ctx, tutorId);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw new NotFoundException(
          `Tutor with ID ${tutorId} not found. Please log in again to refresh your authentication token.`,
        );
      }
      throw error;
    }
  }

  /**
   * Validates that the time range is valid
   */
  validateTimeRange(startDateTime: string, endDateTime: string): void {
    const start = new Date(startDateTime);
    const end = new Date(endDateTime);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new TypeError('Invalid start or end date time provided');
    }

    if (end <= start) {
      throw new RangeError('End date time must be after start date time');
    }
  }

  /**
   * Validates access permissions for listing tasks
   */
  validateAccess(ctx: RequestContext, _query: TaskQueryDto): void {
    if (
      !this.taskAclService.forActor(ctx.user as IActor).canDoAction(Action.LIST)
    ) {
      throw new UnauthorizedException();
    }
  }

  /**
   * Enforces user restrictions on query parameters
   */
  enforceUserRestrictions(ctx: RequestContext, query: TaskQueryDto): void {
    if (ctx.user!.roles.includes(ROLE.USER)) {
      if (query.tutorId && query.tutorId !== ctx.user!.id) {
        throw new UnauthorizedException();
      }
      query.tutorId = ctx.user!.id;
    }
  }

  /**
   * Validates time range for updated tasks
   */
  validateUpdatedTimeRange(task: Task, dto: Partial<TaskInputDto>): void {
    if (dto.startDateTime !== undefined || dto.endDateTime !== undefined) {
      const startDateTime = task.startDateTime;
      const endDateTime = task.endDateTime;

      if (isNaN(startDateTime.getTime()) || isNaN(endDateTime.getTime())) {
        throw new TypeError('Invalid start or end date time provided');
      }

      if (endDateTime <= startDateTime) {
        throw new RangeError('End date time must be after start date time');
      }
    }
  }

  /**
   * Validates task exists and user has permission to update it
   */
  async validateTaskForUpdate(
    ctx: RequestContext,
    taskId: number,
  ): Promise<Task> {
    // This will be implemented by the repository service
    throw new Error('Method to be implemented by TaskRepositoryService');
  }

  /**
   * Validates task exists for deletion
   */
  async validateTaskForDeletion(
    ctx: RequestContext,
    taskId: number,
  ): Promise<Task> {
    // This will be implemented by the repository service
    throw new Error('Method to be implemented by TaskRepositoryService');
  }
}
