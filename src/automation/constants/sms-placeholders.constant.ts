/**
 * SMS Placeholder Constants
 * Available placeholders for SMS message templates
 */
export const SMS_PLACEHOLDERS = {
  // Order information
  orderNumber: {
    key: 'orderNumber',
    description: 'Order ID/number',
    example: '12345',
  },
  orderId: {
    key: 'orderId',
    description: 'Order ID (same as orderNumber)',
    example: '12345',
  },
  orderDate: {
    key: 'orderDate',
    description: 'Order date in readable format',
    example: 'January 15, 2024',
  },
  orderDateShort: {
    key: 'orderDateShort',
    description: 'Order date in short format',
    example: 'Jan 15, 2024',
  },

  // Customer information
  customerName: {
    key: 'customerName',
    description: 'Customer full name',
    example: 'John Doe',
  },
  customerFirstName: {
    key: 'customerFirstName',
    description: 'Customer first name',
    example: 'John',
  },
  customerEmail: {
    key: 'customerEmail',
    description: 'Customer email address',
    example: 'john@example.com',
  },
  customerPhone: {
    key: 'customerPhone',
    description: 'Customer phone number',
    example: '+1234567890',
  },

  // Financial information
  total: {
    key: 'total',
    description: 'Total order amount',
    example: '99.99',
  },
  currency: {
    key: 'currency',
    description: 'Currency code',
    example: 'CAD',
  },
  itemCount: {
    key: 'itemCount',
    description: 'Number of items in order',
    example: '3',
  },

  // Session/Schedule information
  sessionDate: {
    key: 'sessionDate',
    description: 'Session date',
    example: 'January 16, 2024',
  },
  sessionTime: {
    key: 'sessionTime',
    description: 'Session time',
    example: '10:00 AM',
  },
  sessionDateShort: {
    key: 'sessionDateShort',
    description: 'Session date in short format',
    example: 'Jan 16',
  },
  date: {
    key: 'date',
    description: 'Event/session date',
    example: 'January 16, 2024',
  },
  time: {
    key: 'time',
    description: 'Event/session time',
    example: '10:00 AM',
  },

  // Product information
  productName: {
    key: 'productName',
    description: 'Product name',
    example: 'LSAT Prep Course',
  },
  productSessions: {
    key: 'productSessions',
    description: 'Number of sessions',
    example: '10',
  },

  // Urgency/Time references
  daysUntilSession: {
    key: 'daysUntilSession',
    description: 'Days until session',
    example: '1',
  },
  hoursUntilSession: {
    key: 'hoursUntilSession',
    description: 'Hours until session',
    example: '24',
  },
} as const;

/**
 * Get all SMS placeholder keys
 */
export const getSmsPlaceholderKeys = (): string[] => {
  return Object.values(SMS_PLACEHOLDERS).map((p) => p.key);
};

/**
 * Get SMS placeholder details for API documentation
 */
export const getSmsPlaceholderDetails = () => {
  return Object.values(SMS_PLACEHOLDERS).map((placeholder) => ({
    key: placeholder.key,
    description: placeholder.description,
    example: placeholder.example,
  }));
};
