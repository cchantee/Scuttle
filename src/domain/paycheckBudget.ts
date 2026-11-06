import { Paycheck } from './models';

/** Receiving current income starts a budget period without changing money or history. */
export function startReceivedBudget(paychecks: Paycheck[], receivedId: string): Paycheck[] {
  const received = paychecks.find(p => p.id === receivedId);
  if (!received || received.status === 'planned') return paychecks;
  // Entering old income must not replace a later active budget.
  const later = paychecks.some(p => p.id !== receivedId && p.status !== 'planned' && !p.budgetArchived && p.receivedAt > received.receivedAt);
  return paychecks.map(p => p.status === 'planned' ? p : p.id === receivedId
    ? { ...p, budgetArchived: later }
    : later ? p : { ...p, budgetArchived: true });
}
