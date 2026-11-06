import { AppData } from './models';
export function currentPaycheck(data: AppData) {
  return [...data.paychecks].reverse().filter(p => p.status !== 'planned' && !p.budgetArchived).sort((a,b) => b.receivedAt.localeCompare(a.receivedAt))[0];
}
export function paycheckDestination(data: AppData) {
  const paycheck = currentPaycheck(data);
  return paycheck ? { pathname: '/paycheck/[id]' as const, params: { id: paycheck.id } } : '/paychecks' as const;
}
