import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationParamsDto } from '../../shared/dtos/pagination-params.dto';
import { IsEnum, IsOptional } from 'class-validator';
import { PaymentStatus } from '../interfaces/stripe-metadata.interface';

export class GetOrdersQueryParams extends PaginationParamsDto {
  @ApiPropertyOptional({
    description: 'Filter orders by payment status',
    enum: PaymentStatus,
    type: String,
    example: PaymentStatus.SUCCEEDED,
  })
  @IsOptional()
  @IsEnum(PaymentStatus, {
    message: 'orderStatus must be a valid PaymentStatus',
  })
  orderStatus?: PaymentStatus;
}
