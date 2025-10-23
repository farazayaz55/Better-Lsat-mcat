import { Injectable } from '@nestjs/common';

@Injectable()
export class PhoneNormalizerService {
  /**
   * Normalizes phone number for comparison by removing spaces, dashes, parentheses
   * @param phone The phone number to normalize
   * @returns Normalized phone number
   */
  normalizePhone(phone: string): string {
    if (!phone) {
      return '';
    }

    // Remove spaces, dashes, parentheses, and other common separators
    // eslint-disable-next-line unicorn/better-regex
    return phone.replace(/[\s\-\(\)]/g, '');
  }

  /**
   * Checks if two phone numbers are equivalent after normalization
   * @param phone1 First phone number
   * @param phone2 Second phone number
   * @returns true if phones are equivalent, false otherwise
   */
  arePhonesEquivalent(phone1: string, phone2: string): boolean {
    if (!phone1 || !phone2) {
      return false;
    }

    const normalized1 = this.normalizePhone(phone1);
    const normalized2 = this.normalizePhone(phone2);

    // Check if one contains the other (handles cases like +1 vs 1)
    return (
      normalized1 === normalized2 ||
      normalized1.includes(normalized2) ||
      normalized2.includes(normalized1)
    );
  }

  /**
   * Formats phone number for display
   * @param phone The phone number to format
   * @returns Formatted phone number
   */
  formatPhone(phone: string): string {
    if (!phone) {
      return '';
    }

    const normalized = this.normalizePhone(phone);

    // Basic formatting for US numbers (10 digits)
    if (normalized.length === 10) {
      return `(${normalized.slice(0, 3)}) ${normalized.slice(3, 6)}-${normalized.slice(6)}`;
    }

    // Basic formatting for US numbers with country code (11 digits starting with 1)
    if (normalized.length === 11 && normalized.startsWith('1')) {
      const withoutCountryCode = normalized.slice(1);
      return `+1 (${withoutCountryCode.slice(0, 3)}) ${withoutCountryCode.slice(3, 6)}-${withoutCountryCode.slice(6)}`;
    }

    // Return normalized version if we can't format it
    return normalized;
  }
}
