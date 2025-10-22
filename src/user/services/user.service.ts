/* eslint-disable max-statements */
/* eslint-disable sonarjs/cognitive-complexity */
/* eslint-disable max-depth */
import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { compare, hash } from 'bcrypt';
import { plainToInstance } from 'class-transformer';
import { ROLE } from '../../auth/constants/role.constant';
import { AppLogger } from '../../shared/logger/logger.service';
import { GoogleCalendarService } from '../../shared/services/google-calendar-api-key.service';
import { RequestContext } from '../../shared/request-context/request-context.dto';
import { CreateCustomerInput } from '../dtos/customer-create-input.dto';
import { UserInput } from '../../order/interfaces/user.interface';
import { CreateUserInput } from '../dtos/user-create-input.dto';
import { UserOutput } from '../dtos/user-output.dto';
import { UpdateUserInput } from '../dtos/user-update-input.dto';
import { User } from '../entities/user.entity';
import { UserRepository } from '../repositories/user.repository';
import { Order } from '../../order/entities/order.entity';
import { UserAclService } from './user-acl.service';
import { Action } from '../../shared/acl/action.constant';
import { IActor } from '../../shared/acl/actor.constant';
import { OrderRepository } from '../../order/repository/order.repository';
import { SlotReservationStatus } from '../../order/constants/slot-reservation-status.constant';

@Injectable()
export class UserService {
  public constructor(
    private readonly repository: UserRepository,
    private readonly logger: AppLogger,
    private readonly googleCalendarService: GoogleCalendarService,
    private readonly userAclService: UserAclService,
    private readonly orderRepository: OrderRepository,
  ) {
    this.logger.setContext(UserService.name);
  }
  public async createUser(
    ctx: RequestContext,
    input: CreateUserInput,
  ): Promise<UserOutput> {
    this.logger.log(ctx, `${this.createUser.name} was called`);
    this.logger.log(
      ctx,
      `DEBUG - UserService received CreateUserInput: ${JSON.stringify(input, null, 2)}`,
    );
    // DEBUG: Try without excludeExtraneousValues first to see if that's the issue
    const user = plainToInstance(User, input, {
      excludeExtraneousValues: false, // Changed from true to false
    });

    this.logger.log(
      ctx,
      `DEBUG - After plainToInstance, user.name: "${user.name}" (type: ${typeof user.name})`,
    );
    this.logger.log(
      ctx,
      `DEBUG - User object: ${JSON.stringify(user, null, 2)}`,
    );

    if (input.password) {
      user.password = await hash(input.password, 10);
    }

    this.logger.log(
      ctx,
      `DEBUG - Before saving, user.name: "${user.name}" (type: ${typeof user.name})`,
    );
    this.logger.log(ctx, `calling ${UserRepository.name}.saveUser`);
    await this.repository.save(user);

    return plainToInstance(UserOutput, user, {
      excludeExtraneousValues: true,
    });
  }

  public async findTutorsAndAdmins(ctx: RequestContext): Promise<User[]> {
    this.logger.log(ctx, `${this.findTutorsAndAdmins.name} was called`);
    const queryBuilder = this.repository
      .createQueryBuilder('user')
      .where('user.roles LIKE :userRole', { userRole: `%${ROLE.USER}%` })
      .orWhere('user.roles LIKE :adminRole', { adminRole: `%${ROLE.ADMIN}%` })
      .orWhere('user.id = :selfId', { selfId: ctx.user?.id });
    return await queryBuilder.getMany();
  }

  public async getOrCreateCustomer(
    ctx: RequestContext,
    input: UserInput,
  ): Promise<User> {
    this.logger.log(ctx, `${this.getOrCreateCustomer.name} was called`);

    this.logger.log(ctx, `calling ${UserRepository.name}.findOne`);
    let customer = await this.repository.findOne({
      where: { email: input.email },
    });
    if (!customer) {
      // Convert UserInput to CreateCustomerInput
      const createCustomerInput: CreateCustomerInput = {
        name: `${input.firstName} ${input.lastName}`,
        email: input.email,
        phone: input.phone,
        roles: [ROLE.CUSTOMER],
        isAccountDisabled: false,
      };

      customer = this.repository.create(createCustomerInput);
      await this.repository.save(customer);
    }
    return customer;
  }

