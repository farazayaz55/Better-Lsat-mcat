/* eslint-disable unicorn/numeric-separators-style */
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class InvoiceItemDto {
  @ApiProperty({
    description: 'Description of the invoice item',
    example: 'LSAT Prep Course - 10 Sessions',
  })
  @IsString()
  description: string;

  @ApiProperty({
    description: 'Quantity of the item',
    example: 1,
    minimum: 1,
  })
  @IsNumber()
  @Min(1)
  quantity: number;

  @ApiProperty({
    description: 'Unit price in cents',
    example: 10000,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  unitPrice: number;

  @ApiProperty({
    description: 'Total price for this item in cents (quantity × unitPrice)',
    example: 10000,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  totalPrice: number;
}

export class CreateInvoiceDto {
  @ApiProperty({
    description: 'ID of the associated order',
    example: 383,
  })
  @IsNumber()
  orderId: number;

  @ApiProperty({
    description: 'ID of the customer',
    example: 174,
  })
  @IsNumber()
  customerId: number;

  @ApiProperty({
    description: 'Invoice items',
    type: [InvoiceItemDto],
    example: [
      {
        description: 'LSAT Prep Course - 10 Sessions',
        quantity: 1,
        unitPrice: 10000,
        totalPrice: 10000,
      },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InvoiceItemDto)
  items: InvoiceItemDto[];

  @ApiProperty({
    description: 'Subtotal amount in cents (sum of all item totalPrice)',
    example: 10000,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  subtotal: number;

  @ApiPropertyOptional({
    description: 'Tax amount in cents',
    example: 1000,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  tax?: number;

  @ApiPropertyOptional({
    description: 'Discount amount in cents',
    example: 500,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  discount?: number;

  @ApiProperty({
    description: 'Total amount in cents (subtotal + tax - discount)',
    example: 10500,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  total: number;

  @ApiPropertyOptional({
    description: 'Currency code (ISO 4217)',
    example: 'USD',
    default: 'USD',
  })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({
    description: 'Additional notes for the invoice',
    example: 'Thank you for your business!',
  })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({
    description: 'Due date for the invoice (ISO 8601 date string)',
    example: '2024-02-15',
  })
  @IsOptional()
  @IsDateString()
  dueDate?: string;
}
