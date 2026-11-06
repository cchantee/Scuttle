import { currentPaycheck } from '../src/domain/navigation';
import { defaultActivityDate, transactionInPaycheck } from '../src/domain/paycheckActivity';
import { CoastalBalance } from '../src/components/coastal';
import { goalFundsHeld, goalHoldingAccount } from '../src/domain/goalFunds';
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useIsFocused, useLocalSearchParams, usePathname, useRouter } from 'expo-router';
import { colors } from '../src/design/theme';
import { Text } from '../src/components/typography';
import { Action, Card, DateField, Field, Feedback, Page, RecordLine, SelectId } from '../src/components/ui';
import { EmptyState } from '../src/components/coastal';
import { TourHighlight } from '../src/components/walkthrough';
import { useCrud } from '../src/components/hooks';
import { useData } from '../src/state/DataProvider';
import { newId, SubscriptionFrequency, Transaction } from '../src/domain/models';
import { formatMoney, parseMoney } from '../src/domain/money';
import { formatDateDisplay, formatDateInput, normalizeDateInput, todayDateInput, todayISODate } from '../src/domain/date';
import { payingAccountSelection } from '../src/domain/transactionAccounts';
import { billPaymentDraft, isBill, ledgerType, transactionKind, transactionTypeLabel, TransactionFormKind } from '../src/domain/transactionKinds';

const kinds: {id: TransactionFormKind; title: string}[] = [
  {id:'expense',title:'Expense'}, {id:'bill',title:'Bill'}, {id:'income',title:'Income'}, {id:'transfer',title:'Transfer'}, {id:'subscription',title:'Subscription'},
];
const frequencies: SubscriptionFrequency[] = ['weekly','biweekly','monthly','annual','custom'];
const filters = [{id:'all',title:'All types'}, {id:'expense',title:'Spending'}, {id:'bill',title:'Bills'}, {id:'income',title:'Income'}, {id:'transfer',title:'Transfers'}, {id:'subscription',title:'Subscriptions'}] as const;

