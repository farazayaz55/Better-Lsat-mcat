import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { OrderModule } from '../order/order.module';
import { SharedModule } from '../shared/shared.module';
import { InvoiceController } from './controllers/invoice.controller';
import { Invoice } from './entities/invoice.entity';
import { InvoiceRepository } from './repositories/invoice.repository';
import { InvoiceGeneratorService } from './services/invoice-generator.service';
import { InvoiceService } from './services/invoice.service';

@Module({
  imports: [
    SharedModule,
    forwardRef(() => OrderModule),
    TypeOrmModule.forFeature([Invoice]),
  ],
  controllers: [InvoiceController],
  providers: [InvoiceRepository, InvoiceService, InvoiceGeneratorService],
  exports: [InvoiceService, InvoiceGeneratorService, InvoiceRepository],
})
export class InvoicingModule {}
