import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindManyOptions, Between } from 'typeorm';
import { Invoice } from '../entities/invoice.entity';
import { InvoiceStatus } from '../constants/invoice-status.constant';

export interface InvoiceFilter {
  status?: InvoiceStatus;
  customerId?: number;
  orderId?: number;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

@Injectable()
export class InvoiceRepository {
  constructor(
    @InjectRepository(Invoice)
    private readonly repository: Repository<Invoice>,
  ) {}

  async create(data: Partial<Invoice>): Promise<Invoice> {
    const invoice = this.repository.create(data);
    return this.repository.save(invoice);
  }

  async findById(id: number): Promise<Invoice | null> {
    return this.repository.findOne({ where: { id } });
  }

  async findByInvoiceNumber(invoiceNumber: string): Promise<Invoice | null> {
    return this.repository.findOne({ where: { invoiceNumber } });
  }

  async findByOrderId(orderId: number): Promise<Invoice[]> {
    return this.repository.find({ where: { orderId } });
  }

  async findByCustomerId(customerId: number): Promise<Invoice[]> {
    return this.repository.find({ where: { customerId } });
  }

  async findWithFilters(filter: InvoiceFilter): Promise<Invoice[]> {
    const queryBuilder = this.repository.createQueryBuilder('invoice');

    if (filter.status) {
      queryBuilder.andWhere('invoice.status = :status', {
        status: filter.status,
      });
    }

    if (filter.customerId) {
      queryBuilder.andWhere('invoice.customerId = :customerId', {
        customerId: filter.customerId,
      });
    }

    if (filter.orderId) {
      queryBuilder.andWhere('invoice.orderId = :orderId', {
        orderId: filter.orderId,
      });
    }

    if (filter.startDate && filter.endDate) {
      queryBuilder.andWhere(
        'invoice.issueDate BETWEEN :startDate AND :endDate',
        {
          startDate: filter.startDate,
          endDate: filter.endDate,
        },
      );
    }

    if (filter.limit) {
      queryBuilder.limit(filter.limit);
    }

    if (filter.offset) {
      queryBuilder.offset(filter.offset);
    }

    queryBuilder.orderBy('invoice.createdAt', 'DESC');

    return queryBuilder.getMany();
  }

  async update(id: number, data: Partial<Invoice>): Promise<void> {
    await this.repository.update(id, data);
  }

  async delete(id: number): Promise<void> {
    await this.repository.delete(id);
  }

  async countByStatus(status: InvoiceStatus): Promise<number> {
    return this.repository.count({ where: { status } });
  }

  async countByDateRange(startDate: Date, endDate: Date): Promise<number> {
    return this.repository.count({
      where: {
        issueDate: Between(startDate, endDate),
      },
    });
  }
}
