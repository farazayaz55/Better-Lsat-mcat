import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';

import { Order } from '../entities/order.entity';

@Injectable()
export class OrderRepository extends Repository<Order> {
  constructor(private readonly dataSource: DataSource) {
    super(Order, dataSource.createEntityManager());
  }

  async getById(id: number): Promise<Order> {
    const order = await this.findOne({ where: { id } });
    if (!order) {
      throw new NotFoundException();
    }

    return order;
  }
}
