import { describe, it, expect } from 'vitest';
import { validateEmail, validatePhone, validateBookingForm } from '../validation';

describe('validateEmail', () => {
  it('should return true for valid email addresses', () => {
    expect(validateEmail('test@example.com')).toBe(true);
    expect(validateEmail('user.name@domain.co.uk')).toBe(true);
    expect(validateEmail('user+tag@example.com')).toBe(true);
  });

  it('should return false for invalid email addresses', () => {
    expect(validateEmail('invalid')).toBe(false);
    expect(validateEmail('missing@domain')).toBe(false);
    expect(validateEmail('@example.com')).toBe(false);
    expect(validateEmail('user@')).toBe(false);
    expect(validateEmail('')).toBe(false);
  });
});

describe('validatePhone', () => {
  it('should return true for valid phone numbers', () => {
    expect(validatePhone('1234567890')).toBe(true);
    expect(validatePhone('(123) 456-7890')).toBe(true);
    expect(validatePhone('+1 123 456 7890')).toBe(true);
    expect(validatePhone('123-456-7890')).toBe(true);
  });

  it('should return false for invalid phone numbers', () => {
    expect(validatePhone('123')).toBe(false);
    expect(validatePhone('abcdefghij')).toBe(false);
    expect(validatePhone('')).toBe(false);
  });
});

describe('validateBookingForm', () => {
  const validFormData = {
    customer_name: 'John Doe',
    customer_email: 'john@example.com',
    customer_phone: '1234567890',
    booking_date: '2025-12-31',
    booking_time: '18:00',
    number_of_guests: 4,
  };

  it('should return no errors for valid form data', () => {
    const errors = validateBookingForm(validFormData);
    expect(Object.keys(errors).length).toBe(0);
  });

  it('should return error for missing customer name', () => {
    const errors = validateBookingForm({ ...validFormData, customer_name: '' });
    expect(errors.customer_name).toBeDefined();
  });

  it('should return error for short customer name', () => {
    const errors = validateBookingForm({ ...validFormData, customer_name: 'A' });
    expect(errors.customer_name).toBeDefined();
  });

  it('should return error for missing email', () => {
    const errors = validateBookingForm({ ...validFormData, customer_email: '' });
    expect(errors.customer_email).toBeDefined();
  });

  it('should return error for invalid email', () => {
    const errors = validateBookingForm({ ...validFormData, customer_email: 'invalid-email' });
    expect(errors.customer_email).toBeDefined();
  });

  it('should return error for missing phone', () => {
    const errors = validateBookingForm({ ...validFormData, customer_phone: '' });
    expect(errors.customer_phone).toBeDefined();
  });

  it('should return error for invalid phone', () => {
    const errors = validateBookingForm({ ...validFormData, customer_phone: '123' });
    expect(errors.customer_phone).toBeDefined();
  });

  it('should return error for missing date', () => {
    const errors = validateBookingForm({ ...validFormData, booking_date: '' });
    expect(errors.booking_date).toBeDefined();
  });

  it('should return error for missing time', () => {
    const errors = validateBookingForm({ ...validFormData, booking_time: '' });
    expect(errors.booking_time).toBeDefined();
  });

  it('should return error for invalid number of guests (too low)', () => {
    const errors = validateBookingForm({ ...validFormData, number_of_guests: 0 });
    expect(errors.number_of_guests).toBeDefined();
  });

  it('should return error for invalid number of guests (too high)', () => {
    const errors = validateBookingForm({ ...validFormData, number_of_guests: 11 });
    expect(errors.number_of_guests).toBeDefined();
  });

  it('should return multiple errors for multiple invalid fields', () => {
    const errors = validateBookingForm({
      customer_name: '',
      customer_email: 'invalid',
      customer_phone: '123',
      booking_date: '',
      booking_time: '',
      number_of_guests: 0,
    });
    expect(Object.keys(errors).length).toBeGreaterThan(1);
  });
});
