# CAD-Only Payment Fix Summary

## Problem Identified

Existing invoices/payments show incorrect currency (INR) and amounts because they were created **before** the CAD conversion logic was implemented.

## What's Fixed

### 1. New Invoices (Future)

✅ **Always stored in CAD**

- Items: Already in CAD from order
- Subtotal: Sum of items (in CAD cents)
- Tax: Converted from payment currency to CAD
- Total: All in CAD

### 2. Payment Transactions (Future)

✅ **Always stored in CAD**

- Amount: Converted from payment currency to CAD
- Currency: Always 'CAD'
- Metadata: Stores original payment currency/amount

### 3. Stripe Metadata

✅ **Currency now always 'cad'**

- Amounts in metadata are still in original payment currency
- But currency field is set to 'cad' to indicate intent
- Conversion happens when creating invoices/transactions

## Existing Data Issue

The invoice you showed (ID 24):

```
subtotal: 782625.00
tax: 90037.00
currency: INR
```

This was created BEFORE the CAD conversion logic, so it has:

- Wrong currency (INR instead of CAD)
- Wrong amounts (not converted to CAD)

## What Happens Now

### For NEW Payments:

1. User pays in INR (or any currency)
2. Webhook receives payment
3. Currency in stripe_meta is set to 'cad'
4. **Invoice created**: Items (CAD) + Tax converted to CAD = All CAD
5. **Payment transaction**: Amount converted to CAD = CAD

### For EXISTING Invoices:

You need to:

1. Delete/recreate OR
2. Update manually in database to CAD

## Testing

To verify new invoices work:

1. Create a new order
2. Pay in a foreign currency (e.g., INR)
3. Check invoice: should be in CAD
4. Check payment transaction: should be in CAD
5. Check stripe_meta currency: should be 'cad'

## Database Cleanup (Optional)

If you want to fix existing invoices:

```sql
-- Update existing invoices to CAD (BUT amounts are still wrong!)
UPDATE invoices
SET currency = 'CAD'
WHERE currency != 'CAD';

-- This only fixes the currency field, not the amounts
-- You'd need to recalculate amounts based on exchange rates at time of payment
```

**Better approach**: Recreate invoices for existing orders by calling the invoice generation endpoint.
