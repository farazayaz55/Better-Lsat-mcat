import { Injectable, Logger } from '@nestjs/common';
import { ProductService } from '../services/product.service';

@Injectable()
export class ProductSeedService {
  private readonly logger = new Logger(ProductSeedService.name);

  constructor(private readonly productService: ProductService) {}

  async seedInitialProducts(): Promise<void> {
    this.logger.log('Starting initial products seeding...');

    try {
      await this.productService.seedInitialProducts();
      this.logger.log('Initial products seeding completed successfully');
    } catch (error) {
      this.logger.error('Failed to seed initial products:', error);
      throw error;
    }
  }
}
