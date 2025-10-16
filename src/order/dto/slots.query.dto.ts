import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, Min, Max } from 'class-validator';
import { Transform } from 'class-transformer';

export class SlotsQueryDto {
  @ApiProperty({
    description: 'Day of the month (1-31)',
    example: 15,
    minimum: 1,
    maximum: 31,
  })
  @Transform(({ value }) => parseInt(value, 10))
  @IsNotEmpty({ message: 'Date is required' })
  @IsNumber({}, { message: 'Date must be a number' })
  @Min(1, { message: 'Date must be at least 1' })
  @Max(31, { message: 'Date must be at most 31' })
  date: number;

  @ApiProperty({
    description: 'Month (1-12)',
    example: 1,
    minimum: 1,
    maximum: 12,
  })
  @Transform(({ value }) => parseInt(value, 10))
  @IsNotEmpty({ message: 'Month is required' })
  @IsNumber({}, { message: 'Month must be a number' })
  @Min(1, { message: 'Month must be at least 1' })
  @Max(12, { message: 'Month must be at most 12' })
  month: number;

  @ApiProperty({
    description: 'Year (2020-2030)',
    example: 2025,
    minimum: 2025,
    maximum: 2050,
  })
  @Transform(({ value }) => parseInt(value, 10))
  @IsNotEmpty({ message: 'Year is required' })
  @IsNumber({}, { message: 'Year must be a number' })
  @Min(2020, { message: 'Year must be at least 2020' })
  @Max(2030, { message: 'Year must be at most 2030' })
  year: number;

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
}
