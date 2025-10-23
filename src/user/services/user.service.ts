import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { compare, hash } from 'bcrypt';
import { plainToInstance } from 'class-transformer';
import { ROLE } from '../../auth/constants/role.constant';
import { AppLogger } from '../../shared/logger/logger.service';
import { PhoneNormalizerService } from '../../shared/utils/phone-normalizer.service';
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

@Injectable()
export class UserService {
  public constructor(
    private readonly repository: UserRepository,
    private readonly logger: AppLogger,
    private readonly phoneNormalizer: PhoneNormalizerService,
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

    //ACL - Skip ACL check if ctx.user is null (system/webhook context)
    if (
      ctx.user &&
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

    //ACL - Skip ACL check if ctx.user is null (system/webhook context)
    if (
      ctx.user &&
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
      this.logger.log(ctx, `Finding employees for serviceId: ${serviceId}`);
    }

    // Use the optimized repository method
    const result =
      await this.repository.findAvailableEmployeesByServiceId(serviceId);

    if (ctx) {
      this.logger.log(
        ctx,
        `Found ${result.length} employees for service ${serviceId}`,
      );
      if (result.length > 0) {
        this.logger.log(
          ctx,
          `Employees: ${result.map((u) => `${u.name} (ID: ${u.id}, serviceIds: ${u.serviceIds})`).join(', ')}`,
        );
      }
    }

    return result;
  }

  public async findByPhone(phone: string): Promise<User | null> {
    if (!phone) {
      return null;
    }

    // Use the repository method for phone search
    const users = await this.repository.findByPhone(phone);
    return users.length > 0 ? users[0] : null;
  }

  public async updateAssignmentCount(
    ctx: RequestContext,
    userId: number,
    newCount: number,
  ): Promise<void> {
    this.logger.log(
      ctx,
      `Updating assignment count for user ${userId} to ${newCount}`,
    );

    const user = await this.repository.getById(userId);
    user.lastAssignedOrderCount = newCount;
    await this.repository.save(user);

    this.logger.log(
      ctx,
      `Successfully updated assignment count for user ${userId}`,
    );
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

    //ACL - Skip ACL check if ctx.user is null (system/webhook context)
    if (
      ctx.user &&
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
}
