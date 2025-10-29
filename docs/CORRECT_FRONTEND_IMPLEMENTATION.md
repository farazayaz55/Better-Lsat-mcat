# Correct Currency Display Implementation

## The Problem

You're displaying 125 CAD as "₹125" instead of converting it to "₹7,832" (125 × 62.66).

## The Solution

Convert **EVERY** price display using exchange rates.

## Complete Working Example

```javascript
import { useState, useEffect } from 'react';

function ProductList({ products }) {
  const [exchangeRates, setExchangeRates] = useState({});
  const [selectedCurrency, setSelectedCurrency] = useState('CAD');
  const [loading, setLoading] = useState(true);

  // Fetch exchange rates ONCE when page loads
  useEffect(() => {
    fetch('/api/v1/currency/exchange-rates?baseCurrency=CAD')
      .then((res) => res.json())
      .then((data) => {
        setExchangeRates(data.data.rates);
        setLoading(false);
      });
  }, []);

  // THIS IS THE KEY FUNCTION - Convert CAD to selected currency
  const convertPrice = (priceInCAD) => {
    // If CAD, no conversion needed
    if (selectedCurrency === 'CAD') {
      return priceInCAD;
    }

    // Get exchange rate for selected currency
    const rate = exchangeRates[selectedCurrency];

    if (!rate) {
      console.error(`No exchange rate for ${selectedCurrency}`);
      return priceInCAD;
    }

    // CONVERT: Multiply by rate
    const converted = priceInCAD * rate;

    return converted;
  };

  // Format for display
  const formatPrice = (price, currency) => {
    const symbols = {
      CAD: '$',
      USD: '$',
      INR: '₹',
      PKR: '₹',
      EUR: '€',
      GBP: '£',
    };

    const decimals = currency === 'PKR' || currency === 'INR' ? 0 : 2;
    const formatted = price.toFixed(decimals);

    return `${symbols[currency] || ''}${formatted}`;
  };

  if (loading) {
    return <div>Loading prices...</div>;
  }

  return (
    <div>
      {/* Currency Switcher */}
      <select
        value={selectedCurrency}
        onChange={(e) => setSelectedCurrency(e.target.value)}
      >
        <option value="CAD">CAD</option>
        <option value="USD">USD</option>
        <option value="INR">INR (Indian Rupee)</option>
        <option value="PKR">PKR (Pakistani Rupee)</option>
        <option value="EUR">EUR</option>
      </select>

      {/* Display Products */}
      {products.map((product) => {
        // THIS IS CRITICAL: Convert the price BEFORE displaying
        const convertedPrice = convertPrice(product.price);

        return (
          <div key={product.id}>
            <h3>{product.name}</h3>
            {/* Show CONVERTED price */}
            <p>{formatPrice(convertedPrice, selectedCurrency)}</p>
          </div>
        );
      })}
    </div>
  );
}

// Example usage:
// Products in database: [{ price: 125 }] (CAD)
// Display with INR: 125 × 62.66 = 7,832 INR → Shows "₹7,832"
// NOT "₹125" ❌

export default ProductList;
```

## Current vs. What You're Seeing

```javascript
// Current (WRONG):
const price = 125; // CAD from database
const symbol = '₹';
return `${symbol}${price}`; // Shows "₹125" ❌

// Correct:
const price = 125; // CAD from database
const rate = exchangeRates['INR']; // 62.66
const convertedPrice = price * rate; // 125 * 62.66 = 7,832
return `₹${convertedPrice}`; // Shows "₹7,832" ✅
```

## Quick Debug Checklist

1. ✅ Are you fetching exchange rates?

   ```javascript
   fetch('/api/v1/currency/exchange-rates?baseCurrency=CAD');
   ```

2. ✅ Are you multiplying by the rate?

   ```javascript
   convertedPrice = originalPrice * exchangeRates[currency];
   ```

3. ❌ Are you just changing the symbol?
   ```javascript
   // DON'T DO THIS
   return `${symbols[currency]}${originalPrice}`;
   ```

## Testing

```javascript
// Test with known values:
const priceInCAD = 125;
const inrRate = 62.66;

const inrPrice = priceInCAD * inrRate;
console.log(`₹${inrPrice}`); // Should show: "₹7832.5"

// NOT: "₹125"
```

## For Your Pages

Apply this pattern to:

- ✅ Home page product list
- ✅ Package selection page
- ✅ Order summary
- ✅ Invoice display
- ✅ Refund display

**Remember:** Convert BEFORE displaying, store CAD in database, convert again at checkout.
