import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { AppLogger } from '../shared/logger/logger.service';
import { RequestContext } from '../shared/request-context/request-context.dto';
import { UserService } from '../user/services/user.service';
import { GoogleCalendarService } from '../shared/services/google-calendar-api-key.service';
import { Task } from './entities/task.entity';
import { TaskInputDto } from './dto/task-input.dto';
import { TaskQueryDto } from './dto/task-query.dto';
import { TaskOutputDto } from './dto/task-output.dto';
import { TaskLabel, TaskPriority, TaskStatus } from './entities/task.entity';

@Injectable()
export class TaskService {
  constructor(
    @InjectRepository(Task)
    private readonly taskRepository: Repository<Task>,
    private readonly logger: AppLogger,
    private readonly userService: UserService,
    private readonly googleCalendarService: GoogleCalendarService,
  ) {
    this.logger.setContext(TaskService.name);
  }

  async create(ctx: RequestContext, dto: TaskInputDto): Promise<TaskOutputDto> {
    this.logger.log(ctx, `Creating task: ${dto.title}`);

    // Validate tutor exists
    const tutor = await this.userService.getUserById(ctx, dto.tutorId);
    if (!tutor) {
      throw new NotFoundException(`Tutor with ID ${dto.tutorId} not found`);
    }

    // Create task entity
    const task = new Task();
    task.title = dto.title;
    task.description = dto.description || null;
    task.startDateTime = new Date(dto.startDateTime);
    task.endDateTime = new Date(dto.endDateTime);
    task.tutorId = dto.tutorId;
    task.label = dto.label;
    task.priority = dto.priority || TaskPriority.MEDIUM;
    task.status = dto.status || TaskStatus.PENDING;

    // Save task to database
    const savedTask = await this.taskRepository.save(task);

    try {
      // Create Google Calendar event
      const eventId = await this.googleCalendarService.createTaskEvent(
        ctx,
        savedTask,
        tutor.email,
      );
      
      // Update task with calendar event ID
      savedTask.googleCalendarEventId = eventId;
      await this.taskRepository.save(savedTask);
      
      this.logger.log(ctx, `Created Google Calendar event with ID: ${eventId}`);
    } catch (error) {
      this.logger.error(
        ctx,
        `Failed to create Google Calendar event for task ${savedTask.id}: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
      // Continue without calendar event - task is still saved
    }

    this.logger.log(ctx, `Successfully created task with ID: ${savedTask.id}`);
    return this.mapToOutputDto(savedTask);
  }

  async findAll(ctx: RequestContext, query: TaskQueryDto): Promise<TaskOutputDto[]> {
    this.logger.log(ctx, `Finding tasks with query: ${JSON.stringify(query)}`);

    const queryBuilder = this.taskRepository.createQueryBuilder('task')
      .leftJoinAndSelect('task.tutor', 'tutor');

    // Apply filters
    if (query.tutorId) {
      queryBuilder.andWhere('task.tutorId = :tutorId', { tutorId: query.tutorId });
    }

    if (query.status) {
      queryBuilder.andWhere('task.status = :status', { status: query.status });
    }

    if (query.priority) {
      queryBuilder.andWhere('task.priority = :priority', { priority: query.priority });
    }

    if (query.label) {
      queryBuilder.andWhere('task.label = :label', { label: query.label });
    }

    if (query.startDate) {
      queryBuilder.andWhere('task.startDateTime >= :startDate', { 
        startDate: new Date(query.startDate) 
      });
    }

    if (query.endDate) {
      queryBuilder.andWhere('task.endDateTime <= :endDate', { 
        endDate: new Date(query.endDate) 
      });
    }

    // Apply pagination
    queryBuilder
      .skip(query.offset || 0)
      .take(query.limit || 10)
      .orderBy('task.startDateTime', 'ASC');

    const tasks = await queryBuilder.getMany();
    return tasks.map(task => this.mapToOutputDto(task));
  }

  async findOne(ctx: RequestContext, taskId: number): Promise<TaskOutputDto> {
    this.logger.log(ctx, `Finding task with ID: ${taskId}`);

    const task = await this.taskRepository.findOne({
      where: { id: taskId },
      relations: ['tutor'],
    });

    if (!task) {
      throw new NotFoundException(`Task with ID ${taskId} not found`);
    }

    return this.mapToOutputDto(task);
  }

  async findByTutor(ctx: RequestContext, tutorId: number): Promise<TaskOutputDto[]> {
    this.logger.log(ctx, `Finding tasks for tutor ID: ${tutorId}`);

    const tasks = await this.taskRepository.find({
      where: { tutorId },
      relations: ['tutor'],
      order: { startDateTime: 'ASC' },
    });

    return tasks.map(task => this.mapToOutputDto(task));
  }

  async update(ctx: RequestContext, taskId: number, dto: Partial<TaskInputDto>): Promise<TaskOutputDto> {
    this.logger.log(ctx, `Updating task with ID: ${taskId}`);

    const task = await this.taskRepository.findOne({
      where: { id: taskId },
      relations: ['tutor'],
    });

    if (!task) {
      throw new NotFoundException(`Task with ID ${taskId} not found`);
    }

    // Update task fields
    if (dto.title !== undefined) task.title = dto.title;
    if (dto.description !== undefined) task.description = dto.description;
    if (dto.startDateTime !== undefined) task.startDateTime = new Date(dto.startDateTime);
    if (dto.endDateTime !== undefined) task.endDateTime = new Date(dto.endDateTime);
    if (dto.label !== undefined) task.label = dto.label;
    if (dto.priority !== undefined) task.priority = dto.priority;
    if (dto.status !== undefined) task.status = dto.status;

    // Save updated task
    const updatedTask = await this.taskRepository.save(task);

    // Update Google Calendar event if it exists
    if (task.googleCalendarEventId) {
      try {
        await this.googleCalendarService.updateTaskEvent(
          ctx,
          task.googleCalendarEventId,
          updatedTask,
          task.tutor.email,
        );
        this.logger.log(ctx, `Updated Google Calendar event: ${task.googleCalendarEventId}`);
      } catch (error) {
        this.logger.error(
          ctx,
          `Failed to update Google Calendar event ${task.googleCalendarEventId}: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`,
        );
      }
    }

    this.logger.log(ctx, `Successfully updated task with ID: ${taskId}`);
    return this.mapToOutputDto(updatedTask);
  }

  async delete(ctx: RequestContext, taskId: number): Promise<void> {
    this.logger.log(ctx, `Deleting task with ID: ${taskId}`);

    const task = await this.taskRepository.findOne({
      where: { id: taskId },
      relations: ['tutor'],
    });

    if (!task) {
      throw new NotFoundException(`Task with ID ${taskId} not found`);
    }

    // Delete Google Calendar event if it exists
    if (task.googleCalendarEventId) {
      try {
        await this.googleCalendarService.deleteTaskEvent(ctx, task.googleCalendarEventId);
        this.logger.log(ctx, `Deleted Google Calendar event: ${task.googleCalendarEventId}`);
      } catch (error) {
        this.logger.error(
          ctx,
          `Failed to delete Google Calendar event ${task.googleCalendarEventId}: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`,
        );
      }
    }

    // Delete task from database
    await this.taskRepository.remove(task);
    this.logger.log(ctx, `Successfully deleted task with ID: ${taskId}`);
  }

  private mapToOutputDto(task: Task): TaskOutputDto {
    return {
      id: task.id,
      title: task.title,
      description: task.description,
      startDateTime: task.startDateTime,
      endDateTime: task.endDateTime,
      tutorId: task.tutorId,
      tutor: {
        id: task.tutor.id,
        name: task.tutor.name,
        email: task.tutor.email,
        roles: task.tutor.roles,
        isAccountDisabled: task.tutor.isAccountDisabled,
        createdAt: task.tutor.createdAt,
        updatedAt: task.tutor.updatedAt,
      },
      googleCalendarEventId: task.googleCalendarEventId,
      label: task.label,
      priority: task.priority,
      status: task.status,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
    };
  }
}
