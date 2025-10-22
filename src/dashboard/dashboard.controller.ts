import {
  Controller,
  Get,
  Query,
  UseGuards,
  UseInterceptors,
  ClassSerializerInterceptor,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { ROLE } from '../auth/constants/role.constant';
import { Roles } from '../auth/decorators/role.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import {
  BaseApiErrorResponse,
  BaseApiResponse,
  swaggerBaseApiResponse,
} from '../shared/dtos/base-api-response.dto';
import { AppLogger } from '../shared/logger/logger.service';
import { ReqContext } from '../shared/request-context/req-context.decorator';
import { RequestContext } from '../shared/request-context/request-context.dto';
import { DashboardQueryDto } from './dto/dashboard-query.dto';
import { DashboardOutputDto } from './dto/dashboard-output.dto';
import { DashboardService } from './dashboard.service';

@ApiTags('dashboard')
@Controller('dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
@UseInterceptors(ClassSerializerInterceptor)
export class DashboardController {
  constructor(
    private readonly dashboardService: DashboardService,
    private readonly logger: AppLogger,
  ) {
    this.logger.setContext(DashboardController.name);
  }

  @Get()
  @Roles(ROLE.ADMIN, ROLE.USER, ROLE.CUSTOMER)
  @ApiOperation({
    summary: 'Get dashboard data',
    description:
      'Retrieve aggregated dashboard metrics including top customers, revenue, and appointments data with optional toggles for each section.',
  })
  @ApiResponse({
    status: 200,
    description: 'Dashboard data retrieved successfully',
    type: swaggerBaseApiResponse(DashboardOutputDto),
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
    type: BaseApiErrorResponse,
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden',
    type: BaseApiErrorResponse,
  })
  @UseGuards(RolesGuard, JwtAuthGuard)
  @Roles(ROLE.ADMIN, ROLE.USER)
  async getDashboardData(
    @ReqContext() ctx: RequestContext,
    @Query() query: DashboardQueryDto,
  ): Promise<BaseApiResponse<DashboardOutputDto>> {
    this.logger.log(
      ctx,
      `${this.getDashboardData.name} was called with period: ${query.period}`,
    );

    const dashboardData = await this.dashboardService.getDashboardData(
      ctx,
      query,
    );

    return {
      data: dashboardData,
      meta: {},
    };
  }
}
