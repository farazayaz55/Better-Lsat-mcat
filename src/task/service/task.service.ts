/* eslint-disable max-statements */
/* eslint-disable sonarjs/cognitive-complexity */
import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { plainToClass } from 'class-transformer';
import { Action } from '../../shared/acl/action.constant';
import { IActor } from '../../shared/acl/actor.constant';
import { ROLE } from '../../auth/constants/role.constant';
import { AppLogger } from '../../shared/logger/logger.service';
import { RequestContext } from '../../shared/request-context/request-context.dto';
import { GoogleCalendarService } from '../../shared/services/google-calendar-api-key.service';
import { UserService } from '../../user/services/user.service';
import { TaskInputDto } from '../dto/task-input.dto';
import { TaskOutputDto } from '../dto/task-output.dto';
import { TaskQueryDto } from '../dto/task-query.dto';
import {
  Task,
  TaskLabel,
  TaskPriority,
  TaskStatus,
} from '../entities/task.entity';
import { TaskAclService } from './task-acl.service';
import { User } from '../../user/entities/user.entity';
import { OrderService } from '../../order/services/order.service';

@Injectable()
export class TaskService {
  constructor(
    @InjectRepository(Task)
    private readonly taskRepository: Repository<Task>,
    private readonly logger: AppLogger,
    private readonly userService: UserService,
    private readonly googleCalendarService: GoogleCalendarService,

    private readonly taskAclService: TaskAclService,
    private readonly orderService: OrderService,
  ) {
    this.logger.setContext(TaskService.name);
  }

  // eslint-disable-next-line max-statements
  async create(ctx: RequestContext, dto: TaskInputDto): Promise<TaskOutputDto> {
    this.logger.log(ctx, `Creating task: ${dto.title}`);

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

    // Validate tutor exists
    let tutor;
    try {
      tutor = await this.userService.getUserById(ctx, dto.tutorId);
    } catch (error) {
      if (error instanceof NotFoundException) {
        this.logger.warn(
          ctx,
          `Tutor with ID ${dto.tutorId} not found. This might be due to an outdated JWT token. User should log in again.`,
        );
        throw new NotFoundException(
          `Tutor with ID ${dto.tutorId} not found. Please log in again to refresh your authentication token.`,
        );
      }
      throw error;
    }

    // Create task entity
    const task = new Task();
    task.title = dto.title;
    task.description = dto.description || undefined;
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
    return plainToClass(TaskOutputDto, savedTask, {
      excludeExtraneousValues: true,
    });
  }

  /**
   * Get Google Calendar tasks for a given query
   * If tutorId is provided, get tasks for that tutor
   * If admin and no tutorId, get tasks for all tutors
   * If no tutorId and no admin, throw BadRequestException
   * If admin and tutorId, get tasks for that tutor
   * @param ctx RequestContext
   * @param query TaskQueryDto
   * @returns TaskOutputDto[]
   */

