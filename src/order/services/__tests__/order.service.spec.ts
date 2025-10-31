import { EventEmitter2 } from '@nestjs/event-emitter';
import { OrderService } from '../order.service';
import { OrderRepository } from '../../repository/order.repository';
import { AppLogger } from '../../../shared/logger/logger.service';
import { UserService } from '../../../user/services/user.service';
import { ProductService } from '../../../product/services/product.service';
import { SlotService } from '../../../shared/slot/services/slot.service';
import { EmployeeAssignmentService } from '../employee-assignment.service';
import { RefundService } from '../../../finance/services/refund.service';
import { InvoiceService } from '../../../invoicing/services/invoice.service';
import { StripeService } from '../../../shared/services/stripe.service';
import { AttendanceStatusDto } from '../../dto/update-session-attendance.dto';

describe('OrderService - notes and session attendance', () => {
  let service: OrderService;
  let repository: jest.Mocked<OrderRepository>;
  let eventEmitter: jest.Mocked<EventEmitter2>;

  beforeEach(() => {
    repository = {
      update: jest.fn(),
      getById: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
      delete: jest.fn(),
      createQueryBuilder: jest.fn() as any,
    } as unknown as jest.Mocked<OrderRepository>;

    eventEmitter = {
      emit: jest.fn(),
    } as unknown as jest.Mocked<EventEmitter2>;

    service = new OrderService(
      repository,
      {
        setContext: jest.fn(),
        log: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      } as unknown as AppLogger,
      {} as unknown as UserService,
      {} as unknown as ProductService,
      {} as unknown as SlotService,
      {} as unknown as EmployeeAssignmentService,
      {} as unknown as RefundService,
      {} as unknown as InvoiceService,
      {} as unknown as StripeService,
      eventEmitter,
    );
  });

  it('updates order notes', async () => {
    repository.update.mockResolvedValue(undefined as any);
    repository.getById.mockResolvedValue({ id: 1, notes: 'new notes' } as any);

    const result = await service.updateOrderNotes(
      { requestID: 't', user: { id: 1 } } as any,
      1,
      { notes: 'new notes' },
    );

    expect(repository.update).toHaveBeenCalledWith(1, { notes: 'new notes' });
    expect(result.notes).toBe('new notes');
  });

  it('updates session attendance and emits event', async () => {
    const order = {
      id: 10,
      items: [
        {
          id: 5,
          sessions: [{ dateTime: '2025-11-01T15:00:00.000Z' }],
          assignedEmployeeIds: [1],
        },
      ],
    } as any;
    repository.getById.mockResolvedValue(order);
    repository.update.mockResolvedValue(undefined as any);
    repository.getById
      .mockResolvedValueOnce(order)
      .mockResolvedValueOnce(order);

    const result = await service.updateSessionAttendance(
      { requestID: 't', user: { id: 2 } } as any,
      10,
      5,
      0,
      AttendanceStatusDto.SHOWED,
      '2025-11-01T15:35:00.000Z',
      2,
    );

    expect(repository.update).toHaveBeenCalled();
    expect(eventEmitter.emit).toHaveBeenCalled();
    expect(result.id).toBe(10);
  });
});
