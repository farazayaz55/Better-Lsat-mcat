import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { RefundReason } from '../../finance/constants/finance.constant';

export class OrderItemDto {
  @ApiProperty({
    description: 'Name of the order item',
    example: '10x Package',
  })
  @IsString()
  name: string;

  @ApiProperty({
    description: 'Quantity of the item',
    example: 1,
  })
  @IsNumber()
  quantity: number;

  @ApiProperty({
    description: 'Price of the item in cents',
    example: 15000,
  })
  @IsNumber()
  price: number;
}

export class ModifyOrderDto {
  @ApiProperty({
    description: 'ID of the original order to modify',
    example: 383,
  })
  @IsNumber()
  originalOrderId: number;

  @ApiProperty({
    description: 'New order items',
    type: [OrderItemDto],
    example: [
      {
        name: '10x Package',
        quantity: 1,
        price: 15000,
      },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  newOrderItems: OrderItemDto[];

  @ApiProperty({
    description: 'Reason for the order modification',
    enum: RefundReason,
    example: RefundReason.CUSTOMER_REQUEST,
  })
  @IsString()
  refundReason: RefundReason;

  @ApiProperty({
    description: 'Additional details about the modification reason',
    example: 'Customer wanted 10x package instead of 60-minute package',
  })
  @IsString()
  reasonDetails: string;

  @ApiPropertyOptional({
    description: 'Additional notes for the new order',
    example: 'Modified order - upgraded package',
  })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class OrderModificationResultDto {
  @ApiProperty({
    description: 'The refund record created for the original order',
  })
  refund: any;

  @ApiProperty({
    description: 'The new order created',
  })
  newOrder: any;

  @ApiProperty({
    description: 'The new invoice created for the new order',
  })
  newInvoice: any;
}
