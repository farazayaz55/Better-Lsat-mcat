import { Injectable } from '@nestjs/common';
import { InvoiceService } from './invoice.service';
import { CreateInvoiceDto } from '../dto/invoice-input.dto';
import { OrderService } from '../../order/services/order.service';
import { RequestContext } from '../../shared/request-context/request-context.dto';
import { AppLogger } from '../../shared/logger/logger.service';
import { Invoice } from '../entities/invoice.entity';
import { FINANCIAL_CONSTANTS } from '../../shared/constants/financial.constant';
import { StripeService } from '../../shared/services/stripe.service';

@Injectable()
export class InvoiceGeneratorService {
  constructor(
    private readonly invoiceService: InvoiceService,
    private readonly orderService: OrderService,
    private readonly logger: AppLogger,
    private readonly stripeService: StripeService,
  ) {
    this.logger.setContext(InvoiceGeneratorService.name);
  }

  async generateInvoiceForOrder(
    ctx: RequestContext,
    orderId: number,
  ): Promise<Invoice | null> {
    this.logger.log(ctx, `Generating invoice for order ${orderId}`);

    try {
      const order = await this.orderService.findOne(orderId);
      if (!order) {
        this.logger.warn(ctx, `Order ${orderId} not found`);
        return null;
      }

      // Check if invoice already exists for this order
      const existingInvoices = await this.invoiceService.getInvoicesByOrderId(
        ctx,
        orderId,
      );
      if (existingInvoices.length > 0) {
        this.logger.warn(ctx, `Invoice already exists for order ${orderId}`);
        return existingInvoices[0];
      }

      // Generate invoice data from order
      const invoiceData = await this.buildInvoiceDataFromOrder(order);

      const invoice = await this.invoiceService.createInvoice(ctx, invoiceData);

      this.logger.log(
        ctx,
        `Successfully generated invoice ${invoice.invoiceNumber} for order ${orderId}`,
      );
      return invoice;
    } catch (error) {
      this.logger.error(
        ctx,
        `Failed to generate invoice for order ${orderId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }

  private async buildInvoiceDataFromOrder(order: {
    id: number;
    customerId: number;
    items: Array<{
      name?: string;
      description?: string;
      quantity?: number;
      price?: number;
    }>;
    stripe_meta?: {
      taxAmount?: number;
      totalAmountIncludingTax?: number;
      currency?: string;
      paidCurrency?: string;
    };
    currency?: string;
  }): Promise<CreateInvoiceDto> {
    // Get the currency user paid in from Stripe (for conversion)
    // Note: amounts from Stripe are in the payment currency
    const paidCurrency =
      order.stripe_meta?.paidCurrency?.toUpperCase() ||
      order.stripe_meta?.currency?.toUpperCase() ||
      'CAD';

    // ALWAYS use CAD for invoice currency (our base currency for all records)
    const invoiceCurrency = FINANCIAL_CONSTANTS.DEFAULT_CURRENCY;

    // Build items - ALWAYS in CAD (already stored in CAD from order)
    // Items are stored in CAD dollars (e.g., $125), convert to cents for storage
    const items = order.items.map((item) => ({
      description: item.name || item.description || 'Service',
      quantity: item.quantity || 1,
      // Prices already in CAD, convert from dollars to cents
      unitPrice: Math.round((item.price || 0) * 100),
      totalPrice: Math.round((item.price || 0) * (item.quantity || 1) * 100),
    }));

    // Subtotal in CAD (already in cents)
    const subtotal = items.reduce(
      (sum: number, item) => sum + item.totalPrice,
      0,
    );

    // Get tax amount from Stripe metadata (already in cents)
    const taxAmountFromStripe = order.stripe_meta?.taxAmount || 0;
    const taxInCheckoutCurrency = taxAmountFromStripe;

    // Convert tax if invoice currency is different from checkout currency
    let tax = taxInCheckoutCurrency;

    // Convert tax from payment currency to CAD if needed
    if (taxInCheckoutCurrency > 0 && paidCurrency && paidCurrency !== 'CAD') {
      try {
        const systemContext = {
          user: null,
          requestID: 'invoice-gen',
          url: '/invoice',
          ip: '127.0.0.1',
        };

        // Get exchange rates from payment currency to CAD
        const rates = await this.stripeService.getExchangeRates(
          systemContext,
          paidCurrency,
        );
        const cadRate = rates.rates['CAD'];

        if (cadRate) {
          // Convert from payment currency to CAD
          tax = Math.round(taxInCheckoutCurrency * cadRate);
          this.logger.log(
            systemContext,
            `Converted tax from ${paidCurrency} to CAD: ${taxInCheckoutCurrency} * ${cadRate} = ${tax}`,
          );
        } else {
          this.logger.warn(
            systemContext,
            `Could not find CAD rate for currency ${paidCurrency}, using tax as-is: ${taxInCheckoutCurrency}`,
          );
        }
      } catch (error) {
        this.logger.warn(
          {
            user: null,
            requestID: 'invoice-gen',
            url: '/invoice',
            ip: '127.0.0.1',
          },
          `Failed to convert tax to CAD: ${error instanceof Error ? error.message : 'Unknown error'}, using tax as-is: ${taxInCheckoutCurrency}`,
        );
      }
    }

    const discount = 0; // TODO: Implement discount calculation
    const total = subtotal + tax - discount;

    this.logger.log(
      {
        user: null,
        requestID: 'invoice-gen',
        url: '/invoice',
        ip: '127.0.0.1',
      },
      `Building invoice for order ${order.id}: subtotal=${subtotal}, tax=${tax}, total=${total}, currency=${invoiceCurrency}`,
    );

    return {
      orderId: order.id,
      customerId: order.customerId,
      items, // Items in CAD (already in cents)
      subtotal, // Subtotal in CAD (cents)
      tax: Math.round(tax), // Tax in CAD (cents)
      discount,
      total: Math.round(total), // Total in CAD (cents)
      currency: 'CAD', // Always store in CAD
      notes: `Invoice for order #${order.id}`,
      dueDate: new Date(
        Date.now() + FINANCIAL_CONSTANTS.DEFAULT_DUE_DAYS * 24 * 60 * 60 * 1000,
      ).toISOString(),
    };
  }
}
