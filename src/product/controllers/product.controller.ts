import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  HttpStatus,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { ClassSerializerInterceptor } from '@nestjs/common';
import { ProductService } from '../services/product.service';
import { CreateProductInput } from '../dto/create-product-input.dto';
import { UpdateProductInput } from '../dto/update-product-input.dto';
import { ProductOutput } from '../dto/product-output.dto';
import {
  BaseApiResponse,
  swaggerBaseApiResponse,
} from '../../shared/dtos/base-api-response.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/role.decorator';
import { ROLE } from '../../auth/constants/role.constant';

@Controller('products')
@ApiTags('products')
@UseInterceptors(ClassSerializerInterceptor)
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Get()
  @ApiOperation({
    summary: 'Get all products',
    description:
      'Retrieve a list of all available products. This endpoint is public and does not require authentication.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    type: swaggerBaseApiResponse([ProductOutput]),
    description: 'List of all products',
  })
  async findAll(): Promise<BaseApiResponse<ProductOutput[]>> {
    const products = await this.productService.findAll();
    return { data: products, meta: { total: products.length } };
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get product by ID',
    description:
      'Retrieve a specific product by its ID. This endpoint is public and does not require authentication.',
  })
  @ApiParam({
    name: 'id',
    description: 'Product ID',
    example: 5,
    type: Number,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    type: swaggerBaseApiResponse(ProductOutput),
    description: 'Product details',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Product not found',
  })
  async findOne(
    @Param('id') id: string,
  ): Promise<BaseApiResponse<ProductOutput>> {
    const product = await this.productService.findOne(+id);
    return { data: product, meta: {} };
  }

  @Post()
  @ApiOperation({
    summary: 'Create a new product',
    description:
      'Create a new product. This endpoint requires admin authentication.',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    type: swaggerBaseApiResponse(ProductOutput),
    description: 'Product created successfully',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid input data',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Authentication required',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Admin role required',
  })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLE.ADMIN)
  async create(
    @Body() input: CreateProductInput,
  ): Promise<BaseApiResponse<ProductOutput>> {
    const product = await this.productService.create(input);
    return { data: product, meta: {} };
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update a product',
    description:
      'Update an existing product. This endpoint requires admin authentication.',
  })
  @ApiParam({
    name: 'id',
    description: 'Product ID',
    example: 5,
    type: Number,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    type: swaggerBaseApiResponse(ProductOutput),
    description: 'Product updated successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Product not found',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid input data',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Authentication required',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Admin role required',
  })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLE.ADMIN)
  async update(
    @Param('id') id: string,
    @Body() input: UpdateProductInput,
  ): Promise<BaseApiResponse<ProductOutput>> {
    const product = await this.productService.update(+id, input);
    return { data: product, meta: {} };
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete a product',
    description:
      'Delete a product. This endpoint requires admin authentication.',
  })
  @ApiParam({
    name: 'id',
    description: 'Product ID',
    example: 5,
    type: Number,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Product deleted successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Product not found',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Authentication required',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Admin role required',
  })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLE.ADMIN)
  async delete(@Param('id') id: string): Promise<BaseApiResponse<null>> {
    await this.productService.delete(+id);
    return { data: null, meta: {} };
  }
}
