import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
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
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  BaseApiErrorResponse,
  swaggerBaseApiResponse,
} from '../shared/dtos/base-api-response.dto';
import { AppLogger } from '../shared/logger/logger.service';
import { ReqContext } from '../shared/request-context/req-context.decorator';
import { RequestContext } from '../shared/request-context/request-context.dto';
import { GhlService } from '../shared/services/Ghl.service';
import { OrderInput } from './dto/order-input.dto';
import { OrderOutput } from './dto/order-output.dto';
import { OrderService } from './order.service';
import { ConfigService } from '@nestjs/config';

@ApiTags('order')
@Controller('order')
export class OrderController {
  constructor(
    private readonly orderService: OrderService,
    private readonly logger: AppLogger,
    private readonly ghlService: GhlService,
    private readonly configService: ConfigService,
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
  ) {
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
    return stripeSession;
  }

  @Get()
  @ApiOperation({
    summary: 'Get Orders as a list API',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    type: swaggerBaseApiResponse([OrderOutput]),
  })
  @UseInterceptors(ClassSerializerInterceptor)
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  findAll() {
    return this.orderService.findAll();
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
    @Query('customerTimezone') timezone: string,
  ) {
    return await this.orderService.getSlotsBooked(
      ctx,
      date,
      month,
      year,
      packageId,
      timezone,
    );
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
  findOne(@Param('id') id: string) {
    return this.orderService.findOne(+id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update order API',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    type: swaggerBaseApiResponse(OrderOutput),
  })
  @UseInterceptors(ClassSerializerInterceptor)
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  update(@Param('id') id: string, @Body() updateOrderDto: OrderInput) {
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
  remove(@ReqContext() ctx: RequestContext, @Param('id') id: string) {
    return this.orderService.remove(ctx, +id);
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
  ) {
    return this.orderService.createStripeCheckoutSession(ctx, +id);
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
  ) {
    return this.orderService.createStripePaymentIntent(ctx, +id);
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
  ) {
    return this.orderService.confirmStripePayment(ctx, body.paymentIntentId);
  }
}
