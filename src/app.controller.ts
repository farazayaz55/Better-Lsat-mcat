import { Controller, Get, Post, Body, Headers, HttpCode, HttpStatus } from '@nestjs/common';

import { AppService } from './app.service';
import { AppLogger } from './shared/logger/logger.service';
import { ReqContext } from './shared/request-context/req-context.decorator';
import { RequestContext } from './shared/request-context/request-context.dto';

@Controller()
export class AppController {
  constructor(
    private readonly logger: AppLogger,
    private readonly appService: AppService,
  ) {
    this.logger.setContext(AppController.name);
  }

  @Get()
  getHello(@ReqContext() ctx: RequestContext): string {
    this.logger.log(ctx, 'Hello world from App controller');

    return this.appService.getHello(ctx);
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  catchAllPost(
    @ReqContext() ctx: RequestContext,
    @Body() body: any,
    @Headers() headers: any,
  ) {
    this.logger.log(ctx, '=== ROOT LEVEL POST ROUTE HIT ===');
    this.logger.log(ctx, `Body: ${JSON.stringify(body)}`);
    this.logger.log(ctx, `Headers: ${JSON.stringify(headers)}`);
    this.logger.log(ctx, `Stripe-Signature: ${headers['stripe-signature'] || 'Missing'}`);
    this.logger.log(ctx, 'WEBHOOK URL MISCONFIGURED - Should be: /api/v1/webhooks/stripe');
    
    return {
      error: 'Webhook URL misconfigured',
      message: 'Stripe webhook should be sent to: /api/v1/webhooks/stripe',
      received: true,
      body,
      headers: Object.keys(headers),
    };
  }
}
