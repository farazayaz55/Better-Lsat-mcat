export enum TimePeriod {
  DAY = 'DAY',
  WEEK = 'WEEK',
  MONTH = 'MONTH',
  QUARTER = 'QUARTER',
  YEAR = 'YEAR',
}

export interface DateRange {
  startDate: Date;
  endDate: Date;
}

export class TimePeriodCalculator {
  static getDateRange(period: TimePeriod): DateRange {
    const now = new Date();
    const endDate = new Date(now);
    endDate.setHours(23, 59, 59, 999); // End of day

    let startDate: Date;

    switch (period) {
      case TimePeriod.DAY: {
        startDate = new Date(now);
        startDate.setHours(0, 0, 0, 0);
        break;
      }

      case TimePeriod.WEEK: {
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 7);
        startDate.setHours(0, 0, 0, 0);
        break;
      }

      case TimePeriod.MONTH: {
        startDate = new Date(now);
        startDate.setMonth(now.getMonth() - 1);
        startDate.setHours(0, 0, 0, 0);
        break;
      }

      case TimePeriod.QUARTER: {
        startDate = new Date(now);
        startDate.setMonth(now.getMonth() - 3);
        startDate.setHours(0, 0, 0, 0);
        break;
      }

      case TimePeriod.YEAR: {
        startDate = new Date(now);
        startDate.setFullYear(now.getFullYear() - 1);
        startDate.setHours(0, 0, 0, 0);
        break;
      }

      default:
        throw new Error(`Unsupported time period: ${period}`);
    }

    return { startDate, endDate };
  }

  /**
   * Get date range for a specific period ending on a given date
   * Useful for historical data analysis
   */
  static getDateRangeForPeriod(period: TimePeriod, endDate: Date): DateRange {
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    let startDate: Date;

    switch (period) {
      case TimePeriod.DAY: {
        startDate = new Date(end);
        startDate.setHours(0, 0, 0, 0);
        break;
      }

      case TimePeriod.WEEK: {
        startDate = new Date(end);
        startDate.setDate(end.getDate() - 7);
        startDate.setHours(0, 0, 0, 0);
        break;
      }

      case TimePeriod.MONTH: {
        startDate = new Date(end);
        startDate.setMonth(end.getMonth() - 1);
        startDate.setHours(0, 0, 0, 0);
        break;
      }

      case TimePeriod.QUARTER: {
        startDate = new Date(end);
        startDate.setMonth(end.getMonth() - 3);
        startDate.setHours(0, 0, 0, 0);
        break;
      }

      case TimePeriod.YEAR: {
        startDate = new Date(end);
        startDate.setFullYear(end.getFullYear() - 1);
        startDate.setHours(0, 0, 0, 0);
        break;
      }

      default:
        throw new Error(`Unsupported time period: ${period}`);
    }

    return { startDate, endDate: end };
  }
}
