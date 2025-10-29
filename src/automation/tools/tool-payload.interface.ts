export interface ToolPayload {
  recipients: string | string[]; // Email addresses, phone numbers, or user IDs
  message: string; // Plain text message (fallback)
  subject?: string; // For email
  template?: string; // Template name for rendering
  data?: Record<string, any>; // Data for template rendering
  channel?: string; // For Slack/Teams (#orders, #alerts, etc.)
}
