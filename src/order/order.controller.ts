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
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
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
import { OrderOutput } from './dto/order-output.dto';
import { OrderService } from './order.service';
import { ReservationCleanupService } from './reservation-cleanup.service';
import { ConfigService } from '@nestjs/config';
import { PaginationParamsDto as PaginationParametersDto } from '../shared/dtos/pagination-params.dto';
import {
  PaymentStatus,
  StripeCheckoutSession,
  StripePaymentIntent,
} from './interfaces/stripe-metadata.interface';
import { Slot } from './interfaces/slot.interface';
import { plainToInstance } from 'class-transformer';

@ApiTags('order')
@Controller('order')
export class OrderController {
  constructor(
    private readonly orderService: OrderService,
    private readonly logger: AppLogger,
    private readonly ghlService: GhlService,
    private readonly configService: ConfigService,
    private readonly reservationCleanupService: ReservationCleanupService,
  ) {
    this.logger.setContext(OrderController.name);
  }

  // @Get('woocommerce')
  // @ApiOperation({ summary: 'Get WooCommerce Orders' })
  // @HttpCode(HttpStatus.OK)
  // async getWooCommerceOrders() {
  //   return await this.orderService.getWooCommerceOrders();
  // }

  @Post()
  @ApiOperation({ summary: 'Create Order' })
  @HttpCode(HttpStatus.OK)
  @ApiResponse({
    status: HttpStatus.CREATED,
    type: swaggerBaseApiResponse(OrderOutput),
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
    const contact = await this.ghlService.getOrCreateContact(
      createOrderDto.user,
    );
    //also create appointment in GHL
    // order.items.forEach(async (item) => {
    //   if (item.id === 8) await this.ghlService.createAppointment(ctx, item);
    // });
    for (const item of order.items) {
      if (item.id === 8) {
        //TODO: This GHL flow, creates appointment which needs to be replaced by appointment in google calendar.
        // once ghl creates appointment, it triggers automations such as sending email to customer, sending sms to customer, etc.
        // we need to replace that as well
        await this.ghlService.createAppointment(ctx, item, contact.id);
      }
      // Note: Google Calendar events are now created in the webhook after successful payment
    }
    // Create Stripe checkout session instead of WooCommerce URL
    const stripeSession = await this.orderService.createStripeCheckoutSession(
      ctx,
      order.id,
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
  @UseInterceptors(ClassSerializerInterceptor)
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  async findAll(
    @Query() query: PaginationParametersDto,
    @Query('orderStatus') orderStatus?: PaymentStatus,
  ): Promise<BaseApiResponse<OrderOutput[]>> {
    const { orders, count } = await this.orderService.findAll(
      query.limit,
      query.offset,
      orderStatus,
    );
    return { data: orders, meta: { count } };
  }

  /**get for specific month */
  @Get('slots')
  @ApiOperation({
    summary: 'Get Slots',
  })
  @ApiResponse({
    status: HttpStatus.OK,
  })
  // @UseInterceptors(ClassSerializerInterceptor)
  async findBookings(
    @ReqContext() ctx: RequestContext,
    @Query('date') date: number,
    @Query('month') month: number,
    @Query('year') year: number,
    @Query('packageId') packageId: number,
  ): Promise<BaseApiResponse<Slot>> {
    const slotsBooked = await this.orderService.getSlotsBooked(
      ctx,
      date,
      month,
      year,
      packageId,
    );
    return { data: slotsBooked, meta: {} };
    // return await this.orderService.getSlotsBooked(
    //   ctx,
    //   date,
    //   month,
    //   year,
    //   packageId,
    //   timezone,
    // );
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
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
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
    console.log(orderOutput);
    return { data: orderOutput, meta: {} };
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update order API (Place holder api)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    type: swaggerBaseApiResponse(OrderOutput),
  })
  @UseInterceptors(ClassSerializerInterceptor)
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  update(@Param('id') id: string, @Body() updateOrderDto: OrderInput): string {
    //place holder api.
    return this.orderService.update(+id, updateOrderDto);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete order by id API',
  })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
  })
  @UseInterceptors(ClassSerializerInterceptor)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
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
  })
  async createStripeCheckout(
    @ReqContext() ctx: RequestContext,
    @Param('id') id: string,
  ): Promise<BaseApiResponse<StripeCheckoutSession | undefined>> {
    const data = await this.orderService.createStripeCheckoutSession(ctx, +id);
    return { data, meta: {} };
  }

  @Post(':id/stripe/payment-intent')
  @ApiOperation({
    summary: 'Create Stripe payment intent for order',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Returns Stripe payment intent client secret and ID',
  })
  async createStripePaymentIntent(
    @ReqContext() ctx: RequestContext,
    @Param('id') id: string,
  ): Promise<BaseApiResponse<StripePaymentIntent | undefined>> {
    const data = await this.orderService.createStripePaymentIntent(ctx, +id);
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
    const data = await this.orderService.confirmStripePayment(
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
}
