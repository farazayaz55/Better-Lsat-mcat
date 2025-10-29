# Frontend Team - Types Export Summary

## ✅ What Was Done

All placeholders are now **exported to Swagger documentation** and will be available as TypeScript types when you generate your frontend client from Swagger.

### 📦 Generated TypeScript Types

When frontend team generates TypeScript client from Swagger (using `openapi-generator` or `swagger-typescript-api`), they will get:

```typescript
// 1. Slack Placeholders Response
export interface SlackPlaceholdersResponseDto {
  placeholders: SlackPlaceholderOutputDto[];
  example?: string;
}

export interface SlackPlaceholderOutputDto {
  placeholder: string;
  description: string;
  example: string;
}

// 2. Slack Automation Parameters (for custom message fields)
export interface SlackAutomationParameters {
  delayMinutes?: number;
  channel?: string;
  customMessage?: string; // Use {{placeholders}} here
  customBlockMessage?: string; // Use {{placeholders}} here
}

// 3. All Automation Config
export interface AutomationConfigOutputDto {
  key: string;
  name: string;
  description: string;
  triggerEvent: string;
  toolType: string;
  isEnabled: boolean;
  parameters?: Record<string, any> | SlackAutomationParameters;
}

// 4. Update Request
export interface UpdateAutomationConfigDto {
  isEnabled?: boolean;
  parameters?: Record<string, any> | SlackAutomationParameters;
}
```

### 🎯 Available Placeholders (Listed in Swagger)

When frontend team looks at `SlackAutomationParameters.customMessage` or `customBlockMessage` field in Swagger, they'll see:

**Available placeholders:** `{{orderId}}`, `{{customerName}}`, `{{customerEmail}}`, `{{total}}`, `{{currency}}`, `{{itemCount}}`

### 📍 Access Points

**1. Swagger UI (`http://localhost:3000/api-docs`):**

- Navigate to `GET /api/v1/automation/placeholders/slack`
- See full response type: `SlackPlaceholdersResponseDto`
- See all 6 placeholders with descriptions and examples

**2. Generated TypeScript Types:**

- Import `SlackPlaceholderOutputDto[]` from generated client
- Loop through to display placeholder buttons in UI
- Use to validate custom messages

**3. API Description Field:**

- The `@ApiPropertyOptional` decorator on `customMessage` and `customBlockMessage` shows:

```
Available: {{orderId}}, {{customerName}}, {{customerEmail}}, {{total}}, {{currency}}, {{itemCount}}
```

## 🚀 Frontend Usage

```typescript
// 1. Generate TypeScript client from Swagger
// e.g., using openapi-generator
import { SlackPlaceholdersResponseDto } from './generated/api';

// 2. Call the API to get placeholders
const response: SlackPlaceholdersResponseDto = await api.getSlackPlaceholders();

// 3. Display in UI
response.placeholders.forEach((p) => {
  console.log(`{{${p.placeholder}}}: ${p.description}`);
  // Output: {{orderId}}: Order ID
  //         {{customerName}}: Customer name
  //         etc.
});

// 4. Build custom message
const customMessage = `🎉 New order #{{orderId}} from {{customerName}} - ${{ total }}`;

// 5. Update automation with custom message
await api.updateAutomation('slack-new-order', {
  parameters: {
    customMessage,
    channel: '#orders',
  },
});
```

## 📊 Summary

✅ **Slack placeholders are exported to Swagger**  
✅ **TypeScript types will be generated**  
✅ **Frontend can call API to get list**  
✅ **Swagger shows all placeholders in field descriptions**  
✅ **Full type safety with `SlackAutomationParameters`**

The frontend team gets:

- 6 placeholder types with descriptions
- API endpoint to fetch them dynamically
- TypeScript types for type safety
- All documented in Swagger UI
