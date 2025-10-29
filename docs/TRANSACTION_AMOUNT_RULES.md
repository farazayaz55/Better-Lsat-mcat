# Payment Transaction Amount Rules

## Important: Amount Structure

### PaymentTransaction Entity

The `amount` field in `payment_transactions` table represents **subtotal only** (product price, excluding tax).

```typescript
{
  amount: 12500,        // Subtotal in CAD cents (NOT including tax)
  currency: 'CAD',
  metadata: {
    taxAmount: 1441,    // Tax from invoice (in CAD cents)
    invoiceSubtotal: 12500, // Subtotal from invoice (in CAD cents)
    totalAmountIncludingTax: 13941, // Total from invoice (in CAD cents)
    paidCurrency: 'INR',
    convertedToCad: true,
  }
}
```

### Amount Calculation

```
Total Payment = Transaction.amount + Transaction.metadata.taxAmount
13941 CAD = 12500 + 1441
```

### Relationship to Invoice

For the same order, the following MUST match:

```typescript
Invoice.subtotal = PaymentTransaction.amount;
Invoice.tax = PaymentTransaction.metadata.taxAmount;
Invoice.total =
  PaymentTransaction.amount + PaymentTransaction.metadata.taxAmount;
```

## Example

### Invoice (ID: 26)

- subtotal: 12500 CAD cents (125.00 CAD)
- tax: 1441 CAD cents (14.41 CAD)
- total: 13941 CAD cents (139.41 CAD)
- currency: CAD

### Payment Transaction

- amount: 12500 CAD cents (subtotal)
- currency: CAD
- metadata.taxAmount: 1441 (from invoice, in CAD)
- metadata.totalAmountIncludingTax: 13941 (from invoice, in CAD)
- metadata.invoiceSubtotal: 12500

✅ **They match perfectly!**

**Important**: All amounts in transaction metadata are from the **invoice** (already in CAD), not from Stripe session.

## Why This Structure?

1. **Matches invoice structure**: transaction.amount = invoice.subtotal
2. **Clear separation**: amount is product price, tax is in metadata
3. **Easy reconciliation**: Compare invoice and transaction line by line
4. **Accurate reporting**: Revenue is clear (amount), tax is separate

## Querying Transactions

```typescript
// Get transaction
const transaction = await paymentTransactionService.getTransactionById(id);

// Amounts
const subtotal = transaction.amount; // 12500
const tax = transaction.metadata?.taxAmount; // 1441
const total = subtotal + tax; // 13941
```

## Frontend Display

```typescript
function TransactionDisplay({ transaction }) {
  const subtotal = transaction.amount / 100;  // Convert from cents
  const tax = (transaction.metadata?.taxAmount || 0) / 100;
  const total = subtotal + tax;

  return (
    <div>
      <p>Subtotal: ${subtotal.toFixed(2)}</p>
      <p>Tax: ${tax.toFixed(2)}</p>
      <p>Total: ${total.toFixed(2)}</p>
    </div>
  );
}
```

## Database Query Example

```sql
-- Get transaction with calculated total
SELECT
  id,
  amount as subtotal,
  (metadata->>'taxAmount')::int as tax,
  amount + (metadata->>'taxAmount')::int as total,
  currency,
  metadata->>'paidCurrency' as original_currency
FROM payment_transactions
WHERE id = 24;
```

## Important Notes

1. **amount field** = Subtotal (product price only)
2. **metadata.taxAmount** = Tax (in CAD cents)
3. **Total payment** = amount + metadata.taxAmount
4. **All in CAD** for consistency
5. **metadata.paidCurrency** = Original payment currency for reference

This ensures clear financial records and easy reconciliation between invoices and transactions.
