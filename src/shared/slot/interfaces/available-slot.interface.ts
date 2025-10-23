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
  @ApiProperty({
    description: 'Time slot',
    example: '2025-10-22T09:00:00.000Z',
  })
  slot: string;

  @ApiProperty({
    description: 'Available employees for this slot',
    type: [AvailableEmployee],
  })
  availableEmployees: AvailableEmployee[];
}
