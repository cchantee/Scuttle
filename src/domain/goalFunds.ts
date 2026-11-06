import { AppData, SavingsContribution } from './models';
export function goalFundsHeld(data: AppData, contribution: SavingsContribution): boolean {
  const linked = data.transactions.find(t => t.id === contribution.transactionId);
  return Boolean(contribution.accountId && (contribution.status === 'pending' || contribution.status === 'designated' || contribution.status === 'posted' && linked?.type === 'transfer'));
}
export function goalHoldingAccount(data: AppData, contribution: SavingsContribution): string | undefined {
  const linked = data.transactions.find(t => t.id === contribution.transactionId);
  return linked?.type === 'transfer' ? linked.toAccountId : contribution.accountId;
}
export function committedForAccount(data: AppData, accountId: string, exceptId?: string): number {
  return data.contributions.filter(c => c.id !== exceptId && goalFundsHeld(data,c) && goalHoldingAccount(data,c) === accountId).reduce((sum,c) => sum+c.amountCents,0);
}
