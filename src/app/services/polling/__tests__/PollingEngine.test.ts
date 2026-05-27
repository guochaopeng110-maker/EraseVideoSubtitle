import { describe, it, expect } from 'vitest';
import { PollingEngine } from '../PollingEngine';

describe('PollingEngine', () => {
  it('should return 5 seconds interval when elapsed time is less than 30 seconds', () => {
    // 0 seconds elapsed
    expect(PollingEngine.getNextInterval(0)).toBe(5000);
    // 15 seconds elapsed
    expect(PollingEngine.getNextInterval(15000)).toBe(5000);
    // 29.9 seconds elapsed
    expect(PollingEngine.getNextInterval(29900)).toBe(5000);
  });

  it('should return 8 seconds interval when elapsed time is between 30 and 120 seconds', () => {
    // Exactly 30 seconds elapsed
    expect(PollingEngine.getNextInterval(30000)).toBe(8000);
    // 60 seconds elapsed
    expect(PollingEngine.getNextInterval(60000)).toBe(8000);
    // 119.9 seconds elapsed
    expect(PollingEngine.getNextInterval(119900)).toBe(8000);
  });

  it('should return 12 seconds interval when elapsed time is 120 seconds or greater', () => {
    // Exactly 120 seconds elapsed
    expect(PollingEngine.getNextInterval(120000)).toBe(12000);
    // 5 minutes elapsed
    expect(PollingEngine.getNextInterval(300000)).toBe(12000);
  });
});
