# Stripe Integration Setup

This document explains how to set up Stripe integration for the Better LSAT MCAT application.

## Environment Variables

Add the following environment variables to your `.env` file:

```bash
# Stripe Secret Key (starts with sk_test_ for test mode, sk_live_ for live mode)
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key_here

# Stripe Webhook Secret (get this from Stripe Dashboard > Webhooks > Your webhook endpoint)
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here

# Frontend URL for success/cancel redirects
FRONTEND_URL=http://localhost:3000

# Optional: Stripe Publishable Key (for frontend integration)
STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key_here
```

## Stripe Dashboard Setup

1. **Create a Stripe Account**: Go to [stripe.com](https://stripe.com) and create an account
2. **Get API Keys**:
   - Go to Developers > API Keys
   - Copy your Secret Key and Publishable Key
3. **Set up Webhooks**:
   - Go to Developers > Webhooks
   - Click "Add endpoint"
   - Set URL to: `https://your-domain.com/webhooks/stripe`
   - Select events: `checkout.session.completed`, `payment_intent.succeeded`, `payment_intent.payment_failed`
   - Copy the webhook secret

## API Endpoints

### Order Creation with Stripe Checkout

- **POST** `/order` - Creates order and returns Stripe checkout session URL
- **POST** `/order/:id/stripe/checkout` - Creates Stripe checkout session for existing order
- **POST** `/order/:id/stripe/payment-intent` - Creates Stripe payment intent for existing order
- **POST** `/order/stripe/confirm-payment` - Confirms Stripe payment

### Webhook Endpoint

- **POST** `/webhooks/stripe` - Handles Stripe webhook events

## Integration Flow

1. **Order Creation**: When a user creates an order, the system now returns a Stripe checkout session URL instead of a WooCommerce URL
2. **Payment Processing**: Users are redirected to Stripe's secure checkout page
3. **Webhook Handling**: Stripe sends webhook events to confirm payment status
4. **Order Completion**: The system processes successful payments and updates order status

## Frontend Integration

The frontend should:

1. Call the order creation endpoint
2. Redirect users to the returned Stripe checkout URL
3. Handle success/cancel redirects
4. Optionally use Stripe Elements for custom payment forms

## Local Development Setup

### Option 1: Stripe CLI (Recommended)

1. **Install Stripe CLI:**

   ```bash
   # macOS
   brew install stripe/stripe-cli/stripe

   # Windows/Linux
   # Download from: https://github.com/stripe/stripe-cli/releases
   ```

2. **Login to Stripe:**

   ```bash
   stripe login
   ```

3. **Start webhook forwarding:**

   ```bash
   npm run stripe:dev
   # Or manually: stripe listen --forward-to localhost:3000/api/webhooks/stripe
   ```

4. **Update .env with webhook secret:**
   Copy the webhook signing secret from the CLI output and update your `.env` file:

   ```bash
   STRIPE_WEBHOOK_SECRET=whsec_1234567890abcdef...
   ```

5. **Test webhooks:**
   ```bash
   npm run stripe:test
   # Or manually: stripe trigger checkout.session.completed
   ```

### Option 2: ngrok

1. **Install ngrok:**

   ```bash
   brew install ngrok/ngrok/ngrok
   ```

2. **Create tunnel:**

   ```bash
   ngrok http 3000
   ```

3. **Configure webhook in Stripe Dashboard:**
   - URL: `https://your-ngrok-url.ngrok.io/api/webhooks/stripe`
   - Events: `checkout.session.completed`, `payment_intent.succeeded`, `payment_intent.payment_failed`

## Testing

Use Stripe's test mode with test card numbers:

- **Success**: 4242 4242 4242 4242
- **Decline**: 4000 0000 0000 0002
- **3D Secure**: 4000 0025 0000 3155

## Development Workflow

1. **Start your application:**

   ```bash
   npm run start:dev
   ```

2. **Start Stripe webhook forwarding (in another terminal):**

   ```bash
   npm run stripe:dev
   ```

3. **Test payments:**
   - Create an order via API
   - Use test card numbers
   - Check webhook logs in terminal
   - Verify order status updates

## Migration from WooCommerce

The system now uses Stripe directly instead of WooCommerce for payment processing. The WooCommerce integration is still available but not used in the main order flow.
