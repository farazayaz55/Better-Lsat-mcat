// Import from shared constants
import {
  FinancialStatus,
  FinancialReason,
  TransactionType,
} from '../../shared/constants/financial.constant';

// Re-export for backward compatibility
export {
  FinancialStatus as RefundStatus,
  FinancialReason as RefundReason,
  TransactionType,
};

// Create arrays from the imported enums
export const REFUND_STATUSES = Object.values(FinancialStatus);
export const REFUND_REASONS = Object.values(FinancialReason);
export const TRANSACTION_TYPES = Object.values(TransactionType);
