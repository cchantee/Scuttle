import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { Action, Field, Feedback, Page, RecordLine } from '../src/components/ui';
import { useCrud } from '../src/components/hooks';
import { formatMoney, parseMoney } from '../src/domain/money';
import { Paycheck } from '../src/domain/models';
import { allocatedForPaycheck, unallocatedForPaycheck } from '../src/domain/calculations';
import { useData } from '../src/state/DataProvider';

export default function Paychecks() {
  const crud = useCrud('paychecks'); const { data } = useData();
  const [amount, setAmount] = useState(''); const [date, setDate] = useState(new Date().toISOString().slice(0,10)); const [source, setSource] = useState(''); const [notes, setNotes] = useState('');
  const reset = () => { setAmount(''); setDate(new Date().toISOString().slice(0,10)); setSource(''); setNotes(''); crud.cancel(); };
  const submit = async () => { try { await crud.submit({ amountCents: parseMoney(amount), receivedAt: date, source: source || undefined, notes: notes || undefined }); reset(); } catch (e) { alert(e instanceof Error ? e.message : 'Invalid paycheck.'); } };
  return <Page title="Paychecks"><Feedback /><Field label="Amount received" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0.00" /><Field label="Date received (YYYY-MM-DD)" value={date} onChangeText={setDate} /><Field label="Income source (optional)" value={source} onChangeText={setSource} /><Field label="Notes (optional)" value={notes} onChangeText={setNotes} multiline /><View style={{ flexDirection: 'row', gap: 8 }}><Action label={crud.editingId ? 'Save paycheck' : 'Add paycheck'} onPress={() => void submit()} />{crud.editingId ? <Action label="Cancel" onPress={reset} /> : null}</View>
    {([...data.paychecks] as Paycheck[]).sort((a,b) => b.receivedAt.localeCompare(a.receivedAt)).map(p => <RecordLine key={p.id} title={`${p.receivedAt} · ${formatMoney(p.amountCents)}`} detail={`${p.source ?? 'Income'} · Allocated ${formatMoney(allocatedForPaycheck(data,p.id))} · Unallocated ${formatMoney(unallocatedForPaycheck(data,p.id))}`} onEdit={() => { crud.edit(p, x => {setAmount((x.amountCents/100).toFixed(2));setDate(x.receivedAt);setSource(x.source ?? '');setNotes(x.notes ?? '');}); }} onDelete={() => crud.confirmDelete(p.id)} />)}
  </Page>;
}
