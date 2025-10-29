import { Injectable } from '@nestjs/common';
import { RequestContext } from '../../../shared/request-context/request-context.dto';
import { AppLogger } from '../../../shared/logger/logger.service';
import { InvoiceService } from '../../../invoicing/services/invoice.service';

@Injectable()
export class RefundInvoiceHandler {
  constructor(
    private readonly invoiceService: InvoiceService,
    private readonly logger: AppLogger,
  ) {
    this.logger.setContext(RefundInvoiceHandler.name);
  }

  /**
   * Voids an invoice when a refund is processed
   */
  async voidInvoice(
    ctx: RequestContext,
    invoiceId: number,
    reason: string,
  ): Promise<void> {
    this.logger.log(
      ctx,
      `Voiding invoice ${invoiceId} due to refund: ${reason}`,
    );

    await this.invoiceService.voidInvoice(ctx, invoiceId, reason);
  }
}
