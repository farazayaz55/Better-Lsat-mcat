export interface PlaceholderInfo {
  placeholder: string;
  description: string;
  example: string;
}

/**
 * Available placeholders for Slack automation messages
 * Use {{placeholder}} in customMessage and customBlockMessage parameters
 */
export const SLACK_PLACEHOLDERS: PlaceholderInfo[] = [
  {
    placeholder: 'orderId',
    description: 'Order ID',
    example: '123',
  },
  {
    placeholder: 'customerName',
    description: 'Customer name',
    example: 'John Doe',
  },
  {
    placeholder: 'customerEmail',
    description: 'Customer email address',
    example: 'john@example.com',
  },
  {
    placeholder: 'total',
    description: 'Order total amount',
    example: '150',
  },
  {
    placeholder: 'currency',
    description: 'Currency code (always CAD)',
    example: 'CAD',
  },
  {
    placeholder: 'itemCount',
    description: 'Number of items in the order',
    example: '3',
  },
];
