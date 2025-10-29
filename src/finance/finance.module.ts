import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { SharedModule } from '../shared/shared.module';
import { OrderModule } from '../order/order.module';
import { InvoicingModule } from '../invoicing/invoicing.module';
import { Refund } from './entities/refund.entity';
import { PaymentTransaction } from './entities/payment-transaction.entity';
import { RefundRepository } from './repositories/refund.repository';
import { PaymentTransactionRepository } from './repositories/payment-transaction.repository';
import { RefundService } from './services/refund.service';
import { PaymentTransactionService } from './services/payment-transaction.service';
import { RefundController } from './controllers/refund.controller';
import { PaymentTransactionController } from './controllers/payment-transaction.controller';
import { CurrencyController } from './controllers/currency.controller';
import { RefundStripeProcessor } from './services/refund-processing/refund-stripe-processor.service';
import { RefundInvoiceHandler } from './services/refund-processing/refund-invoice-handler.service';
import { RefundProcessingOrchestrator } from './services/refund-processing/refund-processing-orchestrator.service';

@Module({
  imports: [
    SharedModule,
    TypeOrmModule.forFeature([Refund, PaymentTransaction]),
    forwardRef(() => OrderModule), // Still needed for OrderService in orchestrator for now
    InvoicingModule, // Need InvoiceDiscoveryService
  ],
  controllers: [
    RefundController,
    PaymentTransactionController,
    CurrencyController,
  ],
  providers: [
    RefundRepository,
    PaymentTransactionRepository,
    RefundService,
    PaymentTransactionService,
    // Refund Processing Services
    RefundStripeProcessor,
    RefundInvoiceHandler,
    RefundProcessingOrchestrator,
  ],
  exports: [
    RefundService,
    PaymentTransactionService,
    RefundRepository,
    PaymentTransactionRepository,
  ],
})
export class FinanceModule {}
