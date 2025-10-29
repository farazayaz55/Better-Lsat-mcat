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

@Module({
  imports: [
    SharedModule,
    TypeOrmModule.forFeature([Refund, PaymentTransaction]),
    forwardRef(() => OrderModule),
    forwardRef(() => InvoicingModule),
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
  ],
  exports: [
    RefundService,
    PaymentTransactionService,
    RefundRepository,
    PaymentTransactionRepository,
  ],
})
export class FinanceModule {}
