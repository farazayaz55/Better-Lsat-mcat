import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { calendar_v3 } from 'googleapis';
import { RequestContext } from '../../request-context/request-context.dto';
import { GoogleCalendarAuthService } from './google-calendar-auth.service';
import { User } from '../../../user/entities/user.entity';

@Injectable()
export class GoogleCalendarBookingService {
  private readonly logger = new Logger(GoogleCalendarBookingService.name);
  private readonly calendarId: string;
  private readonly defaultCalendarId =
    'c_41f0af94200759137f30305f470ef7853a4020e41c5b160eedf7dea7cae3db9a@group.calendar.google.com';

  constructor(
    private readonly configService: ConfigService,
    private readonly authService: GoogleCalendarAuthService,
  ) {
    this.calendarId =
      this.configService.get<string>('googleCalendar.calendarId') ||
      this.defaultCalendarId;
  }

  /**
   * Fetches all the tasks from a specific Calendar (Better-LSAT that should be used for orders)
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
    try {
      this.logger.log(
        `Getting booked slots from ${startDate.toISOString()} to ${endDate.toISOString()}`,
      );

      this.logger.log(
        'Tutors: ',
        JSON.stringify(employees.map((e) => e.email)),
      );
      // Use raw HTTP request to list events
      const url = new URL(
        `https://www.googleapis.com/calendar/v3/calendars/${this.calendarId}/events`,
      );
      url.searchParams.set('timeMin', startDate.toISOString());
      url.searchParams.set('timeMax', endDate.toISOString());
      url.searchParams.set('singleEvents', 'true');
      url.searchParams.set('orderBy', 'startTime');

      const data = await this.authService.makeCalendarApiRequest(
        new RequestContext(),
        url.toString(),
        'GET',
      );

      this.logger.log(
        `Retrieved ${data.items?.length || 0} events from Google Calendar`,
      );

      const bookedSlots = new Map<
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
      >();

      if (data.items) {
        for (const event of data.items) {
          this.logger.log(`Processing event: ${event.summary}`);
          this.logger.log(`Event start: ${JSON.stringify(event.start)}`);

          const employeeInfo = this.extractEmployeeFromEvent(event, employees);

          if (employeeInfo && event.start?.dateTime) {
            // Convert event time to UTC for consistent comparison
            const eventTime = new Date(event.start.dateTime);
            const slotTime = eventTime.toISOString();

            this.logger.log(
              `Adding booking for slot: ${slotTime} (from ${event.start.dateTime}) with employee: ${employeeInfo.employeeEmail} (ID: ${employeeInfo.employeeId})`,
            );
            const existingBookings = bookedSlots.get(slotTime) || [];
            existingBookings.push({
              ...employeeInfo,
              title: event.summary || '',
              description: event.description || '',
              meetingLink: event.conferenceData?.entryPoints?.[0]?.uri || '',
              invitees: event.attendees || [],
              eventId: (event.id as string) || '',
              start: event.start?.dateTime
                ? new Date(event.start.dateTime).toISOString()
                : undefined,
              end: event.end?.dateTime
                ? new Date(event.end.dateTime).toISOString()
                : undefined,
              privateMeta: event.extendedProperties?.private || {},
            });
            bookedSlots.set(slotTime, existingBookings);
          } else {
            this.logger.log(
              `Skipping event "${event.summary}" - no employee info or no dateTime. Employee: ${employeeInfo ? 'found' : 'not found'}, DateTime: ${event.start?.dateTime || 'none'}`,
            );
            if (!employeeInfo) {
              this.logger.log(
                `Event "${event.summary}" attendees: ${JSON.stringify(event.attendees?.map((a: any) => a.email))}`,
              );
              this.logger.log(
                `Event "${event.summary}" extended properties: ${JSON.stringify(event.extendedProperties?.private)}`,
              );
            }
          }
        }
      }

      this.logger.log(
        `Found ${bookedSlots.size} booked slots in Google Calendar`,
      );

      return bookedSlots;
    } catch (error) {
      this.logger.error(
        `Failed to get booked slots: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
      return new Map();
    }
  }

  /**
   * Extracts employee information from a calendar event
   */
  private extractEmployeeFromEvent(
    event: calendar_v3.Schema$Event,
    employees: User[],
  ): { employeeId: number; employeeEmail: string } | null {
    this.logger.log(`Extracting employee from event: ${event.summary}`);
    this.logger.log(
      `Event attendees: ${JSON.stringify(event.attendees?.map((a) => a.email))}`,
    );
    this.logger.log(
      `Available employees: ${JSON.stringify(employees.map((e) => e.email))}`,
    );

    if (event.attendees) {
      for (const attendee of event.attendees) {
        const employee = employees.find(
          (emp) => emp.email.toLowerCase() === attendee.email?.toLowerCase(),
        );
        if (employee) {
          this.logger.log(
            `Found employee match: ${employee.email} (ID: ${employee.id})`,
          );
          return { employeeId: employee.id, employeeEmail: employee.email };
        }
      }
    }

    if (event.extendedProperties?.private?.employeeEmail) {
      const employeeEmail = event.extendedProperties.private.employeeEmail;
      const employee = employees.find(
        (emp) => emp.email.toLowerCase() === employeeEmail.toLowerCase(),
      );
      if (employee) {
        this.logger.log(
          `Found employee via extended properties: ${employee.email} (ID: ${employee.id})`,
        );
        return { employeeId: employee.id, employeeEmail: employee.email };
      }
    }

    this.logger.log(`No employee found for event: ${event.summary}`);
    return null;
  }

  /**
   * Gets available employees at a specific time
   */
  async getAvailableEmployeesAtTime(
    dateTime: string,
    employees: User[],
  ): Promise<User[]> {
    try {
      const slotDate = new Date(dateTime);
      const slotBookings = await this.getBookedSlots(
        slotDate,
        slotDate,
        employees,
      );

      const busyEmployeeIds =
        slotBookings.get(dateTime)?.map((b) => b.employeeId) || [];

      // Filter out busy employees
      const availableEmployees = employees.filter((emp) => {
        const isNotBusy = !busyEmployeeIds.includes(emp.id);

        this.logger.log(
          `🔍 DEBUG: Employee ${emp.name} (${emp.id}) - Not busy: ${isNotBusy}`,
        );

        return isNotBusy;
      });

      this.logger.log(
        `Found ${availableEmployees.length} available employees at ${dateTime}`,
      );

      return availableEmployees;
    } catch (error) {
      this.logger.error(
        `Failed to get available employees at ${dateTime}: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
      return employees; // Return all employees as fallback
    }
  }
}
