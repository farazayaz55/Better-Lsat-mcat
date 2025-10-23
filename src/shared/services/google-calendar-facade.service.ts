import { Injectable, Logger } from '@nestjs/common';
import { RequestContext } from '../request-context/request-context.dto';
import { User } from '../../user/entities/user.entity';
import { GoogleCalendarAuthService } from './google-calendar/google-calendar-auth.service';
import { GoogleCalendarAppointmentService } from './google-calendar/google-calendar-appointment.service';
import { GoogleCalendarTaskService } from './google-calendar/google-calendar-task.service';
import { GoogleCalendarBookingService } from './google-calendar/google-calendar-booking.service';
import { OrderItem, TaskEvent } from './interfaces/calendar-event.interface';

/**
 * Facade service that delegates to focused Google Calendar services
 * Maintains backward compatibility while using the new architecture
 */
@Injectable()
export class GoogleCalendarService {
  private readonly logger = new Logger(GoogleCalendarService.name);

  constructor(
    private readonly authService: GoogleCalendarAuthService,
    private readonly appointmentService: GoogleCalendarAppointmentService,
    private readonly taskService: GoogleCalendarTaskService,
    private readonly bookingService: GoogleCalendarBookingService,
  ) {
    this.logger.log('GoogleCalendarService facade initialized');
  }

  // ===== APPOINTMENT METHODS =====

  /**
   * @deprecated Use GoogleCalendarAppointmentService.createAppointment directly
   */
  async createAppointment(
    ctx: RequestContext,
    item: OrderItem,
    customerEmail: string,
    employeeEmail?: string,
    orderId?: number,
  ): Promise<void> {
    this.logger.warn(
      ctx,
      'createAppointment is deprecated. Use GoogleCalendarAppointmentService directly.',
    );
    return this.appointmentService.createAppointment(
      ctx,
      item,
      customerEmail,
      employeeEmail,
      orderId,
    );
  }

  /**
   * @deprecated Use GoogleCalendarAppointmentService.createOrderEvents directly
   */
  async createOrderEvents(
    ctx: RequestContext,
    order: any,
    userService: any,
  ): Promise<void> {
    this.logger.warn(
      ctx,
      'createOrderEvents is deprecated. Use GoogleCalendarAppointmentService directly.',
    );
    return this.appointmentService.createOrderEvents(ctx, order, userService);
  }

  // ===== TASK METHODS =====

  /**
   * @deprecated Use GoogleCalendarTaskService.createTaskEvent directly
   */
  async createTaskEvent(
    ctx: RequestContext,
    task: TaskEvent,
    tutorEmail: string,
  ): Promise<string> {
    this.logger.warn(
      ctx,
      'createTaskEvent is deprecated. Use GoogleCalendarTaskService directly.',
    );
    return this.taskService.createTaskEvent(ctx, task, tutorEmail);
  }

  /**
   * @deprecated Use GoogleCalendarTaskService.updateTaskEvent directly
   */
  async updateTaskEvent(
    ctx: RequestContext,
    eventId: string,
    task: TaskEvent,
    tutorEmail: string,
  ): Promise<void> {
    this.logger.warn(
      ctx,
      'updateTaskEvent is deprecated. Use GoogleCalendarTaskService directly.',
    );
    return this.taskService.updateTaskEvent(ctx, eventId, task, tutorEmail);
  }

  /**
   * @deprecated Use GoogleCalendarTaskService.deleteTaskEvent directly
   */
  async deleteTaskEvent(ctx: RequestContext, eventId: string): Promise<void> {
    this.logger.warn(
      ctx,
      'deleteTaskEvent is deprecated. Use GoogleCalendarTaskService directly.',
    );
    return this.taskService.deleteTaskEvent(ctx, eventId);
  }

  // ===== BOOKING METHODS =====

  /**
   * @deprecated Use GoogleCalendarBookingService.getBookedSlots directly
   */
  async getBookedSlots(
    startDate: Date,
    endDate: Date,
    employees: User[],
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
        privateMeta?: Record<string, any>;
      }>
    >
  > {
    this.logger.warn(
      'getBookedSlots is deprecated. Use GoogleCalendarBookingService directly.',
    );
    return this.bookingService.getBookedSlots(startDate, endDate, employees);
  }

  /**
   * @deprecated Use GoogleCalendarBookingService.getAvailableEmployeesAtTime directly
   */
  async getAvailableEmployeesAtTime(
    dateTime: string,
    employees: User[],
  ): Promise<User[]> {
    this.logger.warn(
      'getAvailableEmployeesAtTime is deprecated. Use GoogleCalendarBookingService directly.',
    );
    return this.bookingService.getAvailableEmployeesAtTime(dateTime, employees);
  }

  // ===== AUTH METHODS =====

  /**
   * @deprecated Use GoogleCalendarAuthService.makeCalendarApiRequest directly
   */
  async makeCalendarApiRequest(
    ctx: RequestContext,
    url: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    body?: any,
  ): Promise<any> {
    this.logger.warn(
      ctx,
      'makeCalendarApiRequest is deprecated. Use GoogleCalendarAuthService directly.',
    );
    return this.authService.makeCalendarApiRequest(ctx, url, method, body);
  }

  /**
   * @deprecated Use GoogleCalendarAuthService.ensureValidCredentials directly
   */
  async ensureValidCredentials(ctx: RequestContext): Promise<void> {
    this.logger.warn(
      ctx,
      'ensureValidCredentials is deprecated. Use GoogleCalendarAuthService directly.',
    );
    return this.authService.ensureValidCredentials(ctx);
  }
}
