/**
 * Custom exceptions for financial operations
 */

export class FinancialProcessingError extends Error {
  constructor(
    message: string,
    public readonly entityId: number,
    public readonly entityType: string,
  ) {
    super(message);
    this.name = 'FinancialProcessingError';
  }
}

export class RefundProcessingError extends FinancialProcessingError {
  constructor(message: string, refundId: number) {
    super(message, refundId, 'Refund');
    this.name = 'RefundProcessingError';
  }
}

export class InvoiceGenerationError extends FinancialProcessingError {
  constructor(message: string, orderId: number) {
    super(message, orderId, 'Invoice');
    this.name = 'InvoiceGenerationError';
  }
}

export class PaymentTransactionError extends FinancialProcessingError {
  constructor(message: string, transactionId: number) {
    super(message, transactionId, 'PaymentTransaction');
    this.name = 'PaymentTransactionError';
  }
}

export class InsufficientFundsError extends Error {
  constructor(
    public readonly requestedAmount: number,
    public readonly availableAmount: number,
  ) {
    super(
      `Insufficient funds: requested ${requestedAmount}, available ${availableAmount}`,
    );
    this.name = 'InsufficientFundsError';
  }
}

export class InvalidAmountError extends Error {
  constructor(
    public readonly amount: number,
    public readonly minAmount: number,
    public readonly maxAmount?: number,
  ) {
    const maxMsg = maxAmount ? ` and max ${maxAmount}` : '';
    super(`Invalid amount: ${amount} must be between ${minAmount}${maxMsg}`);
    this.name = 'InvalidAmountError';
  }
}

export class DuplicateTransactionError extends Error {
  constructor(
    public readonly transactionId: string,
    public readonly entityType: string,
  ) {
    super(`Duplicate ${entityType} transaction: ${transactionId}`);
    this.name = 'DuplicateTransactionError';
  }
}
