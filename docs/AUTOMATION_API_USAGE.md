# Automation API Usage Guide

## 🔧 Enable/Disable Automations

### Enable Slack Notification

```bash
curl -X PATCH http://localhost:3000/api/v1/automation/slack-new-order \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"isEnabled": true}'
```

### Disable Slack Notification

```bash
curl -X PATCH http://localhost:3000/api/v1/automation/slack-new-order \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"isEnabled": false}'
```

---

## ✏️ Customize Slack Message

### Change the Message Text

```bash
curl -X PATCH http://localhost:3000/api/v1/automation/slack-new-order \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "parameters": {
      "customMessage": "🚀 NEW ORDER ALERT: #{{orderId}} from {{customerName}} worth ${{total}}!"
    }
  }'
```

### Change the Block Title (Rich Formatting)

```bash
curl -X PATCH http://localhost:3000/api/v1/automation/slack-new-order \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "parameters": {
      "customBlockMessage": "*🔥 HOT ORDER #{{orderId}}*"
    }
  }'
```

### Change Slack Channel

```bash
curl -X PATCH http://localhost:3000/api/v1/automation/slack-new-order \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "parameters": {
      "channel": "#alerts"
    }
  }'
```

### Change All Parameters at Once

```bash
curl -X PATCH http://localhost:3000/api/v1/automation/slack-new-order \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "parameters": {
      "delayMinutes": 0,
      "channel": "#orders",
      "customMessage": "📦 New order #{{orderId}} from {{customerName}} - ${{total}}",
      "customBlockMessage": "📦 Order #{{orderId}}"
    }
  }'
```

---

## 📋 Available Placeholders

Use these in your custom messages:

| Placeholder         | Description     | Example          |
| ------------------- | --------------- | ---------------- |
| `{{orderId}}`       | Order ID        | 123              |
| `{{customerName}}`  | Customer name   | John Doe         |
| `{{customerEmail}}` | Customer email  | john@example.com |
| `{{total}}`         | Order total     | 150              |
| `{{currency}}`      | Currency code   | CAD              |
| `{{itemCount}}`     | Number of items | 3                |

---

## 📊 Get All Automations

```bash
curl -X GET http://localhost:3000/api/v1/automation \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

Response:

```json
[
  {
    "key": "slack-new-order",
    "name": "Slack New Order Notification",
    "description": "Sends Slack notification when new order is created",
    "triggerEvent": "order.created",
    "toolType": "slack",
    "isEnabled": false,
    "parameters": {
      "delayMinutes": 0,
      "channel": "#orders",
      "customMessage": "🎉 New order #{{orderId}} from {{customerName}} - ${{total}}",
      "customBlockMessage": "New Order #{{orderId}}"
    }
  }
]
```

---

## 📜 Get Execution Logs

```bash
curl -X GET http://localhost:3000/api/v1/automation/slack-new-order/logs \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

Response:

```json
[
  {
    "id": 1,
    "automationKey": "slack-new-order",
    "triggerEvent": "order.created",
    "toolType": "slack",
    "status": "success",
    "executedAt": "2025-10-29T12:00:00.000Z"
  }
]
```

---

## 🎯 Common Use Cases

### 1. Enable and Configure Custom Message

```bash
curl -X PATCH http://localhost:3000/api/v1/automation/slack-new-order \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "isEnabled": true,
    "parameters": {
      "channel": "#orders",
      "customMessage": "💰 NEW SALE: Order #{{orderId}} from {{customerName}} - ${{total}}"
    }
  }'
```

### 2. Disable All Notifications

```bash
curl -X PATCH http://localhost:3000/api/v1/automation/slack-new-order \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"isEnabled": false}'
```

### 3. Switch Channels

```bash
curl -X PATCH http://localhost:3000/api/v1/automation/slack-new-order \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "parameters": {
      "channel": "#sales-team"
    }
  }'
```

---

## 🔄 How It Works

1. **Event Trigger**: When an order is created, `order.created` event is emitted
2. **Automation Check**: System checks if Slack automation is enabled
3. **Message Building**: Uses `customMessage` parameter (with placeholder replacement)
4. **Slack Delivery**: Sends formatted message to configured channel
5. **Logging**: Records execution in `automation_log` table

---

## 🎨 Message Examples

### Default Message

```
🎉 New order #123 from John Doe - $150
```

### Custom Template 1

```json
"customMessage": "🔥 ORDER ALERT: #{{orderId}} from {{customerName}} totaling ${{total}}"
```

Output: `🔥 ORDER ALERT: #123 from John Doe totaling $150`

### Custom Template 2

```json
"customMessage": "New sale! Order #{{orderId}} - {{customerName}} - ${{total}} {{currency}}"
```

Output: `New sale! Order #123 - John Doe - $150 CAD`

### Custom Template 3

```json
"customMessage": "📦 Order #{{orderId}} by {{customerName}} ({{customerEmail}}) - ${{total}}"
```

Output: `📦 Order #123 by John Doe (john@example.com) - $150`
