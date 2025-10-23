import { Module } from '@nestjs/common';
import { GoogleCalendarModule as NewGoogleCalendarModule } from './services/google-calendar/google-calendar.module';
import { SharedModule } from './shared.module';

@Module({
  imports: [SharedModule, NewGoogleCalendarModule],
  providers: [],
  exports: [NewGoogleCalendarModule],
})
export class GoogleCalendarModule {}
