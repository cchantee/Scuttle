import { Text } from '../src/components/typography';
import React, { useMemo, useState } from 'react';

import { Link } from 'expo-router';
import { Action, DateField, Feedback, Page } from '../src/components/ui';
import { formatMoney } from '../src/domain/money';
import { useData } from '../src/state/DataProvider';
import { formatDateDisplay, normalizeDateInput } from '../src/domain/date';

export default function History(){const {data}=useData();const [from,setFrom]=useState(''),[to,setTo]=useState(''),[category,setCategory]=useState(''),[paycheck,setPaycheck]=useState(''),[account,setAccount]=useState('');
const items=useMemo(()=>{
 const normalizedFrom=from?normalizeDateInput(from):''; const normalizedTo=to?normalizeDateInput(to):'';
 const rows:any[]=[];
 data.paychecks.forEach(p=>rows.push({id:`p-${p.id}`,date:p.receivedAt,label:`Paycheck · ${p.source??'Income'}`,amount:p.amountCents,detail:`Income received${p.accountId?` · ${data.accounts.find(a=>a.id===p.accountId)?.name??'Account'}`:''}`,paycheckId:p.id,accountId:p.accountId,route:'/paychecks'}));
 data.allocations.forEach(a=>{const p=data.paychecks.find(x=>x.id===a.paycheckId);const c=data.categories.find(x=>x.id===a.categoryId);rows.push({id:`a-${a.id}`,date:p?.receivedAt??'',label:`Allocation · ${c?.name??'Category'}`,amount:a.amountCents,detail:`Paycheck ${p?.receivedAt??'missing'}`,categoryId:a.categoryId,paycheckId:a.paycheckId,route:'/budget'});});
 data.transactions.forEach(t=>rows.push({id:`t-${t.id}`,date:t.date,label:`${t.type} · ${t.description}`,amount:t.amountCents,detail:`${data.categories.find(c=>c.id===t.categoryId)?.name??''}${data.accounts.find(a=>a.id===t.accountId)?` · ${data.accounts.find(a=>a.id===t.accountId)?.name}`:''}`,categoryId:t.categoryId,accountId:t.accountId,toAccountId:t.toAccountId,paycheckId:t.paycheckId??data.allocations.find(a=>a.id===t.allocationId)?.paycheckId,route:'/transactions'}));
 data.contributions.forEach(c=>rows.push({id:`c-${c.id}`,date:c.date,label:`Savings contribution · ${data.goals.find(g=>g.id===c.goalId)?.name??'Goal'}`,amount:c.amountCents,detail:c.note??'Goal ledger',route:'/goals'}));
 return rows.filter(x=>(!from||!normalizedFrom||x.date>=normalizedFrom)&&(!to||!normalizedTo||x.date<=normalizedTo)&&(!category||x.categoryId===category)&&(!paycheck||x.paycheckId===paycheck)&&(!account||x.accountId===account||x.toAccountId===account)).sort((a,b)=>b.date.localeCompare(a.date));
},[data,from,to,category,paycheck,account]);
return <Page title="Financial history"><Feedback /><DateField label="From date" value={from} onChangeText={setFrom} optional/><DateField label="To date" value={to} onChangeText={setTo} optional/><Text>Category filter</Text><Action label={category?'Clear category filter':'All categories'} onPress={()=>setCategory('')}/>{data.categories.map(c=><Action key={c.id} label={`${category===c.id?'✓ ':''}${c.name}`} onPress={()=>setCategory(category===c.id?'':c.id)}/>)}<Text>Paycheck filter</Text><Action label={paycheck?'Clear paycheck filter':'All paychecks'} onPress={()=>setPaycheck('')}/>{data.paychecks.map(p=><Action key={p.id} label={`${paycheck===p.id?'✓ ':''}${formatDateDisplay(p.receivedAt)} · ${formatMoney(p.amountCents)}`} onPress={()=>setPaycheck(paycheck===p.id?'':p.id)}/>)}<Text>Account filter</Text><Action label={account?'Clear account filter':'All accounts'} onPress={()=>setAccount('')}/>{data.accounts.map(a=><Action key={a.id} label={`${account===a.id?'✓ ':''}${a.name}`} onPress={()=>setAccount(account===a.id?'':a.id)}/>)}
{items.length?items.map(item=><Link key={item.id} href={item.route}><Text>{formatDateDisplay(item.date)} · {item.label} · {formatMoney(item.amount)} · {item.detail} · Open record list to edit</Text></Link>):<Text>No matching history records.</Text>}<Text>Records can be edited from their section:</Text><Link href="/paychecks">Paychecks</Link><Link href="/budget">Allocations</Link><Link href="/transactions">Transactions</Link><Link href="/goals">Contributions</Link></Page>;
}
