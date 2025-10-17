import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateProductInput {
  @ApiProperty({
    description: 'Product name',
    example: '60-Minute Single Prep',
    type: String,
  })
  @IsNotEmpty({ message: 'Name is required' })
  @IsString({ message: 'Name must be a string' })
  name: string;

  @ApiProperty({
    description: 'Product price in dollars',
    example: 125,
    type: Number,
    minimum: 0,
  })
  @IsNotEmpty({ message: 'Price is required' })
  @IsNumber({}, { message: 'Price must be a number' })
  @Min(0, { message: 'Price must be at least 0' })
  price: number;

  @ApiPropertyOptional({
    description: 'Savings amount in dollars (optional)',
    example: 75,
    type: Number,
    minimum: 0,
    default: 0,
  })
  @IsOptional()
  @IsNumber({}, { message: 'Save must be a number' })
  @Min(0, { message: 'Save must be at least 0' })
  save?: number;

  @ApiProperty({
    description: 'Session duration',
    example: 'Unlimited',
    type: String,
  })
  @IsNotEmpty({ message: 'Duration is required' })
  @IsString({ message: 'Duration must be a string' })
  Duration: string;

  @ApiProperty({
    description: 'Number of sessions included',
    example: 1,
    type: Number,
    minimum: 1,
  })
  @IsNotEmpty({ message: 'Sessions is required' })
  @IsNumber({}, { message: 'Sessions must be a number' })
  @Min(1, { message: 'Sessions must be at least 1' })
  sessions: number;

  @ApiProperty({
    description: 'Product description',
    example:
      'Need flexibility? Book individual LSAT tutoring sessions as you go',
    type: String,
  })
  @IsNotEmpty({ message: 'Description is required' })
  @IsString({ message: 'Description must be a string' })
  Description: string;

  @ApiPropertyOptional({
    description: 'Optional badge information',
    type: 'object',
    example: { text: 'Most Popular', color: 'bg-blue-600' },
    properties: {
      text: { type: 'string', example: 'Most Popular' },
      color: { type: 'string', example: 'bg-blue-600' },
    },
  })
  @IsOptional()
  @IsObject({ message: 'Badge must be an object' })
  badge?: { text: string; color: string };
}
