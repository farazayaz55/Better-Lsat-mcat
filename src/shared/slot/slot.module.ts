import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SlotController } from './slot.controller';
import { SlotService } from './services/slot.service';
import { SlotGeneratorService } from './services/slot-generator.service';
import { SlotAvailabilityService } from './services/slot-availability.service';
import { SlotReservationService } from './services/slot-reservation.service';
import { Order } from '../../order/entities/order.entity';
import { GoogleCalendarModule } from '../google-calendar.module';
import { UserModule } from '../../user/user.module';
import { SharedModule } from '../shared.module';

@Module({
  imports: [
    SharedModule, // Provides AppLogger and EmployeeAvailabilityService
    TypeOrmModule.forFeature([Order]),
    GoogleCalendarModule,
    UserModule,
  ],
  controllers: [SlotController],
  providers: [
    SlotService,
    SlotGeneratorService,
    SlotAvailabilityService,
    SlotReservationService,
  ],
  exports: [SlotService], // Export SlotService for use by other modules
})
export class SlotModule {}
