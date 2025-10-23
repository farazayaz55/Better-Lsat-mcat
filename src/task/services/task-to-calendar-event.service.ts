import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { RequestContext } from '../../shared/request-context/request-context.dto';
import { GoogleCalendarTaskService } from '../../shared/services/google-calendar/google-calendar-task.service';
import { Task } from '../entities/task.entity';
import { UserOutput } from '../../user/dtos/user-output.dto';

@Injectable()
export class TaskToCalendarEventService {
  private readonly logger = new Logger(TaskToCalendarEventService.name);

  constructor(
    private readonly googleCalendarTaskService: GoogleCalendarTaskService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Creates task with Google Calendar integration using database transaction
   */
  async createTaskWithCalendarIntegration(
    ctx: RequestContext,
    task: Task,
    tutor: UserOutput,
  ): Promise<Task> {
    const queryRunner = this.dataSource.createQueryRunner();

    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const savedTask = await this.saveTaskInTransaction(
        ctx,
        queryRunner,
        task,
      );
      const eventId = await this.createCalendarEvent(ctx, savedTask, tutor);
      const finalTask = await this.updateTaskWithEventId(
        queryRunner,
        savedTask,
        eventId,
      );

      await queryRunner.commitTransaction();

      this.logger.log(
        ctx,
        `Successfully created task with ID: ${finalTask.id} and Google Calendar event with ID: ${eventId}`,
      );

      return finalTask;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        ctx,
        `Failed to create task atomically: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Updates Google Calendar event if it exists
   */
  async updateGoogleCalendarEvent(
    ctx: RequestContext,
    originalTask: Task,
    updatedTask: Task,
  ): Promise<void> {
    if (!originalTask.googleCalendarEventId) {
      return;
    }

    try {
      await this.googleCalendarTaskService.updateTaskEvent(
        ctx,
        originalTask.googleCalendarEventId,
        {
          id: updatedTask.id,
          title: updatedTask.title,
          description: updatedTask.description,
          startDateTime: updatedTask.startDateTime.toISOString(),
          endDateTime: updatedTask.endDateTime.toISOString(),
          priority: updatedTask.priority,
          status: updatedTask.status,
          label: updatedTask.label,
        },
        originalTask.tutor.email,
      );
      this.logger.log(
        ctx,
        `Updated Google Calendar event: ${originalTask.googleCalendarEventId}`,
      );
    } catch (error) {
      this.logger.error(
        ctx,
        `Failed to update Google Calendar event ${originalTask.googleCalendarEventId}: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
    }
  }

  /**
   * Deletes Google Calendar event if it exists
   */
  async deleteGoogleCalendarEvent(
    ctx: RequestContext,
    task: Task,
  ): Promise<void> {
    if (!task.googleCalendarEventId) {
      return;
    }

    try {
      await this.googleCalendarTaskService.deleteTaskEvent(
        ctx,
        task.googleCalendarEventId,
      );
      this.logger.log(
        ctx,
        `Deleted Google Calendar event: ${task.googleCalendarEventId}`,
      );
    } catch (error) {
      this.logger.error(
        ctx,
        `Failed to delete Google Calendar event ${task.googleCalendarEventId}: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
    }
  }

  /**
   * Saves task to database within transaction
   */
  private async saveTaskInTransaction(
    ctx: RequestContext,
    queryRunner: any,
    task: Task,
  ): Promise<Task> {
    const savedTask = await queryRunner.manager.save(Task, task);
    this.logger.log(ctx, `Task saved to database with ID: ${savedTask.id}`);
    return savedTask;
  }

  /**
   * Creates Google Calendar event for the task
   */
  private async createCalendarEvent(
    ctx: RequestContext,
    task: Task,
    tutor: UserOutput,
  ): Promise<string> {
    return await this.googleCalendarTaskService.createTaskEvent(
      ctx,
      {
        id: task.id,
        title: task.title,
        description: task.description,
        startDateTime: task.startDateTime.toISOString(),
        endDateTime: task.endDateTime.toISOString(),
        priority: task.priority,
        status: task.status,
        label: task.label,
      },
      tutor.email,
    );
  }

  /**
   * Updates task with calendar event ID within transaction
   */
  private async updateTaskWithEventId(
    queryRunner: any,
    task: Task,
    eventId: string,
  ): Promise<Task> {
    task.googleCalendarEventId = eventId;
    return await queryRunner.manager.save(Task, task);
  }
}
