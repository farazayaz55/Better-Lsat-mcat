import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FINANCIAL_CONSTANTS } from '../constants/financial.constant';

@Injectable()
export class FinancialNumberService {
  constructor(private readonly configService: ConfigService) {}

  /**
   * Generate unique number in format: PREFIX-YYYYMMDD-XXXX
   * Example: INV-20250115-0001
   */
  async generateNumber(prefix: string): Promise<string> {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD

    // For now, we'll use timestamp for uniqueness
    // In production, you might want to use a sequence counter
    const sequence = Date.now().toString().slice(-4); // Last 4 digits of timestamp

    return `${prefix}-${dateStr}-${sequence}`;
  }

  /**
   * Generate unique invoice number
   */
  async generateInvoiceNumber(): Promise<string> {
    return this.generateNumber(FINANCIAL_CONSTANTS.NUMBER_PREFIXES.INVOICE);
  }

  /**
   * Generate unique refund number
   */
  async generateRefundNumber(): Promise<string> {
    return this.generateNumber(FINANCIAL_CONSTANTS.NUMBER_PREFIXES.REFUND);
  }

  /**
   * Generate unique transaction number
   */
  async generateTransactionNumber(): Promise<string> {
    return this.generateNumber(FINANCIAL_CONSTANTS.NUMBER_PREFIXES.TRANSACTION);
  }

  /**
   * Validate number format
   */
  isValidNumber(number: string, prefix: string): boolean {
    const pattern = new RegExp(`^${prefix}-\\d{8}-\\d{4}$`);
    return pattern.test(number);
  }

  /**
   * Validate invoice number format
   */
  isValidInvoiceNumber(invoiceNumber: string): boolean {
    return this.isValidNumber(
      invoiceNumber,
      FINANCIAL_CONSTANTS.NUMBER_PREFIXES.INVOICE,
    );
  }

  /**
   * Validate refund number format
   */
  isValidRefundNumber(refundNumber: string): boolean {
    return this.isValidNumber(
      refundNumber,
      FINANCIAL_CONSTANTS.NUMBER_PREFIXES.REFUND,
    );
  }

  /**
   * Validate transaction number format
   */
  isValidTransactionNumber(transactionNumber: string): boolean {
    return this.isValidNumber(
      transactionNumber,
      FINANCIAL_CONSTANTS.NUMBER_PREFIXES.TRANSACTION,
    );
  }
}
