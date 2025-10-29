import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { InvoiceService } from '../services/invoice.service';
import { InvoiceRepository } from '../repositories/invoice.repository';
import { FinancialNumberService } from '../../shared/services/financial-number.service';
import { Invoice } from '../entities/invoice.entity';

describe('InvoiceService', () => {
  let service: InvoiceService;
  let mockRepository: any;
  let mockConfigService: any;

  beforeEach(async () => {
    mockRepository = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
    };

    mockConfigService = {
      get: jest.fn().mockReturnValue('INV'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvoiceService,
        {
          provide: InvoiceRepository,
          useValue: mockRepository,
        },
        {
          provide: FinancialNumberService,
          useValue: {
            generateInvoiceNumber: jest
              .fn()
              .mockResolvedValue('INV-20250115-0001'),
          },
        },
      ],
    }).compile();

    service = module.get<InvoiceService>(InvoiceService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should create an invoice', async () => {
    const invoiceData = {
      orderId: 1,
      customerId: 1,
      items: [
        { id: 1, name: 'Test Item', price: 100, quantity: 1, total: 100 },
      ],
      subtotal: 100,
      tax: 0,
      discount: 0,
      total: 100,
      currency: 'USD',
    };

    const mockInvoice = { id: 1, ...invoiceData };
    mockRepository.create.mockReturnValue(mockInvoice);
    mockRepository.save.mockResolvedValue(mockInvoice);

    const result = await service.create(invoiceData);

    expect(result).toBeDefined();
    expect(mockRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        ...invoiceData,
        invoiceNumber: 'INV-20250115-0001',
        status: 'draft',
      }),
    );
  });
});
