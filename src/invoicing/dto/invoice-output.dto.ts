/* eslint-disable unicorn/numeric-separators-style */
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

import { InvoiceStatus } from '../constants/invoice-status.constant';

export class InvoiceItemOutputDto {
  @ApiProperty({ example: 1 })
  @Expose()
  id: number;

  @ApiProperty({ example: 'Tutoring Session' })
  @Expose()
  name: string;

  @ApiProperty({ example: 10000 })
  @Expose()
  price: number;

  @ApiProperty({ example: 1 })
  @Expose()
  quantity: number;

  @ApiProperty({ example: 10000 })
  @Expose()
  total: number;
}

export class InvoiceOutputDto {
  @ApiProperty({ example: 1 })
  @Expose()
  id: number;

  @ApiProperty({ example: 'INV-20250115-0001' })
  @Expose()
  invoiceNumber: string;

  @ApiProperty({ example: 1 })
  @Expose()
  orderId: number;

  @ApiProperty({ example: 1 })
  @Expose()
  customerId: number;

  @ApiProperty({ enum: InvoiceStatus, example: InvoiceStatus.PAID })
  @Expose()
  status: InvoiceStatus;

  @ApiProperty({ example: '2025-01-15' })
  @Expose()
  issueDate: Date;

  @ApiProperty({ example: '2025-01-22' })
  @Expose()
  dueDate: Date;

  @ApiPropertyOptional({ example: '2025-01-15' })
  @Expose()
  paidDate: Date | null;

  @ApiProperty({ type: [InvoiceItemOutputDto] })
  @Expose()
  items: InvoiceItemOutputDto[];

  @ApiProperty({ example: 10000 })
  @Expose()
  subtotal: number;

  @ApiProperty({ example: 0 })
  @Expose()
  tax: number;

  @ApiProperty({ example: 0 })
  @Expose()
  discount: number;

  @ApiProperty({ example: 10000 })
  @Expose()
  total: number;

  @ApiProperty({ example: 'USD' })
  @Expose()
  currency: string;

  @ApiPropertyOptional({ example: 'Thank you for your business!' })
  @Expose()
  notes: string | null;

  @ApiPropertyOptional({ example: '2025-01-15T14:30:00.000Z' })
  @Expose()
  voidedAt: Date | null;

  @ApiPropertyOptional({ example: 'Customer requested refund' })
  @Expose()
  voidReason: string | null;

  @ApiProperty({ example: '2025-01-15T14:30:00.000Z' })
  @Expose()
  createdAt: Date;

  @ApiProperty({ example: '2025-01-15T14:30:00.000Z' })
  @Expose()
  updatedAt: Date;
}
