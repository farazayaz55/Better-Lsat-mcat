import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { calendar_v3 } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { RequestContext } from '../request-context/request-context.dto';
import { User } from '../../user/entities/user.entity';

@Injectable()
export class GoogleCalendarService {
  private readonly logger = new Logger(GoogleCalendarService.name);
  private oauth2Client: OAuth2Client;

  constructor(private readonly configService: ConfigService) {
    this.initializeGoogleCalendar();
  }

  private async initializeGoogleCalendar() {
    try {
      // Initialize OAuth2 client for all operations
      this.oauth2Client = new OAuth2Client(
        this.configService.get<string>('googleCalendar.clientId'),
        this.configService.get<string>('googleCalendar.clientSecret'),
        this.configService.get<string>('googleCalendar.redirectUri'),
      );

      // Set credentials if we have stored tokens
      const accessToken = this.configService.get<string>(
        'googleCalendar.accessToken',
      );
      const refreshToken = this.configService.get<string>(
        'googleCalendar.refreshToken',
      );

      this.logger.log(
        new RequestContext(),
        `DEBUG: Access token exists: ${!!accessToken}, Refresh token exists: ${!!refreshToken}`,
      );

      if (accessToken && refreshToken) {
        this.oauth2Client.setCredentials({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        this.logger.log(
          new RequestContext(),
          'OAuth2 credentials loaded from environment',
        );

        // OAuth2 credentials loaded successfully
      } else {
        this.logger.warn(
          new RequestContext(),
          'No OAuth2 tokens found. Calendar operations will require authorization.',
        );
      }

      this.logger.log(
        new RequestContext(),
        `Google Calendar service initialized with OAuth2`,
      );
      this.logger.log(
        new RequestContext(),
        `Calendar ID: ${this.configService.get<string>('googleCalendar.calendarId')}`,
      );
    } catch (error) {
      this.logger.error(
        new RequestContext(),
        `Failed to initialize Google Calendar service: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
      throw error;
    }
  }

  async createAppointment(
    ctx: RequestContext,
    item: any,
    customerEmail: string,
    employeeEmail?: string,
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

  private async createEventForDateTime(
    ctx: RequestContext,
    item: any,
    dateTime: string,
    customerEmail: string,
    employeeEmail?: string,
  ): Promise<void> {
    try {
      const startTime = new Date(dateTime);
      const endTime = new Date(
        startTime.getTime() + this.parseDuration(item.Duration),
      );

      // Business owner email (you) - this will be the organizer
      const businessOwnerEmail = this.configService.get<string>(
        'googleCalendar.businessOwnerEmail',
      );

      // Use UTC timezone to avoid timezone conversion issues
      const event: calendar_v3.Schema$Event = {
        summary: `${item.name} - Appointment`,
        description: `${item.Description || `Service: ${item.name}`}\n\nThis appointment has been scheduled by Better LSAT MCAT.\n\nOrder Item ID: ${item.id}\nQuantity: ${item.quantity}\nPrice: $${item.price}`,
        start: {
          dateTime: startTime.toISOString(),
          timeZone: 'UTC',
        },
        end: {
          dateTime: endTime.toISOString(),
          timeZone: 'UTC',
        },
        organizer: businessOwnerEmail
          ? {
              email: businessOwnerEmail,
              displayName: 'Better LSAT MCAT',
            }
          : undefined,
        attendees: [
          {
            email: customerEmail,
            displayName: 'Customer',
            responseStatus: 'needsAction',
          },
          ...(employeeEmail
            ? [
                {
                  email: employeeEmail,
                  displayName: 'Employee',
                  responseStatus: 'needsAction',
                },
              ]
            : []),
        ],
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'email', minutes: 24 * 60 }, // 24 hours before
            { method: 'popup', minutes: 30 }, // 30 minutes before
          ],
        },
        conferenceData: {
          createRequest: {
            requestId: `meet-${item.id}-${Date.now()}`,
            conferenceSolutionKey: {
              type: 'hangoutsMeet',
            },
          },
        },
        extendedProperties: {
          private: {
            orderItemId: item.id.toString(),
            customerEmail,
            employeeEmail: employeeEmail || '',
            quantity: item.quantity.toString(),
            price: item.price.toString(),
            businessOwnerEmail: businessOwnerEmail || '',
          },
        },
      };

      // Create the event - Use configured calendar ID
      const calendarId =
        this.configService.get<string>('googleCalendar.calendarId') ||
        'c_41f0af94200759137f30305f470ef7853a4020e41c5b160eedf7dea7cae3db9a@group.calendar.google.com';
      this.logger.log(ctx, `Creating event in calendar: ${calendarId}`);
      this.logger.log(
        ctx,
        `Event attendees: Customer: ${customerEmail}, Employee: ${employeeEmail || 'None'}`,
      );

      try {
        // Ensure OAuth2 credentials are set and refreshed before making the API call
        await this.ensureValidCredentials(ctx);

        // Get the refreshed access token
        const credentials = this.oauth2Client.credentials;
        if (!credentials.access_token) {
          throw new Error('No access token available');
        }

        // Use raw HTTP request to create events (same approach that worked in test)
        const response = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events?conferenceDataVersion=1`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${credentials.access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              ...event,
              sendUpdates: 'all', // Send invitations to all attendees
            }),
          },
        );

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        const eventData = (await response.json()) as any;

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
          `Failed to insert event into calendar ${calendarId}: ${
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
      throw error;
    }
  }

  async getBookedSlots(
    startDate: Date,
    endDate: Date,
    employees: User[],
  ): Promise<
    Map<string, Array<{ employeeId: number; employeeEmail: string }>>
  > {
    try {
      this.logger.log(
        new RequestContext(),
        `Getting booked slots from ${startDate.toISOString()} to ${endDate.toISOString()}`,
      );

      // Ensure OAuth2 credentials are valid before making the API call
      await this.ensureValidCredentials(new RequestContext());

      // Get the refreshed access token
      const credentials = this.oauth2Client.credentials;
      if (!credentials.access_token) {
        throw new Error('No access token available');
      }

      const calendarId =
        this.configService.get<string>('googleCalendar.calendarId') ||
        'c_41f0af94200759137f30305f470ef7853a4020e41c5b160eedf7dea7cae3db9a@group.calendar.google.com';

      // Use raw HTTP request to list events
      const url = new URL(
        `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`,
      );
      url.searchParams.set('timeMin', startDate.toISOString());
      url.searchParams.set('timeMax', endDate.toISOString());
      url.searchParams.set('singleEvents', 'true');
      url.searchParams.set('orderBy', 'startTime');

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${credentials.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = (await response.json()) as any;

      const bookedSlots = new Map<
        string,
        Array<{ employeeId: number; employeeEmail: string }>
      >();

      if (data.items) {
        for (const event of data.items) {
          this.logger.log(
            new RequestContext(),
            `Processing event: ${event.summary}`,
          );
          this.logger.log(
            new RequestContext(),
            `Event start: ${JSON.stringify(event.start)}`,
          );

          const employeeInfo = this.extractEmployeeFromEvent(event, employees);

          if (employeeInfo && event.start?.dateTime) {
            // Convert event time to UTC for consistent comparison
            const eventTime = new Date(event.start.dateTime);
            const slotTime = eventTime.toISOString();

            this.logger.log(
              new RequestContext(),
              `Adding booking for slot: ${slotTime} (from ${event.start.dateTime}) with employee: ${employeeInfo.employeeEmail}`,
            );
            const existingBookings = bookedSlots.get(slotTime) || [];
            existingBookings.push(employeeInfo);
            bookedSlots.set(slotTime, existingBookings);
          } else {
            this.logger.log(
              new RequestContext(),
              `Skipping event - no employee info or no dateTime. Employee: ${employeeInfo ? 'found' : 'not found'}, DateTime: ${event.start?.dateTime || 'none'}`,
            );
          }
        }
      }

      this.logger.log(
        new RequestContext(),
        `Found ${bookedSlots.size} booked slots in Google Calendar`,
      );

      return bookedSlots;
    } catch (error) {
      this.logger.error(
        new RequestContext(),
        `Failed to get booked slots: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
      return new Map();
    }
  }

