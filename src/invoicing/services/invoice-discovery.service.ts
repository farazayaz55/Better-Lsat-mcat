import { Injectable } from '@nestjs/common';
import { RequestContext } from '../../shared/request-context/request-context.dto';
import { AppLogger } from '../../shared/logger/logger.service';
import { InvoiceService } from './invoice.service';

@Injectable()
export class InvoiceDiscoveryService {
  constructor(
    private readonly invoiceService: InvoiceService,
    private readonly logger: AppLogger,
  ) {
    this.logger.setContext(InvoiceDiscoveryService.name);
  }

  /**
   * Finds the invoice for an order
   * @param ctx - Request context
   * @param orderId - The order ID to find invoice for
   * @returns Invoice ID or null if not found
   */
  async findInvoiceForOrder(
    ctx: RequestContext,
    orderId: number,
  ): Promise<{ id: number } | null> {
    this.logger.log(ctx, `Finding invoice for order ${orderId}`);

    const invoices = await this.invoiceService.getInvoicesByOrderId(
      ctx,
      orderId,
    );

    if (invoices.length > 0) {
      this.logger.log(
        ctx,
        `Found invoice ${invoices[0].id} for order ${orderId}`,
      );
      return { id: invoices[0].id };
    }

    this.logger.warn(ctx, `No invoice found for order ${orderId}`);
    return null;
  }
}
