/* eslint-disable unicorn/no-array-for-each */
/* eslint-disable max-depth */
/* eslint-disable max-statements */
import { Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { ProductService } from '../../product/services/product.service';
import { AppLogger } from '../../shared/logger/logger.service';
import { RequestContext } from '../../shared/request-context/request-context.dto';
import { SlotReservationStatus } from '../../shared/slot/constants/slot-reservation-status.constant';
import { SlotService } from '../../shared/slot/services/slot.service';
import { UserService } from '../../user/services/user.service';
import { OrderInput } from '../dto/order-input.dto';
import { OrderOutput } from '../dto/order-output.dto';
import { Order } from '../entities/order.entity';
import { OrderRepository } from '../repository/order.repository';
import {
  EmployeeAssignmentResult,
  EmployeeAssignmentService,
} from './employee-assignment.service';

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
  ) {
    this.logger.setContext(OrderService.name);
  }

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
          // Map assigned employees to their respective slots
          item.assignedEmployeeIds = [];

          for (const assignment of assignedEmployees) {
            for (const slot of assignment.assignedSlots) {
              const slotIndex = item.DateTime.indexOf(slot);
              if (slotIndex !== -1 && slotIndex < item.DateTime.length) {
                // eslint-disable-next-line security/detect-object-injection
                item.assignedEmployeeIds[slotIndex] = assignment.employee.id;
              }
            }
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

    // Create order
    const order = this.repository.create({
      ...createOrderDto,
      customer,
      items: createOrderDto.items,
      slot_reservation_status: SlotReservationStatus.RESERVED,
      slot_reservation_expires_at: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes
    });

    const savedOrder = await this.repository.save(order);
    return plainToInstance(OrderOutput, savedOrder, {
      excludeExtraneousValues: true,
    });
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
      orders: orders.map((order) =>
        plainToInstance(OrderOutput, order, {
          excludeExtraneousValues: true,
        }),
      ),
      count,
    };
  }

  async findOne(id: number): Promise<Order | null> {
    return await this.repository.findOne({ where: { id } });
  }

  async updateOrder(id: number, updateData: Partial<Order>): Promise<void> {
    await this.repository.update(id, updateData);
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
}
