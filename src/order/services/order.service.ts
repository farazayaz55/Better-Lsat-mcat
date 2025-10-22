/* eslint-disable unicorn/no-array-for-each */
/* eslint-disable max-depth */
/* eslint-disable max-statements */
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { plainToInstance } from 'class-transformer';
import { AppLogger } from '../../shared/logger/logger.service';
import { RequestContext } from '../../shared/request-context/request-context.dto';
import { GhlService } from '../../shared/services/Ghl.service';
import { GoogleCalendarService } from '../../shared/services/google-calendar-api-key.service';
import { StripeService } from '../../shared/services/stripe.service';
import { WooCommerceService } from '../../shared/services/WooCommerce.service';
import { CreateCustomerInput } from '../../user/dtos/customer-create-input.dto';
import { User } from '../../user/entities/user.entity';
import { UserService } from '../../user/services/user.service';
import { ProductService } from '../../product/services/product.service';
import { OrderInput } from '../dto/order-input.dto';
import { OrderOutput } from '../dto/order-output.dto';
import { Order } from '../entities/order.entity';
import {
  CheckoutRedirectConfig,
  RedirectUrls,
} from '../interfaces/checkout-redirect.interface';
import { Slot } from '../interfaces/slot.interface';
import {
  PaymentStatus,
  StripeCheckoutSession,
  StripeMetadata,
  StripePaymentIntent,
} from '../interfaces/stripe-metadata.interface';
import { OrderRepository } from '../repository/order.repository';
import { SlotReservationStatus } from '../constants/slot-reservation-status.constant';
import { ItemInput } from '../interfaces/item.interface';

@Injectable()
export class OrderService {
  private debugLogged = new Set<string>();

  constructor(
    private readonly repository: OrderRepository,
    private readonly logger: AppLogger,
    private readonly userService: UserService,
    private readonly productService: ProductService,
    private readonly wS: WooCommerceService,
    private readonly ghlService: GhlService,
    private readonly stripeService: StripeService,
    private readonly googleCalendarService: GoogleCalendarService,
    private readonly configService: ConfigService,
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
      paymentStatus: PaymentStatus.PENDING,
      lastWebhookProcessedAt: new Date(),
      webhookErrors: [],
    };

    //create customer if does not exist
    // if exists then fetch it
    const customer = await this.userService.getOrCreateCustomer(ctx, {
      firstName: createOrderDto.user.firstName,
      lastName: createOrderDto.user.lastName,
      email: createOrderDto.user.email,
      phone: createOrderDto.user.phone,
    });
    order.customer = customer;

    // Validate that all product IDs in items exist
    const productIds = createOrderDto.items.map((item) => item.id);
    const existingProducts = await this.productService.findByIds(productIds);

    if (existingProducts.length !== productIds.length) {
      const existingIds = existingProducts.map((p) => p.id);
      const missingIds = productIds.filter((id) => !existingIds.includes(id));
      this.logger.error(ctx, `Products not found: ${missingIds.join(', ')}`);
      throw new Error(`Products with IDs ${missingIds.join(', ')} not found`);
    }

    this.logger.log(ctx, `Validated ${existingProducts.length} products exist`);

    // Assign employees per item using round-robin
    if (createOrderDto.items && createOrderDto.items.length > 0) {
      this.logger.log(
        ctx,
        `🔍 DEBUG: Starting employee assignment for ${createOrderDto.items.length} items`,
      );

      for (const item of createOrderDto.items) {
        this.logger.log(
          ctx,
          `🔍 DEBUG: Processing item ${item.name} (ID: ${item.id}) with ${item.DateTime?.length || 0} DateTime slots`,
        );
        this.logger.log(
          ctx,
          `🔍 DEBUG: Item DateTime slots: ${JSON.stringify(item.DateTime)}`,
        );

        const assignedEmployees: User[] | undefined =
          await this.userService.assignOrderRoundRobin(
            ctx,
            item.id,
            item.DateTime,
          );

        this.logger.log(
          ctx,
          `🔍 DEBUG: assignOrderRoundRobin returned: ${assignedEmployees ? `${assignedEmployees.length} employees` : 'undefined'}`,
        );
        if (assignedEmployees) {
          this.logger.log(
            ctx,
            `🔍 DEBUG: Assigned employees: ${assignedEmployees.map((emp) => `${emp.name} (ID: ${emp.id})`).join(', ')}`,
          );
        }

        if (assignedEmployees && assignedEmployees.length > 0) {
          // Assign the same employee to all slots
          const assignedEmployee = assignedEmployees[0]; // Take the first (and should be only) employee
          item.assignedEmployeeIds = Array(item.DateTime.length).fill(
            assignedEmployee.id,
          );

          this.logger.log(
            ctx,
            `✅ Item ${item.name} assigned to employee ${assignedEmployee.name} (ID: ${assignedEmployee.id}) for all ${item.DateTime.length} slots`,
          );
        } else {
          this.logger.error(
            ctx,
            `❌ No employee available for service ID: ${item.id}. Found ${assignedEmployees?.length || 0} available employees`,
          );
          this.logger.error(
            ctx,
            `❌ Item details: ${JSON.stringify({
              id: item.id,
              name: item.name,
              DateTime: item.DateTime,
              availableEmployees: assignedEmployees?.length || 0,
            })}`,
          );
          throw new Error(`No employee available for service ID: ${item.id}`);
        }
      }

      this.logger.log(
        ctx,
        `🔍 DEBUG: Completed employee assignment for all items`,
      );
    } else {
      this.logger.warn(
        ctx,
        `🔍 DEBUG: No items to process for employee assignment`,
      );
    }

