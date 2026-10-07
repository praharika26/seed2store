/**
 * Date validation utilities for crop registration system
 * Provides comprehensive date validation, sanitization, and error handling
 */

export interface DateValidationResult {
  isValid: boolean;
  error?: string;
  warning?: string;
  sanitizedValue: string | null;
}

export class DateValidator {
  /**
   * Validates a harvest date input with comprehensive checks
   * @param dateString - The date string to validate
   * @returns DateValidationResult with validation status and sanitized value
   */
  static validateHarvestDate(dateString: string): DateValidationResult {
    // Handle empty or whitespace-only strings
    const sanitized = this.sanitizeDate(dateString);
    if (sanitized === null) {
      return {
        isValid: true,
        sanitizedValue: null,
      };
    }

    // Check if the date format is valid
    if (!this.isValidDateFormat(sanitized)) {
      return {
        isValid: false,
        error: 'Please enter a valid date in YYYY-MM-DD format',
        sanitizedValue: null,
      };
    }

    // Check if it's a future date
    if (this.isFutureDate(sanitized)) {
      return {
        isValid: true,
        warning: 'Future harvest dates may indicate incorrect data entry',
        sanitizedValue: sanitized,
      };
    }

    return {
      isValid: true,
      sanitizedValue: sanitized,
    };
  }

  /**
   * Sanitizes date input by trimming whitespace and converting empty strings to null
   * @param dateString - The date string to sanitize
   * @returns Sanitized date string or null if empty
   */
  static sanitizeDate(dateString: string): string | null {
    if (!dateString || typeof dateString !== 'string') {
      return null;
    }

    const trimmed = dateString.trim();
    if (trimmed === '' || /^\s*$/.test(trimmed)) {
      return null;
    }

    return trimmed;
  }

  /**
   * Checks if a date string is in valid format and represents a real date
   * @param dateString - The date string to check
   * @returns True if the date format is valid
   */
  static isValidDateFormat(dateString: string): boolean {
    if (!dateString || typeof dateString !== 'string') {
      return false;
    }

    // Check basic ISO date format (YYYY-MM-DD)
    const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!isoDateRegex.test(dateString)) {
      return false;
    }

    // Build the date in UTC and compare UTC parts. (`new Date("YYYY-MM-DD")` is UTC midnight, so
    // comparing local parts rejected every date for users west of Greenwich.)
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (isNaN(date.getTime())) {
      return false;
    }

    // Ensure the parsed date matches the input (catches invalid dates like 2023-02-30)
    return (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 && // getUTCMonth() is 0-indexed
      date.getUTCDate() === day
    );
  }

  /**
   * Checks if a date string represents a future date
   * @param dateString - The date string to check (assumed to be valid format)
   * @returns True if the date is in the future
   */
  static isFutureDate(dateString: string): boolean {
    if (!dateString || !this.isValidDateFormat(dateString)) {
      return false;
    }

    // Parse the date string directly to avoid timezone issues
    const [year, month, day] = dateString.split('-').map(Number);
    const inputDate = new Date(year, month - 1, day); // month is 0-indexed
    
    const today = new Date();
    const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    return inputDate > todayDate;
  }
}