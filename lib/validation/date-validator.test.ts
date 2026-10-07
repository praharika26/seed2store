import { describe, it, expect } from 'vitest';
import { DateValidator, DateValidationResult } from './date-validator';

describe('DateValidator', () => {
  describe('sanitizeDate', () => {
    it('should return null for empty string', () => {
      expect(DateValidator.sanitizeDate('')).toBe(null);
    });

    it('should return null for whitespace-only string', () => {
      expect(DateValidator.sanitizeDate('   ')).toBe(null);
      expect(DateValidator.sanitizeDate('\t\n')).toBe(null);
    });

    it('should trim and return valid date string', () => {
      expect(DateValidator.sanitizeDate('  2023-12-01  ')).toBe('2023-12-01');
    });

    it('should return null for null or undefined input', () => {
      expect(DateValidator.sanitizeDate(null as any)).toBe(null);
      expect(DateValidator.sanitizeDate(undefined as any)).toBe(null);
    });
  });

  describe('isValidDateFormat', () => {
    it('should return true for valid ISO date format', () => {
      expect(DateValidator.isValidDateFormat('2023-12-01')).toBe(true);
      expect(DateValidator.isValidDateFormat('2024-02-29')).toBe(true); // leap year
    });

    it('should return false for invalid date format', () => {
      expect(DateValidator.isValidDateFormat('2023/12/01')).toBe(false);
      expect(DateValidator.isValidDateFormat('12-01-2023')).toBe(false);
      expect(DateValidator.isValidDateFormat('2023-13-01')).toBe(false); // invalid month
      expect(DateValidator.isValidDateFormat('2023-02-30')).toBe(false); // invalid day
    });

    it('should return false for empty or invalid input', () => {
      expect(DateValidator.isValidDateFormat('')).toBe(false);
      expect(DateValidator.isValidDateFormat('invalid')).toBe(false);
      expect(DateValidator.isValidDateFormat(null as any)).toBe(false);
    });
  });

  describe('isFutureDate', () => {
    it('should return true for future dates', () => {
      // Use a simple future date string
      const future = new Date();
      future.setDate(future.getDate() + 30);
      const futureDateString = `${future.getFullYear()}-${String(future.getMonth() + 1).padStart(2, '0')}-${String(future.getDate()).padStart(2, '0')}`;
      
      expect(DateValidator.isFutureDate(futureDateString)).toBe(true);
    });

    it('should return false for past dates', () => {
      expect(DateValidator.isFutureDate('2020-01-01')).toBe(false);
    });

    it('should return false for today', () => {
      const today = new Date().toISOString().split('T')[0];
      expect(DateValidator.isFutureDate(today)).toBe(false);
    });

    it('should return false for invalid dates', () => {
      expect(DateValidator.isFutureDate('invalid')).toBe(false);
      expect(DateValidator.isFutureDate('')).toBe(false);
    });
  });

  describe('validateHarvestDate', () => {
    it('should accept empty dates as valid with null value', () => {
      const result = DateValidator.validateHarvestDate('');
      expect(result.isValid).toBe(true);
      expect(result.sanitizedValue).toBe(null);
      expect(result.error).toBeUndefined();
      expect(result.warning).toBeUndefined();
    });

    it('should reject invalid date formats', () => {
      const result = DateValidator.validateHarvestDate('2023/12/01');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Please enter a valid date in YYYY-MM-DD format');
      expect(result.sanitizedValue).toBe(null);
    });

    it('should warn about future dates but accept them', () => {
      // Use a simple future date string
      const future = new Date();
      future.setDate(future.getDate() + 30);
      const futureDateString = `${future.getFullYear()}-${String(future.getMonth() + 1).padStart(2, '0')}-${String(future.getDate()).padStart(2, '0')}`;
      
      const result = DateValidator.validateHarvestDate(futureDateString);
      expect(result.isValid).toBe(true);
      expect(result.warning).toBe('Future harvest dates may indicate incorrect data entry');
      expect(result.sanitizedValue).toBe(futureDateString);
    });

    it('should accept valid past dates without warnings', () => {
      const result = DateValidator.validateHarvestDate('2023-06-15');
      expect(result.isValid).toBe(true);
      expect(result.sanitizedValue).toBe('2023-06-15');
      expect(result.error).toBeUndefined();
      expect(result.warning).toBeUndefined();
    });

    it('should handle whitespace-only input as empty', () => {
      const result = DateValidator.validateHarvestDate('   ');
      expect(result.isValid).toBe(true);
      expect(result.sanitizedValue).toBe(null);
    });
  });
});