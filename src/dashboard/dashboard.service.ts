import { Injectable } from '@nestjs/common';
import { AppLogger } from '../shared/logger/logger.service';
import { RequestContext } from '../shared/request-context/request-context.dto';
import { OrderService } from '../order/services/order.service';
import { UserService } from '../user/services/user.service';
import { DashboardQueryDto } from './dto/dashboard-query.dto';
import {
  DashboardOutputDto,
  DashboardDataDto,
  DashboardMetaDto,
} from './dto/dashboard-output.dto';
import { TimePeriodCalculator } from './constants/time-period.constant';

@Injectable()
export class DashboardService {
  constructor(
    private readonly orderService: OrderService,
    private readonly userService: UserService,
    private readonly logger: AppLogger,
  ) {
    this.logger.setContext(DashboardService.name);
  }

  async getDashboardData(
    ctx: RequestContext,
    query: DashboardQueryDto,
  ): Promise<DashboardOutputDto> {
    this.logger.log(ctx, `Getting dashboard data for period: ${query.period}`);

    const dateRange = TimePeriodCalculator.getDateRange(query.period);
    const data: DashboardDataDto = {};

    // Get top customers if requested
    if (query.includeTopCustomers) {
      data.topCustomers = await this.orderService.getTopCustomers(
        ctx,
        dateRange,
        query.topCustomersLimit ?? 10,
      );
    }

    // Get revenue data if requested
    if (query.includeRevenue) {
      data.revenue = await this.orderService.getRevenueData(
        ctx,
        dateRange,
        query.period,
      );
    }

    // Get appointments data if requested
    if (query.includeAppointments) {
      data.appointments = await this.orderService.getAppointmentsData(
        ctx,
        dateRange,
        query.period,
      );
    }

    const meta: DashboardMetaDto = {
      period: query.period,
      startDate: dateRange.startDate.toISOString(),
      endDate: dateRange.endDate.toISOString(),
    };

    return { data, meta };
  }
}
