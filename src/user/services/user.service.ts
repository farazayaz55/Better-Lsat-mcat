import { Injectable, UnauthorizedException } from '@nestjs/common';
import { compare, hash } from 'bcrypt';
import { plainToInstance } from 'class-transformer';
import { ROLE } from '../../auth/constants/role.constant';
import { AppLogger } from '../../shared/logger/logger.service';
import { RequestContext } from '../../shared/request-context/request-context.dto';
import { CreateCustomerInput } from '../dtos/customer-create-input.dto';
import { CreateUserInput } from '../dtos/user-create-input.dto';
import { UserOutput } from '../dtos/user-output.dto';
import { UpdateUserInput } from '../dtos/user-update-input.dto';
import { User } from '../entities/user.entity';
import { UserRepository } from '../repositories/user.repository';

@Injectable()
export class UserService {
  public constructor(
    private readonly repository: UserRepository,
    private readonly logger: AppLogger,
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

    console.log('Found user:', {
      id: user.id,
      email: user.email,
      hasPassword: !!user.password,
      roles: user.roles,
    });

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
  ): Promise<User | undefined> {
    const availableEmployees = await this.findEmployeesByServiceId(serviceId);

    if (availableEmployees.length === 0) {
      this.logger.warn(
        ctx,
        `No employees available for service ID: ${serviceId}`,
      );
      return undefined;
    }

    // Sort by last assigned order count to implement round-robin
    availableEmployees.sort(
      (a, b) => a.lastAssignedOrderCount - b.lastAssignedOrderCount,
    );

    const selectedEmployee = availableEmployees[0];

    // Update the assignment count
    await this.repository.update(selectedEmployee.id, {
      lastAssignedOrderCount: selectedEmployee.lastAssignedOrderCount + 1,
    });

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
}
