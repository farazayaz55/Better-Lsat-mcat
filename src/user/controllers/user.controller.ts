import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { plainToInstance } from 'class-transformer';
import { ROLE } from '../../auth/constants/role.constant';
import { Roles } from '../../auth/decorators/role.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { UserInput } from '../../order/interfaces/user.interface';
import {
  BaseApiErrorResponse,
  BaseApiResponse,
  swaggerBaseApiResponse,
} from '../../shared/dtos/base-api-response.dto';
import { BaseUserOutput } from '../../shared/dtos/base-user-output.dto';
import { PaginationParamsDto as PaginationParametersDto } from '../../shared/dtos/pagination-params.dto';
import { AppLogger } from '../../shared/logger/logger.service';
import { ReqContext } from '../../shared/request-context/req-context.decorator';
import { RequestContext } from '../../shared/request-context/request-context.dto';
import { GhlService } from '../../shared/services/Ghl.service';
import { UserOutput } from '../dtos/user-output.dto';
import { UpdateUserInput } from '../dtos/user-update-input.dto';
import { UserService } from '../services/user.service';

@ApiTags('users')
@Controller('users')
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly logger: AppLogger,
    private readonly ghlService: GhlService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {
    this.logger.setContext(UserController.name);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @UseInterceptors(ClassSerializerInterceptor)
  @Get('me')
  @ApiOperation({
    summary: 'Get user me API',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    type: swaggerBaseApiResponse(UserOutput),
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    type: BaseApiErrorResponse,
  })
  async getMyProfile(
    @ReqContext() ctx: RequestContext,
  ): Promise<BaseApiResponse<UserOutput>> {
    this.logger.log(ctx, `${this.getMyProfile.name} was called`);

    const user = await this.userService.getUserById(ctx, ctx.user!.id);
    return { data: user, meta: {} };
  }

  @Post('get-or-create-customer')
  @ApiOperation({
    summary: 'Get or create customer API',
    description:
      'Public endpoint to get existing customer by email or create a new one',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    type: swaggerBaseApiResponse(BaseUserOutput),
    description: 'Customer retrieved or created successfully',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    type: BaseApiErrorResponse,
  })
  @UseInterceptors(ClassSerializerInterceptor)
  async getOrCreateCustomer(
    @ReqContext() ctx: RequestContext,
    @Body() input: UserInput,
  ): Promise<BaseApiResponse<BaseUserOutput>> {
    this.logger.log(ctx, `${this.getOrCreateCustomer.name} was called`);

    const user = await this.userService.getOrCreateCustomer(ctx, input);

    // Transform User entity to UserOutput
    const userOutput = plainToInstance(BaseUserOutput, user, {
      excludeExtraneousValues: true,
    });

    return { data: userOutput, meta: {} };
  }

  @UseInterceptors(ClassSerializerInterceptor)
  @Get()
  @ApiOperation({
    summary: 'Get users as a list API',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    type: swaggerBaseApiResponse([UserOutput]),
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    type: BaseApiErrorResponse,
  })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLE.ADMIN, ROLE.USER)
  @ApiBearerAuth()
  async getUsers(
    @ReqContext() ctx: RequestContext,
    @Query() query: PaginationParametersDto,
  ): Promise<BaseApiResponse<UserOutput[]>> {
    this.logger.log(ctx, `${this.getUsers.name} was called`);

    const { users, count } = await this.userService.getUsers(
      ctx,
      query.limit,
      query.offset,
    );

    return { data: users, meta: { total: count } };
  }

  @UseInterceptors(ClassSerializerInterceptor)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLE.ADMIN, ROLE.USER)
  @ApiBearerAuth()
  @Get(':id')
  @ApiOperation({
    summary: 'Get user by id API',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    type: swaggerBaseApiResponse(UserOutput),
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    type: BaseApiErrorResponse,
  })
  async getUser(
    @ReqContext() ctx: RequestContext,
    @Param('id') id: number,
  ): Promise<BaseApiResponse<UserOutput>> {
    this.logger.log(ctx, `${this.getUser.name} was called`);

    const user = await this.userService.getUserById(ctx, id);
    return { data: user, meta: {} };
  }

  // RBAC: Admin can edit anyone, Users can edit customers, Customers can edit themselves
  @Patch(':id')
  @ApiOperation({
    summary: 'Update user API',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    type: swaggerBaseApiResponse(UserOutput),
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    type: BaseApiErrorResponse,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    type: BaseApiErrorResponse,
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    type: BaseApiErrorResponse,
  })
  @Roles(ROLE.ADMIN, ROLE.USER)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @UseInterceptors(ClassSerializerInterceptor)
  async updateUser(
    @ReqContext() ctx: RequestContext,
    @Param('id') userId: number,
    @Body() input: UpdateUserInput,
  ): Promise<BaseApiResponse<UserOutput>> {
    this.logger.log(ctx, `${this.updateUser.name} was called`);
    const user = await this.userService.updateUser(ctx, userId, input);
    return { data: user, meta: {} };
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete user API',
  })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'User deleted successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    type: BaseApiErrorResponse,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    type: BaseApiErrorResponse,
  })
  @Roles(ROLE.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteUser(
    @ReqContext() ctx: RequestContext,
    @Param('id') userId: number,
  ): Promise<void> {
    this.logger.log(ctx, `${this.deleteUser.name} was called`);

    // Use database transaction to ensure atomicity
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Step 2: Delete contact from GHL

      const user = await this.userService.getUserById(ctx, userId);
      if (user.roles.includes(ROLE.USER)) {
        // const ghlUserId = await this.userService.getGhlIdByUserId(ctx, userId);
        // this.logger.log(ctx, `Deleting contact from GHL ${ghlUserId}`);
        // if (ghlUserId) {
        //   await this.ghlService.deleteUser(ghlUserId);
        // }
      }

      // Step 1: Delete user from database
      this.logger.log(ctx, 'Deleting user from database');
      await this.userService.deleteUser(ctx, userId);

      // If we reach here, all operations succeeded
      await queryRunner.commitTransaction();
      this.logger.log(ctx, 'User deletion completed successfully');
    } catch (error) {
      // If any operation fails, rollback the transaction
      await queryRunner.rollbackTransaction();

      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      const errorMeta = error instanceof Error ? { stack: error.stack } : {};
      this.logger.error(
        ctx,
        `User deletion failed: ${errorMessage}`,
        errorMeta,
      );
      throw error;
    } finally {
      // Release the query runner
      await queryRunner.release();
    }
  }
}
