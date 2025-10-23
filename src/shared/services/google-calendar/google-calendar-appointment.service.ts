import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RequestContext } from '../../request-context/request-context.dto';
import { GoogleCalendarAuthService } from './google-calendar-auth.service';
import { GoogleCalendarEventBuilderService } from './google-calendar-event-builder.service';
import {
  OrderItem,
  AppointmentEvent,
} from '../interfaces/calendar-event.interface';

@Injectable()
export class GoogleCalendarAppointmentService {
  private readonly logger = new Logger(GoogleCalendarAppointmentService.name);
  private readonly calendarId: string;
  private readonly defaultCalendarId =
    'c_41f0af94200759137f30305f470ef7853a4020e41c5b160eedf7dea7cae3db9a@group.calendar.google.com';

  constructor(
    private readonly configService: ConfigService,
    private readonly authService: GoogleCalendarAuthService,
    private readonly eventBuilder: GoogleCalendarEventBuilderService,
  ) {
    this.calendarId =
      this.configService.get<string>('googleCalendar.calendarId') ||
      this.defaultCalendarId;
  }

  /**
   * Creates Google Calendar events for appointment items
   */
  async createAppointment(
    ctx: RequestContext,
    item: OrderItem,
    customerEmail: string,
    employeeEmail?: string,
    orderId?: number,
  ): Promise<void> {
    try {
      this.logger.log(
        ctx,
        `Creating Google Calendar event for item: ${item.name} (ID: ${item.id})`,
      );

      for (const dateTime of item.DateTime) {
        await this.createEventForDateTime(
          ctx,
          item,
          dateTime,
          customerEmail,
          employeeEmail,
          orderId,
        );
      }
    } catch (error) {
      this.logger.error(
        ctx,
        `Failed to create Google Calendar event for item ${item.name}: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
      throw error;
    }
  }

  /**
   * Creates a single event for a specific date/time
   */
  private async createEventForDateTime(
    ctx: RequestContext,
    item: OrderItem,
    dateTime: string,
    customerEmail: string,
    employeeEmail?: string,
    orderId?: number,
  ): Promise<void> {
    try {
      const startTime = new Date(dateTime);
      const endTime = new Date(
        startTime.getTime() + item.Duration * 60 * 1000, // Use duration directly (minutes to milliseconds)
      );

      // Build event using helper methods
      const eventBase = this.eventBuilder.buildEventBase(
        `${item.name} - Appointment`,
        `${item.Description || `Service: ${item.name}`}\n\nThis appointment has been scheduled by Better LSAT MCAT.\n\nOrder Item ID: ${item.id}\nQuantity: ${item.quantity}\nPrice: $${item.price}`,
        startTime,
        endTime,
      );

      const attendees = this.eventBuilder.buildAttendees(
        customerEmail,
        employeeEmail,
      );
      const reminders = this.eventBuilder.buildReminders(false);
      const extendedProperties = this.eventBuilder.buildExtendedProperties(
        orderId,
        item.id,
        customerEmail,
        employeeEmail,
        item.quantity,
        item.price,
      );

      const event: AppointmentEvent = {
        summary: eventBase.summary,
        description: eventBase.description,
        start: eventBase.start,
        end: eventBase.end,
        organizer: eventBase.organizer,
        attendees,
        reminders,
        extendedProperties,
        conferenceData: {
          createRequest: {
            requestId: `meet-${item.id}-${Date.now()}`,
            conferenceSolutionKey: {
              type: 'hangoutsMeet',
            },
          },
        },
      };

      this.logger.log(ctx, `Creating event in calendar: ${this.calendarId}`);
      this.logger.log(
        ctx,
        `Event attendees: Customer: ${customerEmail}, Employee: ${employeeEmail || 'None'}`,
      );

      try {
        const eventData = await this.authService.makeCalendarApiRequest(
          ctx,
          `https://www.googleapis.com/calendar/v3/calendars/${this.calendarId}/events?conferenceDataVersion=1`,
          'POST',
          {
            ...event,
            sendUpdates: 'all', // Send invitations to all attendees
          },
        );

        this.logger.log(
          ctx,
          `Created Google Calendar event: ${eventData.id} for ${dateTime}`,
        );

        // Log Google Meet link if available
        if (eventData.conferenceData?.entryPoints) {
          const meetLink = eventData.conferenceData.entryPoints.find(
            (ep: any) => ep.entryPointType === 'video',
          );
          if (meetLink) {
            this.logger.log(ctx, `Google Meet link created: ${meetLink.uri}`);
          }
        } else {
          this.logger.warn(ctx, 'No Google Meet link found in event response');
        }
      } catch (insertError) {
        this.logger.error(
          ctx,
          `Failed to insert event into calendar ${this.calendarId}: ${
            insertError instanceof Error ? insertError.message : 'Unknown error'
          }`,
        );

        // Try to get more details about the error
        if (
          insertError instanceof Error &&
          insertError.message.includes('Login Required')
        ) {
          this.logger.error(
            ctx,
            `OAuth2 authentication required. Please authorize the application.`,
          );
        }

        throw insertError;
      }
    } catch (error) {
      this.logger.error(
        ctx,
        `Failed to create Google Calendar event for ${dateTime}: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );

      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      if (errorMessage.includes('Login Required')) {
        throw new Error('Calendar service temporarily unavailable');
      }
      throw new Error('Failed to create calendar event');
    }
  }

  /**
   * Orchestration method for creating calendar events from orders
   */
  async createOrderEvents(
    ctx: RequestContext,
    order: any, // Using any for now to match existing Order entity
    userService: any, // Using any for now to avoid circular dependency
  ): Promise<void> {
    try {
      this.logger.log(ctx, `=== CREATING GOOGLE CALENDAR EVENTS ===`);
      this.logger.log(
        ctx,
        `Order ID: ${order.id}, Customer ID: ${order.customer.id}`,
      );
      this.logger.log(ctx, `Number of items: ${order.items?.length || 0}`);

      // Get customer email
      this.logger.log(
        ctx,
        `Getting customer details for ID: ${order.customer.id}`,
      );
      const customer = await userService.getUserById(ctx, order.customer.id);
      const customerEmail = customer.email;
      this.logger.log(ctx, `Customer email: ${customerEmail}`);

      // Process each item in the order
      this.logger.log(ctx, `Processing ${order.items?.length || 0} items...`);
      for (let i = 0; i < order.items.length; i++) {
        const item = order.items[i];
        this.logger.log(ctx, `Processing item: ${item.name} (ID: ${item.id})`);

        // Skip GHL items (ID 8) - they're handled separately
        if (item.id === 8) {
          this.logger.log(
            ctx,
            `Skipping Google Calendar event for GHL item ${item.name} (ID: ${item.id})`,
          );
          continue;
        }

        // Validate that we have matching DateTime slots and assigned employees
        if (
          !item.DateTime ||
          !item.assignedEmployeeIds ||
          item.DateTime.length !== item.assignedEmployeeIds.length
        ) {
          this.logger.warn(
            ctx,
            `Item ${item.name} (ID: ${item.id}) has mismatched DateTime slots (${item.DateTime?.length || 0}) and assigned employees (${item.assignedEmployeeIds?.length || 0})`,
          );
          continue;
        }

        // Create one Google Calendar event per DateTime slot
        for (let j = 0; j < item.DateTime.length; j++) {
          const dateTime = item.DateTime[j];
          const employeeId = item.assignedEmployeeIds[j];

          try {
            // Get employee email
            const employee = await userService.getUserById(ctx, employeeId);
            const employeeEmail = employee.email;

            this.logger.log(
              ctx,
              `Creating Google Calendar event for slot ${dateTime} with employee ${employee.name} (${employeeEmail})`,
            );

            // Create Google Calendar event for this specific slot
            await this.createAppointment(
              ctx,
              {
                ...item,
                DateTime: [dateTime], // Single slot for this event
                assignedEmployeeIds: [employeeId], // Single employee for this event
              },
              customerEmail,
              employeeEmail,
              order.id,
            );

            this.logger.log(
              ctx,
              `Successfully created Google Calendar event for slot ${dateTime}`,
            );
          } catch (error) {
            this.logger.error(
              ctx,
              `Failed to create Google Calendar event for slot ${dateTime} with employee ID ${employeeId}: ${
                error instanceof Error ? error.message : 'Unknown error'
              }`,
            );
          }
        }
      }

      this.logger.log(
        ctx,
        `Completed Google Calendar events creation for order ${order.id}`,
      );
    } catch (error) {
      this.logger.error(
        ctx,
        `Failed to create Google Calendar events for order ${order.id}: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
      throw error;
    }
  }
}
