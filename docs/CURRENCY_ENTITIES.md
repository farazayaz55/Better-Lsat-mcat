# Entities with Currency Field

## Summary

The following entities have a `currency` field that stores currency codes (e.g., 'USD', 'CAD', 'EUR').

## Entities

### 1. **Refund** (`src/finance/entities/refund.entity.ts`)

```typescript
@Column({ type: 'varchar', length: 3, default: 'USD' })
currency: string;
```

- Table: `refunds`
- Default: `USD`
- Stores the currency of the refunded amount

### 2. **Invoice** (`src/invoicing/entities/invoice.entity.ts`)

```typescript
@Column({ type: 'varchar', length: 3, default: 'USD' })
currency: string;
```

- Table: `invoices`
- Default: `USD`
- Stores the currency of the invoice

### 3. **PaymentTransaction** (`src/finance/entities/payment-transaction.entity.ts`)

- Extends `BaseOrderRelatedEntity` which has currency
- Table: `payment_transactions`
- Default: `USD`
- Stores the currency of the payment transaction

## Base Classes

### BaseFinancialEntity (`src/shared/entities/base-financial.entity.ts`)

```typescript
@Column({
  type: 'varchar',
  length: FINANCIAL_CONSTANTS.CURRENCY_LENGTH, // 3
  default: FINANCIAL_CONSTANTS.DEFAULT_CURRENCY, // 'USD'
})
currency: string;
```

- All financial entities inherit from this base class
- Includes `currency` field by default
- Default currency is **USD**

### BaseOrderRelatedEntity

- Extends `BaseFinancialEntity`
- Automatically includes currency field

## Notes

- **All currencies are stored as 3-character ISO codes** (USD, CAD, EUR, etc.)
- **Default currency is USD** across all entities
- **Amounts are stored in cents** (integer values), so 10000 = $100.00
- The currency field determines the denomination of the amount

## Currency Data Type

```typescript
type: 'varchar'
length: 3
default: 'USD' // or as defined in FINANCIAL_CONSTANTS
```

## Current Usage

When displaying amounts in the frontend currency switcher, you need to:

1. **Get the stored currency** from the entity (Invoice, Refund, PaymentTransaction)
2. **Get the exchange rates** from `/api/v1/currency/exchange-rates`
3. **Convert if needed**:
   - If entity currency (e.g., `CAD`) ≠ selected currency (e.g., `USD`)
   - Use rate: `amountInSelectedCurrency = entityAmount * rates[selectedCurrency]`
4. **Display with symbol** for the selected currency

## Example Conversion Flow

```javascript
// Entity has: amount = 10000 (cents), currency = 'CAD'
// User selected: 'USD'
// Exchange rates: { USD: 0.73 } (from API)

// Step 1: Convert cents to currency units
const amountInCAD = entity.amount / 100; // 100.00 CAD

// Step 2: Get exchange rate
const rate = exchangeRates['USD']; // 0.73

// Step 3: Convert to selected currency
const amountInUSD = amountInCAD * rate; // 73.00 USD

// Step 4: Display
const displayAmount = `$${amountInUSD.toFixed(2)}`; // "$73.00"
```
