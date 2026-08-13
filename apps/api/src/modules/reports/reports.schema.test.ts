import { describe, it, expect } from 'vitest';
import {
  summaryQuerySchema,
  dailyQuerySchema,
  topProductsQuerySchema,
  recentOrdersQuerySchema,
  salesQuerySchema,
  debtsQuerySchema,
} from './reports.schema';

const UUID = '6f9619ff-8b86-d011-b42d-00c04fc964ff';

describe('dailyQuerySchema', () => {
  it('coerces days to a number and applies the default', () => {
    expect(dailyQuerySchema.parse({}).days).toBe(7);
    expect(dailyQuerySchema.parse({ days: '30' }).days).toBe(30);
  });

  it('rejects days outside 1..92', () => {
    expect(() => dailyQuerySchema.parse({ days: 0 })).toThrow();
    expect(() => dailyQuerySchema.parse({ days: 93 })).toThrow();
  });

  it('rejects non-numeric days', () => {
    expect(() => dailyQuerySchema.parse({ days: 'abc' })).toThrow();
  });
});

describe('topProductsQuerySchema / recentOrdersQuerySchema', () => {
  it('caps limit at 100 and coerces strings', () => {
    expect(topProductsQuerySchema.parse({ limit: '5' }).limit).toBe(5);
    expect(() => topProductsQuerySchema.parse({ limit: 101 })).toThrow();
    expect(recentOrdersQuerySchema.parse({}).limit).toBe(15);
    expect(() => recentOrdersQuerySchema.parse({ limit: 0 })).toThrow();
  });
});

describe('salesQuerySchema', () => {
  it('validates period and groupBy enums', () => {
    const out = salesQuerySchema.parse({ period: 'month', groupBy: 'branch' });
    expect(out.period).toBe('month');
    expect(out.groupBy).toBe('branch');
  });

  it('defaults period to all', () => {
    expect(salesQuerySchema.parse({}).period).toBe('all');
  });

  it('rejects unknown period / groupBy values', () => {
    expect(() => salesQuerySchema.parse({ period: 'decade' })).toThrow();
    expect(() => salesQuerySchema.parse({ groupBy: 'zip' })).toThrow();
  });
});

describe('range schemas (summary/debts)', () => {
  it('accepts an empty query (all optional)', () => {
    expect(summaryQuerySchema.parse({})).toEqual({});
  });

  it('treats empty-string values as not provided', () => {
    const out = summaryQuerySchema.parse({ branchId: '', from: '', to: '' });
    expect(out.branchId).toBeUndefined();
    expect(out.from).toBeUndefined();
    expect(out.to).toBeUndefined();
  });

  it('rejects a malformed uuid', () => {
    expect(() => summaryQuerySchema.parse({ branchId: 'not-a-uuid' })).toThrow();
  });

  it('rejects an invalid date', () => {
    expect(() => debtsQuerySchema.parse({ from: 'not-a-date' })).toThrow();
  });

  it('accepts a valid uuid and date', () => {
    const out = summaryQuerySchema.parse({ branchId: UUID, from: '2026-01-01' });
    expect(out.branchId).toBe(UUID);
    expect(out.from).toBe('2026-01-01');
  });
});
