import { Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';

import { AppLogger } from '../shared/logger/logger.service';
import { RequestContext } from '../shared/request-context/request-context.dto';
import { GhlService } from '../shared/services/Ghl.service';
import {
  IWooCommerceOrder,
  IWooCommerceOrderResponse,
} from '../shared/services/interfaces/woocommerce.order.interface';
import { WooCommerceService } from '../shared/services/WooCommerce.service';
import { CreateCustomerInput } from '../user/dtos/customer-create-input.dto';
import { User } from '../user/entities/user.entity';
import { UserService } from '../user/services/user.service';

import { OrderInput } from './dto/order-input.dto';
import { OrderOutput } from './dto/order-output.dto';
import { Order } from './entities/order.entity';
import { OrderRepository } from './repository/order.repository';

@Injectable()
export class OrderService {
  constructor(
    private readonly repository: OrderRepository,
    private readonly logger: AppLogger,
    private readonly userService: UserService,
    private readonly wS: WooCommerceService,
    private readonly ghlService: GhlService,
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

    //create customer if does not exist
    // if exists then fetch it
    const customer = await this.userService.getOrCreateCustomer(ctx, {
      email: createOrderDto.user.email,
      name: createOrderDto.user.firstName + createOrderDto.user.lastName,
      phone: createOrderDto.user.phone,
    } as CreateCustomerInput);
    order.customerId = customer.id;

    console.log('createOrderDto.items', createOrderDto.items);

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

  async generateWooCommerceUrl(
    ctx: RequestContext,
    orderId: number | undefined,
  ): Promise<IWooCommerceOrderResponse | undefined> {
    if (!orderId) {
      this.logger.error(ctx, 'Invalid id passed');
      return;
    }
    const order = await this.findOne(orderId);
    let orderData: IWooCommerceOrder = {
      payment_method: 'cod', // or dynamically from your order/payment choice
      payment_method_title: 'Cash on Delivery',
      set_paid: false,
      billing: {
        first_name: '',
        last_name: '',
        address_1: 'N/A',
        address_2: '',
        city: 'N/A',
        state: 'N/A',
        postcode: '00000',
        country: 'US',
        email: '',
        phone: '',
      },
      line_items: [],
      shipping_lines: [
        {
          method_id: 'flat_rate', // example
          method_title: 'Flat Rate',
          total: '0.00',
        },
      ],
      customer_id: undefined, // optional if linked
      customer_note: '',
    };
    if (order) {
      orderData = {
        payment_method: 'cod', // or dynamically from your order/payment choice
        payment_method_title: 'Cash on Delivery',
        set_paid: false,
        billing: {
          first_name: order.customer.name,
          last_name: order.customer.name,
          address_1: 'N/A',
          address_2: '',
          city: 'N/A',
          state: 'N/A',
          postcode: '00000',
          country: 'US',
          email: order.customer.email,
          phone: '',
        },
        line_items: order.items.map((item) => ({
          product_id: 961, // must match WooCommerce product ID
          quantity: item.quantity,
          total: item.price.toString(),
          meta_data: [
            { key: 'package_name', value: item.name },
            // { key: 'amelia_datetime', value: JSON.stringify(item.DateTime) },
          ],
        })),
        shipping_lines: [
          {
            method_id: 'flat_rate', // example
            method_title: 'Flat Rate',
            total: '0', //shipping cost
          },
        ],
        customer_id: undefined, // optional if linked
        customer_note: '',
      };
    }

    return await this.wS.createOrder(orderData);
  }

  // async getWooCommerceOrders(): Promise<WooCommerceOrderResponse[]> {
  //   return await this.wS.getOrders();
  // }

  async findAll() {
    return await this.repository.find();
  }

  async findOne(id: number): Promise<Order | null> {
    return await this.repository.findOne({ where: { id } });
  }

  update(id: number, _updateOrderDto: OrderInput) {
    return `This action updates a #${id} order`;
  }

  async getSlotsBooked(
    date: number,
    month: number,
    year: number,
    packageId: number,
    customerTimezone: string,
  ) {
    const from = new Date(year, month - 1, date, 0, 0, 0); // day start
    const to = new Date(year, month - 1, date, 23, 59, 59, 999); // day end
    let ghlSlots: string[] = []; // these are the slots that are available(free) in GHL calendar of Mustafa
    const wooCommerceSlots: string[] = []; // these are the slots that are booked in WooCommerce

    // Generate slots based on order ID
    // Order ID 5 uses 15-minute slots, others use 1-hour slots
    const slotDurationMinutes = packageId === 8 ? 15 : 60;

    //for package id 8, we were using leadconnector GHL calendar integration, so we need to get the slots from there as well just for safety
    if (packageId === 8) {
      ghlSlots = await this.ghlService.getSlots(
        from.getTime().toString(),
        to.getTime().toString(),
      );
    } else {
      const orders = await this.wS.getOrders();
      for (const order of orders) {
        for (const item of order.line_items) {
          if (item.meta_data.find((meta) => meta.key === 'ameliabooking')) {
            const bookingData = item.meta_data.find(
              (meta) => meta.key === 'ameliabooking',
            )?.value;

            // Check if the value is already an object or needs to be parsed
            const booking =
              typeof bookingData === 'string'
                ? JSON.parse(bookingData)
                : bookingData;

            const bookingStart = booking.package[0].bookingStart;
            const utcOffset = booking.package[0].utcOffset;

            const [datePart, timePart] = bookingStart.split(' ');
            const [year, month, day] = datePart.split('-').map(Number);
            const [hour, minute, second] = timePart.split(':').map(Number);

            // Create date in local timezone, then convert to UTC
            const localDate = new Date(
              year,
              month - 1,
              day,
              hour,
              minute,
              second,
            );

            // Subtract the UTC offset to get actual UTC time
            // utcOffset is in minutes: 300 means UTC+5
            const utcDate = new Date(
              localDate.getTime() - utcOffset * 60 * 1000,
            );
            wooCommerceSlots.push(utcDate.toISOString());
          }
        }
      }
    }

    // Get all employees who can work on this service
    const availableEmployees =
      await this.userService.findEmployeesByServiceId(packageId);

    const generatedSlots = this.generateTimeSlots(
      date,
      month,
      year,

      slotDurationMinutes,
      customerTimezone,
      availableEmployees,
    );

    if (!packageId) {
      // If no specific service ID, return all available slots
      return {
        bookedSlots: [],
        availableSlots: generatedSlots.map((slot) => ({
          slot,
          availableEmployees: [],
        })),
        slotDurationMinutes,
      };
    }

    if (availableEmployees.length === 0) {
      return {
        bookedSlots: [],
        availableSlots: [],
        slotDurationMinutes,
        message: `No employees available for service ID: ${packageId}`,
      };
    }

    // Get all orders for this service and collect booked slots per employee
    const orders = await this.findAll();
    const employeeBookedSlots = new Map<number, Set<string>>();

    // Initialize map for all available employees
    for (const emp of availableEmployees) {
      employeeBookedSlots.set(emp.id, new Set<string>());
    }

    // Collect booked slots for each employee
    for (const order of orders) {
      for (const item of order.items) {
        if (item.id === packageId && item.assignedEmployeeId) {
          const employeeId = item.assignedEmployeeId;
          const employeeSlots = employeeBookedSlots.get(employeeId);

          if (employeeSlots) {
            for (const dt of item.DateTime) {
              const slotDate = new Date(dt);
              if (slotDate >= from && slotDate <= to) {
                employeeSlots.add(dt);
              }
            }
          }
        }
      }
    }

    // Find slots that are booked for ALL employees (completely unavailable)
    const allBookedSlots = new Set<string>();
    const partiallyBookedSlots = new Set<string>();

    for (const slot of generatedSlots) {
      const bookedForEmployees = availableEmployees.filter((emp) => {
        const employeeSlots = employeeBookedSlots.get(emp.id);
        return employeeSlots?.has(slot) || false;
      });

      if (bookedForEmployees.length === availableEmployees.length) {
        // All employees are booked for this slot
        allBookedSlots.add(slot);
      } else if (bookedForEmployees.length > 0) {
        // Some employees are booked for this slot
        partiallyBookedSlots.add(slot);
      }
    }

    // Create available slots with available employees
    let availableSlots = generatedSlots
      .filter((slot) => !allBookedSlots.has(slot))
      .map((slot) => {
        const availableForSlot = availableEmployees.filter((emp) => {
          const employeeSlots = employeeBookedSlots.get(emp.id);
          return !employeeSlots?.has(slot);
        });

        return {
          slot,
          availableEmployees: availableForSlot.map((emp) => ({
            id: emp.id,
            name: emp.name,
            email: emp.email,
          })),
        };
      });

    //
    const bookedSlots = [...allBookedSlots].sort(
      (a, b) => new Date(a).getTime() - new Date(b).getTime(),
    );
    if (packageId === 8) {
      return {
        bookedSlots,
        availableSlots: ghlSlots,
        slotDurationMinutes,
      };
    } else {
      //filter those slots that are already booked in wooCommerce
      availableSlots = availableSlots.filter(
        (slot) => !wooCommerceSlots.includes(slot.slot),
      );

      return {
        bookedSlots,
        availableSlots,
        slotDurationMinutes,
      };
    }
  }

  private generateTimeSlots(
    date: number,
    month: number,
    year: number,

    durationMinutes: number,
    customerTimezone?: string,
    availableEmployees?: User[],
  ): string[] {
    const from = new Date(year, month - 1, date, 0, 0, 0); // day start
    const to = new Date(year, month - 1, date, 23, 59, 59, 999); // day end
    const slots: string[] = [];
    const current = new Date(from);
    let startWorkHour, endWorkHour;

    if (availableEmployees) {for (const employee of availableEmployees) {
      const employeeWorkHours = employee.workHours;
      if (employeeWorkHours) {
        const day = current.toLocaleString('en-us', { weekday: 'long' });
        const workHours = employeeWorkHours[day];
        if (workHours) {
          const [startString, endString] = workHours[0].split('-');
          startWorkHour = Number.parseInt(startString.split(':')[0]); // Gets hour part
          endWorkHour = Number.parseInt(endString.split(':')[0]); // Gets hour part
        }
      }
    }}

    while (current <= to) {
      // Convert to Canadian timezone (Eastern Time)
      const canadianTime = new Date(
        current.toLocaleString('en-US', { timeZone: 'America/Toronto' }),
      );
      const hour = canadianTime.getHours();

      // Only generate slots during business hours (8 AM to 8 PM Canadian time)
      // if (hour >= 8 && hour < 20) {
      //   //also check if the slot is within the same day as customerTimezone
      //   const currentTime = new Date(
      //     current.toLocaleString('en-us', { timeZone: customerTimezone }),
      //   );
      //   if (currentTime.getDate() == date)
      //     slots.push(new Date(current).toISOString());
      // }

      //this above logic will be replaced by working hours of employee
      if (
        startWorkHour &&
        endWorkHour &&
        hour >= startWorkHour &&
        hour < endWorkHour
      ) {
        slots.push(new Date(current).toISOString());
      }
      // Add duration minutes
      current.setMinutes(current.getMinutes() + durationMinutes);
    }

    return slots;
  }

  remove(id: number) {
    return `This action removes a #${id} order`;
  }
}
