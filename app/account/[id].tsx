import { colors } from '../../src/design/theme';
import React from 'react';
import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { Text } from '../../src/design/Text';
import { Hero } from '../../src/components/brand';
import { Action, Feedback, Page, RecordLine } from '../../src/components/ui';
import { useCrud } from '../../src/components/hooks';
import { accountBalance, availableAccountBalance, pendingForAccount } from '../../src/domain/calculations';
import { accruedInterestCents, nextInterestPostingPreview } from '../../src/domain/interest';
import { formatMoney } from '../../src/domain/money';
import { useData } from '../../src/state/DataProvider';
import { formatDateDisplay, todayISODate } from '../../src/domain/date';

export default function AccountDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data, postMonthlyInterest } = useData();
  const crud = useCrud('transactions');
  const paycheckCrud = useCrud('paychecks');
  const account = data.accounts.find(item => item.id === id);
  if (!account) return <Page title="Account"><Text>Account not found.</Text><Link href="/accounts">Back to accounts</Link></Page>;
  const transactions = data.transactions.filter(item => item.accountId === account.id || item.toAccountId === account.id).sort((a, b) => b.date.localeCompare(a.date));
  const deposits = data.paychecks.filter(item => item.accountId === account.id).sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
  const pendingContributions = data.contributions.filter(item => item.accountId === account.id && item.status === 'pending');
  const available = availableAccountBalance(data, account);
  const earnsInterest = account.type === 'savings' || account.type === 'high_yield_savings' || account.type === 'credit_card';
  const accruedInterest = earnsInterest ? accruedInterestCents(data, account, todayISODate()) : 0;
  const postingPreview = earnsInterest ? nextInterestPostingPreview(data, account, todayISODate()) : null;
  const creditedInterest = transactions.filter(item => !!item.interestPosting).reduce((sum, item) => sum + item.amountCents, 0);
  return <Page title={account.name}><Feedback />
    <Hero label={account.type === 'credit_card' ? 'Credit card debt owed' : 'Actual account balance'} amount={formatMoney(accountBalance(data, account))} detail="Based on your recorded activity" />
    <Action label={account.type === 'credit_card' ? 'Make a card payment' : 'Transfer money'} onPress={() => router.push({ pathname: '/transaction/new', params: account.type === 'credit_card' ? { type: 'transfer', toAccountId: account.id } : { type: 'transfer', accountId: account.id } })} />
    {pendingForAccount(data, account.id) > 0 ? <><Text>Pending goal allocations: {formatMoney(pendingForAccount(data, account.id))}</Text>{available !== null ? <Text>Available after pending allocations: {formatMoney(available)}</Text> : <Text>Outstanding balance including pending: {formatMoney(accountBalance(data, account) + pendingForAccount(data, account.id))}</Text>}</> : null}
    {earnsInterest ? <>
      <Text>{account.type === 'credit_card' ? 'Interest rate (APR)' : 'Interest rate (APY)'}: {account.interestRatePercent ?? 0}%</Text>
      <Text>Accrued but uncredited estimate: {formatMoney(accruedInterest)}</Text>
      <Text>Credited interest charges/credits: {formatMoney(creditedInterest)}</Text>
      <Text style={{ color: colors.muted, fontSize: 12 }}>Simulation estimate only. It does not reproduce issuer billing rules. Savings use effective APY with daily compounding; cards estimate APR / 365.</Text>
      {postingPreview ? <><Text>Next completed statement month: {postingPreview.periodKey} · {formatMoney(postingPreview.amountCents)} estimated</Text><Action label={account.type === 'credit_card' ? 'Post monthly interest charge' : 'Credit monthly interest'} onPress={() => postMonthlyInterest(account.id)} /></> : null}
    </> : null}
    <Action label="Edit account" onPress={() => router.push({ pathname: '/accounts', params: { accountId: account.id } })} />
    <Action label="+ Add transaction" variant="primary" fullWidth onPress={() => router.push({ pathname: '/transaction/new', params: { accountId: account.id } })} />
    <Text style={{ fontWeight: '600' }}>Activity</Text>
    {!transactions.length && !deposits.length && !pendingContributions.length ? <Text>No deposits, transactions, or pending goal allocations associated with this account.</Text> : null}
    {deposits.map(paycheck => <RecordLine key={`paycheck-${paycheck.id}`} title={`Paycheck deposit · ${formatMoney(paycheck.accountCreditCents ?? paycheck.amountCents)}`} detail={`${formatDateDisplay(paycheck.receivedAt)} · ${paycheck.source ?? 'Income'}`} onView={() => router.push({ pathname: '/paycheck/[id]', params: { id: paycheck.id } })} onEdit={() => router.push({ pathname: '/paychecks', params: { paycheckId: paycheck.id } })} onDelete={() => paycheckCrud.confirmDelete(paycheck.id)} />)}
    {pendingContributions.map(item => <RecordLine key={`pending-${item.id}`} title={`Pending goal allocation · ${formatMoney(item.amountCents)}`} detail={`${data.goals.find(goal => goal.id === item.goalId)?.name ?? 'Savings goal'} · ${formatDateDisplay(item.date)}`} onView={() => router.push({ pathname: '/goal/[id]', params: { id: item.goalId } })} onEdit={() => router.push({ pathname: '/goal/[id]', params: { id: item.goalId } })} onDelete={() => router.push({ pathname: '/goal/[id]', params: { id: item.goalId } })} />)}
    {transactions.map(tx => {
      const otherAccountId = tx.accountId === account.id ? tx.toAccountId : tx.accountId;
      const other = data.accounts.find(item => item.id === otherAccountId);
      return <RecordLine key={tx.id} title={tx.description} detail={`${formatDateDisplay(tx.date)} · ${tx.type} · ${formatMoney(tx.amountCents)}${tx.type === 'transfer' && other ? ` · ${tx.accountId === account.id ? 'To' : 'From'} ${other.name}` : ''}`} onEdit={() => router.push({ pathname: '/transactions', params: { editId: tx.id } })} onDelete={() => crud.confirmDelete(tx.id)} />;
    })}
    <Link href="/accounts">Edit account details</Link>
  </Page>;
}
