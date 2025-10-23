import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { plainToClass } from 'class-transformer';
import { RequestContext } from '../../shared/request-context/request-context.dto';
import { Action } from '../../shared/acl/action.constant';
import { IActor } from '../../shared/acl/actor.constant';
import { TaskAclService } from '../service/task-acl.service';
import { TaskInputDto } from '../dto/task-input.dto';
import { TaskOutputDto } from '../dto/task-output.dto';
import { TaskQueryDto } from '../dto/task-query.dto';
import { Task, TaskPriority, TaskStatus } from '../entities/task.entity';

@Injectable()
export class TaskRepositoryService {
  constructor(
    @InjectRepository(Task)
    private readonly taskRepository: Repository<Task>,
    private readonly taskAclService: TaskAclService,
  ) {}

  /**
   * Creates task entity from DTO
   */
  createTaskEntity(dto: TaskInputDto): Task {
    const task = new Task();
    task.title = dto.title;
    task.description = dto.description || undefined;
    task.startDateTime = new Date(dto.startDateTime);
    task.endDateTime = new Date(dto.endDateTime);
    task.tutorId = dto.tutorId;
    task.label = dto.label;
    task.priority = dto.priority || TaskPriority.MEDIUM;
    task.status = dto.status || TaskStatus.PENDING;
    return task;
  }

  /**
   * Finds and validates task for update operation
   */
  async findTaskForUpdate(ctx: RequestContext, taskId: number): Promise<Task> {
    const task = await this.taskRepository.findOne({
      where: { id: taskId },
      relations: ['tutor'],
    });

    if (!task) {
      throw new NotFoundException(`Task with ID ${taskId} not found`);
    }

    if (
      !this.taskAclService
        .forActor(ctx.user as IActor)
        .canDoAction(Action.UPDATE, task)
    ) {
      throw new UnauthorizedException();
    }

    return task;
  }

  /**
   * Finds and validates task for deletion operation
   */
  async findTaskForDeletion(
    ctx: RequestContext,
    taskId: number,
  ): Promise<Task> {
    const task = await this.taskRepository.findOne({
      where: { id: taskId },
      relations: ['tutor'],
    });

    if (!task) {
      throw new NotFoundException(`Task with ID ${taskId} not found`);
    }

    return task;
  }

  /**
   * Finds a single task by ID
   */
  async findOne(ctx: RequestContext, taskId: number): Promise<TaskOutputDto> {
    const task = await this.taskRepository.findOne({
      where: { id: taskId },
      relations: ['tutor'],
    });

    if (!task) {
      throw new NotFoundException(`Task with ID ${taskId} not found`);
    }

    if (
      !this.taskAclService
        .forActor(ctx.user as IActor)
        .canDoAction(Action.READ, task)
    ) {
      throw new UnauthorizedException();
    }

    return plainToClass(TaskOutputDto, task, {
      excludeExtraneousValues: true,
    });
  }

  /**
   * Finds tasks by tutor ID
   */
  async findByTutor(
    ctx: RequestContext,
    tutorId: number,
  ): Promise<TaskOutputDto[]> {
    if (ctx.user!.id !== tutorId) {
      throw new UnauthorizedException();
    }

    const tasks = await this.taskRepository.find({
      where: { tutorId },
      relations: ['tutor'],
      order: { startDateTime: 'ASC' },
    });

    return tasks.map((task) =>
      plainToClass(TaskOutputDto, task, {
        excludeExtraneousValues: true,
      }),
    );
  }

  /**
   * Finds database tasks based on query
   */
  async findDatabaseTasks(
    ctx: RequestContext,
    query: TaskQueryDto,
  ): Promise<TaskOutputDto[]> {
    const whereConditions = this.buildWhereConditions(query);

    const dbTasks = await this.taskRepository.find({
      where: whereConditions,
      relations: ['tutor'],
      order: { startDateTime: 'ASC' },
      skip: query.offset || 0,
      take: query.limit || 10,
    });

    return dbTasks.map((task) =>
      plainToClass(TaskOutputDto, task, {
        excludeExtraneousValues: true,
      }),
    );
  }

  /**
   * Updates task fields from DTO
   */
  updateTaskFields(task: Task, dto: Partial<TaskInputDto>): void {
    if (dto.title !== undefined) {
      task.title = dto.title;
    }
    if (dto.description !== undefined) {
      task.description = dto.description;
    }
    if (dto.startDateTime !== undefined) {
      task.startDateTime = new Date(dto.startDateTime);
    }
    if (dto.endDateTime !== undefined) {
      task.endDateTime = new Date(dto.endDateTime);
    }
    if (dto.label !== undefined) {
      task.label = dto.label;
    }
    if (dto.priority !== undefined) {
      task.priority = dto.priority;
    }
    if (dto.status !== undefined) {
      task.status = dto.status;
    }
  }

  /**
   * Saves task to database
   */
  async save(task: Task): Promise<Task> {
    return await this.taskRepository.save(task);
  }

  /**
   * Removes task from database
   */
  async remove(task: Task): Promise<void> {
    await this.taskRepository.remove(task);
  }

  /**
   * Builds where conditions for database queries
   */
  private buildWhereConditions(query: TaskQueryDto): FindOptionsWhere<Task> {
    const whereConditions: FindOptionsWhere<Task> = {};

    if (query.tutorId) {
      whereConditions.tutorId = query.tutorId;
    }
    if (query.status) {
      whereConditions.status = query.status;
    }
    if (query.priority) {
      whereConditions.priority = query.priority;
    }
    if (query.label) {
      whereConditions.label = query.label;
    }

    return whereConditions;
  }
}
