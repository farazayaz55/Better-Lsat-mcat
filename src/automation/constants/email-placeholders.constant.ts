import { PlaceholderInfo } from './slack-placeholders.constant';

/**
 * Available placeholders for Email automation messages
 * Use {{placeholder}} in subject and message parameters
 */
export const EMAIL_PLACEHOLDERS: PlaceholderInfo[] = [
  {
    placeholder: 'orderNumber',
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
    example: '150.00',
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
  {
    placeholder: 'orderDate',
    description: 'Order date (formatted)',
    example: '12/15/2024',
  },
];
