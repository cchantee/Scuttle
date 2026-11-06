import { AppData } from './models';
import { goalSummary, pendingForGoal } from './calculations';
/** The same clearly labeled goal overview for Home and Goals; holds never change bank balances. */
export function goalOverview(data: AppData) {
  const setAsideCents = data.goals.reduce((sum, goal) => sum + goalSummary(data, goal).savedCents, 0);
  const reservedCents = data.goals.reduce((sum, goal) => sum + pendingForGoal(data, goal.id), 0);
  const targetCents = data.goals.reduce((sum, goal) => sum + goal.targetCents, 0);
  return { setAsideCents, reservedCents, targetCents, progressPercent: targetCents ? setAsideCents / targetCents * 100 : 0 };
}
