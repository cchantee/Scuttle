import React from 'react';
import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { Text } from 'react-native';
import { allocationSummary, allocatedForPaycheck, unallocatedForPaycheck } from '../../src/domain/calculations';
import { formatMoney } from '../../src/domain/money';
import { Action, Card, Feedback, Page, ProgressBar, RecordLine, SectionTitle } from '../../src/components/ui';
import { useCrud } from '../../src/components/hooks';
import { useData } from '../../src/state/DataProvider';
import { formatDateDisplay } from '../../src/domain/date';

export default function PaycheckDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data } = useData();
  const allocationCrud = useCrud('allocations');
  const transactionCrud = useCrud('transactions');
  const paycheck = data.paychecks.find(item => item.id === id);
  if (!paycheck) return <Page title="Paycheck"><Text>Paycheck not found.</Text><Link href="/paychecks">Back to paychecks</Link></Page>;
  const allocations = data.allocations.filter(item => item.paycheckId === paycheck.id);
  const allocationIds = new Set(allocations.map(item => item.id));
  const linkedExpenses = data.transactions.filter(item => item.type === 'expense' && item.allocationId && allocationIds.has(item.allocationId)).sort((a, b) => b.date.localeCompare(a.date));
  const accountMoves = data.transactions.filter(item => item.paycheckId === paycheck.id).sort((a, b) => b.date.localeCompare(a.date));
  const remainingAccount = data.accounts.find(account => account.id === (paycheck.remainingAccountId ?? paycheck.accountId));
  return <Page title="Paycheck details"><Feedback />
    <Card><Text style={{ color: '#555' }}>{formatDateDisplay(paycheck.receivedAt)} · {paycheck.source ?? 'Income'}</Text><Text style={{ fontSize: 25, fontWeight: '700', color: '#171717' }}>{formatMoney(paycheck.amountCents)}</Text>{paycheck.accountId ? <Text style={{ color: '#555' }}>Deposited to {data.accounts.find(account => account.id === paycheck.accountId)?.name ?? 'account'}{remainingAccount && remainingAccount.id !== paycheck.accountId ? ` · remaining funds now in ${remainingAccount.name}` : ''}</Text> : <Text style={{ color: '#555' }}>Budgeted as a standalone paycheck</Text>}<ProgressBar value={allocatedForPaycheck(data, paycheck.id)} max={paycheck.amountCents} /><Text style={{ color: '#555' }}>{formatMoney(allocatedForPaycheck(data, paycheck.id))} allocated · {formatMoney(unallocatedForPaycheck(data, paycheck.id))} unallocated</Text></Card>
    {paycheck.notes ? <Text>{paycheck.notes}</Text> : null}
    <Action label={paycheck.accountId ? 'Edit or move remaining funds' : 'Edit or move paycheck to an account'} onPress={() => router.push({ pathname: '/paychecks', params: { paycheckId: paycheck.id } })} />
    <Action label="+ Add category allocation" variant="primary" fullWidth onPress={() => router.push({ pathname: '/budget', params: { paycheckId: paycheck.id } })} />
    <SectionTitle>Categories</SectionTitle>
    {!allocations.length ? <Text>No categories allocated from this paycheck yet.</Text> : null}
    {allocations.map(allocation => {
      const category = data.categories.find(item => item.id === allocation.categoryId);
      const summary = allocationSummary(data, allocation);
      return <RecordLine key={allocation.id} title={category?.name ?? 'Missing category'} detail={`${formatMoney(summary.allocatedCents)} allocated · ${formatMoney(summary.spentCents)} spent · ${formatMoney(summary.remainingCents)} left`} onView={() => router.push({ pathname: '/allocation/[id]', params: { id: allocation.id } })} onEdit={() => router.push({ pathname: '/budget', params: { allocationId: allocation.id } })} onDelete={() => allocationCrud.confirmDelete(allocation.id)} />;
    })}
    <SectionTitle>Linked expenses</SectionTitle>
    {!linkedExpenses.length ? <Text>No expense transactions are linked to these allocations.</Text> : null}
    {linkedExpenses.map(transaction => {
      const allocation = allocations.find(item => item.id === transaction.allocationId);
      const category = data.categories.find(item => item.id === allocation?.categoryId);
      return <RecordLine key={transaction.id} title={transaction.description} detail={`${formatDateDisplay(transaction.date)} · ${category?.name ?? 'Budget category'} · ${formatMoney(transaction.amountCents)}`} onView={() => router.push({ pathname: '/transactions', params: { editId: transaction.id } })} onEdit={() => router.push({ pathname: '/transactions', params: { editId: transaction.id } })} onDelete={() => transactionCrud.confirmDelete(transaction.id)} />;
    })}
    {accountMoves.length ? <><SectionTitle>Account moves</SectionTitle>{accountMoves.map(move => <RecordLine key={move.id} title={move.description} detail={`${formatDateDisplay(move.date)} · ${formatMoney(move.amountCents)} · ${data.accounts.find(account => account.id === move.accountId)?.name ?? 'Account'} → ${data.accounts.find(account => account.id === move.toAccountId)?.name ?? 'Account'}`} onEdit={() => router.push({ pathname: '/transactions', params: { editId: move.id } })} onDelete={() => transactionCrud.confirmDelete(move.id)} />)}</> : null}
  </Page>;
}
