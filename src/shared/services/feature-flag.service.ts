import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class FeatureFlagService {
  constructor(private readonly configService: ConfigService) {}

  /**
   * Check if invoice generation is enabled
   */
  isInvoiceGenerationEnabled(): boolean {
    return (
      this.configService.get('ENABLE_INVOICE_GENERATION', 'false') === 'true'
    );
  }

  /**
   * Check if tax calculation is enabled
   */
  isTaxCalculationEnabled(): boolean {
    return this.configService.get('STRIPE_TAX_ENABLED', 'false') === 'true';
  }

  /**
   * Get invoice number prefix
   */
  getInvoiceNumberPrefix(): string {
    return this.configService.get('INVOICE_NUMBER_PREFIX', 'INV');
  }

  /**
   * Get default currency
   */
  getDefaultCurrency(): string {
    return this.configService.get('DEFAULT_CURRENCY', 'CAD');
  }
}