  /**
   * adding customer
   */
  public async createCustomer(
    ctx: RequestContext,
    input: CreateCustomerInput,
  ): Promise<UserOutput> {
    this.logger.log(ctx, `${this.createCustomer.name} was called`);

    const user = plainToInstance(User, input, {
      excludeExtraneousValues: true,
    });

    // user.password = await hash(input.password, 10);

    this.logger.log(ctx, `calling ${UserRepository.name}.saveUser`);
    await this.repository.save(user);

    return plainToInstance(UserOutput, user, {
      excludeExtraneousValues: true,
    });
  }

  public async validateEmailPassword(
    ctx: RequestContext,
    email: string,
    pass: string,
  ): Promise<UserOutput> {
    this.logger.log(ctx, `${this.validateEmailPassword.name} was called`);

    this.logger.log(ctx, `calling ${UserRepository.name}.findOne`);
    const user = await this.repository.findOne({ where: { email } });
    if (!user) {
      throw new UnauthorizedException();
    }

    // Check if user is a customer - customers can't login
    if (user.roles && user.roles.includes(ROLE.CUSTOMER)) {
      console.log('Customer user attempted login - denying access');
      throw new UnauthorizedException();
    }

    const match = await compare(pass, user.password);
    if (!match) {
      throw new UnauthorizedException();
    }

    return plainToInstance(UserOutput, user, {
      excludeExtraneousValues: true,
    });
  }

  public async getUsers(
    ctx: RequestContext,
    limit: number,
    offset: number,
  ): Promise<{ users: UserOutput[]; count: number }> {
    this.logger.log(ctx, `${this.getUsers.name} was called`);

    this.logger.log(
      ctx,
      `calling ${UserRepository.name}.createQueryBuilder with ordersCount`,
    );
    const queryBuilder = this.repository
      .createQueryBuilder('user')
      .loadRelationCountAndMap('user.ordersCount', 'user.orders')
      .take(limit)
      .skip(offset);

    // Non-admin callers should only see customers or themselves
    if (!ctx.user?.roles?.includes(ROLE.ADMIN)) {
      queryBuilder.andWhere(
        '(user.roles LIKE :customerRole OR user.id = :selfId)',
        { customerRole: `%${ROLE.CUSTOMER}%`, selfId: ctx.user?.id },
      );
    }

    const [users, count] = await queryBuilder.getManyAndCount();

    const usersOutput = plainToInstance(UserOutput, users, {
      excludeExtraneousValues: true,
    });

    return { users: usersOutput, count };
  }

  public async getUserById(
    ctx: RequestContext,
    id: number,
  ): Promise<UserOutput> {
    this.logger.log(ctx, `${this.getUserById.name} was called`);

    this.logger.log(ctx, `calling ${UserRepository.name}.getById`);
    const user = await this.repository.getById(id);

    //ACL
    if (
      !this.userAclService
        .forActor(ctx.user as IActor)
        .canDoAction(Action.READ, user)
    ) {
      throw new UnauthorizedException();
    }

    return plainToInstance(UserOutput, user, {
      excludeExtraneousValues: true,
    });
  }

  public async getGhlIdByUserId(
    ctx: RequestContext,
    id: number,
  ): Promise<string> {
    this.logger.log(ctx, `${this.getGhlIdByUserId.name} was called`);
    const user = await this.repository.findOne({ where: { id } });
    return user?.ghlUserId ?? '';
  }

  public async findByUsername(
    ctx: RequestContext,
    username: string,
  ): Promise<UserOutput> {
    this.logger.log(ctx, `${this.findByUsername.name} was called`);

    this.logger.log(ctx, `calling ${UserRepository.name}.findOne`);
    const user = await this.repository.findOne({ where: { username } });

    return plainToInstance(UserOutput, user, {
      excludeExtraneousValues: true,
    });
  }

  public async findByEmail(
    ctx: RequestContext,
    email: string,
  ): Promise<UserOutput> {
    this.logger.log(ctx, `${this.findByEmail.name} was called`);

    this.logger.log(ctx, `calling ${UserRepository.name}.findOne`);
    const user = await this.repository.findOne({ where: { email } });

    return plainToInstance(UserOutput, user, {
      excludeExtraneousValues: true,
    });
  }

