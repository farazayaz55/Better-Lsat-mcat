import { Expose, Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserOutput } from '../../user/dtos/user-output.dto';

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
  @ApiProperty({ description: 'Session duration', example: '60 minutes' })
  Duration: string;

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
  @ApiProperty({ description: 'Assigned employee ID', example: 5 })
  assignedEmployeeId: number;
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
}
