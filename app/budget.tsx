import React, { useState } from 'react';
import { Text } from 'react-native';
import { Action, Field, Feedback, Page, RecordLine, SelectId } from '../src/components/ui';
import { useCrud } from '../src/components/hooks';
import { formatMoney, parseMoney } from '../src/domain/money';
import { BudgetAllocation } from '../src/domain/models';
import { allocationSummary, allocatedForPaycheck, unallocatedForPaycheck } from '../src/domain/calculations';
import { useData } from '../src/state/DataProvider';

export default function Budget() {
  const cat = useCrud('categories'), alloc = useCrud('allocations'); const { data } = useData();
  const [name,setName]=useState(''), [paycheckId,setPaycheck]=useState(''), [categoryId,setCategory]=useState(''), [amount,setAmount]=useState('');
  const categorySave = async () => { if (!name.trim()) return alert('Enter a category name.'); const ok = await cat.submit({ name: name.trim() }); if (ok) setName(''); };
  const allocationSave = async () => { try { if (!paycheckId || !categoryId) return alert('Choose a paycheck and category.'); await alloc.submit({ paycheckId, categoryId, amountCents: parseMoney(amount) }); setAmount(''); } catch (e) { alert(e instanceof Error ? e.message : 'Invalid allocation.'); } };
  return <Page title="Budget categories and allocations"><Feedback />
    <Field label="New category name" value={name} onChangeText={setName} /><Action label="Add category" onPress={() => void categorySave()} />
    {cat.editingId ? <><Field label="Edit category name" value={name} onChangeText={setName} /><Action label="Save category" onPress={() => void categorySave()} /><Action label="Cancel" onPress={() => {cat.cancel();setName('');}} /></> : null}
    {data.categories.map(c => <RecordLine key={c.id} title={c.name} detail="Category" onEdit={() => { cat.setEditingId(c.id); setName(c.name); }} onDelete={() => cat.confirmDelete(c.id)} />)}
    <SelectId label="Paycheck" choices={data.paychecks.map(x=>({id:x.id,title:`${x.receivedAt} · ${formatMoney(x.amountCents)}`}))} value={paycheckId} onChange={setPaycheck} />
    <SelectId label="Category" choices={data.categories.map(x=>({id:x.id,title:x.name}))} value={categoryId} onChange={setCategory} />
    <Field label="Allocated amount" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0.00" /><Action label={alloc.editingId ? 'Save allocation' : 'Add allocation'} onPress={() => void allocationSave()} />{alloc.editingId ? <Action label="Cancel edit" onPress={() => alloc.cancel()} /> : null}
    {data.paychecks.map(p => <React.Fragment key={p.id}><Text>Paycheck {p.receivedAt}: {formatMoney(allocatedForPaycheck(data,p.id))} allocated · {formatMoney(unallocatedForPaycheck(data,p.id))} unallocated</Text>{data.allocations.filter(a=>a.paycheckId===p.id).map((a:BudgetAllocation)=>{const s=allocationSummary(data,a);return <RecordLine key={a.id} title={`${data.categories.find(c=>c.id===a.categoryId)?.name ?? 'Unknown category'} · ${formatMoney(s.allocatedCents)}`} detail={`${formatMoney(s.spentCents)} spent · ${formatMoney(s.remainingCents)} remaining`} onEdit={()=>{alloc.edit(a, x=>{setPaycheck(x.paycheckId);setCategory(x.categoryId);setAmount((x.amountCents/100).toFixed(2));});}} onDelete={()=>alloc.confirmDelete(a.id)} />;})}</React.Fragment>)}
  </Page>;
}