  public async updateUser(
    ctx: RequestContext,
    userId: number,
    input: UpdateUserInput,
  ): Promise<UserOutput> {
    this.logger.log(ctx, `${this.updateUser.name} was called`);

    this.logger.log(ctx, `calling ${UserRepository.name}.getById`);
    const user = await this.repository.getById(userId);

    //ACL
    if (
      !this.userAclService
        .forActor(ctx.user as IActor)
        .canDoAction(Action.UPDATE, user)
    ) {
      throw new UnauthorizedException();
    }

    // Hash the password if it exists in the input payload.
    // if (input.password) {
    //   input.password = await hash(input.password, 10);
    // }

    // merges the input (2nd line) to the found user (1st line)
    const updatedUser: User = {
      ...user,
      ...input,
    };

    this.logger.log(ctx, `calling ${UserRepository.name}.save`);
    await this.repository.save(updatedUser);

    return plainToInstance(UserOutput, updatedUser, {
      excludeExtraneousValues: true,
    });
  }

  public async findEmployeesByServiceId(
    serviceId: number,
    ctx?: RequestContext,
  ): Promise<User[]> {
    if (ctx) {
      this.logger.log(
        ctx,
        `🔍 DEBUG: findEmployeesByServiceId called for serviceId: ${serviceId}`,
      );
    }

    // Step 3: Check users with USER role and not disabled
    const activeUsers = await this.repository.find({
      where: {
        roles: ROLE.USER,
        isAccountDisabled: false,
      },
    });

    if (ctx) {
      this.logger.log(
        ctx,
        `🔍 DEBUG: Found ${activeUsers.length} active users with USER role`,
      );
      if (activeUsers.length > 0) {
        this.logger.log(
          ctx,
          `🔍 DEBUG: Active users: ${activeUsers.map((u) => `${u.name} (ID: ${u.id}, roles: ${u.roles}, serviceIds: ${u.serviceIds})`).join(', ')}`,
        );
      }
    }

    // Step 4: Test the query parameters
    const queryParameters = {
      serviceId: serviceId.toString(),
      serviceIdStart: `${serviceId},%`,
      serviceIdEnd: `%,${serviceId}`,
      serviceIdMiddle: `%,${serviceId},%`,
    };

    if (ctx) {
      this.logger.log(
        ctx,
        `🔍 DEBUG: Query parameters: ${JSON.stringify(queryParameters)}`,
      );
    }

    // Step 5: Execute the main query
    const result = await this.repository
      .createQueryBuilder('user')
      .where('user.roles LIKE :role', { role: `%${ROLE.USER}%` })
      .andWhere('user.isAccountDisabled = :isDisabled', { isDisabled: false })
      .andWhere(
        '(user.serviceIds = :serviceId OR user.serviceIds LIKE :serviceIdStart OR user.serviceIds LIKE :serviceIdEnd OR user.serviceIds LIKE :serviceIdMiddle)',
        queryParameters,
      )
      .getMany();

    if (ctx) {
      this.logger.log(
        ctx,
        `🔍 DEBUG: Query result: ${result.length} employees found for service ${serviceId}`,
      );
      if (result.length > 0) {
        this.logger.log(
          ctx,
          `🔍 DEBUG: Found employees: ${result.map((u) => `${u.name} (ID: ${u.id}, serviceIds: ${u.serviceIds})`).join(', ')}`,
        );
      }

      // Step 6: Manual check for debugging
      for (const user of activeUsers) {
        const serviceIdsString = user.serviceIds
          ? user.serviceIds.toString()
          : 'null';
        const hasServiceId = serviceIdsString.includes(serviceId.toString());
        this.logger.log(
          ctx,
          `🔍 DEBUG: User ${user.name} (ID: ${user.id}) - serviceIds: ${serviceIdsString}, has service ${serviceId}: ${hasServiceId}`,
        );
      }
    }

    return result;
  }

