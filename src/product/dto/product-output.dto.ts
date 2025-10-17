import { Expose, Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Badge } from '../../order/dto/order-output.dto';

export class ProductOutput {
  @Expose()
  @ApiProperty({
    description: 'Product ID',
    example: 5,
    type: Number,
  })
  id: number;

  @Expose()
  @ApiProperty({
    description: 'Product name',
    example: '60-Minute Single Prep',
    type: String,
  })
  name: string;

  @Expose()
  @ApiProperty({
    description: 'Product price in dollars',
    example: 125,
    type: Number,
  })
  price: number;

  @Expose()
  @ApiPropertyOptional({
    description: 'Savings amount in dollars (optional)',
    example: 75,
    type: Number,
    default: 0,
  })
  save?: number;

  @Expose()
  @ApiProperty({
    description: 'Number of sessions included',
    example: 1,
    type: Number,
  })
  sessions: number;

  @Expose()
  @ApiProperty({
    description: 'Session duration',
    example: 'Unlimited',
    type: String,
  })
  Duration: string;

  @Expose()
  @ApiProperty({
    description: 'Product description',
    example:
      'Need flexibility? Book individual LSAT tutoring sessions as you go',
    type: String,
  })
  Description: string;

  @Expose()
  @Type(() => Badge)
  @ApiPropertyOptional({
    description: 'Optional badge information',
    type: Badge,
    example: { text: 'Most Popular', color: 'bg-blue-600' },
  })
  badge?: Badge;

  @Expose()
  @ApiProperty({
    description: 'Product creation timestamp',
    type: String,
    example: '2025-01-15T10:30:00Z',
  })
  createdAt: Date;

  @Expose()
  @ApiProperty({
    description: 'Product last update timestamp',
    type: String,
    example: '2025-01-15T10:30:00Z',
  })
  updatedAt: Date;
}
