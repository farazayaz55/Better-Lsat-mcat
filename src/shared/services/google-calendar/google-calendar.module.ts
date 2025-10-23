import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GoogleCalendarAuthService } from './google-calendar-auth.service';
import { GoogleCalendarEventBuilderService } from './google-calendar-event-builder.service';
import { GoogleCalendarAppointmentService } from './google-calendar-appointment.service';
import { GoogleCalendarTaskService } from './google-calendar-task.service';
import { GoogleCalendarBookingService } from './google-calendar-booking.service';
import { GoogleCalendarService } from '../google-calendar-facade.service';

@Module({
  imports: [ConfigModule],
  providers: [
    GoogleCalendarAuthService,
    GoogleCalendarEventBuilderService,
    GoogleCalendarAppointmentService,
    GoogleCalendarTaskService,
    GoogleCalendarBookingService,
    GoogleCalendarService, // Facade service for backward compatibility
  ],
  exports: [
    GoogleCalendarAuthService,
    GoogleCalendarEventBuilderService,
    GoogleCalendarAppointmentService,
    GoogleCalendarTaskService,
    GoogleCalendarBookingService,
    GoogleCalendarService, // Export facade for backward compatibility
  ],
})
export class GoogleCalendarModule {}