  public async assignOrderRoundRobin(
    ctx: RequestContext,
    serviceId: number,
    itemSlots: string[],
  ): Promise<User[] | undefined> {
    this.logger.log(
      ctx,
      `🔍 DEBUG: assignOrderRoundRobin called for serviceId: ${serviceId}, itemSlots: ${JSON.stringify(itemSlots)}`,
    );

    const availableEmployees = await this.findEmployeesByServiceId(
      serviceId,
      ctx,
    );
    this.logger.log(
      ctx,
      `🔍 DEBUG: Found ${availableEmployees.length} available employees for service ${serviceId}`,
    );

    if (availableEmployees.length > 0) {
      this.logger.log(
        ctx,
        `🔍 DEBUG: Available employees: ${availableEmployees.map((emp) => `${emp.name} (ID: ${emp.id}, count: ${emp.lastAssignedOrderCount})`).join(', ')}`,
      );
    }

    if (availableEmployees.length === 0) {
      this.logger.warn(
        ctx,
        `❌ No employees available for service ID: ${serviceId}`,
      );
      return undefined;
    }

    // Find one employee who can handle ALL slots
    const assignedEmployees: User[] = [];
    if (itemSlots && itemSlots.length > 0) {
      this.logger.log(
        ctx,
        `🔍 DEBUG: Looking for one employee who can handle all ${itemSlots.length} slots`,
      );

      try {
        // Sort employees by assignment count (round-robin)
        const sortedEmployees = availableEmployees.sort(
          (a, b) => a.lastAssignedOrderCount - b.lastAssignedOrderCount,
        );

        this.logger.log(
          ctx,
          `🔍 DEBUG: Sorted employees by assignment count: ${sortedEmployees.map((emp) => `${emp.name} (count: ${emp.lastAssignedOrderCount})`).join(', ')}`,
        );

        let selectedEmployee: User | undefined;

        // Check each employee to see if they can handle ALL slots
        for (const employee of sortedEmployees) {
          this.logger.log(
            ctx,
            `🔍 DEBUG: Checking if employee ${employee.name} (ID: ${employee.id}) can handle all slots`,
          );

          let canHandleAllSlots = true;

          // Check availability for each slot
          for (const itemSlot of itemSlots) {
            this.logger.log(
              ctx,
              `🔍 DEBUG: Checking employee ${employee.name} availability for slot ${itemSlot}`,
            );

            // Check Google Calendar availability
            const availableAtTime =
              await this.googleCalendarService.getAvailableEmployeesAtTime(
                itemSlot,
                [employee], // Check only this employee
              );

            if (availableAtTime.length === 0) {
              this.logger.log(
                ctx,
                `🔍 DEBUG: Employee ${employee.name} not available in Google Calendar for slot ${itemSlot}`,
              );
              canHandleAllSlots = false;
              break;
            }

            // Check database availability
            const isDatabaseAvailable =
              await this.checkEmployeeDatabaseAvailability(
                ctx,
                itemSlot,
                employee.id,
              );

            if (!isDatabaseAvailable) {
              this.logger.log(
                ctx,
                `🔍 DEBUG: Employee ${employee.name} not available in database for slot ${itemSlot}`,
              );
              canHandleAllSlots = false;
              break;
            }

            this.logger.log(
              ctx,
              `🔍 DEBUG: Employee ${employee.name} available for slot ${itemSlot}`,
            );
          }

          if (canHandleAllSlots) {
            selectedEmployee = employee;
            this.logger.log(
              ctx,
              `🔍 DEBUG: Employee ${employee.name} (ID: ${employee.id}) can handle all slots!`,
            );
            break;
          }
        }

        // Update assignment count and assign employee
        if (selectedEmployee) {
          await this.repository.update(selectedEmployee.id, {
            lastAssignedOrderCount: selectedEmployee.lastAssignedOrderCount + 1,
          });

          this.logger.log(
            ctx,
            `✅ Assigned employee ${selectedEmployee.name} (ID: ${selectedEmployee.id}) for all ${itemSlots.length} slots`,
          );

          assignedEmployees.push(selectedEmployee);
        } else {
          this.logger.error(
            ctx,
            `❌ No employee found who can handle all ${itemSlots.length} slots`,
          );
          return undefined;
        }
      } catch (error) {
        this.logger.error(
          ctx,
          `❌ Failed to check Google Calendar availability: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`,
        );
        this.logger.error(ctx, `❌ Error details: ${JSON.stringify(error)}`);
        throw new Error(
          `Failed to check Google Calendar availability: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`,
        );
        // Fall through to general round-robin
      }
    } else {
      this.logger.log(
        ctx,
        `🔍 DEBUG: No specific time slots provided, using general round-robin`,
      );
    }

    this.logger.log(
      ctx,
      `🔍 DEBUG: Final assigned employees count: ${assignedEmployees.length}`,
    );
    if (assignedEmployees.length > 0) {
      this.logger.log(
        ctx,
        `🔍 DEBUG: Final assigned employees: ${assignedEmployees.map((emp) => `${emp.name} (ID: ${emp.id})`).join(', ')}`,
      );
    }

    return assignedEmployees;
  }

