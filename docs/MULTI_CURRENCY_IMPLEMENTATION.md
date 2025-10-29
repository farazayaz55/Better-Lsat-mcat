# Multi-Currency Implementation Guide

## Summary

The system now supports multi-currency functionality where:

- Frontend passes currency (e.g., CAD) when creating an order
- Order stores the currency
- Checkout session uses the order's currency
- All downstream entities (invoices, refunds, payment transactions) inherit the currency

## Changes Made

### 1. Order Entity (`src/order/entities/order.entity.ts`)

Added currency field:

```typescript
@Column({ type: 'varchar', length: 3, default: 'USD' })
currency: string;
```

### 2. Order Input DTO (`src/order/dto/order-input.dto.ts`)

Already had currency field - no changes needed.

### 3. Payment Service (`src/order/services/payment.service.ts`)

Updated to use order's currency:

```typescript
// Use order's currency or fallback to provided currency or USD
const checkoutCurrency = (order.currency || currency || 'USD').toLowerCase();
```

### 4. Migration

Created migration `1761397300000-AddCurrencyToOrder.ts` to add currency column to orders table.

## Flow

### Order Creation Flow

1. **Frontend Request**:

   ```typescript
   POST /api/v1/order
   {
     items: [...],
     user: {...},
     currency: "CAD"  // Frontend passes currency
   }
   ```

2. **Backend** saves order with currency field

3. **Checkout Session Creation**:
   - Reads `order.currency` from database
   - Creates Stripe checkout session with that currency
   - Example: If order.currency = "CAD", creates session with `currency: "cad"`

4. **Ripple Effect**:
   - Invoice created: uses `order.currency`
   - Payment Transaction: uses `order.currency` (from Stripe metadata)
   - Refund created: inherits from original order's currency

## Frontend Integration

### Creating Order with Currency

```typescript
// Example order creation
const createOrder = async (items, user, selectedCurrency) => {
  const response = await fetch('/api/v1/order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      items,
      user,
      currency: selectedCurrency, // 'CAD', 'USD', etc.
    }),
  });

  const order = await response.json();
  return order;
};
```

### Example: Currency Switcher

```typescript
// In your frontend currency switcher
const handleCheckout = (selectedCurrency = 'CAD') => {
  // Create order with selected currency
  const order = await createOrder(items, user, selectedCurrency);

  // Create checkout session - backend uses order.currency
  const checkout = await createStripeCheckoutSession(order.id);

  // Redirect to Stripe
  window.location.href = checkout.url;
};
```

## Database Schema

### Order Table

```sql
ALTER TABLE "order"
ADD COLUMN "currency" varchar(3) NOT NULL DEFAULT 'USD';
```

### Currency Cascade

```
Order (currency: CAD)
  ↓
Stripe Checkout Session (currency: cad)
  ↓
Invoice (currency: CAD)
  ↓
Payment Transaction (currency: CAD)
  ↓
Refund (currency: CAD)
```

## Currency Field Locations

All entities with currency field:

1. `Order` - **NEW!** Stores selected currency from frontend
2. `Invoice` - Inherits from order
3. `Refund` - Inherits from original order
4. `PaymentTransaction` - From Stripe metadata

## Running the Migration

```bash
npm run migration:run
```

This will add the currency column to the orders table.

## Testing

### Test Order Creation

```bash
curl -X POST http://localhost:3000/api/v1/order \
  -H "Content-Type: application/json" \
  -d '{
    "items": [...],
    "user": {...},
    "currency": "CAD"
  }'
```

### Verify Currency Flow

1. Create order with `currency: "CAD"`
2. Check database: `SELECT currency FROM "order" WHERE id = <order_id>` → Should return "CAD"
3. Create checkout session → Stripe should show CAD
4. Check invoice currency → Should be CAD
5. Process payment → Transaction currency should be CAD
6. Create refund → Refund currency should be CAD

## Supported Currencies

- CAD (Canadian Dollar)
- USD (US Dollar) - Default
- EUR (Euro)
- GBP (British Pound)
- JPY (Japanese Yen)
- AUD (Australian Dollar)
- NZD (New Zealand Dollar)
- CHF (Swiss Franc)
- CNY (Chinese Yuan)
- INR (Indian Rupee)

Note: Any ISO 4217 currency code is supported if Stripe supports it.

## Migration Rollback

If you need to rollback:

```bash
npm run migration:revert
```

This will remove the currency column from the orders table.
