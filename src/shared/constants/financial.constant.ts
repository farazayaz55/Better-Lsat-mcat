/**
 * Shared financial constants for invoicing, refunds, and payment transactions
 */
export const FINANCIAL_CONSTANTS = {
  DEFAULT_CURRENCY: 'CAD',
  DEFAULT_DUE_DAYS: 7,
  AMOUNT_PRECISION: 2, // cents
  MAX_REFUND_AMOUNT: 1000000, // $10,000 in cents
  MIN_AMOUNT: 1, // minimum 1 cent
  CURRENCY_LENGTH: 3, // ISO currency code length
  NUMBER_PREFIXES: {
    INVOICE: 'INV',
    REFUND: 'REF',
    TRANSACTION: 'TRN',
  },
} as const;

/**
 * Common financial statuses
 */
export enum FinancialStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

/**
 * Common financial reasons
 */
export enum FinancialReason {
  CUSTOMER_REQUEST = 'customer_request',
  DUPLICATE = 'duplicate',
  FRAUDULENT = 'fraudulent',
  OTHER = 'other',
}

/**
 * Transaction types
 */
export enum TransactionType {
  PAYMENT = 'payment',
  REFUND = 'refund',
  CHARGEBACK = 'chargeback',
  ADJUSTMENT = 'adjustment',
}