export default function Transactions() {
  const crud=useCrud('transactions');
  const {data,loading,reportError,settleGoalContribution}=useData();
  const router=useRouter(), pathname=usePathname(), focused=useIsFocused();
  const params=useLocalSearchParams<{allocationId?:string;accountId?:string;editId?:string;goalContributionId?:string;type?:string;reminder?:string;scope?:string}>();
  const [formOpen,setFormOpen]=useState(pathname==='/transaction/new');
  const [kind,setKind]=useState<TransactionFormKind>('expense'), [scheduledBill,setScheduledBill]=useState(false);
  const [description,setDescription]=useState(''),[amount,setAmount]=useState(''),[date,setDate]=useState(formatDateInput(defaultActivityDate(data)));
  const [categoryId,setCategory]=useState(''),[allocationId,setAllocation]=useState(''),[accountId,setAccount]=useState(''),[toAccountId,setToAccount]=useState('');
  const [paycheckId,setPaycheckId]=useState(''),[notes,setNotes]=useState('');
  const [frequency,setFrequency]=useState<SubscriptionFrequency>('monthly'),[interval,setInterval]=useState(''),[dueDate,setDueDate]=useState(todayDateInput(data.user));
  const [scope,setScope]=useState('current');
  const current=currentPaycheck(data);
  const [filter,setFilter]=useState<typeof filters[number]['id']>('all'),[search,setSearch]=useState(''),[saved,setSaved]=useState(false),[busy,setBusy]=useState(false);
  const manualAccount=useRef(false), saving=useRef(false), applied=useRef('');
  const type=ledgerType(kind,scheduledBill), scheduled=type==='subscription', spending=type==='expense';
  const pending=data.contributions.find(c=>c.id===params.goalContributionId && goalFundsHeld(data,c));
  const routeKey=JSON.stringify([pathname,params.editId,params.allocationId,params.accountId,params.goalContributionId,params.type,params.reminder]);
  const clearDraft=()=>{
    manualAccount.current=false;crud.cancel();setKind('expense');setScheduledBill(false);setDescription('');setAmount('');setDate(formatDateInput(defaultActivityDate(data)));
    setCategory('');setAllocation('');setAccount('');setToAccount('');setPaycheckId('');setNotes('');setFrequency('monthly');setInterval('');setDueDate(todayDateInput(data.user));
  };
  const fill=(tx:Transaction)=>{
    manualAccount.current=true;setKind(transactionKind(data,tx));setScheduledBill(tx.type==='subscription');setDescription(tx.description);setAmount((tx.amountCents/100).toFixed(2));setDate(formatDateInput(tx.date));
    setCategory(tx.categoryId??'');setAllocation(tx.allocationId??'');setAccount(tx.accountId??'');setToAccount(tx.toAccountId??'');setPaycheckId(tx.paycheckId??'');setNotes(tx.notes??'');
    setFrequency(tx.subscriptionFrequency??'monthly');setInterval(tx.subscriptionIntervalDays?.toString()??'');setDueDate(formatDateInput(tx.nextDueDate??tx.date));setFormOpen(true);
  };
  useEffect(()=>{
    if(!focused){applied.current='';return;}
    if(loading||applied.current===routeKey)return;
    applied.current=routeKey;clearDraft();setFormOpen(pathname==='/transaction/new');
    if(params.scope==='all')setScope('all');
    if(params.reminder==='1')setScheduledBill(true);
    const tx=data.transactions.find(t=>t.id===params.editId);
    if(tx){fill(tx);crud.setEditingId(tx.id);return;}
    if(params.type&&kinds.some(k=>k.id===params.type))setKind(params.type as TransactionFormKind);
    const allocation=data.allocations.find(a=>a.id===params.allocationId);
    if(allocation){setAllocation(allocation.id);setCategory(allocation.categoryId);setFormOpen(true);}
    if(params.accountId&&data.accounts.some(a=>a.id===params.accountId)){manualAccount.current=true;setAccount(params.accountId);}
    if(pending){setKind('transfer');setDescription(`Goal contribution · ${data.goals.find(g=>g.id===pending.goalId)?.name??'Savings goal'}`);setAmount((pending.amountCents/100).toFixed(2));setAccount(goalHoldingAccount(data,pending)??'');manualAccount.current=true;setFormOpen(true);}
  },[focused,loading,routeKey]);
  useEffect(()=>{
    if(loading||!formOpen||!spending||crud.editingId||params.goalContributionId)return;
    const next=payingAccountSelection(data,{allocationId,categoryId},{accountId,manual:manualAccount.current});
    if(next!==accountId)setAccount(next);
  },[data,loading,formOpen,spending,crud.editingId,params.goalContributionId,allocationId,categoryId,accountId]);
  const close=()=>{
    clearDraft();setFormOpen(false);
    router.replace({pathname:'/transactions',params:{editId:undefined,allocationId:undefined,accountId:undefined,goalContributionId:undefined,type:undefined,reminder:undefined,scope:undefined}});
  };
  const submit=async()=>{
    if(saving.current)return;
    saving.current=true;setBusy(true);
    try{
      if((spending||type==='transfer')&&!accountId)throw new Error('Choose a paying account.');
      if(!description.trim())throw new Error(kind==='bill'?'Enter a bill name.':'Enter a payee or description.');
      const enteredDate=normalizeDateInput(date);
      if(!enteredDate)throw new Error('Enter a valid transaction date.');
      const nextDueDate=scheduled?normalizeDateInput(dueDate):undefined;
      if(scheduled&&!nextDueDate)throw new Error('Choose a valid next due date.');
      if(scheduled&&frequency==='custom'&&(!/^\d+$/.test(interval)||+interval<1||+interval>365))throw new Error('Choose a repeat interval from 1 to 365 days.');
      const allocation=data.allocations.find(a=>a.id===allocationId),previous=data.transactions.find(t=>t.id===crud.editingId);
      const fields={type,description:description.trim(),amountCents:parseMoney(amount),date:enteredDate,purpose:kind==='bill'?'bill' as const:undefined,
        categoryId:spending?(allocation?.categoryId??categoryId)||undefined:scheduled?categoryId||undefined:undefined,
        allocationId:spending?allocationId||undefined:undefined,accountId:accountId||undefined,toAccountId:type==='transfer'?toAccountId||undefined:undefined,
        paycheckId:type==='transfer'?paycheckId||undefined:undefined,notes:notes.trim()||undefined,goalContributionId:previous?.goalContributionId,
        subscriptionFrequency:scheduled?frequency:undefined,subscriptionIntervalDays:scheduled&&frequency==='custom'?+interval:undefined,nextDueDate:nextDueDate||undefined};
      const ok=params.goalContributionId?await settleGoalContribution(params.goalContributionId,{id:newId(),...fields}):await crud.submit(fields);
      if(ok){setSaved(true);close();}
    }catch(error){reportError(error instanceof Error?error.message:'Could not save this transaction.');}
    finally{saving.current=false;setBusy(false);}
  };
  const recordBillPayment=()=>{
    const tx=data.transactions.find(t=>t.id===crud.editingId);
    if(!tx)return;
    fill({id:'bill-payment-draft',...billPaymentDraft(data,tx,todayISODate(data.user))});crud.cancel();setScheduledBill(false);setPaycheckId('');manualAccount.current=Boolean(tx.accountId);
  };
  const filtered=[...data.transactions].filter(tx=>{
    if(tx.type==='subscription')return false;
    if(scope!=='all'&&!transactionInPaycheck(data,tx,current))return false;
    const query=search.trim().toLowerCase(),bill=isBill(data,tx);
    const matches=filter==='all'||filter==='bill'&&bill||filter!=='bill'&&filter!=='subscription'&&tx.type===filter;
    return matches&&(!query||`${tx.description} ${transactionTypeLabel(data,tx)} ${data.categories.find(c=>c.id===tx.categoryId)?.name??''} ${data.accounts.find(a=>a.id===tx.accountId)?.name??''} ${tx.date}`.toLowerCase().includes(query));
  }).sort((a,b)=>(b.type==='subscription'?b.nextDueDate??b.date:b.date).localeCompare(a.type==='subscription'?a.nextDueDate??a.date:a.date));
  const spent=filtered.filter(t=>t.type==='expense').reduce((n,t)=>n+t.amountCents,0);
  const editingScheduledBill=kind==='bill'&&scheduled&&Boolean(crud.editingId);
  return <Page title={formOpen?crud.editingId?'Edit transaction':'Add transaction':'Transactions'}><TourHighlight id="expense-main"><Feedback />
    {saved&&!formOpen?<View accessibilityLiveRegion="polite" style={{padding:13,borderRadius:14,backgroundColor:colors.glass}}><Text style={{fontSize:13}}>Your transaction was saved.</Text></View>:null}
    {!formOpen?<>
      <CoastalBalance title={scope==='all'?'All recorded spending':'Spending this paycheck'} amount={formatMoney(spent)} subtitle={scope==='all'?'All paychecks':current?`${current.source || 'Paycheck'} · ${formatDateDisplay(current.receivedAt)}`:'Record a paycheck to start'}/>
      <SelectId label="Show transactions" choices={[{id:'current',title:'This paycheck'},{id:'all',title:'All'}]} value={scope} onChange={value=>setScope(value||'current')}/>
      <Action label="Bills & reminders →" variant="text" onPress={()=>router.push('/reminders')}/>
      <Action label="+ Add transaction" variant="primary" fullWidth onPress={()=>router.push('/transaction/new')} />
      <Field label="Search activity" value={search} onChangeText={setSearch} placeholder="Payee, bill, account, or category" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:7}}>{filters.filter(f=>f.id!=='subscription').map(f=><Chip key={f.id} label={f.title} selected={filter===f.id} onPress={()=>setFilter(f.id)} />)}</ScrollView>
      {!filtered.length?<EmptyState message={scope==='all'?'No matching activity.':'No transactions for this paycheck yet.'}/>:null}
      {filtered.map(tx=><RecordLine key={tx.id} icon={tx.type==='transfer'?'move':isBill(data,tx)?'home':tx.type==='subscription'?'calendar':'transaction'} title={tx.description}
        amount={`${tx.type==='expense'?'−':tx.type==='income'?'+':''}${formatMoney(tx.amountCents)}`}
        detail={`${transactionTypeLabel(data,tx)} · ${formatDateDisplay(tx.type==='subscription'?tx.nextDueDate??tx.date:tx.date)}${tx.accountId?` · ${data.accounts.find(a=>a.id===tx.accountId)?.name??'Account'}`:''}`}
        onView={()=>{fill(tx);crud.setEditingId(tx.id);}} onEdit={()=>{fill(tx);crud.setEditingId(tx.id);}} onDelete={()=>crud.confirmDelete(tx.id)} />)}
    </>:<>

      <View style={{gap:10}}><Text style={{fontSize:14,fontWeight:'600'}}>Transaction type</Text><View style={{flexDirection:'row',flexWrap:'wrap',gap:7}}>{kinds.filter(k=>!params.goalContributionId||k.id==='transfer').map(k=><Chip key={k.id} label={k.title} selected={kind===k.id} onPress={()=>setKind(k.id)} />)}</View></View>
      {kind==='bill'&&!editingScheduledBill?<Card><Text style={{fontSize:14,fontWeight:'600'}}>Is this bill paid?</Text><View style={{flexDirection:'row',gap:8}}><Chip label="Paid bill" selected={!scheduledBill} onPress={()=>setScheduledBill(false)} /><Chip label="Schedule reminder" selected={scheduledBill} onPress={()=>setScheduledBill(true)} /></View></Card>:null}
      {editingScheduledBill?<Card><Text style={{fontWeight:'600'}}>Scheduled bill</Text><Action label="Record a payment" onPress={recordBillPayment}/></Card>:null}
      <Card>
        <Field label={kind==='bill'?'Bill name':'Payee / description'} value={description} onChangeText={setDescription} placeholder={kind==='bill'?'e.g. Apartment rent':'e.g. Groceries'} />
        {params.goalContributionId?<View><Text style={{fontSize:12,color:colors.muted}}>Amount to move</Text><Text role="money" style={{fontSize:26}}>{formatMoney(pending?.amountCents??0)}</Text></View>:<Field label="Amount" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0.00" />}
        {!scheduled?<DateField label={kind==='bill'?'Payment date':'Date'} value={date} onChangeText={setDate}/>:<><DateField label="Next due date" value={dueDate} onChangeText={setDueDate}/><SelectId label="Repeat" choices={frequencies.map(f=>({id:f,title:f==='biweekly'?'Every two weeks':f==='custom'?'Custom interval':f[0].toUpperCase()+f.slice(1)}))} value={frequency} onChange={value=>{if(value)setFrequency(value as SubscriptionFrequency);}}/>{frequency==='custom'?<Field label="Repeat every (days)" value={interval} onChangeText={setInterval} keyboardType="numeric" placeholder="1–365"/>:null}</>}
        {spending||scheduled?<SelectId label={kind==='bill'?'Bill category':'Category (optional)'} choices={data.categories.map(c=>({id:c.id,title:c.name}))} value={categoryId} onChange={value=>{setCategory(value);setAllocation('');}} create="category"/>:null}
        {params.goalContributionId?<Text style={{fontSize:13}}>Funding account: {data.accounts.find(a=>a.id===accountId)?.name??'Select an account'}</Text>:<SelectId label={type==='transfer'?'From account':scheduled?'Account charged (optional)':type==='income'?'Receiving account':'Paying account'} choices={data.accounts.map(a=>({id:a.id,title:a.name}))} value={accountId} onChange={value=>{manualAccount.current=true;setAccount(value);if(value===toAccountId)setToAccount('');}} create="account"/>}
        {type==='transfer'?<SelectId label="To account" choices={data.accounts.filter(a=>a.id!==accountId).map(a=>({id:a.id,title:a.name}))} value={toAccountId} onChange={setToAccount}/>:null}

        <Field label="Notes (optional)" value={notes} onChangeText={setNotes} multiline/>
      </Card>
      <Action label={busy?'Saving…':params.goalContributionId?'Move money':crud.editingId?'Save changes':kind==='bill'?scheduled?'Save bill reminder':'Save bill payment':scheduled?'Save subscription':'Save transaction'} variant="primary" fullWidth onPress={()=>void submit()}/>
      <Action label="Cancel" variant="text" fullWidth onPress={close}/>
    </>}
  </TourHighlight></Page>;
}
function Chip({label,selected,onPress}:{label:string;selected:boolean;onPress:()=>void}){
  return <Pressable accessibilityRole="button" accessibilityState={{selected}} onPress={onPress} style={{minHeight:44,paddingHorizontal:14,paddingVertical:11,borderRadius:14,borderWidth:1,borderColor:selected?colors.text:colors.border,backgroundColor:selected?colors.text:colors.surface,justifyContent:'center'}}><Text style={{fontSize:13,fontWeight:selected?'600':'400',color:selected?colors.surface:colors.text}}>{label}</Text></Pressable>;
}
