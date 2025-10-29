import { Test, TestingModule } from '@nestjs/testing';
import { RefundStripeProcessor } from './refund-stripe-processor.service';
import { StripeService } from '../../../shared/services/stripe.service';
import { OrderService } from '../../../order/services/order.service';
import { PaymentService } from '../../../order/services/payment.service';
import { AppLogger } from '../../../shared/logger/logger.service';
import { RequestContext } from '../../../shared/request-context/request-context.dto';
import { Order } from '../../../order/entities/order.entity';
import { RefundReason } from '../../constants/finance.constant';

describe('RefundStripeProcessor', () => {
  let processor: RefundStripeProcessor;
  let stripeService: jest.Mocked<StripeService>;
  let orderService: jest.Mocked<OrderService>;
  let paymentService: jest.Mocked<PaymentService>;
  let logger: jest.Mocked<AppLogger>;

  const mockOrder: Partial<Order> = {
    id: 1,
    stripe_meta: {
      paymentIntentId: 'pi_test123',
      paidCurrency: 'USD',
    },
  };

  beforeEach(async () => {
    stripeService = {
      retrieveCheckoutSession: jest.fn(),
      createRefund: jest.fn(),
      getExchangeRates: jest.fn(),
    } as any;

    orderService = {
      findOne: jest.fn(),
    } as any;

    paymentService = {
      updateStripeMeta: jest.fn(),
    } as any;

    logger = {
      setContext: jest.fn(),
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RefundStripeProcessor,
        { provide: StripeService, useValue: stripeService },
        { provide: OrderService, useValue: orderService },
        { provide: PaymentService, useValue: paymentService },
        { provide: AppLogger, useValue: logger },
      ],
    }).compile();

    processor = module.get<RefundStripeProcessor>(RefundStripeProcessor);
  });

  it('should be defined', () => {
    expect(processor).toBeDefined();
  });

  describe('findPaymentIntent', () => {
    it('should return payment intent ID from order metadata', async () => {
      const ctx = {} as RequestContext;
      const paymentIntentId = await processor.findPaymentIntent(
        ctx,
        mockOrder as Order,
      );
      expect(paymentIntentId).toBe('pi_test123');
    });

    it('should retrieve payment intent from checkout session if not in metadata', async () => {
      const orderWithoutPaymentIntent: Partial<Order> = {
        id: 1,
        stripe_meta: {
          checkoutSessionId: 'cs_test123',
        },
      };

      stripeService.retrieveCheckoutSession.mockResolvedValue({
        payment_intent: 'pi_retrieved123',
      } as any);

      const ctx = {} as RequestContext;
      const paymentIntentId = await processor.findPaymentIntent(
        ctx,
        orderWithoutPaymentIntent as Order,
      );

      expect(paymentIntentId).toBe('pi_retrieved123');
      expect(stripeService.retrieveCheckoutSession).toHaveBeenCalledWith(
        ctx,
        'cs_test123',
      );
    });
  });

  describe('mapRefundReasonToStripe', () => {
    it('should map RefundReason.DUPLICATE to duplicate', () => {
      const result = processor.mapRefundReasonToStripe(RefundReason.DUPLICATE);
      expect(result).toBe('duplicate');
    });

    it('should map RefundReason.FRAUDULENT to fraudulent', () => {
      const result = processor.mapRefundReasonToStripe(RefundReason.FRAUDULENT);
      expect(result).toBe('fraudulent');
    });

    it('should map RefundReason.CUSTOMER_REQUEST to requested_by_customer', () => {
      const result = processor.mapRefundReasonToStripe(
        RefundReason.CUSTOMER_REQUEST,
      );
      expect(result).toBe('requested_by_customer');
    });
  });
});
