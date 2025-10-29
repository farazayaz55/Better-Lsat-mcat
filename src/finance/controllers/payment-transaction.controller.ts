import {
  ClassSerializerInterceptor,
  Controller,
  Get,
  HttpStatus,
  NotFoundException,
  Param,
  ParseIntPipe,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiExtraModels,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/role.decorator';
import { ROLE } from '../../auth/constants/role.constant';
import {
  BaseApiErrorResponse,
  BaseApiResponse,
  swaggerBaseApiResponse,
} from '../../shared/dtos/base-api-response.dto';
import { AppLogger } from '../../shared/logger/logger.service';
import { ReqContext } from '../../shared/request-context/req-context.decorator';
import { RequestContext } from '../../shared/request-context/request-context.dto';
import {
  TransactionType,
  TRANSACTION_TYPES,
} from '../constants/finance.constant';
import { PaymentTransaction } from '../entities/payment-transaction.entity';
import { TransactionQueryDto } from '../dto/transaction-query.dto';
import { PaymentTransactionService } from '../services/payment-transaction.service';
import { PaymentTransactionFilter } from '../repositories/payment-transaction.repository';

@ApiTags('transactions')
@Controller('transactions')
@ApiExtraModels(TransactionQueryDto)
@UseInterceptors(ClassSerializerInterceptor)
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
export class PaymentTransactionController {
  constructor(
    private readonly paymentTransactionService: PaymentTransactionService,
    private readonly logger: AppLogger,
  ) {
    this.logger.setContext(PaymentTransactionController.name);
  }

  @Get()
  @ApiOperation({
    summary: 'Get payment transactions',
    description:
      'Retrieve payment transactions with optional filtering and pagination. Supports filtering by type, status, customer, order, date range, amount range, payment method, and currency.',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Number of transactions to return (max 100)',
    example: 10,
  })
  @ApiQuery({
    name: 'offset',
    required: false,
    type: Number,
    description: 'Number of transactions to skip',
    example: 0,
  })
  @ApiQuery({
    name: 'type',
    required: false,
    enum: TRANSACTION_TYPES,
    description: 'Filter by transaction type',
    example: TransactionType.PAYMENT,
  })
  @ApiQuery({
    name: 'status',
    required: false,
    type: String,
    description: 'Filter by transaction status',
    example: 'succeeded',
  })
  @ApiQuery({
    name: 'customerId',
    required: false,
    type: Number,
    description: 'Filter by customer ID',
    example: 123,
  })
  @ApiQuery({
    name: 'orderId',
    required: false,
    type: Number,
    description: 'Filter by order ID',
    example: 383,
  })
  @ApiQuery({
    name: 'invoiceId',
    required: false,
    type: Number,
    description: 'Filter by invoice ID',
    example: 1,
  })
  @ApiQuery({
    name: 'startDate',
    required: false,
    type: String,
    description: 'Filter by transactions created after this date (YYYY-MM-DD)',
    example: '2024-01-01',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    type: String,
    description: 'Filter by transactions created before this date (YYYY-MM-DD)',
    example: '2024-12-31',
  })
  @ApiQuery({
    name: 'minAmount',
    required: false,
    type: Number,
    description: 'Minimum amount in cents',
    example: 1000,
  })
  @ApiQuery({
    name: 'maxAmount',
    required: false,
    type: Number,
    description: 'Maximum amount in cents',
    example: 100000,
  })
  @ApiQuery({
    name: 'paymentMethod',
    required: false,
    type: String,
    description: 'Filter by payment method',
    example: 'card',
  })
  @ApiQuery({
    name: 'currency',
    required: false,
    type: String,
    description: 'Filter by currency code',
    example: 'USD',
  })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    enum: ['createdAt', 'amount', 'status', 'type'],
    description: 'Sort by field',
    example: 'createdAt',
  })
  @ApiQuery({
    name: 'sortOrder',
    required: false,
    enum: ['ASC', 'DESC'],
    description: 'Sort order',
    example: 'DESC',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    type: swaggerBaseApiResponse([PaymentTransaction]),
    description: 'List of transactions retrieved successfully',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized access',
    type: BaseApiErrorResponse,
  })
  @Roles(ROLE.ADMIN, ROLE.USER)
  async getTransactions(
    @ReqContext() ctx: RequestContext,
    @Query() query: TransactionQueryDto,
  ): Promise<BaseApiResponse<PaymentTransaction[]>> {
    this.logger.log(ctx, `${this.getTransactions.name} called`);

    // Convert query DTO to filter interface
    const filter: PaymentTransactionFilter = {
      limit: query.limit,
      offset: query.offset,
      type: query.type,
      status: query.status,
      customerId: query.customerId,
      orderId: query.orderId,
      invoiceId: query.invoiceId,
      paymentMethod: query.paymentMethod,
      currency: query.currency,
      minAmount: query.minAmount,
      maxAmount: query.maxAmount,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
    };

    // Parse date strings to Date objects
    if (query.startDate) {
      filter.startDate = new Date(query.startDate);
    }
    if (query.endDate) {
      filter.endDate = new Date(query.endDate);
    }

    const { transactions, total } =
      await this.paymentTransactionService.getTransactionsWithFilters(
        ctx,
        filter,
      );

    return {
      data: transactions,
      meta: {
        total,
        limit: filter.limit,
        offset: filter.offset,
        hasMore: (filter.offset || 0) + (filter.limit || 100) < total,
      },
    };
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get transaction by ID',
    description: 'Retrieve a single payment transaction by its ID',
  })
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'The ID of the transaction',
    example: 1,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    type: swaggerBaseApiResponse(PaymentTransaction),
    description: 'Transaction retrieved successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    type: BaseApiErrorResponse,
    description: 'Transaction not found',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized access',
    type: BaseApiErrorResponse,
  })
  @Roles(ROLE.ADMIN, ROLE.USER)
  async getTransactionById(
    @ReqContext() ctx: RequestContext,
    @Param('id', ParseIntPipe) transactionId: number,
  ): Promise<BaseApiResponse<PaymentTransaction>> {
    this.logger.log(ctx, `${this.getTransactionById.name} called`);

    const transaction = await this.paymentTransactionService.getTransactionById(
      ctx,
      transactionId,
    );

    if (!transaction) {
      throw new NotFoundException(
        `Transaction with ID ${transactionId} not found`,
      );
    }

    return { data: transaction, meta: {} };
  }

  @Get('stats/overview')
  @ApiOperation({
    summary: 'Get transaction statistics',
    description:
      'Get overview statistics for payment transactions including totals, counts by type and status, and revenue metrics',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Transaction statistics retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'object',
          properties: {
            total: { type: 'number', example: 150 },
            byType: {
              type: 'object',
              example: { PAYMENT: 120, REFUND: 30 },
            },
            byStatus: {
              type: 'object',
              example: { succeeded: 140, failed: 10 },
            },
            recentCount: { type: 'number', example: 25 },
            totalRevenue: { type: 'number', example: 500000 },
            totalRefunds: { type: 'number', example: 50000 },
          },
        },
        meta: { type: 'object' },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized access',
    type: BaseApiErrorResponse,
  })
  @Roles(ROLE.ADMIN, ROLE.USER)
  async getTransactionStats(
    @ReqContext() ctx: RequestContext,
  ): Promise<BaseApiResponse<any>> {
    this.logger.log(ctx, `${this.getTransactionStats.name} called`);

    const stats = await this.paymentTransactionService.getTransactionStats(ctx);

    return { data: stats, meta: {} };
  }
}
