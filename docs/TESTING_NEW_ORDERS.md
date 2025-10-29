# Testing New Orders After CAD Fix

## What Was Fixed

### 1. **Stripe Metadata**

- `currency` field: Always set to **'cad'**
- `paidCurrency` field: Tracks what customer actually paid in (e.g., 'inr')
- This ensures system knows the payment currency for conversion

### 2. **Invoice Generation**

- Gets `paidCurrency` from stripe_meta
- Converts tax from payment currency to CAD
- Stores everything in **CAD**

### 3. **Payment Transactions**

- Gets payment currency from webhook session
- Converts amount to CAD using exchange rates
- Stores in **CAD with metadata** showing original currency

## How to Test

### Step 1: Create a Test Order

1. Go to frontend
2. Select a product
3. **Choose INR** as payment currency
4. Complete checkout

### Step 2: Verify Stripe Metadata

Check the order's `stripe_meta` field:

```json
{
  "currency": "cad",           // ✅ Should be 'cad'
  "paidCurrency": "inr",       // ✅ Should show what customer paid in
  "taxAmount": 90037,          // Amount in payment currency (INR cents)
  "checkoutSessionId": "...",
  ...
}
```

### Step 3: Verify Invoice

Invoice should show:

- **currency**: CAD ✅
- **subtotal**: Based on order items (already in CAD)
- **tax**: Converted from payment currency to CAD
- **total**: All in CAD

Example for 125 CAD item with INR payment:

```
subtotal: 12500 (125 CAD in cents)
tax: ~1500 (converted from INR tax to CAD)
currency: CAD
```

### Step 4: Verify Payment Transaction

Payment transaction should show:

- **amount**: Converted to CAD
- **currency**: CAD ✅
- **metadata**: Contains original payment details

## Expected Flow

```
Customer pays 125 CAD in INR (say 10,000 INR)
↓
Stripe processes 10,000 INR
↓
Webhook receives payment
↓
Stripe metadata: currency='cad', paidCurrency='inr'
↓
Invoice generated:
  - Items: 125.00 CAD (from order)
  - Tax: Converted to CAD
  - Total: All CAD
↓
Payment transaction:
  - Amount: Converted to CAD
  - Currency: CAD
  - Metadata: originalCurrency='inr', originalAmount=10000
```

## Common Issues

### Issue: Invoice still shows foreign currency

**Cause**: Old invoice created before fix
**Solution**: Delete and recreate, or create new test order

### Issue: Wrong amounts in invoice

**Cause**: Tax not being converted properly
**Check**: Look for conversion logs in webhook logs

### Issue: Currency is correct but amounts seem wrong

**Cause**: Exchange rate calculation issue
**Check**: Verify exchange rate API is working

## Debugging

### Check Webhook Logs

```bash
docker logs better_lsat_mcat-app-1 | grep -i "invoice\|payment\|converted"
```

Look for:

- `Converted tax from INR to CAD`
- `Converted payment from INR to CAD`
- `Building invoice for order`

### Check Database

```sql
-- Check invoice
SELECT id, invoiceNumber, currency, subtotal, tax, total
FROM invoices
WHERE orderId = <YOUR_ORDER_ID>;

-- Check payment transaction
SELECT id, amount, currency, metadata
FROM payment_transactions
WHERE orderId = <YOUR_ORDER_ID>;

-- Check order stripe_meta
SELECT id, stripe_meta
FROM order
WHERE id = <YOUR_ORDER_ID>;
```

## Success Criteria

✅ Order.stripe_meta.currency = 'cad'
✅ Order.stripe_meta.paidCurrency = actual payment currency (e.g., 'inr')
✅ Invoice.currency = 'CAD'
✅ Invoice amounts are reasonable (not 10000x)
✅ PaymentTransaction.currency = 'CAD'
✅ PaymentTransaction.amount is in CAD cents
✅ All amounts make sense for a 125 CAD product

## What to Look For

A 125 CAD product with INR payment should result in:

- Invoice subtotal: ~12500 cents (125 CAD)
- Invoice tax: ~1000-2000 cents (10-20 CAD depending on rate)
- Payment transaction: ~12500-14500 cents total

If you see:

- Subtotal: 782625 cents (7826 CAD) ❌ TOO HIGH
- Subtotal: 12500 cents (125 CAD) ✅ CORRECT
