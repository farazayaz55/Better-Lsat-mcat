import { IsArray, IsNumber, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ItemInput {
  @ApiProperty({
    description: 'Item ID',
    example: 1,
    type: Number,
  })
  @IsNumber()
  id: number;

  @ApiProperty({
    description: 'Item price',
    example: 100,
    type: Number,
  })
  @IsNumber()
  price: number;

  @ApiProperty({
    description: 'Item name',
    example: '60-Minute Prep Session',
    type: String,
  })
  @IsString()
  name: string;

  @ApiProperty({
    description: 'Session duration',
    example: '60 minutes',
    type: String,
  })
  @IsString()
  Duration: string;

  @ApiProperty({
    description: 'Item description',
    example: 'Comprehensive prep session',
    type: String,
  })
  @IsString()
  Description: string;

  @ApiProperty({
    description: 'Scheduled date and time slots',
    example: ['2025-10-15T12:00:00Z', '2025-10-15T13:00:00Z'],
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  DateTime: string[];

  @ApiProperty({
    description: 'Quantity of items',
    example: 1,
    type: Number,
  })
  @IsNumber()
  quantity: number;

  @ApiPropertyOptional({
    description: 'ID of assigned employee',
    example: 5,
    type: Number,
  })
  @IsOptional()
  @IsNumber()
  assignedEmployeeId?: number;
}

// Array of items
export type Items = ItemInput[];
