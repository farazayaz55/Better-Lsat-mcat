# Email Subject and Message Configuration Implementation

## Summary

Email subject and message can now be configured from the frontend. Placeholders like `{{orderNumber}}`, `{{customerName}}`, `{{total}}` are supported.

## Changes Made

### 1. New DTO: `EmailAutomationParameters`

Created in `src/automation/dto/update-automation-config.dto.ts`

```typescript
export class EmailAutomationParameters {
  delayMinutes?: number;
  ccRecipients?: string[];
  subject?: string; // Now configurable!
  message?: string; // Now configurable!
  template?: string;
}
```

### 2. Email Placeholders Constant

Created `src/automation/constants/email-placeholders.constant.ts`

Available placeholders:

- `{{orderNumber}}` - Order ID
- `{{customerName}}` - Customer name
- `{{customerEmail}}` - Customer email
- `{{total}}` - Order total amount
- `{{currency}}` - Currency code (CAD, USD, etc.)
- `{{itemCount}}` - Number of items in order
- `{{orderDate}}` - Order date (formatted)

### 3. Updated Automation Classes

All email/SMS automations now:

- Read `subject` and `message` from configuration parameters
- Fall back to default values if not configured
- Support placeholder replacement

**Files updated:**

- `src/automation/automations/order-confirmation.automation.ts`
- `src/automation/automations/reminder-24h.automation.ts`
- `src/automation/automations/reminder-3day.automation.ts`

### 4. New API Endpoint

**Get Email Placeholders**

```
GET /api/v1/automation/placeholders/email
```

Returns list of available placeholders for email automations.

## How to Use from Frontend

### 1. Get Email Placeholders

```typescript
const { placeholders } = await api.get('/api/v1/automation/placeholders/email');

// placeholders = [
//   { placeholder: "orderNumber", description: "Order ID", example: "123" },
//   { placeholder: "customerName", description: "Customer name", example: "John Doe" },
//   ... more placeholders
// ]
```

### 2. Get Automation Configuration

```typescript
const automation = await api.get('/api/v1/automation/order-confirmation-email');

// Current config includes default subject and message:
// {
//   key: 'order-confirmation-email',
//   parameters: {
//     subject: 'Order #{{orderNumber}} Confirmed - Better LSAT MCAT',
//     message: 'Your order #{{orderNumber}} has been confirmed. Total: ${{total}}',
//     template: 'order-confirmation',
//     delayMinutes: 0,
//     ccRecipients: []
//   }
// }
```

### 3. Update Email Configuration

```typescript
// Customize subject and message
await api.patch('/api/v1/automation/order-confirmation-email', {
  parameters: {
    subject: '🎉 Your Order #{{orderNumber}} is Confirmed!',
    message:
      'Hi {{customerName}}, your order #{{orderNumber}} worth ${{total}} {{currency}} has been confirmed!',
    delayMinutes: 0,
    ccRecipients: [],
    template: 'order-confirmation',
  },
});
```

### 4. Example Frontend Implementation

```typescript
// React/Next.js example
function EmailAutomationEditor() {
  const [automation, setAutomation] = useState<AutomationConfigOutputDto>();
  const [placeholders, setPlaceholders] = useState<PlaceholderInfo[]>([]);

  useEffect(() => {
    // Fetch automation config
    api.get('/api/v1/automation/order-confirmation-email')
      .then(res => setAutomation(res.data));

    // Fetch available placeholders
    api.get('/api/v1/automation/placeholders/email')
      .then(res => setPlaceholders(res.data.placeholders));
  }, []);

  const updateSubject = (newSubject: string) => {
    api.patch('/api/v1/automation/order-confirmation-email', {
      parameters: {
        ...automation.parameters,
        subject: newSubject
      }
    }).then(() => {
      setAutomation(prev => ({
        ...prev,
        parameters: { ...prev.parameters, subject: newSubject }
      }));
    });
  };

  const updateMessage = (newMessage: string) => {
    api.patch('/api/v1/automation/order-confirmation-email', {
      parameters: {
        ...automation.parameters,
        message: newMessage
      }
    });
  };

  return (
    <div>
      <h3>Email Subject:</h3>
      <input
        type="text"
        value={automation?.parameters?.subject}
        onChange={e => updateSubject(e.target.value)}
        placeholder="Use {{orderNumber}}, {{customerName}}, etc."
      />

      <h3>Email Message:</h3>
      <textarea
        value={automation?.parameters?.message}
        onChange={e => updateMessage(e.target.value)}
        placeholder="Plain text fallback message"
      />

      <div className="placeholders">
        <h4>Available Placeholders:</h4>
        {placeholders.map(p => (
          <button
            key={p.placeholder}
            onClick={() => insertPlaceholder(`{{${p.placeholder}}}`)}
          >
            <strong>{{{p.placeholder}}}</strong>: {p.description}
          </button>
        ))}
      </div>
    </div>
  );
}
```

## Default Values

### Order Confirmation Email

- **Subject**: `Order #{{orderNumber}} Confirmed - Better LSAT MCAT`
- **Message**: `Your order #{{orderNumber}} has been confirmed. Total: ${{total}}`

### 24h Reminder Email

- **Subject**: `Reminder: Your upcoming session - Better LSAT MCAT`
- **Message**: `Hi {{customerName}}, this is a reminder about your upcoming session.`

### 3 Day SMS Reminder

- **Message**: `Hi {{customerName}}, reminder about your Better LSAT MCAT session. Order #{{orderNumber}}. See you soon!`

## API Examples

### Get all email automations

```bash
GET /api/v1/automation
```

Response includes email automations with their configurable parameters.

### Update email subject

```bash
PATCH /api/v1/automation/order-confirmation-email
Content-Type: application/json

{
  "parameters": {
    "subject": "🎉 Order #{{orderNumber}} Confirmed!"
  }
}
```

### Get email placeholders

```bash
GET /api/v1/automation/placeholders/email
```

Response:

```json
{
  "data": {
    "placeholders": [
      {
        "placeholder": "orderNumber",
        "description": "Order ID",
        "example": "123"
      },
      {
        "placeholder": "customerName",
        "description": "Customer name",
        "example": "John Doe"
      },
      {
        "placeholder": "total",
        "description": "Order total amount",
        "example": "150.00"
      },
      {
        "placeholder": "currency",
        "description": "Currency code (CAD, USD, etc.)",
        "example": "CAD"
      },
      {
        "placeholder": "itemCount",
        "description": "Number of items in the order",
        "example": "3"
      },
      {
        "placeholder": "orderDate",
        "description": "Order date (formatted)",
        "example": "12/15/2024"
      }
    ],
    "example": "Use {{orderNumber}} in your message template like: \"Your order #{{orderNumber}} has been confirmed - ${{total}}\""
  },
  "meta": {}
}
```

## Testing

### Test with curl

```bash
# Get automation config
curl -X GET http://localhost:3000/api/v1/automation/order-confirmation-email \
  -H "Authorization: Bearer YOUR_TOKEN"

# Update subject
curl -X PATCH http://localhost:3000/api/v1/automation/order-confirmation-email \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "parameters": {
      "subject": "NEW Subject with {{orderNumber}}"
    }
  }'
```

## Notes

- Placeholders are replaced at runtime with actual order data
- HTML templates still work alongside plain text messages
- Existing configurations are preserved and will use default values if subject/message aren't set
- All email and SMS automations now support configurable messages
