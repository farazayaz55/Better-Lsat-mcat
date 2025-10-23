import { Injectable } from '@nestjs/common';
import { plainToClass } from 'class-transformer';
import { AppLogger } from '../../shared/logger/logger.service';
import { RequestContext } from '../../shared/request-context/request-context.dto';
import { TaskInputDto } from '../dto/task-input.dto';
import { TaskOutputDto } from '../dto/task-output.dto';
import { TaskQueryDto } from '../dto/task-query.dto';
import { CalendarEventToTaskService } from '../services/calendar-event-to-task.service';
import { TaskToCalendarEventService } from '../services/task-to-calendar-event.service';
import { TaskRepositoryService } from '../services/task-repository.service';
import { TaskValidationService } from '../services/task-validation.service';

@Injectable()
export class TaskService {
  constructor(
    private readonly logger: AppLogger,
    private readonly taskRepositoryService: TaskRepositoryService,
    private readonly taskValidationService: TaskValidationService,
    private readonly taskToCalendarEventService: TaskToCalendarEventService,
    private readonly calendarEventToTaskService: CalendarEventToTaskService,
  ) {
    this.logger.setContext(TaskService.name);
  }

  async create(ctx: RequestContext, dto: TaskInputDto): Promise<TaskOutputDto> {
    this.logger.log(ctx, `Creating task: ${dto.title}`);

    // Validate permissions and input
    this.taskValidationService.validateCreatePermissions(ctx, dto);
    const tutor = await this.taskValidationService.validateAndGetTutor(
      ctx,
      dto.tutorId,
    );
    this.taskValidationService.validateTimeRange(
      dto.startDateTime,
      dto.endDateTime,
    );

    // Create task entity and integrate with Google Calendar
    const task = this.taskRepositoryService.createTaskEntity(dto);
    const savedTask =
      await this.taskToCalendarEventService.createTaskWithCalendarIntegration(
        ctx,
        task,
        tutor,
      );

    return plainToClass(TaskOutputDto, savedTask, {
      excludeExtraneousValues: true,
    });
  }

  /**
   * Get Google Calendar tasks for a given query
   * Delegates to CalendarEventToTaskService for better separation of concerns
   */
  async getGoogleCalendarTasks(
    ctx: RequestContext,
    query: TaskQueryDto,
  ): Promise<TaskOutputDto[] | undefined> {
    return this.calendarEventToTaskService.getGoogleCalendarTasks(ctx, query);
  }

  async findAll(
    ctx: RequestContext,
    query: TaskQueryDto,
  ): Promise<TaskOutputDto[]> {
    this.logger.log(ctx, `Finding tasks with query: ${JSON.stringify(query)}`);

    this.taskValidationService.validateAccess(ctx, query);
    this.taskValidationService.enforceUserRestrictions(ctx, query);

    // Fetch both database tasks and Google Calendar events
    const [databaseTasks, calendarTasks] = await Promise.all([
      this.taskRepositoryService.findDatabaseTasks(ctx, query),
      this.getGoogleCalendarTasks(ctx, query),
    ]);

    // Combine and sort all tasks by start time
    const allTasks = [
      ...databaseTasks,
      ...(calendarTasks || []),
    ] as TaskOutputDto[];

    // Sort by start time
    allTasks.sort(
      (a, b) =>
        new Date(a.startDateTime).getTime() -
        new Date(b.startDateTime).getTime(),
    );

    // Apply pagination to the combined results
    const startIndex = query.offset || 0;
    const endIndex = startIndex + (query.limit || 10);

    return allTasks.slice(startIndex, endIndex);
  }

  async findOne(ctx: RequestContext, taskId: number): Promise<TaskOutputDto> {
    return this.taskRepositoryService.findOne(ctx, taskId);
  }

  async findByTutor(
    ctx: RequestContext,
    tutorId: number,
  ): Promise<TaskOutputDto[]> {
    return this.taskRepositoryService.findByTutor(ctx, tutorId);
  }

  async update(
    ctx: RequestContext,
    taskId: number,
    dto: Partial<TaskInputDto>,
  ): Promise<TaskOutputDto> {
    this.logger.log(ctx, `Updating task with ID: ${taskId}`);

    const task = await this.taskRepositoryService.findTaskForUpdate(
      ctx,
      taskId,
    );
    this.taskRepositoryService.updateTaskFields(task, dto);
    this.taskValidationService.validateUpdatedTimeRange(task, dto);

    const updatedTask = await this.taskRepositoryService.save(task);
    await this.taskToCalendarEventService.updateGoogleCalendarEvent(
      ctx,
      task,
      updatedTask,
    );

    this.logger.log(ctx, `Successfully updated task with ID: ${taskId}`);
    return plainToClass(TaskOutputDto, updatedTask, {
      excludeExtraneousValues: true,
    });
  }

  async delete(ctx: RequestContext, taskId: number): Promise<void> {
    this.logger.log(ctx, `Deleting task with ID: ${taskId}`);

    const task = await this.taskRepositoryService.findTaskForDeletion(
      ctx,
      taskId,
    );
    await this.taskToCalendarEventService.deleteGoogleCalendarEvent(ctx, task);
    await this.taskRepositoryService.remove(task);

    this.logger.log(ctx, `Successfully deleted task with ID: ${taskId}`);
  }
}
