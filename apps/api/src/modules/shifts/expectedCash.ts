import type { Prisma } from '@prisma/client';

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

type ExpenseLike = { amount: Prisma.Decimal | number; paidFromCash: boolean };

/**
 * Total of expenses actually paid from the cash drawer. Only these reduce the
 * drawer's expected cash at shift close. Cash withdrawals (WITHDRAWAL) are
 * always `paidFromCash`, so they are included here too.
 */
export function cashExpenseTotal(expenses: ExpenseLike[]): number {
  return round2(expenses.filter((e) => e.paidFromCash).reduce((sum, e) => sum + Number(e.amount), 0));
}

/** Total of expenses settled outside the drawer (card/bank/credit...). These are recorded but never deducted from expected cash. */
export function nonCashExpenseTotal(expenses: ExpenseLike[]): number {
  return round2(expenses.filter((e) => !e.paidFromCash).reduce((sum, e) => sum + Number(e.amount), 0));
}

/**
 * Expected cash at shift close = opening cash + cash sales − cash outflows.
 * `cashOutflows` must only include expenses paid from the drawer
 * (see {@link cashExpenseTotal}); non-cash expenses must be excluded.
 */
export function computeExpectedCash(openingCash: number, cashSales: number, cashOutflows: number): number {
  return round2(openingCash + cashSales - cashOutflows);
}
