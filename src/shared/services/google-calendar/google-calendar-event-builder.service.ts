import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CalendarEventAttendee,
  CalendarEventReminder,
  CalendarEventExtendedProperties,
} from '../interfaces/calendar-event.interface';

@Injectable()
export class GoogleCalendarEventBuilderService {
  private readonly businessOwnerEmail: string;

  constructor(private readonly configService: ConfigService) {
    this.businessOwnerEmail =
      this.configService.get<string>('googleCalendar.businessOwnerEmail') || '';
  }

  /**
   * Builds the base event structure
   */
  buildEventBase(
    summary: string,
    description: string,
    startTime: Date,
    endTime: Date,
  ): {
    summary: string;
    description: string;
    start: { dateTime: string; timeZone: string };
    end: { dateTime: string; timeZone: string };
    organizer?: { email: string; displayName: string };
  } {
    return {
      summary,
      description,
      start: {
        dateTime: startTime.toISOString(),
        timeZone: 'UTC',
      },
      end: {
        dateTime: endTime.toISOString(),
        timeZone: 'UTC',
      },
      organizer: this.businessOwnerEmail
        ? {
            email: this.businessOwnerEmail,
            displayName: 'Better LSAT MCAT',
          }
        : undefined,
    };
  }

  /**
   * Builds attendees array for calendar events
   */
  buildAttendees(
    customerEmail: string,
    employeeEmail?: string,
    tutorEmail?: string,
  ): CalendarEventAttendee[] {
    const attendees: CalendarEventAttendee[] = [];

    // Only add customer if email is not empty
    if (customerEmail && customerEmail.trim() !== '') {
      attendees.push({
        email: customerEmail,
        displayName: 'Customer',
        responseStatus: 'needsAction',
      });
    }

    if (employeeEmail) {
      attendees.push({
        email: employeeEmail,
        displayName: 'Employee',
        responseStatus: 'needsAction',
      });
    }

    if (tutorEmail) {
      attendees.push({
        email: tutorEmail,
        displayName: 'Tutor',
        responseStatus: 'needsAction',
      });
    }

    return attendees;
  }

  /**
   * Builds reminders configuration
   */
  buildReminders(isTask = false): {
    useDefault: boolean;
    overrides: CalendarEventReminder[];
  } {
    const overrides: CalendarEventReminder[] = isTask
      ? [{ method: 'popup', minutes: 30 }] // Tasks only get 30 min popup
      : [
          { method: 'email', minutes: 24 * 60 }, // 24 hours before
          { method: 'popup', minutes: 30 }, // 30 minutes before
        ];

    return {
      useDefault: false,
      overrides,
    };
  }

  /**
   * Builds extended properties for calendar events
   */
  buildExtendedProperties(
    orderId?: number,
    orderItemId?: number,
    customerEmail?: string,
    employeeEmail?: string,
    quantity?: number,
    price?: number,
    taskId?: number,
    tutorEmail?: string,
    priority?: string,
    status?: string,
    label?: string,
    organizerUserId?: number,
    organizerRoles?: string[],
  ): { private: CalendarEventExtendedProperties } {
    const privateProps: CalendarEventExtendedProperties = {
      businessOwnerEmail: this.businessOwnerEmail || '',
    };

    if (orderId !== undefined) {privateProps.orderId = String(orderId);}
    if (orderItemId !== undefined)
      {privateProps.orderItemId = String(orderItemId);}
    if (customerEmail) {privateProps.customerEmail = customerEmail;}
    if (employeeEmail) {privateProps.employeeEmail = employeeEmail;}
    if (quantity !== undefined) {privateProps.quantity = String(quantity);}
    if (price !== undefined) {privateProps.price = String(price);}
    if (taskId !== undefined) {privateProps.taskId = String(taskId);}
    if (tutorEmail) {privateProps.tutorEmail = tutorEmail;}
    if (priority) {privateProps.priority = priority;}
    if (status) {privateProps.status = status;}
    if (label) {privateProps.label = label;}
    if (organizerUserId !== undefined)
      {privateProps.organizerUserId = String(organizerUserId);}
    if (organizerRoles) {privateProps.organizerRoles = organizerRoles.join(',');}

    return { private: privateProps };
  }
}
