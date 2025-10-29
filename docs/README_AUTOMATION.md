# Automation System

A simple, code-based automation system similar to Go High Level where developers define automations in code and users can enable/disable them via API.

## 🎯 Features

- **4 Initial Automations:**
  1. Order Confirmation Email (immediate when order created)
  2. 24 Hour Reminder Email (1440 min delay after order paid)
  3. 3 Day Reminder SMS (4320 min delay after order paid)
  4. Slack New Order Notification (immediate when order created)

- **3 Communication Tools:**
  1. Email (Nodemailer SMTP - configured for SendGrid)
  2. SMS (Twilio - placeholder for now)
  3. Slack (Webhook integration - configured)

## 📋 API Endpoints

All endpoints require JWT authentication.

### Get All Automations

```
GET /api/v1/automation
```

Returns list of all automations with their current config.

Response:

```json
[
  {
    "key": "order-confirmation-email",
    "name": "Order Confirmation Email",
    "description": "Sends immediate confirmation email when order is created",
    "triggerEvent": "order.created",
    "toolType": "email",
    "isEnabled": false,
    "parameters": {
      "delayMinutes": 0,
      "ccRecipients": [],
      "template": "order-confirmation"
    }
  }
]
```

### Get Specific Automation

```
GET /api/v1/automation/:key
```

### Update Automation Config

```
PATCH /api/v1/automation/:key
```

Request body:

```json
{
  "isEnabled": true,
  "parameters": {
    "delayMinutes": 0,
    "ccRecipients": ["admin@example.com"],
    "template": "order-confirmation"
  }
}
```

**Example: Change Slack notification message**

```bash
# Customize the Slack message
curl -X PATCH http://localhost:3000/api/v1/automation/slack-new-order \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "parameters": {
      "channel": "#orders",
      "customMessage": "🚀 ALERT: New order #{{orderId}} from {{customerName}} worth ${{total}}!",
      "customBlockMessage": "*🔥 HOT ORDER #{{orderId}}*"
    }
  }'
```

**Available placeholders for Slack messages:**

- `{{orderId}}` - Order ID
- `{{customerName}}` - Customer name
- `{{customerEmail}}` - Customer email
- `{{total}}` - Order total
- `{{currency}}` - Currency code
- `{{itemCount}}` - Number of items

### Get Automation Logs

```
GET /api/v1/automation/:key/logs
```

Returns execution history for the automation.

## 🔧 Configuration

### Slack (Already Configured)

Your Slack webhook is configured:

```env
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
```

### Email (Needs SendGrid API Key)

Add to `.env`:

```env
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=apikey
SMTP_PASS=YOUR_SENDGRID_API_KEY_HERE
SMTP_FROM_NAME=Better LSAT MCAT
SMTP_FROM_EMAIL=noreply@yourdomain.com
```

## 🚀 How It Works

### Event Flow

1. **Order Created:**
   - `OrderService.create()` emits `order.created` event
   - AutomationExecutorService listens
   - Runs all automations with trigger `order.created` (if enabled)
   - Examples: Order confirmation email, Slack notification

2. **Order Paid:**
   - `StripeWebhookHandler.handleCheckoutSessionCompleted()` emits `order.paid` event
   - AutomationExecutorService listens
   - Runs all automations with trigger `order.paid` (if enabled)
   - Examples: 24h reminder email, 3-day reminder SMS

### Adding New Automation

1. Create class in `src/automation/automations/`:

```typescript
@Injectable()
export class MyNewAutomation extends BaseAutomation {
  readonly key = 'my-new-automation';
  readonly name = 'My New Automation';
  readonly description = 'Description here';
  readonly triggerEvent = TriggerEvent.ORDER_CREATED; // or ORDER_PAID
  readonly toolType = ToolType.EMAIL; // or SMS, SLACK
  readonly defaultParameters = {
    delayMinutes: 0,
  };

  async buildPayload(
    eventData: any,
    parameters: any,
  ): Promise<ToolPayload | null> {
    // Build and return payload
  }
}
```

2. Register in `AutomationRegistryService` constructor

3. Add to module providers

4. Seed config in database (via migration or admin API)

### Adding New Tool

1. Add to `ToolType` enum
2. Create class extending `BaseTool`
3. Implement `send()` and `isConfigured()` methods
4. Register in `ToolRegistryService`

### Adding New Trigger

1. Add to `TriggerEvent` enum
2. Add `@OnEvent()` handler in `AutomationExecutorService`
3. Emit event from appropriate service

## 📊 Database

Two tables:

- `automation_config` - Stores automation configurations
- `automation_log` - Stores execution history

## 🔐 Security

All automation endpoints are protected with JWT authentication.

## 📝 Notes

- Delayed automations use `setTimeout()` (for production, consider using Bull queue)
- SMS tool is a placeholder until Twilio is configured
- Email tool requires SendGrid API key
- Slack tool is ready to use
