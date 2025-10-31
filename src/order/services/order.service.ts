/* eslint-disable unicorn/no-array-for-each */
/* eslint-disable max-depth */
/* eslint-disable max-statements */
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { plainToInstance } from 'class-transformer';
import { ProductService } from '../../product/services/product.service';
import { AppLogger } from '../../shared/logger/logger.service';
import { RequestContext } from '../../shared/request-context/request-context.dto';
import { SlotReservationStatus } from '../../shared/slot/constants/slot-reservation-status.constant';
import { SlotService } from '../../shared/slot/services/slot.service';
import { UserService } from '../../user/services/user.service';
import { OrderInput } from '../dto/order-input.dto';
import { OrderOutput } from '../dto/order-output.dto';
import {
  ModifyOrderDto,
  OrderModificationResultDto,
} from '../dto/modify-order.dto';
import { Order, OrderStatus } from '../entities/order.entity';
import { OrderRepository } from '../repository/order.repository';
import {
  EmployeeAssignmentResult,
  EmployeeAssignmentService,
} from './employee-assignment.service';
import { RefundService } from '../../finance/services/refund.service';
import { InvoiceService } from '../../invoicing/services/invoice.service';
import { InvoiceStatus } from '../../invoicing/constants/invoice-status.constant';
import { PaymentStatus } from '../interfaces/stripe-metadata.interface';
import { RefundReason } from '../../finance/constants/finance.constant';
import { StripeService } from '../../shared/services/stripe.service';
import { TriggerEvent } from '../../automation/constants/trigger-events.constant';
import { OrderAppointmentService } from './order-appointment.service';

@Injectable()
export class OrderService {
  private debugLogged = new Set<string>();

  constructor(
    private readonly repository: OrderRepository,
    private readonly logger: AppLogger,
    private readonly userService: UserService,
    private readonly productService: ProductService,
    private readonly slotService: SlotService,
    private readonly employeeAssignmentService: EmployeeAssignmentService,
    private readonly refundService: RefundService,
    private readonly invoiceService: InvoiceService,
    private readonly stripeService: StripeService,
    private readonly eventEmitter: EventEmitter2,
    private readonly orderAppointmentService: OrderAppointmentService,
  ) {
    this.logger.setContext(OrderService.name);
  }

