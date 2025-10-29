import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  Query,
  UseGuards,
  HttpStatus,
  ParseIntPipe,
  NotFoundException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';

import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/role.decorator';
import { ROLE } from '../../auth/constants/role.constant';
import {
  BaseApiResponse,
  BaseApiErrorResponse,
} from '../../shared/dtos/base-api-response.dto';
import { ReqContext } from '../../shared/request-context/req-context.decorator';
import { RequestContext } from '../../shared/request-context/request-context.dto';

import { RefundService } from '../services/refund.service';
import { Refund } from '../entities/refund.entity';
import {
  CreateRefundDto,
  ProcessRefundDto,
  CancelRefundDto,
  RefundQueryDto,
} from '../dto/refund.dto';
import { RefundStatus, RefundReason } from '../constants/finance.constant';

@ApiTags('refunds')
@Controller('refunds')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
export class RefundController {
  constructor(private readonly refundService: RefundService) {}

  @Post()
  @ApiOperation({
    summary: 'Create a new refund',
    description: 'Creates a new refund request for an order',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Refund created successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'number', example: 1 },
        refundNumber: { type: 'string', example: 'REF-2025-0001' },
        originalOrderId: { type: 'number', example: 383 },
        customerId: { type: 'number', example: 174 },
        amount: { type: 'number', example: 10000 },
        currency: { type: 'string', example: 'USD' },
        reason: { type: 'string', example: 'customer_request' },
        reasonDetails: {
          type: 'string',
          example: 'Customer requested refund due to scheduling conflict',
        },
        status: { type: 'string', example: 'pending' },
        createdAt: { type: 'string', example: '2024-01-15T10:30:00Z' },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid input data',
    type: BaseApiErrorResponse,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized access',
    type: BaseApiErrorResponse,
  })
  @Roles(ROLE.ADMIN, ROLE.USER)
  async createRefund(
    @ReqContext() ctx: RequestContext,
    @Body() createRefundDto: CreateRefundDto,
  ): Promise<BaseApiResponse<Refund>> {
    const refund = await this.refundService.createRefund(ctx, createRefundDto);
    return {
      data: refund,
      meta: {},
    };
  }

  @Get()
  @ApiOperation({
    summary: 'Get refunds with filters',
    description:
      'Retrieve refunds with optional filtering by status, reason, customer, or date range',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: RefundStatus,
    description: 'Filter by refund status',
  })
  @ApiQuery({
    name: 'reason',
    required: false,
    enum: RefundReason,
    description: 'Filter by refund reason',
  })
  @ApiQuery({
    name: 'customerId',
    required: false,
    type: Number,
    description: 'Filter by customer ID',
  })
  @ApiQuery({
    name: 'originalOrderId',
    required: false,
    type: Number,
    description: 'Filter by original order ID',
  })
  @ApiQuery({
    name: 'startDate',
    required: false,
    type: String,
    description: 'Start date for filtering (YYYY-MM-DD)',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    type: String,
    description: 'End date for filtering (YYYY-MM-DD)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Number of refunds to return (1-100)',
  })
  @ApiQuery({
    name: 'offset',
    required: false,
    type: Number,
    description: 'Number of refunds to skip',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Refunds retrieved successfully',
    type: [Refund],
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized access',
    type: BaseApiErrorResponse,
  })
  @Roles(ROLE.ADMIN, ROLE.USER)
  async getRefunds(
    @ReqContext() ctx: RequestContext,
    @Query() query: RefundQueryDto,
  ): Promise<BaseApiResponse<Refund[]>> {
    const filter = {
      status: query.status,
      reason: query.reason,
      customerId: query.customerId,
      originalOrderId: query.originalOrderId,
      startDate: query.startDate ? new Date(query.startDate) : undefined,
      endDate: query.endDate ? new Date(query.endDate) : undefined,
      limit: query.limit,
      offset: query.offset,
    };

    const refunds = await this.refundService.getRefundsWithFilters(ctx, filter);
    return {
      data: refunds,
      meta: {},
    };
  }

  @Get('stats')
  @ApiOperation({
    summary: 'Get refund statistics',
    description:
      'Retrieve refund statistics including counts by status, reason, and recent activity',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Refund statistics retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        total: { type: 'number', example: 25 },
        byStatus: {
          type: 'object',
          example: {
            pending: 5,
            processing: 2,
            completed: 15,
            cancelled: 2,
            failed: 1,
          },
        },
        byReason: {
          type: 'object',
          example: {
            customer_request: 20,
            duplicate: 3,
            fraudulent: 1,
            other: 1,
          },
        },
        recentCount: { type: 'number', example: 8 },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized access',
    type: BaseApiErrorResponse,
  })
  @Roles(ROLE.ADMIN, ROLE.USER)
  async getRefundStats(
    @ReqContext() ctx: RequestContext,
  ): Promise<BaseApiResponse<any>> {
    const stats = await this.refundService.getRefundStats(ctx);
    return {
      data: stats,
      meta: {},
    };
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get refund by ID',
    description: 'Retrieve a specific refund by its unique identifier',
  })
  @ApiParam({
    name: 'id',
    description: 'Refund ID',
    type: Number,
    example: 1,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Refund retrieved successfully',
    type: Refund,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Refund not found',
    type: BaseApiErrorResponse,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized access',
    type: BaseApiErrorResponse,
  })
  @Roles(ROLE.ADMIN, ROLE.USER)
  async getRefundById(
    @ReqContext() ctx: RequestContext,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<BaseApiResponse<Refund>> {
    const refund = await this.refundService.getRefundById(ctx, id);
    if (!refund) {
      throw new NotFoundException(`Refund with ID ${id} not found`);
    }
    return {
      data: refund,
      meta: {},
    };
  }

  @Get('number/:refundNumber')
  @ApiOperation({
    summary: 'Get refund by refund number',
    description: 'Retrieve a specific refund by its refund number',
  })
  @ApiParam({
    name: 'refundNumber',
    description: 'Refund number',
    type: String,
    example: 'REF-2025-0001',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Refund retrieved successfully',
    type: Refund,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Refund not found',
    type: BaseApiErrorResponse,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized access',
    type: BaseApiErrorResponse,
  })
  @Roles(ROLE.ADMIN, ROLE.USER)
  async getRefundByNumber(
    @ReqContext() ctx: RequestContext,
    @Param('refundNumber') refundNumber: string,
  ): Promise<BaseApiResponse<Refund>> {
    const refund = await this.refundService.getRefundByNumber(
      ctx,
      refundNumber,
    );
    if (!refund) {
      throw new NotFoundException(
        `Refund with number ${refundNumber} not found`,
      );
    }
    return {
      data: refund,
      meta: {},
    };
  }

  @Get('order/:orderId')
  @ApiOperation({
    summary: 'Get refunds for an order',
    description:
      'Retrieve all refunds associated with a specific original order',
  })
  @ApiParam({
    name: 'orderId',
    description: 'Original Order ID',
    type: Number,
    example: 383,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Refunds retrieved successfully',
    type: [Refund],
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized access',
    type: BaseApiErrorResponse,
  })
  @Roles(ROLE.ADMIN, ROLE.USER)
  async getRefundsByOrderId(
    @ReqContext() ctx: RequestContext,
    @Param('orderId', ParseIntPipe) orderId: number,
  ): Promise<BaseApiResponse<Refund[]>> {
    const refunds = await this.refundService.getRefundsByOriginalOrderId(
      ctx,
      orderId,
    );
    return {
      data: refunds,
      meta: {},
    };
  }

  @Get('customer/:customerId')
  @ApiOperation({
    summary: 'Get refunds for a customer',
    description: 'Retrieve all refunds associated with a specific customer',
  })
  @ApiParam({
    name: 'customerId',
    description: 'Customer ID',
    type: Number,
    example: 174,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Refunds retrieved successfully',
    type: [Refund],
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized access',
    type: BaseApiErrorResponse,
  })
  @Roles(ROLE.ADMIN, ROLE.USER)
  async getRefundsByCustomerId(
    @ReqContext() ctx: RequestContext,
    @Param('customerId', ParseIntPipe) customerId: number,
  ): Promise<BaseApiResponse<Refund[]>> {
    const refunds = await this.refundService.getRefundsByCustomerId(
      ctx,
      customerId,
    );
    return {
      data: refunds,
      meta: {},
    };
  }

  @Put(':id/process')
  @ApiOperation({
    summary: 'Process a refund',
    description: 'Mark a refund as processing and initiate the refund process',
  })
  @ApiParam({
    name: 'id',
    description: 'Refund ID',
    type: Number,
    example: 1,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Refund processing initiated successfully',
    type: Refund,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Refund not found',
    type: BaseApiErrorResponse,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Refund is not in pending status',
    type: BaseApiErrorResponse,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized access',
    type: BaseApiErrorResponse,
  })
  @Roles(ROLE.ADMIN, ROLE.USER)
  async processRefund(
    @ReqContext() ctx: RequestContext,
    @Param('id', ParseIntPipe) id: number,
    @Body() processRefundDto: ProcessRefundDto,
  ): Promise<BaseApiResponse<Refund>> {
    const refund = await this.refundService.processRefund(
      ctx,
      id,
      processRefundDto,
    );
    return {
      data: refund,
      meta: {},
    };
  }

  @Put(':id/cancel')
  @ApiOperation({
    summary: 'Cancel a refund',
    description: 'Cancel a pending or processing refund',
  })
  @ApiParam({
    name: 'id',
    description: 'Refund ID',
    type: Number,
    example: 1,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Refund cancelled successfully',
    type: Refund,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Refund not found',
    type: BaseApiErrorResponse,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Cannot cancel completed refund',
    type: BaseApiErrorResponse,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized access',
    type: BaseApiErrorResponse,
  })
  @Roles(ROLE.ADMIN, ROLE.USER)
  async cancelRefund(
    @ReqContext() ctx: RequestContext,
    @Param('id', ParseIntPipe) id: number,
    @Body() cancelRefundDto: CancelRefundDto,
  ): Promise<BaseApiResponse<Refund>> {
    const refund = await this.refundService.cancelRefund(
      ctx,
      id,
      cancelRefundDto,
    );
    return {
      data: refund,
      meta: {},
    };
  }
}