    // Validate slot availability and create reservations
    await this.validateAndReserveSlots(ctx, order, createOrderDto.items);

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

  async findAll(
    limit: number,
    offset: number,
    orderStatus?: string,
  ): Promise<{ orders: OrderOutput[]; count: number }> {
    const queryBuilder = this.repository
      .createQueryBuilder('o')
      .leftJoinAndSelect('o.customer', 'customer');

    // Add payment status filter using proper PostgreSQL JSON syntax
    if (orderStatus) {
      queryBuilder.andWhere('o.stripe_meta->>:key = :value', {
        key: 'paymentStatus',
        value: orderStatus,
      });
    }

    // Add pagination and ordering
    queryBuilder.skip(offset).take(limit).orderBy('o.id', 'DESC');

    // Get results and count
    const [orders, count] = await queryBuilder.getManyAndCount();

    console.log(orders[0]);

    // Transform to DTO
    const ordersOutput = plainToInstance(OrderOutput, orders, {
      excludeExtraneousValues: true,
    });

    return { orders: ordersOutput, count };
  }

  async findOne(id: number): Promise<Order | null> {
    return await this.repository.findOne({ where: { id } });
  }

  update(id: number, _updateOrderDto: OrderInput): string {
    return `This action updates a #${id} order`;
  }

  /**
   * Updates an order with partial data
   * @param id Order ID
   * @param updateData Partial order data to update
   */
  async updateOrder(id: number, updateData: Partial<Order>): Promise<void> {
    await this.repository.update(id, updateData);
  }

  /**
   * Check if a slot is within the grace period (too close to current time)
   */
  private isSlotWithinGracePeriod(
    slot: string,
    gracePeriodCutoff: Date,
  ): boolean {
    const slotTime = new Date(slot);
    return slotTime <= gracePeriodCutoff;
  }

  async getSlotsBooked(
    ctx: RequestContext,
    date: string,
    packageId: number,
    // eslint-disable-next-line @typescript-eslint/no-inferrable-types
  ): Promise<Slot> {
    const gracePeriodHours = 24;

    // Parse the ISO date string to get year, month, and date
    const dateObj = new Date(date);
    const year = dateObj.getUTCFullYear();
    const month = dateObj.getUTCMonth() + 1; // getUTCMonth() returns 0-11, so add 1
    const day = dateObj.getUTCDate();

    this.logger.log(
      ctx,
      `🔍 DEBUG: Parsed date - Input: ${date}, Parsed: ${year}-${month}-${day}, Day of week: ${this.getDayOfWeekName(dateObj.getDay())}`,
    );

    // Validate that the requested date is not in the past
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0); // Start of today in UTC
    this.logger.log(
      ctx,
      `🔍 DEBUG: Date validation - Requested: ${dateObj.toISOString()}, Today: ${today.toISOString()}, Is past: ${dateObj < today}`,
    );

    if (dateObj < today) {
      // Get product to fetch actual duration
      const product = await this.productService.findOne(packageId);
      const slotDurationMinutes = product?.Duration || 60; // Default to 60 minutes

      this.logger.log(
        ctx,
        `🔍 DEBUG: Date is in the past, returning empty slots`,
      );

      return {
        bookedSlots: [],
        availableSlots: [],
        slotDurationMinutes,
        warning: 'Cannot book slots for dates in the past',
      };
    }

