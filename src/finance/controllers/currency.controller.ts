import {
  Controller,
  Get,
  Query,
  HttpStatus,
  UseInterceptors,
  ClassSerializerInterceptor,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { StripeService } from '../../shared/services/stripe.service';
import { AppLogger } from '../../shared/logger/logger.service';
import { RequestContext } from '../../shared/request-context/request-context.dto';
import { ReqContext } from '../../shared/request-context/req-context.decorator';
import { BaseApiResponse } from '../../shared/dtos/base-api-response.dto';

export interface ExchangeRatesResponse {
  baseCurrency: string;
  rates: Record<string, number>;
  lastUpdated: Date;
}

@ApiTags('Currency')
@Controller('currency')
@UseInterceptors(ClassSerializerInterceptor)
export class CurrencyController {
  constructor(
    private readonly stripeService: StripeService,
    private readonly logger: AppLogger,
  ) {
    this.logger.setContext(CurrencyController.name);
  }

  @Get('exchange-rates')
  @ApiOperation({
    summary: 'Get exchange rates from CAD to other currencies',
    description:
      'Retrieves current exchange rates from Stripe with CAD as the base currency',
  })
  @ApiBearerAuth()
  @ApiQuery({
    name: 'baseCurrency',
    required: false,
    description: 'Base currency code (default: CAD)',
    type: String,
    example: 'CAD',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Exchange rates retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        baseCurrency: {
          type: 'string',
          example: 'CAD',
        },
        rates: {
          type: 'object',
          example: {
            USD: 0.73,
            EUR: 0.68,
            GBP: 0.58,
          },
        },
        lastUpdated: {
          type: 'string',
          format: 'date-time',
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.SERVICE_UNAVAILABLE,
    description: 'Failed to retrieve exchange rates',
  })
  async getExchangeRates(
    @ReqContext() ctx: RequestContext,
    @Query('baseCurrency') baseCurrency: string = 'CAD',
  ): Promise<BaseApiResponse<ExchangeRatesResponse>> {
    this.logger.log(ctx, 'Getting exchange rates');

    try {
      const exchangeRates = await this.stripeService.getExchangeRates(
        ctx,
        baseCurrency,
      );

      // Extract the rates from the exchange rate object
      if (!exchangeRates) {
        throw new Error('No exchange rates available');
      }

      const rateData = exchangeRates;

      const response: ExchangeRatesResponse = {
        baseCurrency: rateData.source || baseCurrency,
        rates: rateData.rates || {},
        lastUpdated: new Date(rateData.effective_at * 1000),
      };

      this.logger.log(
        ctx,
        `Successfully retrieved exchange rates for ${rateData.source}`,
      );

      return { data: response, meta: {} };
    } catch (error) {
      this.logger.error(
        ctx,
        `Failed to get exchange rates: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
      throw error;
    }
  }

  @Get('convert')
  @ApiOperation({
    summary: 'Convert currency amount',
    description:
      'Converts an amount from one currency to another using Stripe exchange rates',
  })
  @ApiBearerAuth()
  @ApiQuery({
    name: 'amount',
    required: true,
    description: 'Amount to convert',
    type: Number,
    example: 100,
  })
  @ApiQuery({
    name: 'from',
    required: true,
    description: 'Source currency code',
    type: String,
    example: 'CAD',
  })
  @ApiQuery({
    name: 'to',
    required: true,
    description: 'Target currency code',
    type: String,
    example: 'USD',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Currency conversion successful',
    schema: {
      type: 'object',
      properties: {
        convertedAmount: {
          type: 'number',
          example: 73.5,
        },
        fromCurrency: {
          type: 'string',
          example: 'CAD',
        },
        toCurrency: {
          type: 'string',
          example: 'USD',
        },
        originalAmount: {
          type: 'number',
          example: 100,
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid parameters',
  })
  async convertCurrency(
    @ReqContext() ctx: RequestContext,
    @Query('amount') amount: number,
    @Query('from') from: string,
    @Query('to') to: string,
  ): Promise<BaseApiResponse<any>> {
    this.logger.log(ctx, `Converting ${amount} from ${from} to ${to}`);

    try {
      const convertedAmount = await this.stripeService.convertCurrency(
        ctx,
        amount,
        from,
        to,
      );

      const response = {
        originalAmount: amount,
        fromCurrency: from,
        toCurrency: to,
        convertedAmount,
      };

      this.logger.log(
        ctx,
        `Successfully converted ${amount} ${from} to ${convertedAmount} ${to}`,
      );

      return { data: response, meta: {} };
    } catch (error) {
      this.logger.error(
        ctx,
        `Failed to convert currency: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
      throw error;
    }
  }
}
