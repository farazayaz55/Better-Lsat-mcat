# CAD-Only Payment Storage

## Overview

This system now stores **ALL payment amounts in CAD** regardless of the currency the customer pays in. This ensures:

✅ **Consistent financial records** - All amounts in one base currency (CAD)
✅ **Simplified accounting** - No need to track multiple currencies in books
✅ **Easy reporting** - All analytics and reports work with single currency

## How It Works

### Customer Experience

1. Customer selects their preferred currency (USD, INR, PKR, etc.) on frontend
2. Stripe checkout shows prices in that currency
3. Customer pays in their currency
4. **Behind the scenes**: All amounts are converted to CAD and stored

### Database Storage

All amounts are stored in **CAD cents**:

| Entity               | Amount | Currency | Notes                                         |
| -------------------- | ------ | -------- | --------------------------------------------- |
| Orders               | CAD    | CAD      | Items already in CAD                          |
| Invoices             | CAD    | CAD      | Automatically converted from payment currency |
| Payment Transactions | CAD    | CAD      | Converted when webhook processes payment      |

## Implementation Details

### 1. Invoice Generation (`InvoiceGeneratorService`)

```typescript
// ALWAYS use CAD for invoice currency
const invoiceCurrency = FINANCIAL_CONSTANTS.DEFAULT_CURRENCY; // CAD

// Items are already in CAD from order
const items = order.items.map((item) => ({
  // Prices already in CAD, convert to cents
  unitPrice: Math.round((item.price || 0) * 100),
  totalPrice: Math.round((item.price || 0) * (item.quantity || 1) * 100),
}));

// Convert tax from payment currency to CAD if needed
if (checkoutCurrency !== 'CAD') {
  const rates = await this.stripeService.getExchangeRates(
    ctx,
    checkoutCurrency,
  );
  const cadRate = rates.rates['CAD'];
  tax = taxInCheckoutCurrency * cadRate;
}
```

### 2. Payment Transaction Creation (`StripeWebhookHandlerService`)

```typescript
// Get currency user paid in
const paidCurrency = session.currency?.toUpperCase() || 'CAD';

// Convert to CAD if needed
let cadAmount = totalAmount;
if (paidCurrency !== 'CAD') {
  const rates = await this.stripeService.getExchangeRates(ctx, paidCurrency);
  const cadRate = rates.rates['CAD'];
  cadAmount = Math.round(totalAmount * cadRate);
}

// Store in CAD
await this.paymentTransactionService.createPaymentTransaction(ctx, {
  amount: cadAmount,
  currency: 'CAD', // Always CAD
  metadata: {
    originalCurrency: paidCurrency, // Track what user paid in
    originalAmount: totalAmount,
    convertedToCad: true,
  },
});
```

### 3. Analytics Service

```typescript
// Simplified - no conversion needed
for (const invoice of filteredInvoices) {
  // All invoices are always in CAD
  const taxInCad = Number(invoice.tax) / 100;
  totalTaxCollected += taxInCad;
  // No conversion needed
}
```

## Conversion Logic

### Exchange Rate Source

Uses `exchangerate-api.com` (free, real-time rates)

### Conversion Formula

```
CAD Amount = Foreign Currency Amount × Exchange Rate to CAD
```

Example:

- Customer pays 1000 PKR
- Exchange rate: 1 PKR = 0.01 CAD
- Stored: 1000 × 0.01 = 10 CAD (1000 cents)

## Metadata Tracking

While we store everything in CAD, we track the original payment details:

```typescript
metadata: {
  originalCurrency: 'PKR', // What customer paid in
  originalAmount: 1000, // Original payment amount
  convertedToCad: true, // Conversion flag
}
```

This allows you to:

- See what currency customer paid in
- Recalculate amounts if needed
- Audit conversions

## Example Flow

### Customer pays in PKR

1. **Frontend**: User selects PKR, sees 1000 PKR
2. **Checkout**: Stripe processes 1000 PKR payment
3. **Webhook**: Receives payment in PKR
   ```typescript
   paidCurrency = 'PKR'
   originalAmount = 1000 PKR
   ```
4. **Conversion**:
   ```typescript
   cadRate = 0.01 // 1 PKR = 0.01 CAD
   cadAmount = 1000 × 0.01 = 10 CAD (1000 cents)
   ```
5. **Invoice**: Stored with 1000 cents CAD
6. **Payment Transaction**: Stored with 1000 cents CAD
7. **Analytics**: All reports show CAD amounts

## Benefits

### 1. Simplified Accounting

- All revenue in one currency
- No multi-currency ledger entries
- Easier financial reporting

### 2. Accurate Financial Records

- Amounts reflect actual CAD value at time of payment
- Historical data remains accurate
- No currency fluctuation in your books

### 3. Easy Reporting

- Revenue reports: Sum of all amounts (already in CAD)
- Tax reporting: Simple totals
- Dashboard: No conversion needed

### 4. Regulatory Compliance

- Tax calculations: All in CAD
- GST/HST: Based on CAD amounts
- Financial statements: Single currency

## Important Notes

### 1. Customer-Facing Display

- **Frontend should still show original currency** if needed
- Use the `originalCurrency` and `originalAmount` from metadata
- For transparency, you can show "Paid 1000 PKR (10 CAD)"

### 2. Reconciliation

- Stripe statements will show foreign currency
- Your database has CAD amounts
- Use metadata to reconcile

### 3. Exchange Rate Fluctuations

- Rates change daily
- Conversions happen at payment time
- Historical payments retain their conversion rate

## Testing

### Test Scenarios

1. **CAD payment**: No conversion, direct storage
2. **USD payment**: Convert USD to CAD, store in CAD
3. **PKR payment**: Convert PKR to CAD, store in CAD
4. **Multiple currencies**: Each converted individually to CAD

### Verification

Check database:

```sql
SELECT
  id,
  amount,
  currency,
  metadata->>'originalCurrency' as paid_in,
  metadata->>'originalAmount' as original_amount
FROM payment_transactions;
```

All `currency` should be `CAD`, but `originalCurrency` shows what was paid.

## Summary

✅ **Customers**: Pay in their preferred currency  
✅ **Database**: Everything stored in CAD  
✅ **Accounting**: Simplified single-currency system  
✅ **Tracking**: Original payment details preserved in metadata  
✅ **Reporting**: All amounts in CAD