  private extractEmployeeFromEvent(
    event: calendar_v3.Schema$Event,
    employees: User[],
  ): { employeeId: number; employeeEmail: string } | null {
    this.logger.log(
      new RequestContext(),
      `Extracting employee from event: ${event.summary}`,
    );
    this.logger.log(
      new RequestContext(),
      `Event attendees: ${JSON.stringify(event.attendees?.map((a) => a.email))}`,
    );
    this.logger.log(
      new RequestContext(),
      `Available employees: ${JSON.stringify(employees.map((e) => e.email))}`,
    );

    if (event.attendees) {
      for (const attendee of event.attendees) {
        const employee = employees.find(
          (emp) => emp.email.toLowerCase() === attendee.email?.toLowerCase(),
        );
        if (employee) {
          this.logger.log(
            new RequestContext(),
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
          new RequestContext(),
          `Found employee via extended properties: ${employee.email} (ID: ${employee.id})`,
        );
        return { employeeId: employee.id, employeeEmail: employee.email };
      }
    }

    this.logger.log(
      new RequestContext(),
      `No employee found for event: ${event.summary}`,
    );
    return null;
  }

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

      const availableEmployees = employees.filter(
        (emp) => !busyEmployeeIds.includes(emp.id),
      );

      this.logger.log(
        new RequestContext(),
        `Found ${availableEmployees.length} available employees at ${dateTime}`,
      );

      return availableEmployees;
    } catch (error) {
      this.logger.error(
        new RequestContext(),
        `Failed to get available employees at ${dateTime}: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
      return employees; // Return all employees as fallback
    }
  }

  // Method to manually set OAuth2 credentials
  setOAuth2Credentials(accessToken: string, refreshToken: string): void {
    this.oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    this.logger.log(new RequestContext(), 'OAuth2 credentials manually set');
  }

  /**
   * Ensures OAuth2 credentials are valid and refreshes access token if needed
   */
  private async ensureValidCredentials(ctx: RequestContext): Promise<void> {
    const accessToken = this.configService.get<string>(
      'googleCalendar.accessToken',
    );
    const refreshToken = this.configService.get<string>(
      'googleCalendar.refreshToken',
    );

    if (!accessToken || !refreshToken) {
      throw new Error(
        'OAuth2 credentials not found. Please authorize the application.',
      );
    }

    // Set current credentials
    this.oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    this.logger.log(ctx, 'OAuth2 credentials loaded from environment');

    // Try to refresh the access token
    try {
      const { credentials } = await this.oauth2Client.refreshAccessToken();
      this.oauth2Client.setCredentials(credentials);

      // Update the stored access token if it was refreshed
      if (
        credentials.access_token &&
        credentials.access_token !== accessToken
      ) {
        this.logger.log(ctx, 'Access token refreshed successfully');
        this.logger.log(
          ctx,
          `New access token: ${credentials.access_token.slice(0, 20)}...`,
        );
        // Note: In a production app, you'd want to store the new access token
        // For now, we'll use the refreshed token for this session
      }

      // Skip calendar access test - we'll test during actual API calls
      this.logger.log(
        ctx,
        'Skipping calendar access test - will test during API calls',
      );
    } catch (refreshError) {
      this.logger.error(
        ctx,
        `Failed to refresh access token: ${refreshError instanceof Error ? refreshError.message : 'Unknown error'}`,
      );

      // If refresh fails, the refresh token might be expired
      // In this case, we need to re-authorize
      throw new Error(
        'Refresh token expired. Please re-authorize the application.',
      );
    }
  }

  private parseDuration(duration: string): number {
    const match = duration.match(/(\d+)([hm])/);
    if (!match) {return 60 * 60 * 1000;} // Default to 1 hour

    const value = parseInt(match[1]);
    const unit = match[2];

    if (unit === 'h') {
      return value * 60 * 60 * 1000; // Convert hours to milliseconds
    } else if (unit === 'm') {
      return value * 60 * 1000; // Convert minutes to milliseconds
    }

    return 60 * 60 * 1000; // Default to 1 hour
  }
}
