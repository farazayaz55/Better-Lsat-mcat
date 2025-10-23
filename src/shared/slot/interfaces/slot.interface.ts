import { ApiProperty } from '@nestjs/swagger';

export class AvailableEmployee {
  @ApiProperty({ description: 'Employee ID', example: 1 })
  id: number;

  @ApiProperty({ description: 'Employee name', example: 'John Doe' })
  name: string;

  @ApiProperty({ description: 'Employee email', example: 'john@example.com' })
  email: string;
}

export class AvailableSlot {
  @ApiProperty({ description: 'Time slot', example: '09:00' })
  slot: string;

  @ApiProperty({
    description: 'Available employees for this slot',
    type: [AvailableEmployee],
  })
  availableEmployees: AvailableEmployee[];
}

export class Slot {
  @ApiProperty({
    description: 'List of booked time slots',
    example: ['09:00', '10:00'],
    type: [String],
  })
  bookedSlots: string[];

  @ApiProperty({
    description: 'Available slots with employee details',
    type: [AvailableSlot],
  })
  availableSlots: AvailableSlot[];

  @ApiProperty({
    description: 'Duration of each slot in minutes',
    example: 60,
  })
  slotDurationMinutes: number;

  @ApiProperty({
    description: 'Optional warning message',
    example: 'Limited availability',
    required: false,
  })
  warning?: string;
}