    const from = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
    const to = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));

    // Get product to fetch actual duration instead of hardcoding
    const product = await this.productService.findOne(packageId);
    const slotDurationMinutes = product?.Duration || 60; // Default to 60 minutes

    // Calculate grace period cutoff time
    const now = new Date();
    const gracePeriodCutoff = new Date(
      now.getTime() + gracePeriodHours * 60 * 60 * 1000,
    );

    this.logger.log(
      ctx,
      `🔍 DEBUG: Grace period - Now: ${now.toISOString()}, Cutoff: ${gracePeriodCutoff.toISOString()}, Hours: ${gracePeriodHours}`,
    );

    // Get all employees who can work on this service
    const availableEmployees =
      await this.userService.findEmployeesByServiceId(packageId);

    this.logger.log(
      ctx,
      `🔍 DEBUG: Found ${availableEmployees.length} employees for service ${packageId}`,
    );

    // Debug log each employee's working hours for the requested day
    const dayOfWeek = this.getDayOfWeekName(dateObj.getDay());
    availableEmployees.forEach((emp, index) => {
      // eslint-disable-next-line security/detect-object-injection
      const workHours = emp.workHours?.[dayOfWeek] || 'No hours set';
      this.logger.log(
        ctx,
        `🔍 DEBUG: Employee ${index + 1} (${emp.name}, ID: ${emp.id}) - ${dayOfWeek} work hours: ${JSON.stringify(workHours)}`,
      );
    });

    if (availableEmployees.length === 0) {
      this.logger.log(
        ctx,
        `🔍 DEBUG: No employees found for service ${packageId}`,
      );
      return {
        bookedSlots: [],
        availableSlots: [],
        slotDurationMinutes,
        warning: `No employees available for service ID: ${packageId}`,
      };
    }

    // Generate time slots (8AM-8PM Canadian time)
    const generatedSlots = this.generateTimeSlots(
      day,
      month,
      year,
      slotDurationMinutes,
      ctx,
    );

    if (!packageId) {
      // Filter slots by working hours and grace period, then return available slots
      const availableSlots = generatedSlots
        .filter(
          (slot) => !this.isSlotWithinGracePeriod(slot, gracePeriodCutoff),
        )
        .map((slot) => {
          // Find employees who are available during their working hours
          const availableForSlot = availableEmployees.filter((emp) =>
            this.isEmployeeAvailableAtTime(emp, slot),
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
        .filter(
          (slot) => !this.isSlotWithinGracePeriod(slot, gracePeriodCutoff),
        )
        .map((slot) => {
          const slotBookings = googleCalendarBookings.get(slot) || [];
          const busyEmployeeIds = slotBookings.map((b) => b.employeeId);

          // Find employees available for this slot (working hours + not busy)
          const availableForSlot = availableEmployees.filter(
            (emp) =>
              !busyEmployeeIds.includes(emp.id) &&
              this.isEmployeeAvailableAtTime(emp, slot),
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

    // For other packages, use Google Calendar integration + database reservations
    try {
      // Get booked slots from Google Calendar
      const googleCalendarBookings =
        await this.googleCalendarService.getBookedSlots(
          from,
          to,
          availableEmployees,
        );

      // Get database reservations (confirmed and active reservations)
      const databaseReservations = await this.getDatabaseReservations(
        ctx,
        from,
        to,
        packageId,
      );

      // Filter available slots (working hours + availability + grace period)
      this.logger.log(
        ctx,
        `🔍 DEBUG: Starting slot filtering - Generated ${generatedSlots.length} slots, Grace period cutoff: ${gracePeriodCutoff.toISOString()}`,
      );

      const slotsAfterGracePeriod = generatedSlots.filter(
        (slot) => !this.isSlotWithinGracePeriod(slot, gracePeriodCutoff),
      );

      this.logger.log(
        ctx,
        `🔍 DEBUG: After grace period filter - ${slotsAfterGracePeriod.length} slots remaining`,
      );

      const availableSlots = slotsAfterGracePeriod
        .map((slot) => {
          const slotBookings = googleCalendarBookings.get(slot) || [];
          const busyEmployeeIds = slotBookings.map((b) => b.employeeId);

          // Add database reservations to busy employees
          const slotReservations = databaseReservations.get(slot) || [];
          const reservedEmployeeIds = slotReservations.map((r) => r.employeeId);
          const allBusyEmployeeIds = [
            ...busyEmployeeIds,
            ...reservedEmployeeIds,
          ];

          // Find employees available for this slot (working hours + not busy)
          const availableForSlot = availableEmployees.filter((emp) => {
            const isNotBusy = !allBusyEmployeeIds.includes(emp.id);
            const isAvailableAtTime = this.isEmployeeAvailableAtTime(emp, slot);

            // Debug log for first few slots
            if (slotsAfterGracePeriod.indexOf(slot) < 3) {
              this.logger.log(
                ctx,
                `🔍 DEBUG: Employee ${emp.name} (${emp.id}) - Slot ${slot} - Not busy: ${isNotBusy}, Available at time: ${isAvailableAtTime}`,
              );
            }

            return isNotBusy && isAvailableAtTime;
          });

          // Debug log for first few slots to understand filtering
          if (slotsAfterGracePeriod.indexOf(slot) < 3) {
            this.logger.log(
              ctx,
              `🔍 DEBUG: Slot ${slot} - Busy employees: ${allBusyEmployeeIds.length}, Available employees: ${availableForSlot.length}`,
            );
          }

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

      // Find completely booked slots (all employees busy OR outside working hours)
      // Note: Grace period slots are not included in booked slots - they're simply not available
      const bookedSlots = generatedSlots
        .filter(
          (slot) => !this.isSlotWithinGracePeriod(slot, gracePeriodCutoff),
        )
        .filter((slot) => {
          const slotBookings = googleCalendarBookings.get(slot) || [];
          const busyEmployeeIds = slotBookings.map((b) => b.employeeId);
          const slotReservations = databaseReservations.get(slot) || [];
          const reservedEmployeeIds = slotReservations.map((r) => r.employeeId);
          const allBusyEmployeeIds = [
            ...busyEmployeeIds,
            ...reservedEmployeeIds,
          ];

          // Check if all employees are either busy or outside working hours
          const employeesInWorkingHours = availableEmployees.filter((emp) =>
            this.isEmployeeAvailableAtTime(emp, slot),
          );

          const busyEmployeesInWorkingHours = employeesInWorkingHours.filter(
            (emp) => allBusyEmployeeIds.includes(emp.id),
          );

          return (
            busyEmployeesInWorkingHours.length ===
              employeesInWorkingHours.length &&
            employeesInWorkingHours.length > 0
          );
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

      // Fallback: return slots filtered by working hours only
      const availableSlots = generatedSlots
        .map((slot) => {
          const availableForSlot = availableEmployees.filter((emp) =>
            this.isEmployeeAvailableAtTime(emp, slot),
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

    // Generate slots for ALL 24 hours (0-23)
    for (let hour = 0; hour < 24; hour++) {
      for (let minute = 0; minute < 60; minute += durationMinutes) {
        const slotDate = new Date(
          Date.UTC(year, month - 1, date, hour, minute),
        );
        slots.push(slotDate.toISOString());
      }
    }

    if (ctx) {
      this.logger.log(
        ctx,
        `Generated ${slots.length} time slots for ${date}/${month}/${year} (${durationMinutes}min intervals) - 24 hours`,
      );
    }

    return slots;
  }

  // Helper method to get day name from day number
  private getDayOfWeekName(dayNumber: number): string {
    const days = [
      'Sunday',
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
    ];
    // eslint-disable-next-line security/detect-object-injection
    return days[dayNumber];
  }

  // Helper method to check if employee is available at specific time based on workHours
  private isEmployeeAvailableAtTime(employee: User, slotTime: string): boolean {
    const slotDate = new Date(slotTime);
    const dayOfWeek = this.getDayOfWeekName(slotDate.getDay());
    const slotHour = slotDate.getUTCHours();
    const slotMinute = slotDate.getUTCMinutes();
    const slotTimeInMinutes = slotHour * 60 + slotMinute;

    // Get employee's working hours for this day
    // eslint-disable-next-line security/detect-object-injection
    const dayWorkHours = employee.workHours?.[dayOfWeek] || [];

    // Debug log for first few checks to understand availability
    const debugKey = `${employee.id}-${dayOfWeek}-${slotHour}:${slotMinute.toString().padStart(2, '0')}`;
    if (!this.debugLogged.has(debugKey)) {
      this.debugLogged.add(debugKey);
      console.log(
        `🔍 DEBUG: Employee ${employee.name} (${employee.id}) - ${dayOfWeek} ${slotHour}:${slotMinute.toString().padStart(2, '0')} UTC - Work hours: ${JSON.stringify(dayWorkHours)}`,
      );
    }

    if (dayWorkHours.length === 0) {
      console.log(
        `🔍 DEBUG: Employee ${employee.name} (${employee.id}) - No work hours for ${dayOfWeek}`,
      );
      return false; // No working hours defined for this day
    }

    // Check if slot time falls within any working hour range
    for (const timeRange of dayWorkHours) {
      const [startTime, endTime] = timeRange.split('-');
      const [startHour, startMin] = startTime.split(':').map(Number);
      const [endHour, endMin] = endTime.split(':').map(Number);

      const startTimeInMinutes = startHour * 60 + startMin;
      const endTimeInMinutes = endHour * 60 + endMin;

      console.log(
        `🔍 DEBUG: Employee ${employee.name} - Checking ${slotHour}:${slotMinute.toString().padStart(2, '0')} (${slotTimeInMinutes} min) against ${startTime}-${endTime} (${startTimeInMinutes}-${endTimeInMinutes} min)`,
      );

      if (
        slotTimeInMinutes >= startTimeInMinutes &&
        slotTimeInMinutes < endTimeInMinutes
      ) {
        console.log(`🔍 DEBUG: Employee ${employee.name} - AVAILABLE!`);
        return true;
      }
    }

    console.log(`🔍 DEBUG: Employee ${employee.name} - NOT AVAILABLE`);
    return false;
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

      // Calculate expiration time for Stripe session
      // Stripe requires minimum 30 minutes, so we use the longer of:
      // 1. Slot reservation expiration time, or
      // 2. 30 minutes from now
      const slotExpirationTime = order.slot_reservation_expires_at
        ? Math.floor(order.slot_reservation_expires_at.getTime() / 1000)
        : Math.floor(Date.now() / 1000) + 30 * 60;

      const minimumStripeExpiration = Math.floor(Date.now() / 1000) + 30 * 60; // 30 minutes from now
      const expiresAt = Math.max(slotExpirationTime, minimumStripeExpiration);

      this.logger.log(
        ctx,
        `Creating Stripe checkout session with expiration: ${new Date(expiresAt * 1000).toISOString()}`,
      );

      if (slotExpirationTime < minimumStripeExpiration) {
        this.logger.log(
          ctx,
          `Slot reservation expires at ${new Date(slotExpirationTime * 1000).toISOString()}, but Stripe session extended to ${new Date(expiresAt * 1000).toISOString()} (minimum 30 minutes)`,
        );
      }

      // Create checkout session with configurable redirect URLs and expiration
      const session = await this.stripeService.createCheckoutSession(ctx, {
        lineItems,
        customerEmail: order.customer.email,
        successUrl: redirectUrls.success,
        cancelUrl: redirectUrls.cancel,
        expiresAt, // Sync with slot reservation timeout
        metadata: {
          orderId: orderId.toString(),
          customerId: order.customer.id.toString(),
          slotReservationExpiresAt:
            order.slot_reservation_expires_at?.toISOString(),
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

      throw this.stripeService.mapStripeError(error);
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
      throw this.stripeService.mapStripeError(error);
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

  /**
   * Validates slot availability and creates reservations for the order
   * @param ctx Request context
   * @param order The order being created
   * @param items The items in the order
   */
  private async validateAndReserveSlots(
    ctx: RequestContext,
    order: Order,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    items: ItemInput[],
  ): Promise<void> {
    this.logger.log(ctx, 'Starting slot validation and reservation process');

    // Get reservation timeout from config (default 30 minutes)
    const reservationTimeoutMinutes = this.configService.get<number>(
      'SLOT_RESERVATION_TIMEOUT_MINUTES',
      30,
    );

    // Calculate expiration time
    const expiresAt = new Date(
      Date.now() + reservationTimeoutMinutes * 60 * 1000,
    );

    // Set reservation details on the order
    order.slot_reservation_expires_at = expiresAt;
    order.slot_reservation_status = SlotReservationStatus.RESERVED;

    this.logger.log(
      ctx,
      `Order will reserve slots until: ${expiresAt.toISOString()} (${reservationTimeoutMinutes} minutes)`,
    );

    // Validate each item's slots
    for (const item of items) {
      this.logger.log(
        ctx,
        `🔍 DEBUG: Processing item ${item.name} (ID: ${item.id}) with assignedEmployeeIds: ${item.assignedEmployeeIds}`,
      );

      if (
        item.DateTime &&
        item.DateTime.length > 0 &&
        item.assignedEmployeeIds &&
        item.assignedEmployeeIds.length > 0
      ) {
        // for (const dateTime of item.DateTime) {
        for (let i = 0; i < item.DateTime.length; i++) {
          const dateTime = item.DateTime[i];
          const employeeId = item.assignedEmployeeIds![i];
          this.logger.log(
            ctx,
            `🔍 DEBUG: Validating slot ${dateTime} for item ${item.id} with employee ${employeeId}`,
          );

          const isAvailable = await this.validateSlotAvailability(
            ctx,
            dateTime,
            item.id,
            employeeId,
          );

          if (!isAvailable) {
            throw new Error(
              `Slot ${dateTime} for service ${item.id} is no longer available for employee ${employeeId}`,
            );
          }
        }
      }
    }

    this.logger.log(
      ctx,
      'All slots validated successfully - reservation created',
    );
  }

  /**
   * Validates if a specific slot is available (not booked or reserved)
   * @param ctx Request context
   * @param dateTime The slot datetime to check
   * @param serviceId The service ID
   * @returns true if available, false if not
   */
  public async validateSlotAvailability(
    ctx: RequestContext,
    dateTime: string,
    serviceId: number,
    employeeId: number,
  ): Promise<boolean> {
    try {
      this.logger.log(
        ctx,
        `🔍 DEBUG: Validating slot availability: ${dateTime} for service ${serviceId} and employee ${employeeId}`,
      );

      // Check for confirmed bookings using TypeORM with JSON queries
      const confirmedBookings = await this.repository
        .createQueryBuilder('o')
        .where('o.slot_reservation_status = :status', {
          status: SlotReservationStatus.CONFIRMED,
        })
        .andWhere(
          "EXISTS (SELECT 1 FROM json_array_elements(o.items) as item WHERE item->>'DateTime' LIKE :dateTime AND json_array_length(item->'assignedEmployeeIds') > 0 AND EXISTS (SELECT 1 FROM json_array_elements(item->'assignedEmployeeIds') as empId WHERE empId::text = :employeeId))",
          {
            dateTime: `%${dateTime}%`,
            employeeId: employeeId.toString(),
          },
        )
        .getCount();

      this.logger.log(
        ctx,
        `🔍 DEBUG: Confirmed bookings count: ${confirmedBookings}`,
      );

      if (confirmedBookings > 0) {
        this.logger.warn(
          ctx,
          `Slot ${dateTime} is already confirmed (booked) for employee ${employeeId}`,
        );
        return false;
      }

      // Check for active reservations using TypeORM with JSON queries
      const activeReservations = await this.repository
        .createQueryBuilder('o')
        .where('o.slot_reservation_status = :status', {
          status: SlotReservationStatus.RESERVED,
        })
        .andWhere('o.slot_reservation_expires_at > :now', {
          now: new Date(),
        })
        .andWhere(
          "EXISTS (SELECT 1 FROM json_array_elements(o.items) as item WHERE item->>'DateTime' LIKE :dateTime AND json_array_length(item->'assignedEmployeeIds') > 0 AND EXISTS (SELECT 1 FROM json_array_elements(item->'assignedEmployeeIds') as empId WHERE empId::text = :employeeId))",
          {
            dateTime: `%${dateTime}%`,
            employeeId: employeeId.toString(),
          },
        )
        .getCount();

      this.logger.log(
        ctx,
        `🔍 DEBUG: Active reservations count: ${activeReservations}`,
      );

      if (activeReservations > 0) {
        this.logger.warn(
          ctx,
          `Slot ${dateTime} is currently reserved by another customer for employee ${employeeId}`,
        );
        return false;
      }

      this.logger.log(
        ctx,
        `Slot ${dateTime} is available for employee ${employeeId}`,
      );
      return true;
    } catch (error) {
      this.logger.error(
        ctx,
        `Error validating slot availability: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return false;
    }
  }

  /**
   * Gets database reservations for a specific date range and service
   * @param ctx Request context
   * @param from Start date
   * @param to End date
   * @param serviceId Service ID
   * @returns Map of slot times to reservation data
   */
  // eslint-disable-next-line sonarjs/cognitive-complexity
  private async getDatabaseReservations(
    ctx: RequestContext,
    from: Date,
    to: Date,
    serviceId: number,
  ): Promise<Map<string, Array<{ employeeId: number; status: string }>>> {
    try {
      this.logger.log(
        ctx,
        `Getting database reservations for service ${serviceId} from ${from.toISOString()} to ${to.toISOString()}`,
      );

      // Query orders with confirmed or active reservations using proper JSON queries
      const reservations = await this.repository
        .createQueryBuilder('o')
        .where('o.slot_reservation_status IN (:...statuses)', {
          statuses: [
            SlotReservationStatus.CONFIRMED,
            SlotReservationStatus.RESERVED,
          ],
        })
        .andWhere('o.slot_reservation_expires_at > :now', {
          now: new Date(),
        })
        .andWhere(
          "EXISTS (SELECT 1 FROM json_array_elements(o.items) as item WHERE item->>'id' = :serviceId)",
          {
            serviceId: serviceId.toString(),
          },
        )
        .getMany();

      this.logger.log(
        ctx,
        `🔍 DEBUG: Found ${reservations.length} orders with reservations for service ${serviceId}`,
      );

      reservations.forEach((order, index) => {
        this.logger.log(
          ctx,
          `🔍 DEBUG Reservation ${index + 1}: Order ID=${order.id}, Status=${order.slot_reservation_status}, Expires=${order.slot_reservation_expires_at}, Items=${JSON.stringify(order.items)}`,
        );
      });

      const reservationMap = new Map<
        string,
        Array<{ employeeId: number; status: string }>
      >();

      for (const order of reservations) {
        if (order.items && Array.isArray(order.items)) {
          for (const item of order.items) {
            if (
              item.id === serviceId &&
              item.DateTime &&
              Array.isArray(item.DateTime)
            ) {
              // for (const dateTime of item.DateTime) {
              //   const slotTime = new Date(dateTime);

              //   // Check if this slot is within our date range
              //   if (slotTime >= from && slotTime <= to) {
              //     const slotKey = slotTime.toISOString();

              //     if (!reservationMap.has(slotKey)) {
              //       reservationMap.set(slotKey, []);
              //     }

              //     reservationMap.get(slotKey)!.push({
              //       employeeId: item.assignedEmployeeId || 0,
              //       status: order.slot_reservation_status || 'UNKNOWN',
              //     });
              //   }
              // }

              for (let i = 0; i < item.DateTime!.length; i++) {
                const dateTime = item.DateTime![i];
                const slotTime = new Date(dateTime);

                if (slotTime >= from && slotTime <= to) {
                  const slotKey = slotTime.toISOString();

                  if (!reservationMap.has(slotKey)) {
                    reservationMap.set(slotKey, []);
                  }

                  reservationMap.get(slotKey)!.push({
                    // eslint-disable-next-line security/detect-object-injection
                    employeeId: item.assignedEmployeeIds![i] || 0,
                    status: order.slot_reservation_status || 'UNKNOWN',
                  });
                }
              }
            }
          }
        }
      }

      this.logger.log(
        ctx,
        `Found ${reservations.length} database reservations affecting ${reservationMap.size} slots`,
      );

      return reservationMap;
    } catch (error) {
      this.logger.error(
        ctx,
        `Error getting database reservations: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return new Map();
    }
  }

  // Dashboard Analytics Methods

  /**
   * Get top customers by revenue for dashboard analytics
   */
  async getTopCustomers(
    ctx: RequestContext,
    dateRange: { startDate: Date; endDate: Date },
    limit: number,
  ) {
    this.logger.log(ctx, 'Fetching top customers data');

    // Get all paid orders in the date range using pure TypeORM
    const orders = await this.repository
      .createQueryBuilder('o')
      .leftJoinAndSelect('o.customer', 'customer')
      .where('o.createdAt BETWEEN :startDate AND :endDate', {
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
      })
      .andWhere('o.stripe_meta->>:paymentStatusKey = :paymentStatusValue', {
        paymentStatusKey: 'paymentStatus',
        paymentStatusValue: 'succeeded',
      })
      .getMany();

    // Process data in JavaScript to avoid SQL GROUP BY issues
    const customerMap = new Map<
      number,
      {
        customerId: number;
        customerName: string;
        email: string;
        totalRevenue: number;
        orderCount: number;
      }
    >();

    // eslint-disable-next-line unicorn/no-array-for-each
    orders.forEach((order) => {
      const customerId = order.customer.id;
      const amountTotal = order.stripe_meta?.amountPaid || 0;

      if (customerMap.has(customerId)) {
        const existing = customerMap.get(customerId)!;
        existing.totalRevenue += amountTotal;
        existing.orderCount += 1;
      } else {
        customerMap.set(customerId, {
          customerId: order.customer.id,
          customerName: order.customer.name,
          email: order.customer.email,
          totalRevenue: amountTotal,
          orderCount: 1,
        });
      }
    });

    // Sort by revenue and limit results
    // eslint-disable-next-line unicorn/prefer-spread
    return Array.from(customerMap.values())
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
      .slice(0, limit);
  }

  /**
   * Get revenue data for dashboard analytics
   */
  async getRevenueData(
    ctx: RequestContext,
    dateRange: { startDate: Date; endDate: Date },
    period: string,
  ) {
    this.logger.log(ctx, 'Fetching revenue data');

    // Get all paid orders in the date range using pure TypeORM
    const orders = await this.repository
      .createQueryBuilder('o')
      .where('o.createdAt BETWEEN :startDate AND :endDate', {
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
      })
      .andWhere('o.stripe_meta->>:paymentStatusKey = :paymentStatusValue', {
        paymentStatusKey: 'paymentStatus',
        paymentStatusValue: 'succeeded',
      })
      .getMany();

    // Calculate total revenue in JavaScript
    const totalRevenue = orders.reduce((sum, order) => {
      return sum + (order.stripe_meta?.amountPaid || 0);
    }, 0);

    // Get period revenue breakdown
    const periodRevenue = await this.getPeriodRevenueBreakdown(
      dateRange,
      period,
    );

    return {
      totalRevenue,
      periodRevenue,
    };
  }

  /**
   * Get appointments data for dashboard analytics
   */
  async getAppointmentsData(
    ctx: RequestContext,
    dateRange: { startDate: Date; endDate: Date },
    period: string,
  ) {
    this.logger.log(ctx, 'Fetching appointments data');

    // Get all paid orders in the date range using pure TypeORM
    const orders = await this.repository
      .createQueryBuilder('o')
      .where('o.createdAt BETWEEN :startDate AND :endDate', {
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
      })
      .andWhere('o.stripe_meta->>:paymentStatusKey = :paymentStatusValue', {
        paymentStatusKey: 'paymentStatus',
        paymentStatusValue: 'succeeded',
      })
      .getMany();

    const totalAppointments = orders.length;
    const now = new Date();
    const upcomingAppointments = orders.filter(
      (order) => order.createdAt > now,
    ).length;
    const completedAppointments = totalAppointments - upcomingAppointments;

    // Get period appointments breakdown
    const periodAppointments = await this.getPeriodAppointmentsBreakdown(
      dateRange,
      period,
    );

    return {
      totalAppointments,
      upcomingAppointments,
      completedAppointments,
      periodAppointments,
    };
  }

  /**
   * Get period revenue breakdown for dashboard analytics
   */
  private async getPeriodRevenueBreakdown(
    dateRange: { startDate: Date; endDate: Date },
    period: string,
  ) {
    // Get all paid orders in the date range using pure TypeORM
    const orders = await this.repository
      .createQueryBuilder('o')
      .where('o.createdAt BETWEEN :startDate AND :endDate', {
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
      })
      .andWhere('o.stripe_meta->>:paymentStatusKey = :paymentStatusValue', {
        paymentStatusKey: 'paymentStatus',
        paymentStatusValue: 'succeeded',
      })
      .getMany();

    // Group by period in JavaScript
    const periodMap = new Map<string, number>();

    // eslint-disable-next-line unicorn/no-array-for-each
    orders.forEach((order) => {
      const date = new Date(order.createdAt);
      let periodKey: string;

      switch (period) {
        case 'DAY':
          periodKey = date.toISOString().split('T')[0]; // YYYY-MM-DD
          break;
        case 'WEEK':
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          periodKey = weekStart.toISOString().split('T')[0];
          break;
        case 'MONTH':
          periodKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          break;
        case 'QUARTER':
          const quarter = Math.floor(date.getMonth() / 3) + 1;
          periodKey = `${date.getFullYear()}-Q${quarter}`;
          break;
        case 'YEAR':
          periodKey = date.getFullYear().toString();
          break;
        default:
          periodKey = date.toISOString().split('T')[0];
      }

      const amount = order.stripe_meta?.amountPaid || 0;
      periodMap.set(periodKey, (periodMap.get(periodKey) || 0) + amount);
    });

    // eslint-disable-next-line unicorn/prefer-spread
    return Array.from(periodMap.entries())
      .map(([date, revenue]) => ({ date, revenue }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * Get period appointments breakdown for dashboard analytics
   */
  private async getPeriodAppointmentsBreakdown(
    dateRange: { startDate: Date; endDate: Date },
    period: string,
  ) {
    // Get all paid orders in the date range using pure TypeORM
    const orders = await this.repository
      .createQueryBuilder('o')
      .where('o.createdAt BETWEEN :startDate AND :endDate', {
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
      })
      .andWhere('o.stripe_meta->>:paymentStatusKey = :paymentStatusValue', {
        paymentStatusKey: 'paymentStatus',
        paymentStatusValue: 'succeeded',
      })
      .getMany();

    // Group by period in JavaScript
    const periodMap = new Map<string, number>();

    // eslint-disable-next-line unicorn/no-array-for-each
    orders.forEach((order) => {
      const date = new Date(order.createdAt);
      let periodKey: string;

      switch (period) {
        case 'DAY':
          periodKey = date.toISOString().split('T')[0]; // YYYY-MM-DD
          break;
        case 'WEEK':
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          periodKey = weekStart.toISOString().split('T')[0];
          break;
        case 'MONTH':
          periodKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          break;
        case 'QUARTER':
          const quarter = Math.floor(date.getMonth() / 3) + 1;
          periodKey = `${date.getFullYear()}-Q${quarter}`;
          break;
        case 'YEAR':
          periodKey = date.getFullYear().toString();
          break;
        default:
          periodKey = date.toISOString().split('T')[0];
      }

      periodMap.set(periodKey, (periodMap.get(periodKey) || 0) + 1);
    });

    // eslint-disable-next-line unicorn/prefer-spread
    return Array.from(periodMap.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }
}
