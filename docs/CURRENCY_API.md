# Currency Exchange Rates API

## Overview

This API provides endpoints to retrieve currency exchange rates and convert currency amounts using CAD as the base currency.

## Endpoints

### GET `/currency/exchange-rates`

Retrieves current exchange rates from CAD to other major currencies.

#### Query Parameters

- `baseCurrency` (optional, default: CAD): The base currency code (e.g., 'CAD', 'USD', 'EUR')

#### Response

```json
{
  "data": {
    "baseCurrency": "CAD",
    "rates": {
      "USD": 0.73,
      "EUR": 0.68,
      "GBP": 0.58,
      "JPY": 109.32,
      "AUD": 1.09,
      "NZD": 1.17,
      "CHF": 0.66,
      "CNY": 5.26,
      "INR": 60.88
    },
    "lastUpdated": "2024-01-15T10:30:00Z"
  }
}
```

#### Example Request

```bash
curl -X GET "http://localhost:3000/currency/exchange-rates?baseCurrency=CAD"
```

### GET `/currency/convert`

Converts an amount from one currency to another.

#### Query Parameters

- `amount` (required): The amount to convert
- `from` (required): Source currency code (e.g., 'CAD')
- `to` (required): Target currency code (e.g., 'USD')

#### Response

```json
{
  "data": {
    "originalAmount": 100,
    "fromCurrency": "CAD",
    "toCurrency": "USD",
    "convertedAmount": 73.5
  }
}
```

#### Example Request

```bash
curl -X GET "http://localhost:3000/currency/convert?amount=100&from=CAD&to=USD"
```

## Implementation Details

### Backend Services

1. **StripeService** (`src/shared/services/stripe.service.ts`)
   - `getExchangeRates()`: Retrieves exchange rates from Stripe API with fallback to hardcoded rates
   - `convertCurrency()`: Converts an amount between currencies

2. **CurrencyController** (`src/finance/controllers/currency.controller.ts`)
   - Provides REST API endpoints for currency operations
   - Includes error handling and logging

### Module Registration

The currency endpoints are registered in the `FinanceModule`:

- Location: `src/finance/finance.module.ts`
- Controller: `CurrencyController`

### Notes

- The API uses Stripe for exchange rate data
- If exchange rates cannot be retrieved, an error will be thrown
- The base currency is set to CAD by default as requested
- Exchange rates are real-time from Stripe's API

## Usage Examples

### Get all exchange rates (CAD base)

```bash
curl http://localhost:3000/currency/exchange-rates
```

### Get exchange rates for a different base currency

```bash
curl http://localhost:3000/currency/exchange-rates?baseCurrency=USD
```

### Convert currency

```bash
# Convert 100 CAD to USD
curl "http://localhost:3000/currency/convert?amount=100&from=CAD&to=USD"

# Convert 50 USD to CAD
curl "http://localhost:3000/currency/convert?amount=50&from=USD&to=CAD"
```

## Supported Currencies

- CAD (Canadian Dollar) - Base currency
- USD (US Dollar)
- EUR (Euro)
- GBP (British Pound)
- JPY (Japanese Yen)
- AUD (Australian Dollar)
- NZD (New Zealand Dollar)
- CHF (Swiss Franc)
- CNY (Chinese Yuan)
- INR (Indian Rupee)
