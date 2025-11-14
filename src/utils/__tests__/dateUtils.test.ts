import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getAvailableTimes, formatDate, getTodayDate, getMaxDate } from '../dateUtils';

describe('formatDate', () => {
  it('should format date correctly', () => {
    const date = new Date('2025-06-15');
    expect(formatDate(date)).toBe('2025-06-15');
  });
});

describe('getTodayDate', () => {
  it('should return today date in YYYY-MM-DD format', () => {
    const today = getTodayDate();
    expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('getMaxDate', () => {
  it('should return date 3 months in the future', () => {
    const maxDate = getMaxDate();
    expect(maxDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('getAvailableTimes', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return all times for future dates', () => {
    vi.setSystemTime(new Date('2025-06-15T10:00:00'));
    const futureDate = new Date('2025-06-20');
    const times = getAvailableTimes(futureDate);
    expect(times.length).toBe(6);
    expect(times).toContain('17:00');
    expect(times).toContain('22:00');
  });

  it('should filter out past times for today', () => {
    vi.setSystemTime(new Date('2025-06-15T18:00:00'));
    const today = new Date('2025-06-15');
    const times = getAvailableTimes(today);
    expect(times.length).toBeLessThan(6);
    expect(times).not.toContain('17:00');
    expect(times).not.toContain('18:00');
  });

  it('should return empty array if all times have passed for today', () => {
    vi.setSystemTime(new Date('2025-06-15T22:00:00'));
    const today = new Date('2025-06-15');
    const times = getAvailableTimes(today);
    expect(times.length).toBe(0);
  });

  it('should include times that are more than 1 hour in the future', () => {
    vi.setSystemTime(new Date('2025-06-15T16:00:00'));
    const today = new Date('2025-06-15');
    const times = getAvailableTimes(today);
    expect(times).not.toContain('17:00');
    expect(times).toContain('18:00');
  });
});
