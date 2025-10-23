import { Injectable, Logger } from '@nestjs/common';
import { RequestContext } from '../../shared/request-context/request-context.dto';
import { GoogleCalendarBookingService } from '../../shared/services/google-calendar/google-calendar-booking.service';
import { UserService } from '../../user/services/user.service';
import { OrderService } from '../../order/services/order.service';
import { TaskOutputDto } from '../dto/task-output.dto';
import { TaskQueryDto } from '../dto/task-query.dto';
import { TaskLabel, TaskPriority, TaskStatus } from '../entities/task.entity';
import { User } from '../../user/entities/user.entity';
import { ROLE } from '../../auth/constants/role.constant';

@Injectable()
export class CalendarEventToTaskService {
  private readonly logger = new Logger(CalendarEventToTaskService.name);

  constructor(
    private readonly googleCalendarBookingService: GoogleCalendarBookingService,
    private readonly userService: UserService,
    private readonly orderService: OrderService,
  ) {}

  /**
   * Get Google Calendar tasks for a given query
   * If tutorId is provided, get tasks for that tutor
   * If admin and no tutorId, get tasks for all tutors
   * If no tutorId and no admin, throw BadRequestException
   * If admin and tutorId, get tasks for that tutor
   */
  async getGoogleCalendarTasks(
    ctx: RequestContext,
    query: TaskQueryDto,
  ): Promise<TaskOutputDto[]> {
    if (!query.googleCalendar) {
      return [];
    }

    this.validateQuery(query);

    const tutors = await this.resolveTutors(ctx, query);
    const googleCalendarBookings = await this.fetchCalendarBookings(
      ctx,
      query,
      tutors,
    );

    return this.processCalendarBookings(ctx, query, googleCalendarBookings);
  }

  /**
   * Validates the query parameters
   */
  private validateQuery(query: TaskQueryDto): void {
    if (!query.startDate || !query.endDate) {
      throw new Error('Start date and end date are required');
    }
  }

  /**
   * Resolves tutors based on query and user permissions
   */
  private async resolveTutors(
    ctx: RequestContext,
    query: TaskQueryDto,
  ): Promise<User[]> {
    const isAdmin = ctx.user!.roles.includes(ROLE.ADMIN);

    if (query.tutorId) {
      const tutor = (await this.userService.getUserById(
        ctx,
        query.tutorId!,
      )) as unknown as User;
      return [tutor];
    }

    if (isAdmin) {
      return await this.userService.findTutorsAndAdmins(ctx);
    }

    throw new Error('Tutor ID is required');
  }

  /**
   * Fetches calendar bookings from Google Calendar
   */
  private async fetchCalendarBookings(
    ctx: RequestContext,
    query: TaskQueryDto,
    tutors: User[],
  ): Promise<
    Map<
      string,
      Array<{
        title: string;
        description: string;
        employeeId: number;
        employeeEmail: string;
        meetingLink: string;
        invitees: Array<{ email: string }>;
        eventId: string;
        start?: string;
        end?: string;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        privateMeta?: Record<string, any>;
      }>
    >
  > {
    this.logger.log('Tutors: ', JSON.stringify(tutors.map((e) => e.email)));
    this.logger.log(ctx, `Found ${tutors.length} tutors for calendar sync`);

    const googleCalendarBookings =
      await this.googleCalendarBookingService.getBookedSlots(
        new Date(query.startDate!),
        new Date(query.endDate!),
        tutors,
      );

    this.logger.log(
      ctx,
      `Retrieved ${googleCalendarBookings.size} booked slots`,
    );

    return googleCalendarBookings;
  }

  /**
   * Processes calendar bookings and converts them to TaskOutputDto
   */
  private async processCalendarBookings(
    ctx: RequestContext,
    query: TaskQueryDto,
    googleCalendarBookings: Map<
      string,
      Array<{
        title: string;
        description: string;
        employeeId: number;
        employeeEmail: string;
        meetingLink: string;
        invitees: Array<{ email: string }>;
        eventId: string;
        start?: string;
        end?: string;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        privateMeta?: Record<string, any>;
      }>
    >,
  ): Promise<TaskOutputDto[]> {
    const googleCalendarTasks: TaskOutputDto[] = [];

    for (const [slotTime, bookings] of googleCalendarBookings) {
      const tutorBookings = this.filterBookingsForTutor(bookings, query);
      if (tutorBookings.length === 0) {
        continue;
      }

      const taskDto = await this.processBookingSlot(
        ctx,
        slotTime,
        tutorBookings[0],
      );
      if (taskDto) {
        googleCalendarTasks.push(taskDto);
      }
    }

    return googleCalendarTasks;
  }

  /**
   * Filters bookings for the requested tutor
   */
  private filterBookingsForTutor(
    bookings: Array<{
      title: string;
      description: string;
      employeeId: number;
      employeeEmail: string;
      meetingLink: string;
      invitees: Array<{ email: string }>;
      eventId: string;
      start?: string;
      end?: string;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      privateMeta?: Record<string, any>;
    }>,
    query: TaskQueryDto,
  ): Array<{
    title: string;
    description: string;
    employeeId: number;
    employeeEmail: string;
    meetingLink: string;
    invitees: Array<{ email: string }>;
    eventId: string;
    start?: string;
    end?: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    privateMeta?: Record<string, any>;
  }> {
    if (!query.tutorId) {
      return bookings;
    }

    return bookings.filter((booking) => booking.employeeId === query.tutorId!);
  }

