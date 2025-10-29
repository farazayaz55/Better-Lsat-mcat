# Automation System - Swagger Documentation

## 📋 Available Tools (ToolType Enum)

The automation system supports the following communication tools:

| Tool         | Value      | Description                     | Status         |
| ------------ | ---------- | ------------------------------- | -------------- |
| **Email**    | `email`    | Send emails via SMTP (SendGrid) | ✅ Configured  |
| **SMS**      | `sms`      | Send SMS via Twilio             | ⏳ Placeholder |
| **Slack**    | `slack`    | Send messages to Slack channels | ✅ Configured  |
| **WhatsApp** | `whatsapp` | Send WhatsApp messages          | 🔜 Future      |

### How to Use in Swagger UI:

When you call the automation API, you'll see `toolType` with dropdown showing all available tools.

---

## 🎯 Available Trigger Events (TriggerEvent Enum)

The automation system can trigger on these events:

| Event                | Value              | Description                     | Status    |
| -------------------- | ------------------ | ------------------------------- | --------- |
| **Order Created**    | `order.created`    | When a new order is created     | ✅ Active |
| **Order Paid**       | `order.paid`       | When order payment is completed | ✅ Active |
| **Order Canceled**   | `order.canceled`   | When an order is canceled       | 🔜 Future |
| **Order Modified**   | `order.modified`   | When an order is modified       | 🔜 Future |
| **User Registered**  | `user.registered`  | When a new user registers       | 🔜 Future |
| **Payment Refunded** | `payment.refunded` | When a refund is processed      | 🔜 Future |
| **Task Created**     | `task.created`     | When a task is created          | 🔜 Future |
| **Task Completed**   | `task.completed`   | When a task is completed        | 🔜 Future |

### How to Use in Swagger UI:

When listing automations, you'll see `triggerEvent` with dropdown showing all available events.

---

## 💬 Slack Placeholders

When configuring Slack automations, you can use these placeholders in your `customMessage` and `customBlockMessage` parameters:

| Placeholder         | Description                    | Example Value      |
| ------------------- | ------------------------------ | ------------------ |
| `{{orderId}}`       | Order ID                       | `123`              |
| `{{customerName}}`  | Customer name                  | `John Doe`         |
| `{{customerEmail}}` | Customer email address         | `john@example.com` |
| `{{total}}`         | Order total amount             | `150`              |
| `{{currency}}`      | Currency code (CAD, USD, etc.) | `CAD`              |
| `{{itemCount}}`     | Number of items in the order   | `3`                |

### How to Use:

```bash
# Get all available placeholders
GET /api/v1/automation/placeholders/slack

# Response:
{
  "placeholders": [
    {
      "placeholder": "orderId",
      "description": "Order ID",
      "example": "123"
    },
    {
      "placeholder": "customerName",
      "description": "Customer name",
      "example": "John Doe"
    },
    // ... more placeholders
  ],
  "example": "Use {{orderId}} in your message template like: \"New order #{{orderId}} from {{customerName}}\""
}
```

### Usage in Custom Messages:

```json
{
  "parameters": {
    "customMessage": "🔥 HOT SALE: Order #{{orderId}} from {{customerName}} worth ${{total}}!"
  }
}
```

**Output:** `🔥 HOT SALE: Order #123 from John Doe worth $150!`

---

## 📊 API Endpoints

### 1. List All Automations

```
GET /api/v1/automation
```

**Response:** Returns all automations with their configurations, including:

- `key` - Unique identifier
- `name` - Display name
- `description` - What it does
- `triggerEvent` - Event enum (dropdown in Swagger)
- `toolType` - Tool enum (dropdown in Swagger)
- `isEnabled` - Current status
- `parameters` - Configuration parameters

### 2. Get Specific Automation

```
GET /api/v1/automation/:key
```

### 3. Update Automation Configuration

```
PATCH /api/v1/automation/:key
```

**Request Body:**

```json
{
  "isEnabled": true,
  "parameters": {
    "delayMinutes": 0,
    "channel": "#orders",
    "customMessage": "🎉 New order #{{orderId}} from {{customerName}} - ${{total}}",
    "customBlockMessage": "New Order #{{orderId}}"
  }
}
```

### 4. Get Execution Logs

```
GET /api/v1/automation/:key/logs
```

Returns execution history for the automation.

### 5. Get Slack Placeholders

```
GET /api/v1/automation/placeholders/slack
```

Returns list of available placeholders with descriptions and examples.

---

## 🎨 Example: Update Slack Notification

```bash
curl -X PATCH http://localhost:3000/api/v1/automation/slack-new-order \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "isEnabled": true,
    "parameters": {
      "channel": "#alerts",
      "customMessage": "🚀 ALERT: Order #{{orderId}} from {{customerName}} - ${{total}}!",
      "customBlockMessage": "*🔥 BIG ORDER #{{orderId}}*"
    }
  }'
```

---

## 📚 Swagger UI Features

### 1. **Enum Dropdowns**

- When you see `toolType` or `triggerEvent` in Swagger UI, you'll get dropdown menus
- Click to see all available options
- Swagger validates your selection

### 2. **Placeholder Information**

- The `parameters` field includes descriptions showing available placeholders
- Call `GET /automation/placeholders/slack` for full documentation

### 3. **Request/Response Examples**

- Each endpoint has example request/response bodies
- Copy-paste ready examples

### 4. **JWT Authentication**

- All endpoints require JWT Bearer token
- Add `Authorization: Bearer YOUR_TOKEN` header

---

## 🔧 Accessing Swagger UI

Navigate to: `http://localhost:3000/api-docs`

Look for the **"automation"** tag to see all automation endpoints.

---

## 💡 Quick Reference

**Enable automation:**

```json
{ "isEnabled": true }
```

**Disable automation:**

```json
{ "isEnabled": false }
```

**Customize Slack message:**

```json
{
  "parameters": {
    "customMessage": "Your template with {{placeholders}}"
  }
}
```

**Change Slack channel:**

```json
{
  "parameters": {
    "channel": "#your-channel"
  }
}
```
