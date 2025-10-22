import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TimePeriod } from '../constants/time-period.constant';

export class TopCustomerDto {
  @ApiProperty({ description: 'Customer ID', example: 1 })
  customerId: number;

  @ApiProperty({ description: 'Customer name', example: 'John Doe' })
  customerName: string;

  @ApiProperty({ description: 'Customer email', example: 'john@example.com' })
  email: string;

  @ApiProperty({
    description: 'Total revenue from this customer',
    example: 1500,
  })
  totalRevenue: number;

  @ApiProperty({
    description: 'Number of orders from this customer',
    example: 5,
  })
  orderCount: number;
}

export class RevenuePeriodDto {
  @ApiProperty({
    description: 'Date for this revenue period',
    example: '2024-01-15',
  })
  date: string;

  @ApiProperty({ description: 'Revenue for this period', example: 500 })
  revenue: number;
}

export class RevenueDto {
  @ApiProperty({ description: 'Total revenue for the period', example: 5000 })
  totalRevenue: number;

  @ApiProperty({
    description: 'Revenue breakdown by period',
    type: [RevenuePeriodDto],
  })
  periodRevenue: RevenuePeriodDto[];
}

export class AppointmentPeriodDto {
  @ApiProperty({
    description: 'Date for this appointment period',
    example: '2024-01-15',
  })
  date: string;

  @ApiProperty({
    description: 'Number of appointments for this period',
    example: 3,
  })
  count: number;
}

export class AppointmentsDto {
  @ApiProperty({
    description: 'Total appointments for the period',
    example: 25,
  })
  totalAppointments: number;

  @ApiProperty({ description: 'Number of upcoming appointments', example: 8 })
  upcomingAppointments: number;

  @ApiProperty({ description: 'Number of completed appointments', example: 17 })
  completedAppointments: number;

  @ApiProperty({
    description: 'Appointments breakdown by period',
    type: [AppointmentPeriodDto],
  })
  periodAppointments: AppointmentPeriodDto[];
}

export class DashboardDataDto {
  @ApiPropertyOptional({
    description: 'Top customers data',
    type: [TopCustomerDto],
  })
  topCustomers?: TopCustomerDto[];

  @ApiPropertyOptional({ description: 'Revenue metrics', type: RevenueDto })
  revenue?: RevenueDto;

  @ApiPropertyOptional({
    description: 'Appointments overview',
    type: AppointmentsDto,
  })
  appointments?: AppointmentsDto;
}

export class DashboardMetaDto {
  @ApiProperty({
    description: 'Time period used',
    enum: TimePeriod,
    example: TimePeriod.MONTH,
  })
  period: TimePeriod;

  @ApiProperty({
    description: 'Start date of the period',
    example: '2024-01-01T00:00:00.000Z',
  })
  startDate: string;

  @ApiProperty({
    description: 'End date of the period',
    example: '2024-01-31T23:59:59.999Z',
  })
  endDate: string;
}

export class DashboardOutputDto {
  @ApiProperty({ description: 'Dashboard data', type: DashboardDataDto })
  data: DashboardDataDto;

  @ApiProperty({ description: 'Dashboard metadata', type: DashboardMetaDto })
  meta: DashboardMetaDto;
}
