# Order Creation Currency Flow

## The Problem

When creating an order, prices stay at $125 regardless of the currency switcher because:

1. Products are stored in **CAD** in the database
2. Frontend displays them as **CAD** but doesn't convert for display
3. When user selects "PKR", it should show ₹25,300 instead of ₹125

## Current Flow (What happens now)

```
User sees: $125 CAD
User switches to PKR: Still shows $125 (WRONG)
Creates order: { items: [{ price: 125 }], currency: "PKR" } ❌
Backend: Creates order with price=125 in PKR (WRONG - should be 25,300)
```

## Correct Flow (What should happen)

```
User sees: $125 CAD
User switches to PKR: Shows ₹25,300 (CONVERTED) ✅
Creates order: { items: [{ price: 125 }], currency: "CAD" } ✅
Backend: Stores order with CAD prices ✅
Checkout: Backend converts CAD to user's selected currency ✅
```

## Frontend Fix for Order Creation

### Step 1: Display Converted Prices

```javascript
// In your order creation form
const [exchangeRates, setExchangeRates] = useState({});
const [selectedCurrency, setSelectedCurrency] = useState('CAD');

// Fetch rates on mount
useEffect(() => {
  fetch('/api/v1/currency/exchange-rates?baseCurrency=CAD')
    .then((res) => res.json())
    .then((data) => setExchangeRates(data.data.rates));
}, []);

// Convert price for display
const displayPrice = (priceInCAD) => {
  if (selectedCurrency === 'CAD') return priceInCAD;
  const rate = exchangeRates[selectedCurrency];
  return rate ? priceInCAD * rate : priceInCAD;
};

// Display products with CONVERTED prices
products.map((product) => (
  <div key={product.id}>
    <h3>{product.name}</h3>
    {/* Show CONVERTED price to user */}
    <p>{formatCurrency(displayPrice(product.price), selectedCurrency)}</p>
  </div>
));
```

### Step 2: Submit Order with Original CAD Prices

```javascript
// When submitting order, send CAD prices (NOT converted)
const handleOrderSubmit = async (products) => {
  const order = {
    items: products.map((product) => ({
      id: product.id,
      name: product.name,
      // IMPORTANT: Send ORIGINAL CAD price
      price: product.price, // Not converted!
      quantity: product.quantity,
    })),
    user: userInfo,
    // IMPORTANT: Set currency to CAD (original)
    currency: 'CAD', // Always CAD at order creation
  };

  // Submit to backend
  const response = await fetch('/api/v1/order', {
    method: 'POST',
    body: JSON.stringify(order),
  });
};

// Later, when creating checkout, pass the USER's selected currency
const createCheckout = async (orderId, userSelectedCurrency) => {
  const response = await fetch(`/api/v1/order/${orderId}/checkout`, {
    method: 'POST',
    body: JSON.stringify({ currency: userSelectedCurrency }), // e.g., "PKR"
  });
};
```

## Complete Example

```javascript
function OrderCreationPage() {
  const [products] = useState([
    { id: 1, name: 'Product A', price: 125 }, // 125 CAD
    { id: 2, name: 'Product B', price: 250 }, // 250 CAD
  ]);

  const [exchangeRates, setExchangeRates] = useState({});
  const [displayCurrency, setDisplayCurrency] = useState('CAD');
  const [cart, setCart] = useState([]);

  // Fetch rates
  useEffect(() => {
    fetch('/api/v1/currency/exchange-rates?baseCurrency=CAD')
      .then((res) => res.json())
      .then((data) => setExchangeRates(data.data.rates));
  }, []);

  // Display converted price
  const displayPrice = (priceInCAD) => {
    if (displayCurrency === 'CAD') return priceInCAD;
    const rate = exchangeRates[displayCurrency];
    return rate ? priceInCAD * rate : priceInCAD;
  };

  const addToCart = (product) => {
    // Add product with CAD price (NOT converted)
    setCart([
      ...cart,
      {
        ...product,
        price: product.price, // Original CAD price
      },
    ]);
  };

  const submitOrder = async () => {
    // Submit with CAD prices
    const order = {
      items: cart,
      currency: 'CAD', // Always CAD
      user: userInfo,
    };

    const response = await fetch('/api/v1/order', {
      method: 'POST',
      body: JSON.stringify(order),
    });

    const orderData = await response.json();

    // Now create checkout with user's display currency
    await createCheckout(orderData.id, displayCurrency);
  };

  return (
    <div>
      {/* Currency Switcher - only for DISPLAY */}
      <select
        value={displayCurrency}
        onChange={(e) => setDisplayCurrency(e.target.value)}
      >
        <option value="CAD">CAD</option>
        <option value="PKR">PKR</option>
        <option value="USD">USD</option>
      </select>

      {/* Products with CONVERTED prices for display */}
      {products.map((product) => (
        <div key={product.id}>
          <h3>{product.name}</h3>
          {/* User sees CONVERTED price */}
          <p>{formatCurrency(displayPrice(product.price), displayCurrency)}</p>
          {/* But cart adds ORIGINAL CAD price */}
          <button onClick={() => addToCart(product)}>Add to Cart</button>
        </div>
      ))}

      <button onClick={submitOrder}>Checkout</button>
    </div>
  );
}
```

## Key Points

1. **Display Currency** (what user sees): Converted prices
2. **Order Currency** (what gets stored): Always CAD
3. **Checkout Currency** (what Stripe charges): User's selected currency

## Summary

- ✅ Display: Show converted prices to user
- ✅ Store: Always CAD prices in order
- ✅ Checkout: Backend converts CAD → selected currency (already implemented)
