# Currency Switcher - Frontend Integration Guide

## API Endpoints

### 1. Get Exchange Rates

**GET** `/api/v1/currency/exchange-rates`

Returns all exchange rates with CAD as the base currency.

**Query Parameters:**

- `baseCurrency` (optional): Base currency code (default: CAD)

**Response:**

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
  },
  "meta": {}
}
```

**Example Request:**

```javascript
fetch('http://localhost:3000/api/v1/currency/exchange-rates?baseCurrency=CAD')
  .then((response) => response.json())
  .then((data) => {
    console.log('Exchange rates:', data.data.rates);
  });
```

### 2. Convert Currency

**GET** `/api/v1/currency/convert`

Converts an amount from one currency to another.

**Query Parameters:**

- `amount` (required): Amount to convert
- `from` (required): Source currency code (e.g., 'CAD')
- `to` (required): Target currency code (e.g., 'USD')

**Response:**

```json
{
  "data": {
    "originalAmount": 100,
    "fromCurrency": "CAD",
    "toCurrency": "USD",
    "convertedAmount": 73.5
  },
  "meta": {}
}
```

**Example Request:**

```javascript
fetch(
  'http://localhost:3000/api/v1/currency/convert?amount=100&from=CAD&to=USD',
)
  .then((response) => response.json())
  .then((data) => {
    console.log('Converted amount:', data.data.convertedAmount);
  });
```

## Frontend Implementation Examples

### React/Vue Example - Currency Switcher Component

```javascript
// CurrencySwitcher.jsx (React example)
import { useState, useEffect } from 'react';

const CurrencySwitcher = () => {
  const [selectedCurrency, setSelectedCurrency] = useState('CAD');
  const [exchangeRates, setExchangeRates] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch exchange rates on component mount
    fetch(
      'http://localhost:3000/api/v1/currency/exchange-rates?baseCurrency=CAD',
    )
      .then((response) => response.json())
      .then((data) => {
        setExchangeRates(data.data.rates);
        setLoading(false);
      })
      .catch((error) => {
        console.error('Failed to fetch exchange rates:', error);
        setLoading(false);
      });
  }, []);

  const handleCurrencyChange = (currency) => {
    setSelectedCurrency(currency);
    // Save to localStorage
    localStorage.setItem('selectedCurrency', currency);
  };

  const convertAmount = (amount) => {
    if (selectedCurrency === 'CAD') {
      return amount; // Already in CAD
    }
    const rate = exchangeRates[selectedCurrency];
    return rate ? (amount * rate).toFixed(2) : amount;
  };

  if (loading) return <div>Loading currency rates...</div>;

  return (
    <div className="currency-switcher">
      <select
        value={selectedCurrency}
        onChange={(e) => handleCurrencyChange(e.target.value)}
      >
        <option value="CAD">CAD $</option>
        <option value="USD">USD $</option>
        <option value="EUR">EUR €</option>
        <option value="GBP">GBP £</option>
      </select>
      {/* Display converted amounts */}
      <div>
        {selectedCurrency !== 'CAD' && (
          <p>
            1 CAD = {exchangeRates[selectedCurrency]} {selectedCurrency}
          </p>
        )}
      </div>
    </div>
  );
};

export default CurrencySwitcher;
```

### Using in Order/Invoice/Refund Lists

```javascript
// OrderList.jsx example
import CurrencySwitcher from './CurrencySwitcher';

const OrderList = ({ orders }) => {
  const [selectedCurrency, setSelectedCurrency] = useState(
    localStorage.getItem('selectedCurrency') || 'CAD',
  );
  const [exchangeRates, setExchangeRates] = useState({});

  useEffect(() => {
    // Fetch exchange rates
    fetch('http://localhost:3000/api/v1/currency/exchange-rates')
      .then((res) => res.json())
      .then((data) => setExchangeRates(data.data.rates));
  }, []);

  const formatCurrency = (amountInCents, baseCurrency = 'CAD') => {
    const amount = amountInCents / 100; // Convert from cents
    const rate =
      selectedCurrency === baseCurrency ? 1 : exchangeRates[selectedCurrency];
    const converted = rate ? amount * rate : amount;

    const currencySymbols = {
      CAD: '$',
      USD: '$',
      EUR: '€',
      GBP: '£',
      JPY: '¥',
    };

    return `${currencySymbols[selectedCurrency] || ''}${converted.toFixed(2)}`;
  };

  return (
    <div>
      <CurrencySwitcher />
      <table>
        <thead>
          <tr>
            <th>Order ID</th>
            <th>Amount</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <tr key={order.id}>
              <td>{order.id}</td>
              <td>{formatCurrency(order.total)}</td>
              <td>{order.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
```

### Cache Exchange Rates

```javascript
// useExchangeRates.js hook (React)
import { useState, useEffect } from 'react';

export const useExchangeRates = () => {
  const [rates, setRates] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchRates = async () => {
      try {
        // Check cache first
        const cached = localStorage.getItem('exchangeRates');
        const cachedTime = localStorage.getItem('exchangeRatesTime');

        // Use cache if less than 1 hour old
        if (cached && cachedTime && Date.now() - cachedTime < 3600000) {
          setRates(JSON.parse(cached));
          setLoading(false);
          return;
        }

        const response = await fetch(
          'http://localhost:3000/api/v1/currency/exchange-rates?baseCurrency=CAD',
        );
        const data = await response.json();

        setRates(data.data.rates);

        // Cache the rates
        localStorage.setItem('exchangeRates', JSON.stringify(data.data.rates));
        localStorage.setItem('exchangeRatesTime', Date.now().toString());
        setLoading(false);
      } catch (err) {
        setError(err.message);
        setLoading(false);
      }
    };

    fetchRates();
  }, []);

  return { rates, loading, error };
};
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

## Notes

1. **Caching**: Exchange rates are fetched from a public API and updated regularly. Consider caching them in your frontend for 1 hour to reduce API calls.

2. **Display Format**: Always show amounts in the selected currency with the appropriate symbol.

3. **Store Selection**: Save the user's currency preference in localStorage or user settings.

4. **Error Handling**: If the API fails, fall back to displaying amounts in the original currency (CAD).

5. **API Base URL**: Make sure to use the correct base URL (e.g., `http://localhost:3000` for development, your production URL for production).
