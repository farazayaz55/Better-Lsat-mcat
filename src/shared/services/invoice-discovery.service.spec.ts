import { Test, TestingModule } from '@nestjs/testing';
import { InvoiceDiscoveryService } from '../../invoicing/services/invoice-discovery.service';
import { InvoiceService } from '../../invoicing/services/invoice.service';
import { AppLogger } from './logger/logger.service';
import { RequestContext } from '../request-context/request-context.dto';

describe('InvoiceDiscoveryService', () => {
  let service: InvoiceDiscoveryService;
  let invoiceService: jest.Mocked<InvoiceService>;
  let logger: jest.Mocked<AppLogger>;

  beforeEach(async () => {
    invoiceService = {
      getInvoicesByOrderId: jest.fn(),
    } as any;

    logger = {
      setContext: jest.fn(),
      log: jest.fn(),
      warn: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvoiceDiscoveryService,
        { provide: InvoiceService, useValue: invoiceService },
        { provide: AppLogger, useValue: logger },
      ],
    }).compile();

    service = module.get<InvoiceDiscoveryService>(InvoiceDiscoveryService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findInvoiceForOrder', () => {
    it('should return invoice ID when invoice exists', async () => {
      const ctx = {} as RequestContext;
      invoiceService.getInvoicesByOrderId.mockResolvedValue([
        { id: 1, orderId: 123 } as any,
      ]);

      const result = await service.findInvoiceForOrder(ctx, 123);
      expect(result).toEqual({ id: 1 });
      expect(invoiceService.getInvoicesByOrderId).toHaveBeenCalledWith(
        ctx,
        123,
      );
    });

    it('should return null when no invoice exists', async () => {
      const ctx = {} as RequestContext;
      invoiceService.getInvoicesByOrderId.mockResolvedValue([]);

      const result = await service.findInvoiceForOrder(ctx, 123);
      expect(result).toBeNull();
    });
  });
});
