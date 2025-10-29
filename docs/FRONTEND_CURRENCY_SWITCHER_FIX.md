# Frontend Currency Switcher - Proper Implementation

## Common Issue

Many developers just change the currency symbol (e.g., `$` to `₹`) without actually converting the amount. This is **WRONG**.

## Correct Implementation

### Step 1: Fetch Exchange Rates

```javascript
// Fetch exchange rates when component mounts
const [exchangeRates, setExchangeRates] = useState({});
const [selectedCurrency, setSelectedCurrency] = useState('CAD');

useEffect(() => {
  const fetchRates = async () => {
    try {
      const response = await fetch(
        '/api/v1/currency/exchange-rates?baseCurrency=CAD',
      );
      const data = await response.json();
      setExchangeRates(data.data.rates);
    } catch (error) {
      console.error('Failed to fetch exchange rates:', error);
    }
  };

  fetchRates();
}, []);
```

### Step 2: Convert Amount Properly

```javascript
// WRONG - Just changing symbol
const convertAmount = (amount, currency) => {
  const symbols = { CAD: '$', PKR: '₹' };
  return `${symbols[currency]}${amount}`;
};

// CORRECT - Actually converting the amount
const convertAmount = (amount, fromCurrency, toCurrency, exchangeRates) => {
  // If same currency, return as is
  if (fromCurrency === toCurrency) {
    return amount;
  }

  // Get the exchange rate (e.g., 1 CAD = ? PKR)
  const rate = exchangeRates[toCurrency];

  if (!rate) {
    console.error(`Exchange rate not found for ${toCurrency}`);
    return amount; // Fallback to original
  }

  // Convert: amount * exchange rate
  const converted = amount * rate;

  return converted;
};
```

### Step 3: Display with Proper Formatting

```javascript
// Component showing how to use it
const CurrencyDisplay = ({ amount, baseCurrency = 'CAD' }) => {
  const [exchangeRates, setExchangeRates] = useState({});
  const [selectedCurrency, setSelectedCurrency] = useState('CAD');

  useEffect(() => {
    fetch('/api/v1/currency/exchange-rates?baseCurrency=CAD')
      .then((res) => res.json())
      .then((data) => setExchangeRates(data.data.rates));
  }, []);

  // Convert the amount
  const convertedAmount = convertAmount(
    amount,
    baseCurrency,
    selectedCurrency,
    exchangeRates,
  );

  // Format based on selected currency
  const formatCurrency = (amount, currency) => {
    const symbols = {
      CAD: { symbol: '$', decimal: 2 },
      PKR: { symbol: '₹', decimal: 0 }, // Pakistani Rupee typically shown without decimals
      USD: { symbol: '$', decimal: 2 },
      EUR: { symbol: '€', decimal: 2 },
      GBP: { symbol: '£', decimal: 2 },
    };

    const config = symbols[currency] || { symbol: '', decimal: 2 };
    const formatted = convertedAmount.toFixed(config.decimal);

    return `${config.symbol}${formatted}`;
  };

  return (
    <div>
      <select
        value={selectedCurrency}
        onChange={(e) => setSelectedCurrency(e.target.value)}
      >
        <option value="CAD">CAD</option>
        <option value="PKR">PKR</option>
        <option value="USD">USD</option>
        <option value="EUR">EUR</option>
      </select>

      <div>{formatCurrency(convertedAmount, selectedCurrency)}</div>
    </div>
  );
};
```

## Complete Working Example

### React Component

```javascript
import { useState, useEffect } from 'react';

function CurrencyConverter({ items }) {
  const [exchangeRates, setExchangeRates] = useState({});
  const [selectedCurrency, setSelectedCurrency] = useState('CAD');
  const [loading, setLoading] = useState(true);

  // Fetch exchange rates on mount
  useEffect(() => {
    fetch('/api/v1/currency/exchange-rates?baseCurrency=CAD')
      .then((response) => response.json())
      .then((data) => {
        setExchangeRates(data.data.rates);
        setLoading(false);
      })
      .catch((error) => {
        console.error('Failed to fetch rates:', error);
        setLoading(false);
      });
  }, []);

  // Convert amount from CAD to selected currency
  const convertAmount = (amountInCAD) => {
    if (selectedCurrency === 'CAD') return amountInCAD;
    const rate = exchangeRates[selectedCurrency];
    return rate ? amountInCAD * rate : amountInCAD;
  };

  // Format currency for display
  const formatCurrency = (amount) => {
    const rounded =
      selectedCurrency === 'PKR'
        ? Math.round(amount) // PKR usually has no decimals
        : amount.toFixed(2);

    const symbols = {
      CAD: '$',
      PKR: '₹',
      USD: '$',
      EUR: '€',
      GBP: '£',
    };

    return `${symbols[selectedCurrency]}${rounded}`;
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      {/* Currency Switcher */}
      <select
        value={selectedCurrency}
        onChange={(e) => setSelectedCurrency(e.target.value)}
        style={{ marginBottom: '20px' }}
      >
        <option value="CAD">CAD ($)</option>
        <option value="PKR">PKR (₹)</option>
        <option value="USD">USD ($)</option>
        <option value="EUR">EUR (€)</option>
        <option value="GBP">GBP (£)</option>
      </select>

      {/* Display items with converted amounts */}
      <div>
        {items.map((item) => (
          <div key={item.id}>
            <h3>{item.name}</h3>
            <p>Price: {formatCurrency(convertAmount(item.price))}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default CurrencyConverter;
```

## Testing the Conversion

```javascript
// Test conversion values
const testConversion = () => {
  const rates = {
    CAD: 1, // Base currency
    PKR: 220, // 1 CAD = 220 PKR (example)
    USD: 0.73, // 1 CAD = 0.73 USD
  };

  const amountInCAD = 100;

  // Convert to different currencies
  console.log('100 CAD =', amountInCAD * rates.PKR, 'PKR'); // 22000 PKR
  console.log('100 CAD =', amountInCAD * rates.USD, 'USD'); // 73 USD
};
```

## Key Points

1. **Always fetch rates** from `/api/v1/currency/exchange-rates`
2. **Multiply the amount** by the exchange rate
3. **Different currencies = different display** (PKR has no decimals, others have 2)
4. **Base currency is CAD** - convert FROM CAD to the selected currency

## Common Mistakes

❌ **WRONG**: Just changing symbol

```javascript
const display = `${symbols[currency]}${amount}`;
```

✅ **CORRECT**: Converting the amount

```javascript
const converted = amount * exchangeRates[currency];
const display = `${symbols[currency]}${converted}`;
```

## Integration with Existing Pages

For your home page, packages page, orders page, etc., you need to:

1. **Fetch rates** once when the page loads
2. **Store selected currency** in localStorage or context
3. **Convert ALL displayed amounts** using the conversion function
4. **Format properly** based on currency (PKR has no decimals)
