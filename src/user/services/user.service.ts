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
import { CreateUserInput } from '../dtos/user-create-input.dto';
import { UserOutput } from '../dtos/user-output.dto';
import { UpdateUserInput } from '../dtos/user-update-input.dto';
import { User } from '../entities/user.entity';
import { UserRepository } from '../repositories/user.repository';
import { Order } from '../../order/entities/order.entity';

@Injectable()
export class UserService {
  public constructor(
    private readonly repository: UserRepository,
    private readonly logger: AppLogger,
    private readonly googleCalendarService: GoogleCalendarService,
  ) {
    this.logger.setContext(UserService.name);
  }
  public async createUser(
    ctx: RequestContext,
    input: CreateUserInput,
  ): Promise<UserOutput> {
    this.logger.log(ctx, `${this.createUser.name} was called`);

    const user = plainToInstance(User, input);

    user.password = await hash(input.password, 10);

    this.logger.log(ctx, `calling ${UserRepository.name}.saveUser`);
    await this.repository.save(user);

    return plainToInstance(UserOutput, user, {
      excludeExtraneousValues: true,
    });
  }

  public async getOrCreateCustomer(
    ctx: RequestContext,
    input: CreateCustomerInput,
  ): Promise<User> {
    this.logger.log(ctx, `${this.getOrCreateCustomer.name} was called`);

    this.logger.log(ctx, `calling ${UserRepository.name}.findOne`);
    let customer = await this.repository.findOne({
      where: { email: input.email },
    });
    if (!customer) {
      ((input.roles = [ROLE.CUSTOMER]),
        (input.isAccountDisabled = false),
        (customer = this.repository.create(input)));
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

    const user = plainToInstance(User, input);

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

    this.logger.log(ctx, `calling ${UserRepository.name}.findAndCount`);
    const [users, count] = await this.repository.findAndCount({
      where: {},
      take: limit,
      skip: offset,
    });

    const usersOutput = plainToInstance(UserOutput, users, {
      excludeExtraneousValues: true,
    });

    return { users: usersOutput, count };
  }

  public async findById(ctx: RequestContext, id: number): Promise<UserOutput> {
    this.logger.log(ctx, `${this.findById.name} was called`);

    this.logger.log(ctx, `calling ${UserRepository.name}.findOne`);
    const user = await this.repository.findOne({ where: { id } });

    return plainToInstance(UserOutput, user, {
      excludeExtraneousValues: true,
    });
  }

  public async getUserById(
    ctx: RequestContext,
    id: number,
  ): Promise<UserOutput> {
    this.logger.log(ctx, `${this.getUserById.name} was called`);

    this.logger.log(ctx, `calling ${UserRepository.name}.getById`);
    const user = await this.repository.getById(id);

    return plainToInstance(UserOutput, user, {
      excludeExtraneousValues: true,
    });
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

    // Hash the password if it exists in the input payload.
    if (input.password) {
      input.password = await hash(input.password, 10);
    }

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

  public async findEmployeesByServiceId(serviceId: number): Promise<User[]> {
    // Step 3: Check users with USER role and not disabled
    const activeUsers = await this.repository.find({
      where: {
        roles: ROLE.USER,
        isAccountDisabled: false,
      },
    });

    // Step 4: Test the query parameters
    const queryParameters = {
      serviceId: serviceId.toString(),
      serviceIdStart: `${serviceId},%`,
      serviceIdEnd: `%,${serviceId}`,
      serviceIdMiddle: `%,${serviceId},%`,
    };

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

    // Step 6: Manual check for debugging
    for (const user of activeUsers) {
      const serviceIdsString = user.serviceIds
        ? user.serviceIds.toString()
        : 'null';
      // Check if user has the required service ID
      serviceIdsString.includes(serviceId.toString());
    }

    return result;
  }

  public async assignOrderRoundRobin(
    ctx: RequestContext,
    serviceId: number,
    preferredDateTime?: string,
  ): Promise<User | undefined> {
    const availableEmployees = await this.findEmployeesByServiceId(serviceId);

    if (availableEmployees.length === 0) {
      this.logger.warn(
        ctx,
        `No employees available for service ID: ${serviceId}`,
      );
      return undefined;
    }

    // If specific time is preferred, check Google Calendar availability
    if (preferredDateTime) {
      try {
        const availableAtTime =
          await this.googleCalendarService.getAvailableEmployeesAtTime(
            preferredDateTime,
            availableEmployees,
          );

        if (availableAtTime.length > 0) {
          // Assign to employee with least assignments at this specific time
          const sortedByCount = availableAtTime.sort(
            (a, b) => a.lastAssignedOrderCount - b.lastAssignedOrderCount,
          );
          const selectedEmployee = sortedByCount[0];

          // Update assignment count
          await this.repository.update(selectedEmployee.id, {
            lastAssignedOrderCount: selectedEmployee.lastAssignedOrderCount + 1,
          });

          this.logger.log(
            ctx,
            `Assigned employee ${selectedEmployee.name} (ID: ${selectedEmployee.id}) for time ${preferredDateTime}`,
          );

          return selectedEmployee;
        } else {
          this.logger.warn(
            ctx,
            `No employees available at preferred time ${preferredDateTime}`,
          );
        }
      } catch (error) {
        this.logger.error(
          ctx,
          `Failed to check Google Calendar availability: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`,
        );
        // Fall through to general round-robin
      }
    }

    // Fallback to general round-robin (original logic)
    const sortedEmployees = availableEmployees.sort(
      (a, b) => a.lastAssignedOrderCount - b.lastAssignedOrderCount,
    );

    const selectedEmployee = sortedEmployees[0];

    // Update the assignment count
    await this.repository.update(selectedEmployee.id, {
      lastAssignedOrderCount: selectedEmployee.lastAssignedOrderCount + 1,
    });

    this.logger.log(
      ctx,
      `Assigned employee ${selectedEmployee.name} (ID: ${selectedEmployee.id}) using round-robin`,
    );

    return selectedEmployee;
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
}