  // eslint-disable-next-line complexity
  async getGoogleCalendarTasks(
    ctx: RequestContext,
    query: TaskQueryDto,
  ): Promise<TaskOutputDto[] | undefined> {
    const googleCalendarTasks: TaskOutputDto[] = [];
    if (query.googleCalendar) {
      if (query.startDate && query.endDate) {
        const isAdmin = ctx.user!.roles.includes(ROLE.ADMIN);
        let tutors: User[] = [];
        // Get the tutor
        if (query.tutorId) {
          tutors.push(
            (await this.userService.getUserById(
              ctx,
              query.tutorId!,
            )) as unknown as User,
          );
        } else if (isAdmin) {
          tutors = await this.userService.findTutorsAndAdmins(ctx);
        }

        if (!query.tutorId && !isAdmin) {
          throw new BadRequestException('Tutor ID is required');
        }
        console.log('Tutors', tutors);

        const googleCalendarBookings =
          await this.googleCalendarService.getBookedSlots(
            new Date(query.startDate),
            new Date(query.endDate),
            tutors,
          );

        console.log('Google calendar bookings', googleCalendarBookings);

        // Convert Google events into TaskOutputDto by resolving to Task/Order
        for (const [slotTime, bookings] of googleCalendarBookings) {
          // Filter for this tutor if requested
          let tutorBookings = bookings;
          if (query.tutorId) {
            tutorBookings = bookings.filter(
              (booking) => booking.employeeId === query.tutorId!,
            );
          }

          if (tutorBookings.length === 0) {
            continue;
          }

          // Use first booking in slot for metadata
          const b: any = tutorBookings[0] as any;
          const eventId: string = b.eventId || `google_${slotTime}`;
          const start = b.start ? new Date(b.start) : new Date(slotTime);
          const end = b.end ? new Date(b.end) : start;
          const inviteeCount: number = Array.isArray(b.invitees)
            ? b.invitees.length
            : 0;
          const privateMeta: Record<string, any> = b.privateMeta || {};

          // If task-backed event (single invitee and taskId present)
          if (privateMeta.taskId && inviteeCount <= 1) {
            const taskEntity = await this.taskRepository.findOne({
              where: { id: Number(privateMeta.taskId) },
              relations: ['tutor'],
            });
            if (taskEntity) {
              const dto: TaskOutputDto = {
                id: taskEntity.id,
                title: taskEntity.title,
                description: taskEntity.description || undefined,
                startDateTime: start,
                endDateTime: end,
                tutorId: taskEntity.tutorId,
                googleCalendarEventId: eventId,
                label: taskEntity.label,
                priority: taskEntity.priority,
                status: taskEntity.status,
                createdAt: taskEntity.createdAt,
                updatedAt: taskEntity.updatedAt,
                meetingLink: b.meetingLink || '',
                invitees: (b.invitees || []).map((a: any) => ({
                  id: b.employeeId,
                  email: a.email || '',
                  name: a.displayName,
                  responseStatus: a.responseStatus,
                })),
              };
              googleCalendarTasks.push(dto);
              continue;
            }
          }

          // If order-backed event (multiple invitees or explicit orderId)
          if (inviteeCount > 1 || privateMeta.orderId) {
            const orderId = Number(privateMeta.orderId);
            const order = Number.isFinite(orderId)
              ? await this.orderService.findOne(orderId)
              : null;

            const title = order?.items?.[0]?.name || 'Scheduled Session';
            const description =
              order?.items?.[0]?.Description || 'Session booked via Order';

            const dto: TaskOutputDto = {
              id: 0,
              title,
              description,
              startDateTime: start,
              endDateTime: end,
              tutorId: query.tutorId!,
              googleCalendarEventId: eventId,
              label: TaskLabel.MEETING,
              priority: TaskPriority.MEDIUM,
              status: TaskStatus.PENDING,
              createdAt: new Date(),
              updatedAt: new Date(),
              meetingLink: b.meetingLink || '',
              invitees: (b.invitees || []).map((a: any) => ({
                email: a.email || '',
                name: a.displayName,
                responseStatus: a.responseStatus,
              })),
            };
            googleCalendarTasks.push(dto);
            continue;
          }

          // Fallback generic mapping
          googleCalendarTasks.push({
            id: 0,
            title: 'Google Calendar Event',
            description: 'Scheduled in Google Calendar',
            startDateTime: start,
            endDateTime: end,
            tutorId: query.tutorId!,
            googleCalendarEventId: eventId,
            label: TaskLabel.MEETING,
            priority: TaskPriority.MEDIUM,
            status: TaskStatus.PENDING,
            createdAt: new Date(),
            updatedAt: new Date(),
            meetingLink: b.meetingLink || '',
            invitees: (b.invitees || []).map((a: any) => ({
              email: a.email || '',
            })),
          });
        }
      } else {
        throw new BadRequestException('Start date and end date are required');
      }
      return googleCalendarTasks;
    }
  }

