/* eslint-disable unicorn/numeric-separators-style */
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
  ApiBody,
  ApiExtraModels,
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

import { InvoiceService } from '../services/invoice.service';
import { CreateInvoiceDto, InvoiceItemDto } from '../dto/invoice-input.dto';
import { InvoiceGeneratorService } from '../services/invoice-generator.service';
import { InvoiceOutputDto } from '../dto/invoice-output.dto';
import {
  UpdateInvoiceStatusDto,
  VoidInvoiceDto,
  InvoiceQueryDto,
} from '../dto/invoice-query.dto';
import { InvoiceStatus } from '../constants/invoice-status.constant';

@ApiTags('invoicing')
@Controller('invoicing')
@ApiExtraModels(
  CreateInvoiceDto,
  InvoiceItemDto,
  InvoiceOutputDto,
  InvoiceQueryDto,
)
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
export class InvoiceController {
  constructor(
    private readonly invoiceService: InvoiceService,
    private readonly invoiceGeneratorService: InvoiceGeneratorService,
  ) {}

  @Post()
  @ApiOperation({
    summary: 'Create a new invoice',
    description: 'Creates a new invoice for an order with detailed line items',
  })
  @ApiBody({
    type: CreateInvoiceDto,
    description: 'Invoice creation data',
    examples: {
      example1: {
        summary: 'Basic Invoice',
        description: 'A basic invoice for a tutoring session',
        value: {
          orderId: 383,
          customerId: 174,
          items: [
            {
              description: 'LSAT Prep Course - 10 Sessions',
              quantity: 1,
              unitPrice: 10000,
              totalPrice: 10000,
            },
          ],
          subtotal: 10000,
          tax: 1000,
          discount: 500,
          total: 10500,
          currency: 'USD',
          notes: 'Thank you for your business!',
          dueDate: '2024-02-15',
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Invoice created successfully',
    type: InvoiceOutputDto,
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
  async createInvoice(
    @ReqContext() ctx: RequestContext,
    @Body() createInvoiceDto: CreateInvoiceDto,
  ): Promise<BaseApiResponse<InvoiceOutputDto>> {
    const invoice = await this.invoiceService.createInvoice(
      ctx,
      createInvoiceDto,
    );
    return {
      data: invoice as any,
      meta: {},
    };
  }

  @Get()
  @ApiOperation({
    summary: 'Get invoices with filters',
    description:
      'Retrieve invoices with optional filtering by status, customer, order, or date range',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: InvoiceStatus,
    description: 'Filter by invoice status',
  })
  @ApiQuery({
    name: 'customerId',
    required: false,
    type: Number,
    description: 'Filter by customer ID',
  })
  @ApiQuery({
    name: 'orderId',
    required: false,
    type: Number,
    description: 'Filter by order ID',
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
    description: 'Number of invoices to return (1-100)',
  })
  @ApiQuery({
    name: 'offset',
    required: false,
    type: Number,
    description: 'Number of invoices to skip',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Invoices retrieved successfully',
    type: [InvoiceOutputDto],
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized access',
    type: BaseApiErrorResponse,
  })
  @Roles(ROLE.ADMIN, ROLE.USER)
  async getInvoices(
    @ReqContext() ctx: RequestContext,
    @Query() query: InvoiceQueryDto,
  ): Promise<BaseApiResponse<InvoiceOutputDto[]>> {
    const filter = {
      status: query.status,
      customerId: query.customerId,
      orderId: query.orderId,
      startDate: query.startDate ? new Date(query.startDate) : undefined,
      endDate: query.endDate ? new Date(query.endDate) : undefined,
      limit: query.limit,
      offset: query.offset,
    };

    const invoices = await this.invoiceService.getInvoicesWithFilters(
      ctx,
      filter,
    );
    return {
      data: invoices as any[],
      meta: {},
    };
  }

  @Get('stats')
  @ApiOperation({
    summary: 'Get invoice statistics',
    description:
      'Retrieve invoice statistics including counts by status and recent activity',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Invoice statistics retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        total: { type: 'number', example: 150 },
        byStatus: {
          type: 'object',
          example: {
            draft: 5,
            issued: 20,
            paid: 120,
            void: 3,
            overdue: 2,
          },
        },
        recentCount: { type: 'number', example: 25 },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized access',
    type: BaseApiErrorResponse,
  })
  @Roles(ROLE.ADMIN, ROLE.USER)
  async getInvoiceStats(
    @ReqContext() ctx: RequestContext,
  ): Promise<BaseApiResponse<any>> {
    const stats = await this.invoiceService.getInvoiceStats(ctx);
    return {
      data: stats,
      meta: {},
    };
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get invoice by ID',
    description: 'Retrieve a specific invoice by its unique identifier',
  })
  @ApiParam({
    name: 'id',
    description: 'Invoice ID',
    type: Number,
    example: 1,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Invoice retrieved successfully',
    type: InvoiceOutputDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Invoice not found',
    type: BaseApiErrorResponse,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized access',
    type: BaseApiErrorResponse,
  })
  @Roles(ROLE.ADMIN, ROLE.USER)
  async getInvoiceById(
    @ReqContext() ctx: RequestContext,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<BaseApiResponse<InvoiceOutputDto>> {
    const invoice = await this.invoiceService.getInvoiceById(ctx, id);
    if (!invoice) {
      throw new NotFoundException(`Invoice with ID ${id} not found`);
    }
    return {
      data: invoice as any,
      meta: {},
    };
  }

  @Get('number/:invoiceNumber')
  @ApiOperation({
    summary: 'Get invoice by invoice number',
    description: 'Retrieve a specific invoice by its invoice number',
  })
  @ApiParam({
    name: 'invoiceNumber',
    description: 'Invoice number',
    type: String,
    example: 'INV-20250115-0001',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Invoice retrieved successfully',
    type: InvoiceOutputDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Invoice not found',
    type: BaseApiErrorResponse,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized access',
    type: BaseApiErrorResponse,
  })
  @Roles(ROLE.ADMIN, ROLE.USER)
  async getInvoiceByNumber(
    @ReqContext() ctx: RequestContext,
    @Param('invoiceNumber') invoiceNumber: string,
  ): Promise<BaseApiResponse<InvoiceOutputDto>> {
    const invoice = await this.invoiceService.getInvoiceByNumber(
      ctx,
      invoiceNumber,
    );
    if (!invoice) {
      throw new NotFoundException(
        `Invoice with number ${invoiceNumber} not found`,
      );
    }
    return {
      data: invoice as any,
      meta: {},
    };
  }

  @Get('order/:orderId')
  @ApiOperation({
    summary: 'Get invoices for an order',
    description: 'Retrieve all invoices associated with a specific order',
  })
  @ApiParam({
    name: 'orderId',
    description: 'Order ID',
    type: Number,
    example: 383,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Invoices retrieved successfully',
    type: [InvoiceOutputDto],
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized access',
    type: BaseApiErrorResponse,
  })
  @Roles(ROLE.ADMIN, ROLE.USER)
  async getInvoicesByOrderId(
    @ReqContext() ctx: RequestContext,
    @Param('orderId', ParseIntPipe) orderId: number,
  ): Promise<BaseApiResponse<InvoiceOutputDto[]>> {
    const invoices = await this.invoiceService.getInvoicesByOrderId(
      ctx,
      orderId,
    );
    return {
      data: invoices as any[],
      meta: {},
    };
  }

  @Get('customer/:customerId')
  @ApiOperation({
    summary: 'Get invoices for a customer',
    description: 'Retrieve all invoices associated with a specific customer',
  })
  @ApiParam({
    name: 'customerId',
    description: 'Customer ID',
    type: Number,
    example: 174,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Invoices retrieved successfully',
    type: [InvoiceOutputDto],
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized access',
    type: BaseApiErrorResponse,
  })
  @Roles(ROLE.ADMIN, ROLE.USER)
  async getInvoicesByCustomerId(
    @ReqContext() ctx: RequestContext,
    @Param('customerId', ParseIntPipe) customerId: number,
  ): Promise<BaseApiResponse<InvoiceOutputDto[]>> {
    const invoices = await this.invoiceService.getInvoicesByCustomerId(
      ctx,
      customerId,
    );
    return {
      data: invoices as any[],
      meta: {},
    };
  }

  @Put(':id/status')
  @ApiOperation({
    summary: 'Update invoice status',
    description: 'Update the status of an existing invoice',
  })
  @ApiParam({
    name: 'id',
    description: 'Invoice ID',
    type: Number,
    example: 1,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Invoice status updated successfully',
    type: InvoiceOutputDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Invoice not found',
    type: BaseApiErrorResponse,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized access',
    type: BaseApiErrorResponse,
  })
  @Roles(ROLE.ADMIN, ROLE.USER)
  async updateInvoiceStatus(
    @ReqContext() ctx: RequestContext,
    @Param('id', ParseIntPipe) id: number,
    @Body() updateStatusDto: UpdateInvoiceStatusDto,
  ): Promise<BaseApiResponse<InvoiceOutputDto>> {
    const invoice = await this.invoiceService.updateInvoiceStatus(
      ctx,
      id,
      updateStatusDto.status,
    );
    return {
      data: invoice as any,
      meta: {},
    };
  }

  @Put(':id/void')
  @ApiOperation({
    summary: 'Void an invoice',
    description: 'Void an existing invoice with a reason',
  })
  @ApiParam({
    name: 'id',
    description: 'Invoice ID',
    type: Number,
    example: 1,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Invoice voided successfully',
    type: InvoiceOutputDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Invoice not found',
    type: BaseApiErrorResponse,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized access',
    type: BaseApiErrorResponse,
  })
  @Roles(ROLE.ADMIN, ROLE.USER)
  async voidInvoice(
    @ReqContext() ctx: RequestContext,
    @Param('id', ParseIntPipe) id: number,
    @Body() voidInvoiceDto: VoidInvoiceDto,
  ): Promise<BaseApiResponse<InvoiceOutputDto>> {
    const invoice = await this.invoiceService.voidInvoice(
      ctx,
      id,
      voidInvoiceDto.reason,
    );
    return {
      data: invoice as any,
      meta: {},
    };
  }

  @Post('generate/:orderId')
  @ApiOperation({
    summary: 'Generate invoice for an order',
    description: 'Automatically generate an invoice for an existing order',
  })
  @ApiParam({
    name: 'orderId',
    description: 'Order ID',
    type: Number,
    example: 383,
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Invoice generated successfully',
    type: InvoiceOutputDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Order not found',
    type: BaseApiErrorResponse,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized access',
    type: BaseApiErrorResponse,
  })
  @Roles(ROLE.ADMIN, ROLE.USER)
  async generateInvoiceForOrder(
    @ReqContext() ctx: RequestContext,
    @Param('orderId', ParseIntPipe) orderId: number,
  ): Promise<BaseApiResponse<InvoiceOutputDto>> {
    const invoice = await this.invoiceGeneratorService.generateInvoiceForOrder(
      ctx,
      orderId,
    );
    if (!invoice) {
      throw new NotFoundException(
        `Order with ID ${orderId} not found or invoice already exists`,
      );
    }
    return {
      data: invoice as any,
      meta: {},
    };
  }
}