  public async createEmployee(employeeData: Partial<User>): Promise<User> {
    const employee = this.repository.create({
      ...employeeData,
      roles: [ROLE.USER],
      isAccountDisabled: false,
    });
    return await this.repository.save(employee);
  }

  public async deleteUser(ctx: RequestContext, id: number): Promise<void> {
    this.logger.log(ctx, `${this.deleteUser.name} was called`);

    // First check if user exists
    const user = await this.repository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User with id ${id} not found`);
    }

    //ACL
    if (
      !this.userAclService
        .forActor(ctx.user as IActor)
        .canDoAction(Action.DELETE, user)
    ) {
      throw new UnauthorizedException();
    }
    // Check if user has associated orders
    const orderRepository = this.repository.manager.getRepository(Order);
    const associatedOrders = await orderRepository.find({
      where: { customerId: id },
    });

    if (associatedOrders.length > 0) {
      this.logger.log(
        ctx,
        `Found ${associatedOrders.length} associated orders for user ${id}, deleting them first`,
      );

      // Delete all associated orders first
      await orderRepository.delete({ customerId: id });
      this.logger.log(
        ctx,
        `Deleted ${associatedOrders.length} associated orders for user ${id}`,
      );
    }

    // Now delete the user
    await this.repository.delete(id);
    this.logger.log(ctx, `User with id ${id} deleted successfully`);
  }

  // Add this method to check database reservations for a specific employee and time
  private async checkEmployeeDatabaseAvailability(
    ctx: RequestContext,
    dateTime: string,
    employeeId: number,
  ): Promise<boolean> {
    this.logger.log(
      ctx,
      `🔍 DEBUG: checkEmployeeDatabaseAvailability called for employee ${employeeId} at ${dateTime}`,
    );

    try {
      // Check for confirmed bookings
      this.logger.log(
        ctx,
        `🔍 DEBUG: Checking for confirmed bookings for employee ${employeeId} at ${dateTime}`,
      );

      const confirmedBookings = await this.orderRepository
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
        `🔍 DEBUG: Found ${confirmedBookings} confirmed bookings for employee ${employeeId} at ${dateTime}`,
      );

      if (confirmedBookings > 0) {
        this.logger.log(
          ctx,
          `🔍 DEBUG: Employee ${employeeId} NOT available at ${dateTime} - has confirmed bookings`,
        );
        return false;
      }

      // Check for active reservations
      this.logger.log(
        ctx,
        `🔍 DEBUG: Checking for active reservations for employee ${employeeId} at ${dateTime}`,
      );

      const activeReservations = await this.orderRepository
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
        `🔍 DEBUG: Found ${activeReservations} active reservations for employee ${employeeId} at ${dateTime}`,
      );

      const isAvailable = activeReservations === 0;
      this.logger.log(
        ctx,
        `🔍 DEBUG: Employee ${employeeId} ${isAvailable ? 'IS' : 'NOT'} available at ${dateTime}`,
      );

      return isAvailable;
    } catch (error) {
      this.logger.error(
        ctx,
        `❌ Error checking database availability for employee ${employeeId} at ${dateTime}: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
      this.logger.error(
        ctx,
        `❌ Database availability check error details: ${JSON.stringify(error)}`,
      );
      return false; // Assume not available if there's an error
    }
  }
}
