# Stripe Checkout Redirect Configuration

## Overview

The Stripe checkout redirect URLs are automatically configured when creating checkout sessions. The system supports flexible configuration for different environments and use cases.

## Current Configuration

### Default Redirect URLs

- **Success URL**: `${FRONTEND_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}&order_id={ORDER_ID}`
- **Cancel URL**: `${FRONTEND_URL}/payment/cancel?order_id={ORDER_ID}`

### Environment Variables

Make sure to set the `FRONTEND_URL` environment variable:

```bash
# Development
FRONTEND_URL=http://localhost:3000

# Production
FRONTEND_URL=https://yourdomain.com
```

## URL Parameters

### Success URL Parameters

- `session_id`: Stripe checkout session ID (automatically provided by Stripe)
- `order_id`: Your internal order ID

### Cancel URL Parameters

- `order_id`: Your internal order ID

## Frontend Implementation Examples

### React/Next.js Success Page

```typescript
// pages/payment/success.tsx
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

export default function PaymentSuccess() {
  const router = useRouter();
  const { session_id, order_id } = router.query;
  const [order, setOrder] = useState(null);

  useEffect(() => {
    if (session_id && order_id) {
      // Verify payment with your backend
      fetch(`/api/orders/${order_id}/verify-payment?session_id=${session_id}`)
        .then(res => res.json())
        .then(data => setOrder(data));
    }
  }, [session_id, order_id]);

  return (
    <div>
      <h1>Payment Successful!</h1>
      <p>Order ID: {order_id}</p>
      <p>Session ID: {session_id}</p>
      {order && (
        <div>
          <p>Amount: ${order.amount}</p>
          <p>Status: {order.status}</p>
        </div>
      )}
    </div>
  );
}
```

### Cancel Page

```typescript
// pages/payment/cancel.tsx
import { useRouter } from 'next/router';

export default function PaymentCancel() {
  const router = useRouter();
  const { order_id } = router.query;

  return (
    <div>
      <h1>Payment Cancelled</h1>
      <p>Order ID: {order_id}</p>
      <button onClick={() => router.push('/checkout')}>
        Try Again
      </button>
    </div>
  );
}
```

## Customizing Redirect URLs

### Option 1: Environment-Based Configuration

You can modify the `generateRedirectUrls` method in `OrderService` to use different URLs based on environment:

```typescript
private generateRedirectUrls(orderId: number): RedirectUrls {
  const isProduction = process.env.NODE_ENV === 'production';

  const config: CheckoutRedirectConfig = {
    baseUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
    successPath: isProduction ? '/thank-you' : '/payment/success',
    cancelPath: isProduction ? '/checkout' : '/payment/cancel',
    includeOrderId: true,
    includeSessionId: true,
  };

  // ... rest of the method
}
```

### Option 2: Order Type-Based Configuration

```typescript
private generateRedirectUrls(orderId: number, orderType?: string): RedirectUrls {
  const config: CheckoutRedirectConfig = {
    baseUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
    successPath: orderType === 'subscription' ? '/subscription/success' : '/payment/success',
    cancelPath: orderType === 'subscription' ? '/subscription/cancel' : '/payment/cancel',
    includeOrderId: true,
    includeSessionId: true,
  };

  // ... rest of the method
}
```

## Backend Verification Endpoint

Create an endpoint to verify payments on your backend:

```typescript
// In your order controller
@Get(':id/verify-payment')
async verifyPayment(
  @Param('id') orderId: number,
  @Query('session_id') sessionId: string,
) {
  return await this.orderService.verifyPayment(orderId, sessionId);
}
```

## Testing Redirect URLs

### Local Development

1. Set `FRONTEND_URL=http://localhost:3000`
2. Create a test order
3. Complete payment on Stripe checkout
4. Verify redirect to `http://localhost:3000/payment/success?session_id=...&order_id=...`

### Production

1. Set `FRONTEND_URL=https://yourdomain.com`
2. Deploy your frontend with the success/cancel pages
3. Test the complete flow

## Security Considerations

1. **Always verify payments on the backend** - Don't trust frontend-only verification
2. **Use HTTPS in production** - Stripe requires HTTPS for production redirects
3. **Validate session IDs** - Verify the session ID with Stripe's API
4. **Handle edge cases** - What happens if user closes browser during payment?

## Common Issues

1. **CORS errors**: Make sure your frontend domain is configured in Stripe
2. **Invalid URLs**: Ensure URLs are properly encoded and valid
3. **Missing parameters**: Check that all required parameters are included
4. **Environment mismatch**: Verify environment variables are set correctly
