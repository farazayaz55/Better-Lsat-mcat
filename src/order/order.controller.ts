import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiBearerAuth,
  ApiExtraModels,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { plainToInstance } from 'class-transformer';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/role.decorator';
import { ROLE } from '../auth/constants/role.constant';
import {
  BaseApiErrorResponse,
  BaseApiResponse,
  swaggerBaseApiResponse,
} from '../shared/dtos/base-api-response.dto';
import { AppLogger } from '../shared/logger/logger.service';
import { ReqContext } from '../shared/request-context/req-context.decorator';
import { RequestContext } from '../shared/request-context/request-context.dto';
import { GhlService } from '../shared/services/Ghl.service';
import { OrderInput } from './dto/order-input.dto';
import { OrderOutput , OrderAppointmentOutput } from './dto/order-output.dto';
import {
  ModifyOrderDto,
  OrderModificationResultDto,
} from './dto/modify-order.dto';
import { GetOrdersQueryParams } from './interfaces/get-orders-query.interface';
import {
  PaymentStatus,
  StripeCheckoutSession,
  StripePaymentIntent,
} from './interfaces/stripe-metadata.interface';
import { OrderService } from './services/order.service';
import { OrderAppointmentService } from './services/order-appointment.service';
import { PaymentService } from './services/payment.service';
import { ReservationCleanupService } from './reservation-cleanup.service';
import { UpdateOrderNotesDto } from './dto/update-order-notes.dto';
import { MarkAppointmentAttendanceDto } from './dto/mark-appointment-attendance.dto';
import { signRescheduleToken } from '../shared/security/reschedule-token.util';
import { OrderStatus } from './entities/order.entity';

