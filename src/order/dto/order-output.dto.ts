import { Expose, Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserOutput } from '../../user/dtos/user-output.dto';
import { SlotReservationStatus } from '../../shared/slot/constants/slot-reservation-status.constant';
import { IsArray, IsNumber } from 'class-validator';

export class Badge {
  @Expose()
  @ApiProperty({
    description: 'Badge text',
    example: 'Popular',
    type: String,
  })
  text: string;

  @Expose()
  @ApiProperty({
    description: 'Badge color',
    example: '#FF6B6B',
    type: String,
  })
  color: string;
}

export class ItemOutput {
  @Expose()
  @ApiProperty({ description: 'Item ID', example: 1 })
  id: number;

  @Expose()
  @ApiProperty({ description: 'Item price', example: 100 })
  price: number;

  @Expose()
  @ApiProperty({ description: 'Item name', example: '60-Minute Prep Session' })
  name: string;

  @Expose()
  @ApiProperty({ description: 'Session duration in minutes', example: 60 })
  Duration: number;

  @Expose()
  @ApiPropertyOptional({
    description: 'Optional badge information',
    type: Badge,
    required: false,
  })
  @Type(() => Badge)
  badge?: Badge;

  @Expose()
  @ApiPropertyOptional({
    description: 'Optional save discount number',
    type: Number,
    required: false,
  })
  @Type(() => Number)
  save?: number;

  @Expose()
  @ApiProperty({ description: 'Number of sessions included', example: 1 })
  sessions: number;

  @Expose()
  @ApiProperty({
    description: 'Item description',
    example: 'Comprehensive prep session',
  })
  Description: string;

  @Expose()
  @ApiProperty({
    description: 'Scheduled date and time',
    example: ['2025-10-15T12:00:00Z'],
    type: [String],
  })
  DateTime: string[];

  @Expose()
  @ApiProperty({ description: 'Quantity', example: 1 })
  quantity: number;

  @Expose()
  @ApiProperty({
    description: 'Assigned employee IDs',
    example: [5, 6],
    type: Array,
    items: { type: 'number' },
  })
  @IsArray()
  @IsNumber({}, { each: true })
  @Type(() => Number)
  assignedEmployeeIds: number[];
}

export class OrderOutput {
  @Expose()
  @ApiProperty({ description: 'Order ID', example: 1 })
  id: number;

  @Expose()
  @Type(() => UserOutput)
  @ApiProperty({
    description: 'Customer information',
    type: UserOutput,
  })
  customer: UserOutput;

  @Expose()
  @Type(() => ItemOutput)
  @ApiProperty({
    description: 'Order items',
    type: [ItemOutput],
  })
  items: ItemOutput[];

  @Expose()
  @ApiPropertyOptional({
    description: 'Slot reservation expiration timestamp',
    example: '2024-01-15T14:30:00.000Z',
    type: 'string',
    format: 'date-time',
    nullable: true,
  })
  slot_reservation_expires_at?: Date;

  @Expose()
  @ApiPropertyOptional({
    description:
      'Slot reservation status indicating the current state of the reservation',
    enum: SlotReservationStatus,
    example: SlotReservationStatus.RESERVED,
    type: 'string',
    nullable: true,
  })
  slot_reservation_status?: SlotReservationStatus;

  @Expose()
  @ApiPropertyOptional({
    description:
      'Google Meet link shared across all calendar events in this order',
    example: 'https://meet.google.com/abc-defg-hij',
    type: 'string',
    nullable: true,
  })
  googleMeetLink?: string;

  @Expose()
  @ApiPropertyOptional({
    description: 'Stripe checkout session URL',
    example: 'https://checkout.stripe.com/pay/cs_test_123456789',
    type: 'string',
    nullable: true,
  })
  checkoutSessionUrl?: string;
}