  /* eslint-disable sonarjs/cognitive-complexity */
  async create(
    ctx: RequestContext,
    createOrderDto: OrderInput,
  ): Promise<OrderOutput> {
    this.logger.log(ctx, `${this.create.name} was called`);

    // Validate products exist
    const productIds = createOrderDto.items.map((item) => item.id);
    const existingProducts = await this.productService.findByIds(productIds);
    const missingIds = productIds.filter(
      (id) => !existingProducts.some((product) => product.id === id),
    );

    if (missingIds.length > 0) {
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

        const assignedEmployees: EmployeeAssignmentResult[] | undefined =
          await this.employeeAssignmentService.assignEmployeeRoundRobin(
            ctx,
            item.id,
            item.DateTime,
          );

        this.logger.log(
          ctx,
          `🔍 DEBUG: assignEmployeeRoundRobin returned: ${assignedEmployees ? `${assignedEmployees.length} assignment(s)` : 'undefined'}`,
        );

        if (assignedEmployees && assignedEmployees.length > 0) {
          // Map assigned employees to their respective slots using epoch keys for robust equality
          item.assignedEmployeeIds = [];

          const slotIndexByEpoch = new Map<number, number>();
          (item.DateTime || []).forEach((dt, idx) => {
            slotIndexByEpoch.set(new Date(dt).getTime(), idx);
          });

          for (const assignment of assignedEmployees) {
            for (const slot of assignment.assignedSlots) {
              const epoch = new Date(slot).getTime();
              const slotIndex = slotIndexByEpoch.get(epoch) ?? -1;
              if (slotIndex === -1) {
                this.logger.warn(
                  ctx,
                  `Could not map assigned slot to DateTime array. slot=${slot} epoch=${epoch} item.DateTime=${JSON.stringify(
                    item.DateTime,
                  )}`,
                );
              } else {
                // eslint-disable-next-line security/detect-object-injection
                item.assignedEmployeeIds[slotIndex] = assignment.employee.id;
              }
            }
          }

          // Validate mapping completeness
          const unassigned: string[] = [];
          const assignedIds = item.assignedEmployeeIds || [];
          (item.DateTime || []).forEach((dt, idx) => {
            // eslint-disable-next-line security/detect-object-injection
            if (assignedIds[idx] == null) {
              unassigned.push(dt);
            }
          });

          if (unassigned.length > 0) {
            this.logger.error(ctx, 'Assignment mismatch diagnostics');
            this.logger.error(
              ctx,
              `Unassigned count=${unassigned.length} Unassigned slots=${JSON.stringify(
                unassigned,
              )}`,
            );
            this.logger.error(
              ctx,
              `All DateTime slots=${JSON.stringify(item.DateTime)}`,
            );
            this.logger.error(
              ctx,
              `assignedEmployeeIds=${JSON.stringify(item.assignedEmployeeIds)}`,
            );
            this.logger.error(
              ctx,
              `assignments=${JSON.stringify(
                assignedEmployees.map((a) => ({
                  employeeId: a.employee.id,
                  assignedSlots: a.assignedSlots,
                })),
              )}`,
            );
            throw new Error(
              `No employee available for slots: ${unassigned.join(', ')}`,
            );
          }

          // Log assignment details
          const assignmentSummary = assignedEmployees
            .map(
              (assignment) =>
                `${assignment.employee.name} (ID: ${assignment.employee.id}) for slots: ${assignment.assignedSlots.join(', ')}`,
            )
            .join('; ');

          this.logger.log(
            ctx,
            `✅ Item ${item.name} assigned employees: ${assignmentSummary}`,
          );
        } else {
          this.logger.error(
            ctx,
            `❌ No employee available for service ID: ${item.id}`,
          );
          this.logger.error(
            ctx,
            `❌ Item details: ${JSON.stringify({
              id: item.id,
              name: item.name,
              DateTime: item.DateTime,
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
    const reservationResult = await this.slotService.reserveSlots(
      Date.now(), // Temporary ID - will be updated after order creation
      'order',
      createOrderDto.items.flatMap((item) => item.DateTime || []),
      createOrderDto.items.flatMap((item) => item.assignedEmployeeIds || []),
      30, // 30 minutes timeout
    );

    if (!reservationResult.isValid) {
      throw new Error(
        reservationResult.errorMessage || 'Slot reservation failed',
      );
    }

    // Create customer
    const customer = await this.userService.getOrCreateCustomer(
      ctx,
      createOrderDto.user,
    );

    // Always store prices in CAD (base currency)
    // Prices are stored as-is because frontend always sends CAD prices
    // The currency field from frontend stores the user's selected currency for checkout
    // Price conversion happens during checkout when creating the Stripe session

    // Create order
    // Persist items without scheduling fields to avoid drift; scheduling lives in OrderAppointment
    const itemsForStorage = createOrderDto.items.map(
      ({ DateTime, assignedEmployeeIds, ...rest }) => rest,
    );

    const order = this.repository.create({
      ...createOrderDto,
      customer,
      items: itemsForStorage, // Store items without DateTime/assignedEmployeeIds
      currency: createOrderDto.currency, // Store user's selected currency (CAD, USD, INR, etc.)
      slot_reservation_status: SlotReservationStatus.RESERVED,
      slot_reservation_expires_at: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes
    });

    const savedOrder = await this.repository.save(order);

    // Create OrderAppointment rows from original scheduling data (DateTime/assignedEmployeeIds)
    const orderForAppointments = {
      ...savedOrder,
      // Use the original items with scheduling fields to generate appointments
      items: createOrderDto.items,
    } as unknown as Order;

    await this.orderAppointmentService.createFromOrder(
      ctx,
      orderForAppointments,
    );

    // Emit event for automations
    this.eventEmitter.emit(TriggerEvent.ORDER_CREATED, {
      order: savedOrder,
      ctx,
    });

    const orderOutput = plainToInstance(OrderOutput, savedOrder, {
      excludeExtraneousValues: true,
    });

    // Map checkoutSessionUrl from stripe_meta
    if (savedOrder.stripe_meta?.checkoutSessionUrl) {
      orderOutput.checkoutSessionUrl =
        savedOrder.stripe_meta.checkoutSessionUrl;
    }

    return orderOutput;
    /* eslint-enable sonarjs/cognitive-complexity */
  }

  async findAll(
    limit: number,
    offset: number,
    orderStatus?: string,
  ): Promise<{ orders: OrderOutput[]; count: number }> {
    const queryBuilder = this.repository
      .createQueryBuilder('o')
      .leftJoinAndSelect('o.customer', 'customer')
      .orderBy('o.createdAt', 'DESC')
      .limit(limit)
      .offset(offset);

    if (orderStatus) {
      queryBuilder.andWhere("o.stripe_meta->>'paymentStatus' = :status", {
        status: orderStatus,
      });
    }

    const [orders, count] = await queryBuilder.getManyAndCount();

    return {
      orders: orders.map((order) => {
        const orderOutput = plainToInstance(OrderOutput, order, {
          excludeExtraneousValues: true,
        });

        // Map checkoutSessionUrl from stripe_meta
        if (order.stripe_meta?.checkoutSessionUrl) {
          orderOutput.checkoutSessionUrl = order.stripe_meta.checkoutSessionUrl;
        }

        return orderOutput;
      }),
      count,
    };
  }

  async findOneByPaymentIntentId(
    paymentIntentId: string,
  ): Promise<Order | null> {
    const systemContext = {
      user: { id: 0, username: 'system', roles: [] },
      requestID: 'system',
      url: '/system',
      ip: '127.0.0.1',
    };

    this.logger.log(
      systemContext,
      `Finding order by payment intent ID: ${paymentIntentId}`,
    );

    try {
      // Search for orders where the stripe_meta contains the payment intent ID
      const orders = await this.repository.find();

      for (const order of orders) {
        if (order.stripe_meta?.paymentIntentId === paymentIntentId) {
          this.logger.log(
            systemContext,
            `Found order ${order.id} for payment intent ${paymentIntentId}`,
          );
          return order;
        }
      }

      this.logger.warn(
        systemContext,
        `No order found for payment intent ${paymentIntentId}`,
      );
      return null;
    } catch (error) {
      this.logger.error(
        systemContext,
        `Error finding order by payment intent ID: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return null;
    }
  }

  async findOne(id: number): Promise<Order | null> {
    return await this.repository.findOne({ where: { id } });
  }

  async findOneByChargeId(chargeId: string): Promise<Order | null> {
    return await this.repository
      .createQueryBuilder('o')
      .where("o.stripe_meta->>'chargeId' = :chargeId", {
        chargeId,
      })
      .getOne();
  }

  async updateOrder(id: number, updateData: Partial<Order>): Promise<void> {
    await this.repository.update(id, updateData);
  }

  async markCompleted(ctx: RequestContext, orderId: number): Promise<void> {
    const order = await this.findOne(orderId);
    if (!order) {throw new NotFoundException(`Order ${orderId} not found`);}
    if (order.orderStatus === OrderStatus.COMPLETED) {return;}
    await this.repository.update(orderId, {
      orderStatus: OrderStatus.COMPLETED,
      completedAt: new Date(),
    });
    this.eventEmitter.emit(TriggerEvent.ORDER_COMPLETED, { ctx, orderId });
    this.logger.log(ctx, `Order ${orderId} marked as COMPLETED`);
  }

  async remove(ctx: RequestContext, id: number): Promise<void> {
    this.logger.log(ctx, `${this.remove.name} was called for order ID: ${id}`);

    // First check if the order exists
    const order = await this.findOne(id);

    if (!order) {
      this.logger.warn(ctx, `Order with ID ${id} not found`);
      throw new Error(`Order with ID ${id} not found`);
    }

    // Delete the order
    await this.repository.delete(id);
    this.logger.log(ctx, `Successfully deleted order with ID: ${id}`);
  }

  /**
   * Updates the order status in stripe_meta
   */
  async updateOrderStatus(
    ctx: RequestContext,
    orderId: number,
    status: PaymentStatus,
    reason?: string,
    refundId?: number,
  ): Promise<void> {
    this.logger.log(ctx, `Updating order ${orderId} status to ${status}`);

    const order = await this.repository.getById(orderId);

    const existingStripeMeta = order.stripe_meta || {};
    const updateData: Partial<Order> = {
      stripe_meta: {
        ...existingStripeMeta,
        paymentStatus: status,
        ...(status === PaymentStatus.CANCELED && {
          canceledAt: new Date(),
          ...(reason && { cancelReason: reason }),
          ...(refundId && { refundId }),
        }),
      },
    };

    this.logger.log(
      ctx,
      `Updating order ${orderId} with data: ${JSON.stringify(updateData)}`,
    );

    await this.repository.update(orderId, updateData);

    this.logger.log(
      ctx,
      `Successfully updated order ${orderId} status to ${status}`,
    );
  }

  /**
   * Cancels the slot reservation for an order
   */
  async cancelSlotReservation(
    ctx: RequestContext,
    orderId: number,
    reason?: string,
  ): Promise<void> {
    this.logger.log(ctx, `Canceling slot reservation for order ${orderId}`);

    const order = await this.repository.getById(orderId);
    if (!order) {
      throw new NotFoundException(`Order with ID ${orderId} not found`);
    }

    const updateData: Partial<Order> = {
      slot_reservation_status: SlotReservationStatus.CANCELED,
      slot_reservation_expires_at: new Date(), // Set to current time to indicate cancellation
    };

    this.logger.log(
      ctx,
      `Updating slot reservation for order ${orderId} with data: ${JSON.stringify(updateData)}`,
    );

    await this.repository.update(orderId, updateData);

    this.logger.log(
      ctx,
      `Successfully canceled slot reservation for order ${orderId}${reason ? `: ${reason}` : ''}`,
    );
  }

  /**
   * Modifies an existing order by refunding the original and creating a new one
   */
  async modifyOrder(
    ctx: RequestContext,
    modifyOrderDto: ModifyOrderDto,
  ): Promise<OrderModificationResultDto> {
    this.logger.log(
      ctx,
      `Modifying order ${modifyOrderDto.originalOrderId} with new items`,
    );

    // 1. Validate original order exists and is paid
    const originalOrder = await this.findOne(modifyOrderDto.originalOrderId);
    if (!originalOrder) {
      throw new NotFoundException(
        `Order with ID ${modifyOrderDto.originalOrderId} not found`,
      );
    }

    // 2. Check if original order has a paid invoice
    const originalInvoices = await this.invoiceService.getInvoicesByOrderId(
      ctx,
      originalOrder.id,
    );
    const originalInvoice =
      originalInvoices.length > 0 ? originalInvoices[0] : null;
    if (!originalInvoice || originalInvoice.status !== InvoiceStatus.PAID) {
      throw new BadRequestException(
        'Original order must be paid to modify. Current status: ' +
          (originalInvoice?.status || 'no invoice'),
      );
    }

    // 3. Validate new order items by converting names to IDs first
    const allProducts = await this.productService.findAll();
    const productMap = new Map(allProducts.map((p) => [p.name, p]));

    const missingProducts = modifyOrderDto.newOrderItems.filter(
      (item) => !productMap.has(item.name),
    );

    if (missingProducts.length > 0) {
      throw new BadRequestException(
        `Products with names ${missingProducts.map((p) => p.name).join(', ')} not found`,
      );
    }

    // 4. Create refund record
    const refund = await this.refundService.createRefund(ctx, {
      originalOrderId: originalOrder.id,
      customerId: originalOrder.customerId,
      amount: originalInvoice.total,
      reason: modifyOrderDto.refundReason as RefundReason,
      reasonDetails: modifyOrderDto.reasonDetails,
    });

    // 5. Void original invoice
    await this.invoiceService.voidInvoice(
      ctx,
      originalInvoice.id,
      `Order modification: ${modifyOrderDto.reasonDetails}`,
    );

    // 5.5. Update original order status to CANCELED
    await this.repository.update(originalOrder.id, {
      stripe_meta: {
        ...originalOrder.stripe_meta,
        paymentStatus: PaymentStatus.CANCELED,
        canceledAt: new Date(),
        cancelReason: `Order modified: ${modifyOrderDto.reasonDetails}`,
        refundId: refund.id,
      },
    });

    this.logger.log(
      ctx,
      `Updated original order ${originalOrder.id} status to CANCELED due to modification`,
    );

    // 5.6. Cancel slot reservation for original order
    await this.cancelSlotReservation(
      ctx,
      originalOrder.id,
      `Order modified: ${modifyOrderDto.reasonDetails}`,
    );

    // 6. Create new order
    const originalUserOutput = await this.userService.getUserById(
      ctx,
      originalOrder.customerId,
    );

    const newOrderInput: OrderInput = {
      currency: originalOrder.currency,
      user: {
        firstName:
          originalUserOutput.name.split(' ')[0] || originalUserOutput.name,
        lastName: originalUserOutput.name.split(' ').slice(1).join(' ') || '',
        email: originalUserOutput.email,
        phone: originalUserOutput.phone,
      },
      items: modifyOrderDto.newOrderItems.map((item) => {
        const product = productMap.get(item.name)!;
        return {
          id: product.id,
          quantity: item.quantity,
          price: item.price,
          name: item.name,
          Duration: product.Duration || 0,
          Description: product.Description || '',
          sessions: product.sessions || 0,
          DateTime: [], // Empty for now - will be scheduled later
        };
      }),
    };

    const newOrder = await this.create(ctx, newOrderInput);

    // 7. Update refund with new order reference
    await this.refundService.updateRefund(ctx, refund.id, {
      newOrderId: newOrder.id,
    });

    // 8. Process Stripe refund (original payment)
    await this.refundService.processRefund(ctx, refund.id, {});

    // 9. Get the new invoice (should be auto-generated)
    const newInvoices = await this.invoiceService.getInvoicesByOrderId(
      ctx,
      newOrder.id,
    );
    const newInvoice = newInvoices.length > 0 ? newInvoices[0] : null;

    this.logger.log(
      ctx,
      `Successfully modified order ${originalOrder.id} -> ${newOrder.id}`,
    );

    return {
      refund,
      newOrder,
      newInvoice,
    };
  }
}