  async findAll(
    ctx: RequestContext,
    query: TaskQueryDto,
  ): Promise<TaskOutputDto[]> {
    this.logger.log(ctx, `Finding tasks with query: ${JSON.stringify(query)}`);

    //ACL
    if (
      !this.taskAclService.forActor(ctx.user as IActor).canDoAction(Action.LIST)
    ) {
      throw new UnauthorizedException();
    }

    // const queryBuilder = this.taskRepository
    //   .createQueryBuilder('task')
    //   .leftJoinAndSelect('task.tutor', 'tutor');

    // // Apply filters
    // if (query.tutorId) {
    //   queryBuilder.andWhere('task.tutorId = :tutorId', {
    //     tutorId: query.tutorId,
    //   });
    // }

    // if (query.status) {
    //   queryBuilder.andWhere('task.status = :status', { status: query.status });
    // }

    // if (query.priority) {
    //   queryBuilder.andWhere('task.priority = :priority', {
    //     priority: query.priority,
    //   });
    // }

    // if (query.label) {
    //   queryBuilder.andWhere('task.label = :label', { label: query.label });
    // }

    // if (query.startDate) {
    //   queryBuilder.andWhere('task.startDateTime >= :startDate', {
    //     startDate: new Date(query.startDate),
    //   });
    // }

    // if (query.endDate) {
    //   queryBuilder.andWhere('task.endDateTime <= :endDate', {
    //     endDate: new Date(query.endDate),
    //   });
    // }

    // // Apply pagination
    // queryBuilder
    //   .skip(query.offset || 0)
    //   .take(query.limit || 10)
    //   .orderBy('task.startDateTime', 'ASC');

    // const tasks = await queryBuilder.getMany();
    // const outputTasks = tasks.map((task) =>
    //   plainToClass(TaskOutputDto, task, {
    //     excludeExtraneousValues: true,
    //   }),
    // );

    // For regular users, restrict listing to their own tasks by tutorId
    if (ctx.user!.roles.includes(ROLE.USER)) {
      if (query.tutorId && query.tutorId !== ctx.user!.id) {
        throw new UnauthorizedException();
      }
      query.tutorId = ctx.user!.id;
    }

    const googleCalendarTasks: TaskOutputDto[] =
      (await this.getGoogleCalendarTasks(ctx, query)) || [];

    // If googleCalendar is true, add googleCalendarEventId to the output tasks

    return [...googleCalendarTasks];
  }

  async findOne(ctx: RequestContext, taskId: number): Promise<TaskOutputDto> {
    this.logger.log(ctx, `Finding task with ID: ${taskId}`);

    const task = await this.taskRepository.findOne({
      where: { id: taskId },
      relations: ['tutor'],
    });

    //ACL

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

  async findByTutor(
    ctx: RequestContext,
    tutorId: number,
  ): Promise<TaskOutputDto[]> {
    this.logger.log(ctx, `Finding tasks for tutor ID: ${tutorId}`);

    if (ctx.user!.id !== tutorId) {
      throw new UnauthorizedException();
    }

    const tasks = await this.taskRepository.find({
      where: { tutorId },
      relations: ['tutor'],
      order: { startDateTime: 'ASC' },
    });

    const outputTasks = tasks.map((task) =>
      plainToClass(TaskOutputDto, task, {
        excludeExtraneousValues: true,
      }),
    );

    return outputTasks;
  }

  // eslint-disable-next-line max-statements
  async update(
    ctx: RequestContext,
    taskId: number,
    dto: Partial<TaskInputDto>,
  ): Promise<TaskOutputDto> {
    this.logger.log(ctx, `Updating task with ID: ${taskId}`);

    const task = await this.taskRepository.findOne({
      where: { id: taskId },
      relations: ['tutor'],
    });

    if (!task) {
      throw new NotFoundException(`Task with ID ${taskId} not found`);
    }

    //ACL
    if (
      !this.taskAclService
        .forActor(ctx.user as IActor)
        .canDoAction(Action.UPDATE, task)
    ) {
      throw new UnauthorizedException();
    }
    // Update task fields
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
        this.logger.log(
          ctx,
          `Updated Google Calendar event: ${task.googleCalendarEventId}`,
        );
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
    return plainToClass(TaskOutputDto, updatedTask, {
      excludeExtraneousValues: true,
    });
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
        await this.googleCalendarService.deleteTaskEvent(
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

    // Delete task from database
    await this.taskRepository.remove(task);
    this.logger.log(ctx, `Successfully deleted task with ID: ${taskId}`);
  }

  // private mapToOutputDto(task: Task): TaskOutputDto {
  //   return {
  //     id: task.id,
  //     title: task.title,
  //     description: task.description,
  //     startDateTime: task.startDateTime,
  //     endDateTime: task.endDateTime,
  //     tutorId: task.tutorId,
  //     tutor: {
  //       id: task.tutor.id,
  //       name: task.tutor.name,
  //       email: task.tutor.email,
  //       roles: task.tutor.roles.map((role) => role as ROLE),
  //       isAccountDisabled: task.tutor.isAccountDisabled,
  //       createdAt: task.tutor.createdAt.toISOString(),
  //       updatedAt: task.tutor.updatedAt.toISOString(),
  //       workHours: task.tutor.workHours,
  //       username: task.tutor.username,
  //       phone: task.tutor.phone,
  //     },
  //     googleCalendarEventId: task.googleCalendarEventId,
  //     label: task.label,
  //     priority: task.priority,
  //     status: task.status,
  //     createdAt: task.createdAt,
  //     updatedAt: task.updatedAt,
  //   };
  // }
}
