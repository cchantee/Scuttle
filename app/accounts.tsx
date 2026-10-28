import React, { useState } from 'react';
import { Text } from 'react-native';
import { Action, Field, Feedback, Page, RecordLine } from '../src/components/ui';
import { useCrud } from '../src/components/hooks';
import { AccountType } from '../src/domain/models';
import { accountBalance } from '../src/domain/calculations';
import { formatMoney, parseMoney } from '../src/domain/money';
import { useData } from '../src/state/DataProvider';

const types: AccountType[] = ['checking','savings','high_yield_savings','cash','credit_card'];
export default function Accounts(){const crud=useCrud('accounts'),{data}=useData();const [name,setName]=useState(''),[type,setType]=useState<AccountType>('checking'),[balance,setBalance]=useState('0.00'),[notes,setNotes]=useState('');
const reset=()=>{setName('');setType('checking');setBalance('0.00');setNotes('');crud.cancel();};
const submit=async()=>{try{if(!name.trim())return alert('Enter an account name.');await crud.submit({name:name.trim(),type,initialBalanceCents:parseMoney(balance),notes:notes||undefined});reset();}catch(e){alert(e instanceof Error?e.message:'Invalid amount.');}};
return <Page title="Virtual accounts"><Feedback /><Field label="Account name" value={name} onChangeText={setName}/><Text>Account type</Text>{types.map(t=><Action key={t} label={`${type===t?'✓ ':''}${t}`} onPress={()=>setType(t)} />)}<Field label={type==='credit_card'?'Starting amount owed':'Starting account balance'} value={balance} onChangeText={setBalance} keyboardType="decimal-pad"/><Field label="Notes" value={notes} onChangeText={setNotes}/><Action label={crud.editingId?'Save account':'Add account'} onPress={()=>void submit()}/>{crud.editingId?<Action label="Cancel" onPress={reset}/>:null}
{data.accounts.map(a=><RecordLine key={a.id} title={a.name} detail={`${a.type==='credit_card'?'Outstanding balance':'Account balance'}: ${formatMoney(accountBalance(data,a))} · ${a.type}`} onEdit={()=>crud.edit(a,x=>{setName(x.name);setType(x.type);setBalance((x.initialBalanceCents/100).toFixed(2));setNotes(x.notes??'');})} onDelete={()=>crud.confirmDelete(a.id)}/>)}
</Page>;}
