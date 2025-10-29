# Payment Transaction Amount Fix

## Problem

Previously:

- PaymentTransaction.amount = Total amount (including tax)
- Invoice.subtotal = Amount without tax
- These didn't match! ❌

## Solution

Now:

- PaymentTransaction.amount = Invoice.subtotal (amount without tax) ✅
- PaymentTransaction.metadata.taxAmount = Tax amount from Stripe ✅
- They always match! ✅

## How It Works

### Updated Logic (`stripe-webhook-handler.service.ts`)

```typescript
// Get invoice to ensure amounts match exactly
let invoiceAmount = 0;
if (invoiceId) {
  const invoice = await this.invoiceService.getInvoiceById(ctx, invoiceId);
  if (invoice) {
    // Use invoice subtotal (amount without tax)
    invoiceAmount = invoice.subtotal;
  }
}

// Store in payment transaction
await this.paymentTransactionService.createPaymentTransaction(ctx, {
  amount: invoiceAmount, // Match invoice subtotal
  metadata: {
    taxAmount: session.total_details?.amount_tax,
    invoiceSubtotal: invoiceAmount,
    totalAmountIncludingTax: session.amount_total,
  },
});
```

## Database Structure

### Before Fix

```json
{
  "amount": 12522,
  "currency": "CAD",
  "metadata": {
    // No tax breakdown
  }
}
```

Problem: 12522 ≠ 12500 (invoice subtotal)

### After Fix

```json
{
  "amount": 12500,
  "currency": "CAD",
  "metadata": {
    "taxAmount": 90037, // Tax in original payment currency
    "invoiceSubtotal": 12500,
    "totalAmountIncludingTax": 13941
  }
}
```

✅ Perfect match!

## Verification

To verify correct amounts:

```sql
-- Invoice and Transaction should match
SELECT
  i.subtotal as invoice_subtotal,
  i.tax as invoice_tax,
  i.total as invoice_total,
  pt.amount as transaction_amount,
  pt.metadata->>'taxAmount' as transaction_tax_metadata,
  pt.metadata->>'invoiceSubtotal' as invoice_subtotal_metadata
FROM invoices i
LEFT JOIN payment_transactions pt ON i.id = pt."invoiceId"
WHERE i.id = <INVOICE_ID>;
```

Expected:

- transaction_amount = invoice_subtotal ✅
- transaction_tax_metadata exists ✅
- invoice_subtotal_metadata = invoice_subtotal ✅

## Transaction Amount Breakdown

| Field                                               | Value | Source                          | Notes                            |
| --------------------------------------------------- | ----- | ------------------------------- | -------------------------------- |
| PaymentTransaction.amount                           | 12500 | Invoice.subtotal                | Amount without tax               |
| Invoice.subtotal                                    | 12500 | Order items (CAD)               | Product price                    |
| Invoice.tax                                         | 1441  | Converted from payment currency | Tax in CAD                       |
| Invoice.total                                       | 13941 | subtotal + tax                  | Total in CAD                     |
| PaymentTransaction.metadata.taxAmount               | 90037 | Stripe                          | Tax in original payment currency |
| PaymentTransaction.metadata.totalAmountIncludingTax | 13941 | Stripe                          | Total in CAD                     |

## Important

The **amount field in payment_transactions** now represents the **subtotal only** (product price without tax). The tax is stored in metadata for reference.

This ensures:

- PaymentTransaction.amount = Invoice.subtotal ✅
- Easy reconciliation
- Accurate financial reporting
