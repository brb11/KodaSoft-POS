import { describe, it, expect } from 'vitest';
import { cashExpenseTotal, nonCashExpenseTotal, computeExpectedCash, round2 } from './expectedCash';

const cash = (amount: number) => ({ amount, paidFromCash: true });
const nonCash = (amount: number) => ({ amount, paidFromCash: false });

describe('cashExpenseTotal', () => {
  it('includes only expenses paid from the cash drawer', () => {
    expect(cashExpenseTotal([cash(100), nonCash(200), cash(50.25)])).toBe(150.25);
  });

  it('returns 0 when nothing was paid from the drawer', () => {
    expect(cashExpenseTotal([nonCash(200), nonCash(75.5)])).toBe(0);
  });

  it('returns 0 for an empty list', () => {
    expect(cashExpenseTotal([])).toBe(0);
  });

  it('treats withdrawals as cash (they are always paidFromCash)', () => {
    expect(cashExpenseTotal([cash(300)])).toBe(300);
  });
});

describe('nonCashExpenseTotal', () => {
  it('includes only non-cash expenses', () => {
    expect(nonCashExpenseTotal([cash(100), nonCash(200), nonCash(50.25)])).toBe(250.25);
  });

  it('returns 0 when everything is cash', () => {
    expect(nonCashExpenseTotal([cash(100), cash(50)])).toBe(0);
  });
});

describe('computeExpectedCash', () => {
  it('expected = opening + cash sales − cash outflows', () => {
    expect(computeExpectedCash(500, 1250.5, 150.25)).toBe(1600.25);
  });

  it('a non-cash expense does NOT reduce expected cash', () => {
    const outflows = cashExpenseTotal([cash(100), nonCash(999), nonCash(500)]);
    expect(computeExpectedCash(500, 1000, outflows)).toBe(1400);
  });

  it('a cash expense AND a withdrawal both reduce expected cash', () => {
    const outflows = cashExpenseTotal([cash(100), cash(250), nonCash(400)]);
    expect(computeExpectedCash(0, 1000, outflows)).toBe(650);
  });

  it('rounds to the nearest cent', () => {
    expect(computeExpectedCash(0.1, 0.2, 0.05)).toBe(0.25);
  });

  it('round2 avoids floating point drift', () => {
    expect(round2(0.1 + 0.2)).toBe(0.3);
  });
});
