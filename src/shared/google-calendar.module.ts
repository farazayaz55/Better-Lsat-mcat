import { Module } from '@nestjs/common';
import { GoogleCalendarService } from './services/google-calendar-api-key.service';
import { SharedModule } from './shared.module';

@Module({
  imports: [SharedModule],
  providers: [GoogleCalendarService],
  exports: [GoogleCalendarService],
})
export class GoogleCalendarModule {}
