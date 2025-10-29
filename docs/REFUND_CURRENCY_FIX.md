# Refund Currency Conversion Fix

## Problem

When creating a refund through `/refunds` endpoint, if you specify an amount in CAD but the original payment was in a different currency (e.g., INR), Stripe would refund the wrong amount.

### Example of the Problem

- Customer paid: 10000 CAD (equivalent to 625000 INR at the time)
- Admin creates refund: 100 CAD
- **What happened**: Stripe refunded 100 INR (very small amount!)
- **What should happen**: Stripe refunds equivalent to 100 CAD in INR

## Solution

The refund service now:

1. Retrieves the original payment currency from `order.stripe_meta.paidCurrency`
2. Converts the refund amount from CAD to the original payment currency
3. Sends the converted amount to Stripe
4. Stores both amounts in the refund `metadata` field

## Implementation

### 1. Get Original Payment Currency

```typescript
const originalPaymentCurrency =
  order.stripe_meta?.paidCurrency?.toUpperCase() ||
  order.stripe_meta?.currency?.toUpperCase() ||
  'CAD';
```

### 2. Convert Refund Amount

```typescript
if (originalPaymentCurrency !== 'CAD') {
  const rates = await this.stripeService.getExchangeRates(ctx, 'CAD');
  const conversionRate = rates.rates[originalPaymentCurrency];
  refundAmountForStripe = Math.round(refund.amount * conversionRate);
}
```

### 3. Send to Stripe

```typescript
const stripeRefund = await this.stripeService.createRefund(ctx, {
  paymentIntentId,
  amount: refundAmountForStripe, // Amount in original payment currency
  reason: stripeReason,
  metadata: {
    refundId: refund.id.toString(),
    refundNumber: refund.refundNumber,
    refundAmountInCad: refund.amount.toString(), // Original CAD amount
    refundAmountInPaymentCurrency: refundAmountForStripe.toString(),
    originalPaymentCurrency,
  },
});
```

### 4. Store Metadata

The refund entity now has a `metadata` field:

```typescript
{
  refundAmountInCad: 10000,  // Amount in CAD
  refundAmountInPaymentCurrency: 62500,  // Amount in original currency
  originalPaymentCurrency: 'INR',  // Original payment currency
}
```

## Example

### Scenario

1. Customer pays 125 CAD (equivalent to 7826 INR)
2. Admin creates refund for 100 CAD

### What Happens Now

```typescript
// System retrieves:
const originalPaymentCurrency = 'INR'; // From order.stripe_meta.paidCurrency
const refundAmountInCad = 10000; // 100 CAD in cents

// System converts:
const exchangeRate = 62.5; // CAD to INR
const refundAmountInInr = 10000 * 62.5 = 625000 cents (6250 INR)

// Stripe refunds:
amount: 625000 // 6250 INR (correct amount!)

// Database stores:
{
  amount: 10000,  // CAD amount (for internal records)
  currency: 'CAD',
  metadata: {
    refundAmountInCad: 10000,
    refundAmountInPaymentCurrency: 625000,
    originalPaymentCurrency: 'INR',
  }
}
```

## Database Changes

### New Field: `metadata` in `refunds` table

```sql
ALTER TABLE refunds ADD COLUMN metadata jsonb;
```

### Migration

File: `migrations/1761720000000-AddMetadataToRefunds.ts`

## Testing

### Test Case 1: Refund in Same Currency

```
Payment: 100 CAD
Refund: 50 CAD
Result: 50 CAD refunded ✅
```

### Test Case 2: Refund in Different Currency

```
Payment: 100 CAD (62500 INR at the time)
Refund: 50 CAD
Result: 31250 INR refunded ✅ (correct conversion)
```

### Test Case 3: Full Refund

```
Payment: 100 CAD (62500 INR)
Full refund: 100 CAD
Result: 62500 INR refunded ✅
```

## API Usage

### Create Refund (CAD Amount)

```typescript
POST /refunds
{
  "originalOrderId": 123,
  "customerId": 456,
  "amount": 10000,  // 100 CAD in cents (backend handles conversion)
  "currency": "CAD",  // Optional, defaults to CAD
  "reason": "customer_request",
  "reasonDetails": "Customer requested refund"
}
```

### Response

```typescript
{
  "id": 1,
  "refundNumber": "REF-20250127-0001",
  "amount": 10000,  // CAD amount for internal records
  "currency": "CAD",
  "metadata": {
    "refundAmountInCad": 10000,
    "refundAmountInPaymentCurrency": 625000,  // What was actually refunded
    "originalPaymentCurrency": "INR"
  },
  "stripeRefundId": "re_1234567890",
  "status": "completed"
}
```

## Notes

1. **Always specify amounts in CAD** - The system handles conversion
2. **Metadata tracks both amounts** - CAD (internal) and original currency (Stripe)
3. **Exchange rates are real-time** - Uses Stripe's current rates
4. **Original payment currency is preserved** - From `order.stripe_meta.paidCurrency`

## Important

- All internal records use **CAD**
- Stripe refunds use the **original payment currency**
- Conversion is automatic and transparent
- Both amounts are stored in `metadata` for auditing
