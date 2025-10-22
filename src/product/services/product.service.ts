import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { CreateProductInput } from '../dto/create-product-input.dto';
import { ProductOutput } from '../dto/product-output.dto';
import { UpdateProductInput } from '../dto/update-product-input.dto';
import { Product } from '../entities/product.entity';
import { ProductRepository } from '../repositories/product.repository';

@Injectable()
export class ProductService {
  private readonly logger = new Logger(ProductService.name);

  constructor(private readonly productRepository: ProductRepository) {}

  async create(input: CreateProductInput): Promise<ProductOutput> {
    this.logger.log(`Creating product: ${input.name}`);

    const product = this.productRepository.create({
      ...input,
      save: input.save || 0, // Default to 0 if not provided
    });

    const savedProduct = await this.productRepository.save(product);
    this.logger.log(`Product created with ID: ${savedProduct.id}`);

    return plainToInstance(ProductOutput, savedProduct, {
      excludeExtraneousValues: true,
    });
  }

  async findAll(): Promise<ProductOutput[]> {
    this.logger.log('Fetching all products');

    const products = await this.productRepository.find({
      order: { createdAt: 'DESC' },
    });

    return plainToInstance(ProductOutput, products, {
      excludeExtraneousValues: true,
    });
  }

  async findOne(id: number): Promise<ProductOutput> {
    this.logger.log(`Fetching product with ID: ${id}`);

    const product = await this.productRepository.findOne({ where: { id } });

    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }

    return plainToInstance(ProductOutput, product, {
      excludeExtraneousValues: true,
    });
  }

  async update(id: number, input: UpdateProductInput): Promise<ProductOutput> {
    this.logger.log(`Updating product with ID: ${id}`);

    const product = await this.productRepository.findOne({ where: { id } });

    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }

    // Update only provided fields
    Object.assign(product, input);

    const updatedProduct = await this.productRepository.save(product);
    this.logger.log(`Product updated with ID: ${updatedProduct.id}`);

    return plainToInstance(ProductOutput, updatedProduct, {
      excludeExtraneousValues: true,
    });
  }

  async delete(id: number): Promise<void> {
    this.logger.log(`Deleting product with ID: ${id}`);

    const product = await this.productRepository.findOne({ where: { id } });

    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }

    // TODO: Add validation to prevent deletion if product is referenced in orders
    // This would require checking if any orders reference this product ID
    // For now, we'll allow deletion but this should be implemented later

    await this.productRepository.remove(product);
    this.logger.log(`Product deleted with ID: ${id}`);
  }

  async exists(id: number): Promise<boolean> {
    const count = await this.productRepository.count({ where: { id } });
    return count > 0;
  }

  async findByIds(ids: number[]): Promise<Product[]> {
    if (ids.length === 0) return [];

    return this.productRepository.findByIds(ids);
  }

  async seedInitialProducts(): Promise<void> {
    this.logger.log('Seeding initial products');

    const initialProducts = [
      {
        id: 8,
        price: 0,
        name: '15-Minute FREE Strategy Call',
        Duration: 15,
        save: 0,
        badge: {
          text: 'FREE',
          color: 'bg-green-600',
        },
        Description:
          'No sales pitch. No wasted time. Just a focused strategy session to give you clarity and direction for your LSAT prep.',
      },
      {
        id: 5,
        price: 125,
        name: '60-Minute Single Prep',
        save: 75,
        Duration: 60,
        badge: {
          text: 'Only 3 slots left',
          color: 'bg-orange-500',
        },
        Description:
          'Need flexibility? Book individual LSAT tutoring sessions as you go',
      },
      {
        id: 6,
        price: 577,
        save: 100,
        name: '5X Prep Session Bundle',
        Duration: 60,
        badge: {
          text: 'Most Popular',
          color: 'bg-blue-600',
        },
        Description: 'Our most popular option for consistent, focused prep.',
      },
      {
        id: 7,
        price: 1100,
        save: 150,
        name: '10X Prep Session Bundle',
        Duration: 60,
        badge: {
          text: 'Hot Selling',
          color: 'bg-red-500',
        },
        Description: 'Built for long-term gains and higher score jumps.',
      },
    ];

    for (const productData of initialProducts) {
      const existingProduct = await this.productRepository.findOne({
        where: { id: productData.id },
      });

      // eslint-disable-next-line unicorn/no-negated-condition
      if (!existingProduct) {
        const product = this.productRepository.create(productData);
        await this.productRepository.save(product);
        this.logger.log(`Seeded product: ${product.name} (ID: ${product.id})`);
      } else {
        this.logger.log(
          `Product with ID ${productData.id} already exists, skipping`,
        );
      }
    }

    this.logger.log('Initial products seeding completed');
  }
}
