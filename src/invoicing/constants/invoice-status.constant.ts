export enum InvoiceStatus {
  DRAFT = 'draft', // Created but not issued
  ISSUED = 'issued', // Sent to customer
  PAID = 'paid', // Payment received
  VOID = 'void', // Cancelled/Refunded
  OVERDUE = 'overdue', // Past due date (future feature)
}

export const INVOICE_STATUSES = Object.values(InvoiceStatus);