  /**
   * Processes a single booking slot and creates appropriate TaskOutputDto
   */
  private async processBookingSlot(
    ctx: RequestContext,
    slotTime: string,
    booking: {
      title: string;
      description: string;
      employeeId: number;
      employeeEmail: string;
      meetingLink: string;
      invitees: Array<{ email: string }>;
      eventId: string;
      start?: string;
      end?: string;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      privateMeta?: Record<string, any>;
    },
  ): Promise<TaskOutputDto | null> {
    const eventId: string = booking.eventId || `google_${slotTime}`;
    const start = booking.start ? new Date(booking.start) : new Date(slotTime);
    const end = booking.end ? new Date(booking.end) : start;
    const inviteeCount: number = Array.isArray(booking.invitees)
      ? booking.invitees.length
      : 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const privateMeta: Record<string, any> = booking.privateMeta || {};

    this.logBookingDetails(ctx, booking);

    if (!this.validateBooking(booking)) {
      return null;
    }

    if (this.shouldSkipTaskEvent(privateMeta, inviteeCount)) {
      return null;
    }

    if (this.isOrderBackedEvent(inviteeCount, privateMeta)) {
      return await this.createOrderDtoFromBooking(
        booking,
        start,
        end,
        eventId,
        privateMeta.orderId,
        booking.employeeId,
      );
    }

    return this.createGenericTaskDto(booking, start, end, eventId);
  }

  /**
   * Logs booking details for debugging
   */
  private logBookingDetails(
    ctx: RequestContext,
    booking: {
      title: string;
      employeeId: number;
      employeeEmail: string;
    },
  ): void {
    this.logger.log(
      ctx,
      `Processing booking: title="${booking.title}", employeeId=${booking.employeeId}, employeeEmail="${booking.employeeEmail}"`,
    );
  }

  /**
   * Validates that booking has required employee information
   */
  private validateBooking(booking: {
    title: string;
    employeeId: number;
  }): boolean {
    if (!booking.employeeId) {
      this.logger.warn(
        `Skipping booking "${booking.title}" - no employeeId found`,
      );
      return false;
    }
    return true;
  }

  /**
   * Determines if this is a task-backed event that should be skipped
   */
  private shouldSkipTaskEvent(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    privateMeta: Record<string, any>,
    inviteeCount: number,
  ): boolean {
    return !!(privateMeta.taskId && inviteeCount <= 1);
  }

  /**
   * Determines if this is an order-backed event
   */
  private isOrderBackedEvent(
    inviteeCount: number,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    privateMeta: Record<string, any>,
  ): boolean {
    return inviteeCount > 1 || !!privateMeta.orderId;
  }

  /**
   * Creates a generic task DTO from booking information
   */
  private createGenericTaskDto(
    booking: {
      title: string;
      description: string;
      employeeId: number;
      meetingLink: string;
      invitees: Array<{ email: string }>;
    },
    start: Date,
    end: Date,
    eventId: string,
  ): TaskOutputDto {
    return {
      id: 0,
      title: booking.title,
      description: booking.description,
      startDateTime: start,
      endDateTime: end,
      tutorId: booking.employeeId,
      googleCalendarEventId: eventId,
      label: TaskLabel.MEETING,
      priority: TaskPriority.MEDIUM,
      status: TaskStatus.PENDING,
      createdAt: new Date(),
      updatedAt: new Date(),
      meetingLink: booking.meetingLink || '',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      invitees: (booking.invitees || []).map((invitee: any) => ({
        email: invitee.email || '',
      })),
    };
  }

  /**
   * Creates a TaskOutputDto from a booking with order metadata
   */
  private async createOrderDtoFromBooking(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    booking: any,
    start: Date,
    end: Date,
    eventId: string,
    orderId: string,
    tutorId: number,
  ): Promise<TaskOutputDto | null> {
    try {
      const orderIdNumber = Number(orderId);
      const order = Number.isFinite(orderIdNumber)
        ? await this.orderService.findOne(orderIdNumber)
        : null;

      if (!order) {
        this.logger.warn(`Order ${orderId} not found in database`);
        return null;
      }

      const title = order?.items?.[0]?.name || 'Scheduled Session';
      const description =
        order?.items?.[0]?.Description || 'Session booked via Order';

      return {
        id: 0,
        title,
        description,
        startDateTime: start,
        endDateTime: end,
        tutorId,
        googleCalendarEventId: eventId,
        label: TaskLabel.MEETING,
        priority: TaskPriority.MEDIUM,
        status: TaskStatus.PENDING,
        createdAt: new Date(),
        updatedAt: new Date(),
        meetingLink: booking.meetingLink || '',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        invitees: (booking.invitees || []).map((invitee: any) => ({
          email: invitee.email || '',
          name: invitee.displayName,
          responseStatus: invitee.responseStatus,
        })),
      };
    } catch (error) {
      this.logger.error(`Error creating order DTO from booking: ${error}`);
      return null;
    }
  }
}
