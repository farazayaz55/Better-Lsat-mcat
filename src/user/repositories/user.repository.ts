import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';

import { User } from '../entities/user.entity';
import { ROLE } from '../../auth/constants/role.constant';

@Injectable()
export class UserRepository extends Repository<User> {
  constructor(private readonly dataSource: DataSource) {
    super(User, dataSource.createEntityManager());
  }

  async getById(id: number): Promise<User> {
    const user = await this.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException();
    }

    return user;
  }

  /**
   * Finds available employees by service ID with optimized query
   * @param serviceId The service ID to search for
   * @returns Array of available employees
   */
  async findAvailableEmployeesByServiceId(serviceId: number): Promise<User[]> {
    const queryParameters = {
      serviceId: serviceId.toString(),
      serviceIdStart: `${serviceId},%`,
      serviceIdEnd: `%,${serviceId}`,
      serviceIdMiddle: `%,${serviceId},%`,
    };

    return this.createQueryBuilder('user')
      .where('user.roles LIKE :role', { role: `%${ROLE.USER}%` })
      .andWhere('user.isAccountDisabled = :isDisabled', { isDisabled: false })
      .andWhere(
        '(user.serviceIds = :serviceId OR user.serviceIds LIKE :serviceIdStart OR user.serviceIds LIKE :serviceIdEnd OR user.serviceIds LIKE :serviceIdMiddle)',
        queryParameters,
      )
      .getMany();
  }

  /**
   * Finds users by phone number with normalization
   * @param phone The phone number to search for
   * @returns Array of users with matching phone numbers
   */
  async findByPhone(phone: string): Promise<User[]> {
    if (!phone) {
      return [];
    }

    // Get all users and filter by normalized phone
    const allUsers = await this.find();
    const normalizedPhone = phone.replace(/[\s()\-]/g, '');

    return allUsers.filter((user) => {
      if (!user.phone) {
        return false;
      }
      const normalizedStoredPhone = user.phone.replace(/[\s()\-]/g, '');
      return (
        normalizedStoredPhone === normalizedPhone ||
        normalizedStoredPhone.includes(normalizedPhone) ||
        normalizedPhone.includes(normalizedStoredPhone)
      );
    });
  }
}
