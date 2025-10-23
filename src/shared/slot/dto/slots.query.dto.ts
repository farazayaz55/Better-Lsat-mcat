import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsISO8601,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class SlotsQueryDto {
  @ApiProperty({
    description: 'Date in ISO 8601 format (UTC timezone)',
    example: '2025-01-15T00:00:00.000Z',
    type: 'string',
    format: 'date-time',
  })
  @IsNotEmpty({ message: 'Date is required' })
  @IsString({ message: 'Date must be a string' })
  @IsISO8601({}, { message: 'Date must be in ISO 8601 format' })
  date: string;

  @ApiProperty({
    description: 'Service/package ID',
    example: 5,
    minimum: 1,
  })
  @Transform(({ value }) => parseInt(value, 10))
  @IsNotEmpty({ message: 'Package ID is required' })
  @IsNumber({}, { message: 'Package ID must be a number' })
  @Min(1, { message: 'Package ID must be at least 1' })
  packageId: number;

  @ApiProperty({
    description: 'Customer timezone (e.g., America/New_York, Europe/London)',
    example: 'America/New_York',
    required: false,
  })
  @IsOptional()
  @IsString()
  customerTimezone?: string;
}
