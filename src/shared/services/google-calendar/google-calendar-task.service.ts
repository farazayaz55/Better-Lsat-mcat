import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RequestContext } from '../../request-context/request-context.dto';
import { GoogleCalendarAuthService } from './google-calendar-auth.service';
import { GoogleCalendarEventBuilderService } from './google-calendar-event-builder.service';
import {
  TaskEvent,
  TaskEventData,
} from '../interfaces/calendar-event.interface';

@Injectable()
export class GoogleCalendarTaskService {
  private readonly logger = new Logger(GoogleCalendarTaskService.name);
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
   * Creates a Google Calendar event for a task
   */
  async createTaskEvent(
    ctx: RequestContext,
    task: TaskEvent,
    tutorEmail: string,
  ): Promise<string> {
    try {
      this.logger.log(
        ctx,
        `Creating Google Calendar event for task: ${task.title} (ID: ${task.id})`,
      );

      const startTime = new Date(task.startDateTime);
      const endTime = new Date(task.endDateTime);

      // Validate time range before proceeding
      if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
        throw new TypeError('Invalid start or end date time provided');
      }

      if (endTime <= startTime) {
        throw new RangeError('End date time must be after start date time');
      }

      // Log raw task data
      this.logger.log(
        ctx,
        `[CREATE TASK] Raw task data: ${JSON.stringify({
          id: task.id,
          title: task.title,
          description: task.description,
          startDateTime: task.startDateTime,
          endDateTime: task.endDateTime,
          priority: task.priority,
          status: task.status,
          label: task.label,
          tutorEmail,
        })}`,
      );

      // Log parsed time data
      this.logger.log(
        ctx,
        `[CREATE TASK] Parsed times: ${JSON.stringify({
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          startTimeValid: !isNaN(startTime.getTime()),
          endTimeValid: !isNaN(endTime.getTime()),
          durationMinutes:
            (endTime.getTime() - startTime.getTime()) / (1000 * 60),
        })}`,
      );

      // Build event using helper methods
      const eventBase = this.eventBuilder.buildEventBase(
        `${task.title} - ${task.label}`,
        `${task.description || `Task: ${task.title}`}\n\nTask ID: ${task.id}\nPriority: ${task.priority}\nStatus: ${task.status}\nLabel: ${task.label}`,
        startTime,
        endTime,
      );

      // Log event base data
      this.logger.log(
        ctx,
        `[CREATE TASK] Event base: ${JSON.stringify({
          summary: eventBase.summary,
          description: eventBase.description,
          start: eventBase.start,
          end: eventBase.end,
          organizer: eventBase.organizer,
        })}`,
      );

      const attendees = this.eventBuilder.buildAttendees(
        '',
        undefined,
        tutorEmail,
      );
      this.logger.log(
        ctx,
        `[CREATE TASK] Attendees being added: ${JSON.stringify(attendees.map((a) => ({ email: a.email, displayName: a.displayName })))}`,
      );
      const reminders = this.eventBuilder.buildReminders(true); // Tasks get different reminders
      const extendedProperties = this.eventBuilder.buildExtendedProperties(
        undefined, // orderId
        undefined, // orderItemId
        undefined, // customerEmail
        undefined, // employeeEmail
        undefined, // quantity
        undefined, // price
        task.id,
        tutorEmail,
        task.priority,
        task.status,
        task.label,
        ctx.user?.id,
        Array.isArray(ctx.user?.roles) ? ctx.user?.roles : undefined,
      );

      const event: TaskEventData = {
        summary: eventBase.summary,
        description: eventBase.description,
        start: eventBase.start,
        end: eventBase.end,
        organizer: eventBase.organizer,
        attendees,
        reminders,
        extendedProperties,
      };

      // Log final event data being sent to Google Calendar
      this.logger.log(
        ctx,
        `[CREATE TASK] Final event data: ${JSON.stringify({
          summary: event.summary,
          description: event.description,
          start: event.start,
          end: event.end,
          organizer: event.organizer,
          attendees: event.attendees,
          reminders: event.reminders,
          extendedProperties: event.extendedProperties,
        })}`,
      );

      this.logger.log(
        ctx,
        `Creating task event in calendar: ${this.calendarId}`,
      );

      const apiPayload = {
        ...event,
        sendUpdates: 'all', // Send invitations to all attendees
      };

      // Log the exact payload being sent to Google Calendar API
      this.logger.log(
        ctx,
        `[CREATE TASK] API payload: ${JSON.stringify(apiPayload)}`,
      );

      const eventData = await this.authService.makeCalendarApiRequest(
        ctx,
        `https://www.googleapis.com/calendar/v3/calendars/${this.calendarId}/events`,
        'POST',
        apiPayload,
      );

      this.logger.log(
        ctx,
        `Created Google Calendar event: ${eventData.id} for task ${task.title}`,
      );

      return eventData.id;
    } catch (error) {
      this.logger.error(
        ctx,
        `Failed to create Google Calendar event for task ${task.id}: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
      throw error;
    }
  }

  /**
   * Updates a Google Calendar event for a task
   */
  async updateTaskEvent(
    ctx: RequestContext,
    eventId: string,
    task: TaskEvent,
    tutorEmail: string,
  ): Promise<void> {
    try {
      this.logger.log(
        ctx,
        `Updating Google Calendar event: ${eventId} for task: ${task.title}`,
      );

      const startTime = new Date(task.startDateTime);
      const endTime = new Date(task.endDateTime);

      // Validate time range before proceeding
      if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
        throw new TypeError('Invalid start or end date time provided');
      }

      if (endTime <= startTime) {
        throw new RangeError('End date time must be after start date time');
      }

      // Build event using helper methods
      const eventBase = this.eventBuilder.buildEventBase(
        `${task.title} - ${task.label}`,
        `${task.description || `Task: ${task.title}`}\n\nTask ID: ${task.id}\nPriority: ${task.priority}\nStatus: ${task.status}\nLabel: ${task.label}`,
        startTime,
        endTime,
      );

      const attendees = this.eventBuilder.buildAttendees(
        '',
        undefined,
        tutorEmail,
      );
      this.logger.log(
        ctx,
        `[UPDATE TASK] Attendees being added: ${JSON.stringify(attendees.map((a) => ({ email: a.email, displayName: a.displayName })))}`,
      );
      const reminders = this.eventBuilder.buildReminders(true); // Tasks get different reminders
      const extendedProperties = this.eventBuilder.buildExtendedProperties(
        undefined, // orderId
        undefined, // orderItemId
        undefined, // customerEmail
        undefined, // employeeEmail
        undefined, // quantity
        undefined, // price
        task.id,
        tutorEmail,
        task.priority,
        task.status,
        task.label,
      );

      const event: TaskEventData = {
        summary: eventBase.summary,
        description: eventBase.description,
        start: eventBase.start,
        end: eventBase.end,
        organizer: eventBase.organizer,
        attendees,
        reminders,
        extendedProperties,
      };

      await this.authService.makeCalendarApiRequest(
        ctx,
        `https://www.googleapis.com/calendar/v3/calendars/${this.calendarId}/events/${eventId}`,
        'PUT',
        {
          ...event,
          sendUpdates: 'all', // Send invitations to all attendees
        },
      );

      this.logger.log(ctx, `Updated Google Calendar event: ${eventId}`);
    } catch (error) {
      this.logger.error(
        ctx,
        `Failed to update Google Calendar event ${eventId}: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
      throw error;
    }
  }

  /**
   * Deletes a Google Calendar event for a task
   */
  async deleteTaskEvent(ctx: RequestContext, eventId: string): Promise<void> {
    try {
      this.logger.log(ctx, `Deleting Google Calendar event: ${eventId}`);

      await this.authService.makeCalendarApiRequest(
        ctx,
        `https://www.googleapis.com/calendar/v3/calendars/${this.calendarId}/events/${eventId}`,
        'DELETE',
      );

      this.logger.log(ctx, `Deleted Google Calendar event: ${eventId}`);
    } catch (error) {
      this.logger.error(
        ctx,
        `Failed to delete Google Calendar event ${eventId}: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
      throw error;
    }
  }
}
