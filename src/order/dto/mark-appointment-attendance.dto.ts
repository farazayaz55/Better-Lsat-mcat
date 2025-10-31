import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { OrderAppointmentAttendanceStatus } from '../entities/order-appointment.entity';

export class MarkAppointmentAttendanceDto {
  @ApiProperty({ enum: OrderAppointmentAttendanceStatus })
  @IsEnum(OrderAppointmentAttendanceStatus)
  status: OrderAppointmentAttendanceStatus;
}