@ApiTags('order')
@Controller('order')
@ApiExtraModels(GetOrdersQueryParams)
export class OrderController {
  constructor(
    private readonly orderService: OrderService,
    private readonly orderAppointmentService: OrderAppointmentService,
    private readonly paymentService: PaymentService,
    private readonly logger: AppLogger,
    private readonly ghlService: GhlService,
    private readonly configService: ConfigService,
    private readonly reservationCleanupService: ReservationCleanupService,
  ) {
    this.logger.setContext(OrderController.name);
  }
  @Patch(':id/notes')
  @ApiOperation({ summary: 'Update order notes' })
  @UseInterceptors(ClassSerializerInterceptor)
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLE.ADMIN, ROLE.USER)
  async updateNotes(
    @ReqContext() ctx: RequestContext,
    @Param('id') id: number,
    @Body() dto: UpdateOrderNotesDto,
  ): Promise<BaseApiResponse<OrderOutput>> {
    await this.orderService.updateOrder(id, { notes: dto.notes });
    const updated = await this.orderService.findOne(id);
    if (!updated) {
      throw new NotFoundException(`Order ${id} not found`);
    }
    const out = plainToInstance(OrderOutput, updated, {
      excludeExtraneousValues: true,
    });
    return { data: out, meta: {} };
  }

  @Get(':id/appointments')
  @ApiOperation({ summary: 'List appointments for an order' })
  @UseInterceptors(ClassSerializerInterceptor)
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLE.ADMIN, ROLE.USER)
  async listAppointments(
    @Param('id') id: number,
  ): Promise<BaseApiResponse<OrderAppointmentOutput[]>> {
    const appts = await this.orderAppointmentService.listByOrder(Number(id));
    const data = appts.map((a) =>
      plainToInstance(OrderAppointmentOutput, a, {
        excludeExtraneousValues: true,
      }),
    );
    return { data, meta: { total: data.length } } as any;
  }

  @Patch('appointments/:appointmentId/attendance')
  @ApiOperation({ summary: 'Mark appointment attendance' })
  @UseInterceptors(ClassSerializerInterceptor)
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLE.ADMIN, ROLE.USER)
  async markAppointmentAttendance(
    @ReqContext() ctx: RequestContext,
    @Param('appointmentId') appointmentId: number,
    @Body() dto: MarkAppointmentAttendanceDto,
  ): Promise<BaseApiResponse<OrderAppointmentOutput>> {
    const saved = await this.orderAppointmentService.markAttendance(
      ctx,
      Number(appointmentId),
      dto.status,
      ctx.user?.id,
    );
    const data = plainToInstance(OrderAppointmentOutput, saved, {
      excludeExtraneousValues: true,
    });
    return { data, meta: {} } as any;
  }

  @Post('appointments/:appointmentId/reschedule/link')
  @ApiOperation({ summary: 'Generate reschedule link for an appointment' })
  @UseInterceptors(ClassSerializerInterceptor)
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLE.ADMIN, ROLE.USER)
  async generateRescheduleLink(
    @ReqContext() ctx: RequestContext,
    @Param('appointmentId') appointmentId: number,
  ): Promise<BaseApiResponse<{ url: string }>> {
    const apptId = Number(appointmentId);
    const appt = await this.orderAppointmentService.getById(apptId);
    if (!appt) {throw new NotFoundException('Appointment not found');}
    const token = signRescheduleToken({
      appointmentId: appt.id,
      orderId: appt.orderId,
      itemId: appt.itemId,
    });
    const base =
      process.env.RESCHEDULE_BASE_URL ||
      this.configService.get<string>('RESCHEDULE_BASE_URL');
    const trimmed = base?.replace(/\/$/, '') || '';
    const hasPath = /\/reschedule$/i.test(trimmed);
    const url = `${trimmed}${hasPath ? '' : '/reschedule'}?token=${token}`;
    return { data: { url }, meta: {} } as any;
  }

  @Patch('appointments/:appointmentId/reschedule')
  @ApiOperation({ summary: 'Reschedule an appointment (admin)' })
  @UseInterceptors(ClassSerializerInterceptor)
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLE.ADMIN, ROLE.USER)
  async rescheduleAppointment(
    @ReqContext() ctx: RequestContext,
    @Param('appointmentId') appointmentId: number,
    @Body() body: { newDateTimeISO: string },
  ): Promise<BaseApiResponse<OrderAppointmentOutput>> {
    const saved = await this.orderAppointmentService.reschedule(
      ctx,
      Number(appointmentId),
      body.newDateTimeISO,
    );
    const data = plainToInstance(OrderAppointmentOutput, saved, {
      excludeExtraneousValues: true,
    });
    return { data, meta: {} } as any;
  }

  @Patch(':orderId/complete')
  @ApiOperation({ summary: 'Mark order as completed' })
  @UseInterceptors(ClassSerializerInterceptor)
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLE.ADMIN, ROLE.USER)
  async markOrderCompleted(
    @ReqContext() ctx: RequestContext,
    @Param('orderId') orderId: number,
  ): Promise<BaseApiResponse<{ status: OrderStatus }>> {
    await this.orderService.markCompleted(ctx, Number(orderId));
    return { data: { status: OrderStatus.COMPLETED }, meta: {} } as any;
  }

  @Post()
  @ApiOperation({ summary: 'Create Order' })
  @HttpCode(HttpStatus.OK)
  @ApiResponse({
    status: HttpStatus.CREATED,
    type: swaggerBaseApiResponse(StripeCheckoutSession),
  })
  // @UseInterceptors(ClassSerializerInterceptor)
  // @ApiBearerAuth()
  // @UseGuards(JwtAuthGuard)
  async create(
    @ReqContext() ctx: RequestContext,
    @Body() createOrderDto: OrderInput,
  ): Promise<BaseApiResponse<StripeCheckoutSession | undefined>> {
    const order = await this.orderService.create(ctx, createOrderDto);
    this.logger.log(ctx, `Created order with ID: ${order.id}`);
    // Create Stripe checkout session instead of WooCommerce URL
    const stripeSession = await this.paymentService.createStripeCheckoutSession(
      ctx,
      order.id,
      createOrderDto.currency,
    );
    return { data: stripeSession, meta: {} };
  }

  @Get()
  @ApiOperation({
    summary: 'Get Orders as a list API',
  })
  @ApiQuery({
    name: 'orderStatus',
    required: false,
    enum: PaymentStatus,
    description: 'Filter orders by payment status',
    example: PaymentStatus.SUCCEEDED,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    type: swaggerBaseApiResponse([OrderOutput]),
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    type: BaseApiErrorResponse,
    description: 'Invalid date format',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    type: BaseApiErrorResponse,
    description: 'Invalid date format',
  })
  @UseInterceptors(ClassSerializerInterceptor)
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLE.ADMIN, ROLE.USER)
  async findAll(
    @Query() query: GetOrdersQueryParams,
  ): Promise<BaseApiResponse<OrderOutput[]>> {
    const { orders, count } = await this.orderService.findAll(
      query.limit,
      query.offset,
      query.orderStatus,
    );
    return { data: orders, meta: { total: count } };
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get order by id API',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    type: swaggerBaseApiResponse(OrderOutput),
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    type: BaseApiErrorResponse,
  })
  @UseInterceptors(ClassSerializerInterceptor)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(ROLE.ADMIN, ROLE.USER)
  async findOne(
    @Param('id') id: string,
  ): Promise<BaseApiResponse<OrderOutput>> {
    const order = await this.orderService.findOne(+id);
    if (!order) {
      throw new NotFoundException();
    }
    const orderOutput = plainToInstance(OrderOutput, order, {
      excludeExtraneousValues: true,
    });

    // Map checkoutSessionUrl from stripe_meta
    if (order.stripe_meta?.checkoutSessionUrl) {
      orderOutput.checkoutSessionUrl = order.stripe_meta.checkoutSessionUrl;
    }

    console.log(orderOutput);
    return { data: orderOutput, meta: {} };
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update order API (Placeholder)',
    description:
      'Updates an existing order - currently returns placeholder response',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Order update placeholder response',
    type: String,
  })
  @UseInterceptors(ClassSerializerInterceptor)
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLE.ADMIN, ROLE.USER)
  async update(
    @Param('id') id: string,
    @Body() updateOrderDto: OrderInput,
  ): Promise<void> {
    //place holder api.
    return await this.orderService.updateOrder(+id, updateOrderDto);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete order by id API',
  })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
  })
  @UseInterceptors(ClassSerializerInterceptor)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(ROLE.ADMIN)
  async remove(
    @ReqContext() ctx: RequestContext,
    @Param('id') id: string,
  ): Promise<BaseApiResponse<void>> {
    const data = await this.orderService.remove(ctx, +id);
    return { data, meta: {} };
  }

  @Post(':id/stripe/checkout')
  @ApiOperation({
    summary: 'Create Stripe checkout session for order',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Returns Stripe checkout session URL and ID',
    type: swaggerBaseApiResponse(StripeCheckoutSession),
  })
  async createStripeCheckout(
    @ReqContext() ctx: RequestContext,
    @Param('id') id: string,
  ): Promise<BaseApiResponse<StripeCheckoutSession | undefined>> {
    const data = await this.paymentService.createStripeCheckoutSession(
      ctx,
      +id,
    );
    return { data, meta: {} };
  }

  @Post(':id/stripe/payment-intent')
  @ApiOperation({
    summary: 'Create Stripe payment intent for order',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Returns Stripe payment intent client secret and ID',
    type: swaggerBaseApiResponse(StripePaymentIntent),
  })
  async createStripePaymentIntent(
    @ReqContext() ctx: RequestContext,
    @Param('id') id: string,
  ): Promise<BaseApiResponse<StripePaymentIntent | undefined>> {
    const data = await this.paymentService.createStripePaymentIntent(ctx, +id);
    return { data, meta: {} };
  }

  @Post('stripe/confirm-payment')
  @ApiOperation({
    summary: 'Confirm Stripe payment',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Returns payment confirmation status',
  })
  async confirmStripePayment(
    @ReqContext() ctx: RequestContext,
    @Body() body: { paymentIntentId: string },
  ): Promise<BaseApiResponse<boolean>> {
    const data = await this.paymentService.confirmStripePayment(
      ctx,
      body.paymentIntentId,
    );
    return { data, meta: {} };
  }

  @Post('cleanup/reservations')
  @ApiOperation({
    summary: 'Manually run reservation cleanup job (for testing/debugging)',
    description:
      'Note: Cleanup runs automatically every 5 minutes via cron job. This endpoint is for manual testing only.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Returns cleanup results',
  })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async runReservationCleanup(@ReqContext() ctx: RequestContext): Promise<
    BaseApiResponse<{
      expiredCount: number;
      stats: {
        total: number;
        reserved: number;
        confirmed: number;
        expired: number;
      };
    }>
  > {
    const data = await this.reservationCleanupService.runCleanupJob(ctx);
    return { data, meta: {} };
  }

  @Get('cleanup/stats')
  @ApiOperation({
    summary: 'Get reservation statistics (for monitoring)',
    description:
      'Returns current reservation statistics. Cleanup runs automatically every 5 minutes.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Returns reservation statistics',
  })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async getReservationStats(@ReqContext() ctx: RequestContext): Promise<
    BaseApiResponse<{
      total: number;
      reserved: number;
      confirmed: number;
      expired: number;
    }>
  > {
    const data = await this.reservationCleanupService.getReservationStats(ctx);
    return { data, meta: {} };
  }

  @Post('modify')
  @ApiOperation({
    summary: 'Modify an existing order',
    description:
      'Refunds the original order and creates a new one with different items',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Order successfully modified',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'object',
          properties: {
            refund: { type: 'object' },
            newOrder: { type: 'object' },
            newInvoice: { type: 'object' },
          },
        },
        meta: { type: 'object' },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    type: BaseApiErrorResponse,
    description: 'Invalid input or order cannot be modified',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    type: BaseApiErrorResponse,
    description: 'Original order not found',
  })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(ROLE.ADMIN, ROLE.USER)
  async modifyOrder(
    @ReqContext() ctx: RequestContext,
    @Body() modifyOrderDto: ModifyOrderDto,
  ): Promise<BaseApiResponse<OrderModificationResultDto>> {
    this.logger.log(ctx, `${this.modifyOrder.name} was called`);

    const data = await this.orderService.modifyOrder(ctx, modifyOrderDto);
    return { data, meta: {} };
  }
}
