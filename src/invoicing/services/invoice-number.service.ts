import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class InvoiceNumberService {
  constructor(private readonly configService: ConfigService) {}

  /**
   * Generate unique invoice number in format: INV-YYYYMMDD-XXXX
   * Example: INV-20250115-0001
   */
  async generateInvoiceNumber(): Promise<string> {
    const prefix = this.configService.get('INVOICE_NUMBER_PREFIX', 'INV');
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD

    // For now, we'll use timestamp for uniqueness
    // In production, you might want to use a sequence counter
    const sequence = Date.now().toString().slice(-4); // Last 4 digits of timestamp

    return `${prefix}-${dateStr}-${sequence}`;
  }

  /**
   * Validate invoice number format
   */
  isValidInvoiceNumber(invoiceNumber: string): boolean {
    const pattern = /^[A-Z]{2,4}-\d{8}-\d{4}$/;
    return pattern.test(invoiceNumber);
  }
}
