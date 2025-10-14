import { Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { AppLogger } from '../shared/logger/logger.service';
import { RequestContext } from '../shared/request-context/request-context.dto';
import { GhlService } from '../shared/services/Ghl.service';
import { GoogleCalendarService } from '../shared/services/google-calendar-api-key.service';
import { StripeService } from '../shared/services/stripe.service';
import { WooCommerceService } from '../shared/services/WooCommerce.service';
import { CreateCustomerInput } from '../user/dtos/customer-create-input.dto';
import { UserService } from '../user/services/user.service';
import { OrderInput } from './dto/order-input.dto';
import { OrderOutput } from './dto/order-output.dto';
import { Order } from './entities/order.entity';
import {
  CheckoutRedirectConfig,
  RedirectUrls,
} from './interfaces/checkout-redirect.interface';
import { Slot } from './interfaces/slot.interface';
import {
  StripeCheckoutSession,
  StripeMetadata,
  StripePaymentIntent,
} from './interfaces/stripe-metadata.interface';
import { OrderRepository } from './repository/order.repository';

@Injectable()
export class OrderService {
  constructor(
    private readonly repository: OrderRepository,
    private readonly logger: AppLogger,
    private readonly userService: UserService,
    private readonly wS: WooCommerceService,
    private readonly ghlService: GhlService,
    private readonly stripeService: StripeService,
    private readonly googleCalendarService: GoogleCalendarService,
  ) {
    this.logger.setContext(OrderService.name);
  }
  async create(
    ctx: RequestContext,
    createOrderDto: OrderInput,
  ): Promise<OrderOutput> {
    this.logger.log(ctx, `${this.create.name} was called`);
    const order = new Order();
    order.items = createOrderDto.items;

    // Initialize stripe_meta with default values
    order.stripe_meta = {
      paymentStatus: 'pending',
      lastWebhookProcessedAt: new Date(),
      webhookErrors: [],
    };

    //create customer if does not exist
    // if exists then fetch it
    const customer = await this.userService.getOrCreateCustomer(ctx, {
      email: createOrderDto.user.email,
      name: createOrderDto.user.firstName + createOrderDto.user.lastName,
      phone: createOrderDto.user.phone,
    } as CreateCustomerInput);
    order.customerId = customer.id;

    // Assign employees per item using round-robin
    if (createOrderDto.items && createOrderDto.items.length > 0) {
      for (const item of createOrderDto.items) {
        const assignedEmployee = await this.userService.assignOrderRoundRobin(
          ctx,
          item.id,
        );

        if (assignedEmployee) {
          item.assignedEmployeeId = assignedEmployee.id;
          this.logger.log(
            ctx,
            `Item ${item.name} assigned to employee: ${assignedEmployee.name} (ID: ${assignedEmployee.id})`,
          );
        } else {
          this.logger.warn(
            ctx,
            `No employee available for service ID: ${item.id}`,
          );
        }
      }
    }

    const savedOrder = await this.repository.save(order);
    return plainToInstance(OrderOutput, savedOrder, {
      excludeExtraneousValues: true,
    });
  }

  async updateStripeMeta(
    orderId: number,
    stripeMeta: StripeMetadata,
  ): Promise<void> {
    await this.repository.update(orderId, { stripe_meta: stripeMeta });
  }

  private generateRedirectUrls(orderId: number): RedirectUrls {
    const config: CheckoutRedirectConfig = {
      baseUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
      successPath: '/payment/success',
      cancelPath: '/payment/cancel',
      includeOrderId: true,
      includeSessionId: true,
    };

    const successParams = new URLSearchParams();
    const cancelParams = new URLSearchParams();

    if (config.includeSessionId) {
      successParams.append('session_id', '{CHECKOUT_SESSION_ID}');
    }
    if (config.includeOrderId) {
      successParams.append('order_id', orderId.toString());
      cancelParams.append('order_id', orderId.toString());
    }

    const successUrl = `${config.baseUrl}${config.successPath}?${successParams.toString()}`;
    const cancelUrl = `${config.baseUrl}${config.cancelPath}?${cancelParams.toString()}`;

    return {
      success: successUrl,
      cancel: cancelUrl,
    };
  }

  // async generateWooCommerceUrl(
  //   ctx: RequestContext,
  //   orderId: number | undefined,
  // ): Promise<IWooCommerceOrderResponse | undefined> {
  //   if (!orderId) {
  //     this.logger.error(ctx, 'Invalid id passed');
  //     return;
  //   }
  //   const order = await this.findOne(orderId);
  //   let orderData: IWooCommerceOrder = {
  //     payment_method: 'cod', // or dynamically from your order/payment choice
  //     payment_method_title: 'Cash on Delivery',
  //     set_paid: false,
  //     billing: {
  //       first_name: '',
  //       last_name: '',
  //       address_1: 'N/A',
  //       address_2: '',
  //       city: 'N/A',
  //       state: 'N/A',
  //       postcode: '00000',
  //       country: 'US',
  //       email: '',
  //       phone: '',
  //     },
  //     line_items: [],
  //     shipping_lines: [
  //       {
  //         method_id: 'flat_rate', // example
  //         method_title: 'Flat Rate',
  //         total: '0.00',
  //       },
  //     ],
  //     customer_id: undefined, // optional if linked
  //     customer_note: '',
  //   };
  //   if (order) {
  //     orderData = {
  //       payment_method: 'cod', // or dynamically from your order/payment choice
  //       payment_method_title: 'Cash on Delivery',
  //       set_paid: false,
  //       billing: {
  //         first_name: order.customer.name,
  //         last_name: order.customer.name,
  //         address_1: 'N/A',
  //         address_2: '',
  //         city: 'N/A',
  //         state: 'N/A',
  //         postcode: '00000',
  //         country: 'US',
  //         email: order.customer.email,
  //         phone: '',
  //       },
  //       line_items: order.items.map((item) => ({
  //         product_id: 961, // must match WooCommerce product ID
  //         quantity: item.quantity,
  //         total: item.price.toString(),
  //         meta_data: [
  //           { key: 'package_name', value: item.name },
  //           // { key: 'amelia_datetime', value: JSON.stringify(item.DateTime) },
  //         ],
  //       })),
  //       shipping_lines: [
  //         {
  //           method_id: 'flat_rate', // example
  //           method_title: 'Flat Rate',
  //           total: '0', //shipping cost
  //         },
  //       ],
  //       customer_id: undefined, // optional if linked
  //       customer_note: '',
  //     };
  //   }

  //   return await this.wS.createOrder(orderData);
  // }

  // async getWooCommerceOrders(): Promise<WooCommerceOrderResponse[]> {
  //   return await this.wS.getOrders();
  // }

  async findAll(): Promise<OrderOutput[]> {
    const orders = await this.repository.find();
    return plainToInstance(OrderOutput, orders, {
      excludeExtraneousValues: true,
    });
  }

  async findOne(id: number): Promise<Order | null> {
    return await this.repository.findOne({ where: { id } });
  }

  update(id: number, _updateOrderDto: OrderInput): string {
    return `This action updates a #${id} order`;
  }

  async getSlotsBooked(
    ctx: RequestContext,
    date: number,
    month: number,
    year: number,
    packageId: number,
  ): Promise<Slot> {
    const from = new Date(year, month - 1, date, 0, 0, 0); // day start
    const to = new Date(year, month - 1, date, 23, 59, 59, 999); // day end

    // Generate slots based on order ID
    // Order ID 8 uses 15-minute slots, others use 1-hour slots
    const slotDurationMinutes = packageId === 8 ? 15 : 60;

    // Get all employees who can work on this service
    const availableEmployees =
      await this.userService.findEmployeesByServiceId(packageId);

    if (availableEmployees.length === 0) {
      return {
        bookedSlots: [],
        availableSlots: [],
        slotDurationMinutes,
        warning: `No employees available for service ID: ${packageId}`,
      };
    }

    // Generate time slots (8AM-8PM Canadian time)
    const generatedSlots = this.generateTimeSlots(
      date,
      month,
      year,
      slotDurationMinutes,
      ctx,
    );

    if (!packageId) {
      // If no specific service ID, return all available slots
      return {
        bookedSlots: [],
        availableSlots: generatedSlots.map((slot) => ({
          slot,
          availableEmployees: availableEmployees.map((emp) => ({
            id: emp.id,
            name: emp.name,
            email: emp.email,
          })),
        })),
        slotDurationMinutes,
      };
    }

    // Handle package ID 8 (GHL integration)
    if (packageId === 8) {
      const ghlSlots = await this.ghlService.getSlots(
        from.getTime().toString(),
        to.getTime().toString(),
      );
      const googleCalendarBookings =
        await this.googleCalendarService.getBookedSlots(
          from,
          to,
          availableEmployees,
        );

      const availableSlots = ghlSlots
        .map((slot) => {
          const slotBookings = googleCalendarBookings.get(slot) || [];
          const busyEmployeeIds = slotBookings.map((b) => b.employeeId);

          // Find employees available for this slot
          const availableForSlot = availableEmployees.filter(
            (emp) => !busyEmployeeIds.includes(emp.id),
          );

          return {
            slot,
            availableEmployees: availableForSlot.map((emp) => ({
              id: emp.id,
              name: emp.name,
              email: emp.email,
            })),
          };
        })
        .filter((slotInfo) => slotInfo.availableEmployees.length > 0);

      return {
        bookedSlots: [],
        availableSlots,
        slotDurationMinutes,
      };
    }

    // For other packages, use Google Calendar integration
    try {
      // Get booked slots from Google Calendar
      const googleCalendarBookings =
        await this.googleCalendarService.getBookedSlots(
          from,
          to,
          availableEmployees,
        );

      // Filter available slots (at least one employee must be free)
      const availableSlots = generatedSlots
        .map((slot) => {
          const slotBookings = googleCalendarBookings.get(slot) || [];
          const busyEmployeeIds = slotBookings.map((b) => b.employeeId);

          // Find employees available for this slot
          const availableForSlot = availableEmployees.filter(
            (emp) => !busyEmployeeIds.includes(emp.id),
          );

          return {
            slot,
            availableEmployees: availableForSlot.map((emp) => ({
              id: emp.id,
              name: emp.name,
              email: emp.email,
            })),
          };
        })
        .filter((slotInfo) => slotInfo.availableEmployees.length > 0);

      // Find completely booked slots (all employees busy)
      const bookedSlots = generatedSlots.filter((slot) => {
        const slotBookings = googleCalendarBookings.get(slot) || [];
        const busyEmployeeIds = slotBookings.map((b) => b.employeeId);
        return busyEmployeeIds.length === availableEmployees.length;
      });

      this.logger.log(
        ctx,
        `Found ${availableSlots.length} available slots and ${bookedSlots.length} booked slots for service ${packageId}`,
      );

      return {
        bookedSlots: bookedSlots.sort(
          (a, b) => new Date(a).getTime() - new Date(b).getTime(),
        ),
        availableSlots,
        slotDurationMinutes,
      };
    } catch (error) {
      this.logger.error(
        ctx,
        `Failed to get Google Calendar slots: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );

      // Fallback: return all slots as available
      return {
        bookedSlots: [],
        availableSlots: generatedSlots.map((slot) => ({
          slot,
          availableEmployees: availableEmployees.map((emp) => ({
            id: emp.id,
            name: emp.name,
            email: emp.email,
          })),
        })),
        slotDurationMinutes,
        warning: 'Unable to check Google Calendar availability',
      };
    }
  }

  private generateTimeSlots(
    date: number,
    month: number,
    year: number,
    durationMinutes: number,
    ctx?: RequestContext,
  ): string[] {
    const slots: string[] = [];

    // Fixed business hours: 8AM-8PM Canadian time
    const startHour = 8;
    const endHour = 20;

    // Generate slots for the entire day
    for (let hour = startHour; hour < endHour; hour++) {
      for (let minute = 0; minute < 60; minute += durationMinutes) {
        // Create date in Canadian timezone
        const slotDate = new Date(year, month - 1, date, hour, minute);

        // Convert to Canadian timezone to ensure we're within business hours
        const canadianTime = new Date(
          slotDate.toLocaleString('en-US', { timeZone: 'America/Toronto' }),
        );

        // Only add if it's still within business hours
        if (
          canadianTime.getHours() >= startHour &&
          canadianTime.getHours() < endHour
        ) {
          slots.push(slotDate.toISOString());
        }
      }
    }

    if (ctx) {
      this.logger.log(
        ctx,
        `Generated ${slots.length} time slots for ${date}/${month}/${year} (${durationMinutes}min intervals)`,
      );
    }

    return slots;
  }

  async remove(ctx: RequestContext, id: number): Promise<void> {
    this.logger.log(ctx, `${this.remove.name} was called for order ID: ${id}`);

    // First check if the order exists
    const order = await this.findOne(id);
    if (!order) {
      this.logger.warn(ctx, `Order with ID ${id} not found for deletion`);
      throw new Error(`Order with ID ${id} not found`);
    }

    // Delete the order
    await this.repository.delete(id);
    this.logger.log(ctx, `Order with ID ${id} successfully deleted`);
  }

  async createStripeCheckoutSession(
    ctx: RequestContext,
    orderId: number | undefined,
  ): Promise<StripeCheckoutSession | undefined> {
    if (!orderId) {
      this.logger.error(ctx, 'Invalid order ID passed');
      return;
    }

    const order = await this.findOne(orderId);
    if (!order) {
      this.logger.error(ctx, `Order with ID ${orderId} not found`);
      return;
    }

    try {
      // Calculate total amount in cents
      const totalAmount = order.items.reduce((total, item) => {
        return total + item.price * item.quantity * 100; // Convert to cents
      }, 0);

      // Create Stripe customer if not exists
      let stripeCustomer;
      const existingCustomers = await this.stripeService.listCustomersByEmail(
        ctx,
        order.customer.email,
      );

      existingCustomers.length > 0
        ? (stripeCustomer = existingCustomers[0])
        : (stripeCustomer = await this.stripeService.createCustomer(ctx, {
            email: order.customer.email,
            name: order.customer.name,
            metadata: {
              orderId: orderId.toString(),
              customerId: order.customer.id.toString(),
            },
          }));
      // if (existingCustomers.length > 0) {
      //   stripeCustomer = existingCustomers[0];
      // } else {
      //   stripeCustomer = await this.stripeService.createCustomer(ctx, {
      //     email: order.customer.email,
      //     name: order.customer.name,
      //     metadata: {
      //       orderId: orderId.toString(),
      //       customerId: order.customer.id.toString(),
      //     },
      //   });
      // }

      // Prepare line items for Stripe checkout
      const lineItems = order.items.map((item) => ({
        price_data: {
          currency: 'usd',
          product_data: {
            name: item.name,
            description: item.Description || `Duration: ${item.Duration}`,
          },
          unit_amount: item.price * 100, // Convert to cents
        },
        quantity: item.quantity,
      }));

      // Generate redirect URLs
      const redirectUrls = this.generateRedirectUrls(orderId);

      // Create checkout session with configurable redirect URLs
      const session = await this.stripeService.createCheckoutSession(ctx, {
        lineItems,
        customerEmail: order.customer.email,
        successUrl: redirectUrls.success,
        cancelUrl: redirectUrls.cancel,
        metadata: {
          orderId: orderId.toString(),
          customerId: order.customer.id.toString(),
        },
      });

      this.logger.log(ctx, `Stripe checkout session created: ${session.id}`);

      // Update order with Stripe session information
      order.stripe_meta = {
        ...order.stripe_meta,
        checkoutSessionId: session.id,
        checkoutSessionStatus: session.status || undefined,
        checkoutSessionUrl: session.url || undefined,
        stripeCustomerId: stripeCustomer.id,
        amountPaid: totalAmount / 100, // Convert back to dollars
        currency: 'usd',
        lastWebhookProcessedAt: new Date(),
        // Store redirect URLs for reference
        successUrl: redirectUrls.success,
        cancelUrl: redirectUrls.cancel,
      };

      // Save the updated order
      await this.repository.save(order);

      return {
        url: session.url!,
        sessionId: session.id,
      };
    } catch (error) {
      this.logger.error(
        ctx,
        `Failed to create Stripe checkout session: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }

  async createStripePaymentIntent(
    ctx: RequestContext,
    orderId: number | undefined,
  ): Promise<StripePaymentIntent | undefined> {
    if (!orderId) {
      this.logger.error(ctx, 'Invalid order ID passed');
      return;
    }

    const order = await this.findOne(orderId);
    if (!order) {
      this.logger.error(ctx, `Order with ID ${orderId} not found`);
      return;
    }

    try {
      // Calculate total amount in cents
      const totalAmount = order.items.reduce((total, item) => {
        return total + item.price * item.quantity * 100; // Convert to cents
      }, 0);

      // Create Stripe customer if not exists
      let stripeCustomer;
      const existingCustomers = await this.stripeService.listCustomersByEmail(
        ctx,
        order.customer.email,
      );

      existingCustomers.length > 0
        ? (stripeCustomer = existingCustomers[0])
        : (stripeCustomer = await this.stripeService.createCustomer(ctx, {
            email: order.customer.email,
            name: order.customer.name,
            metadata: {
              orderId: orderId.toString(),
              customerId: order.customer.id.toString(),
            },
          }));

      // if (existingCustomers.length > 0) {
      //   stripeCustomer = existingCustomers[0];
      // } else {
      //   stripeCustomer = await this.stripeService.createCustomer(ctx, {
      //     email: order.customer.email,
      //     name: order.customer.name,
      //     metadata: {
      //       orderId: orderId.toString(),
      //       customerId: order.customer.id.toString(),
      //     },
      //   });
      // }

      // Create payment intent
      const paymentIntent = await this.stripeService.createPaymentIntent(ctx, {
        amount: totalAmount,
        currency: 'usd',
        customerId: stripeCustomer.id,
        description: `Order #${orderId} - ${order.items.map((item) => item.name).join(', ')}`,
        metadata: {
          orderId: orderId.toString(),
          customerId: order.customer.id.toString(),
        },
      });

      this.logger.log(
        ctx,
        `Stripe payment intent created: ${paymentIntent.id}`,
      );

      return {
        clientSecret: paymentIntent.client_secret!,
        paymentIntentId: paymentIntent.id,
      };
    } catch (error) {
      this.logger.error(
        ctx,
        `Failed to create Stripe payment intent: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }

  async confirmStripePayment(
    ctx: RequestContext,
    paymentIntentId: string,
  ): Promise<boolean> {
    try {
      const paymentIntent = await this.stripeService.retrievePaymentIntent(
        ctx,
        paymentIntentId,
      );

      if (paymentIntent.status === 'succeeded') {
        this.logger.log(
          ctx,
          `Payment confirmed for intent: ${paymentIntentId}`,
        );
        return true;
      }

      return false;
    } catch (error) {
      this.logger.error(
        ctx,
        `Failed to confirm payment: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return false;
    }
  }
}
