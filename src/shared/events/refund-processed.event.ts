/**
 * Event emitted when a refund has been successfully processed
 */
export class RefundProcessedEvent {
  constructor(
    public readonly refundId: number,
    public readonly orderId: number,
    public readonly customerId: number,
    public readonly refundNumber: string,
    public readonly amount: number,
    public readonly currency: string,
    public readonly reason: string,
    public readonly reasonDetails?: string,
    public readonly stripeRefundId?: string,
  ) {}
}
