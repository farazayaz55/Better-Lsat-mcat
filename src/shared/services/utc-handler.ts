export function convertCustomerDateToUTC(
  year: number,
  month: number,
  date: number,
  customerTimezone: string,
): Date {
  // Create date in customer's timezone
  const customerDate = new Date(year, month - 1, date, 0, 0, 0);

  // Convert to UTC using timezone offset
  const utcDate = new Date(
    customerDate.toLocaleString('en-US', { timeZone: customerTimezone }),
  );

  return utcDate;
}
