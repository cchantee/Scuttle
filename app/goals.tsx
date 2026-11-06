import { HarborBalance as CoastalBalance } from '../src/components/collaborative';
import { goalOverview } from '../src/domain/goalOverview';
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useIsFocused, useLocalSearchParams, usePathname, useRouter } from 'expo-router';
import { Text } from '../src/components/typography';
import { Action, Card, DateField, Field, Feedback, Page, RecordLine, SectionTitle } from '../src/components/ui';
import { EmptyState } from '../src/components/coastal';
import { categoryIcon } from '../src/components/icons';
import { colors } from '../src/design/theme';
import { useCrud } from '../src/components/hooks';
import { goalSummary, pendingForGoal } from '../src/domain/calculations';
import { formatMoney, parseMoney } from '../src/domain/money';
import { useData } from '../src/state/DataProvider';
import { formatDateInput, normalizeDateInput } from '../src/domain/date';

export default function Goals(){
  const crud=useCrud('goals'),{data,reportError}=useData(),router=useRouter(),pathname=usePathname(),focused=useIsFocused();
  const params=useLocalSearchParams<{returnTo?:string}>();
  const [formOpen,setFormOpen]=useState(pathname==='/goal/new'),[name,setName]=useState(''),[target,setTarget]=useState(''),[initial,setInitial]=useState(''),[targetDate,setTargetDate]=useState('');
  const clear=()=>{setName('');setTarget('');setInitial('');setTargetDate('');crud.cancel();};
  useEffect(()=>{if(!focused)return;clear();setFormOpen(pathname==='/goal/new');},[focused,pathname]);
  const close=()=>{clear();setFormOpen(false);if(pathname==='/goal/new')router.replace(params.returnTo==='add-to-goal'?'/add-to-goal':'/goals');};
  const save=async()=>{
    try{
      if(!name.trim())throw new Error('Give your goal a name.');
      const targetCents=parseMoney(target);if(targetCents<=0)throw new Error('Choose a target greater than zero.');
      const normalized=targetDate?normalizeDateInput(targetDate):undefined;if(targetDate&&!normalized)throw new Error('Choose a valid target date.');
      const ok=await crud.submit({name:name.trim(),targetCents,initialSavedCents:parseMoney(initial.trim()||'0'),targetDate:normalized});if(ok)close();
    }catch(error){reportError(error instanceof Error?error.message:'Check your goal amounts.');}
  };
  const overview=goalOverview(data),saved=overview.setAsideCents,reserved=overview.reservedCents;
  return <Page title={formOpen?crud.editingId?'Edit savings goal':'Create a goal':'Your goals'}><Feedback/>
    {formOpen?<>

      <Card><Field label="Goal name" value={name} onChangeText={setName} placeholder="e.g. Moving Fund"/><Field label="Target amount" value={target} onChangeText={setTarget} keyboardType="decimal-pad" placeholder="0.00"/><Field label="Already saved (optional)" value={initial} onChangeText={setInitial} keyboardType="decimal-pad" placeholder="0.00"/><Text style={{fontSize:12,color:colors.muted}}>This records money you have already saved. It does not add money to your bank account.</Text><DateField label="Target date" value={targetDate} onChangeText={setTargetDate} optional/></Card>
      <Action label={crud.editingId?'Save changes':'Create savings goal'} variant="primary" fullWidth onPress={()=>void save()}/><Action label="Cancel" fullWidth variant="text" onPress={close}/>
    </>:<>
      <CoastalBalance title="Set aside for your goals" amount={formatMoney(saved)} subtitle={`${data.goals.length} ${data.goals.length===1?'goal':'goals'}${reserved?` · ${formatMoney(reserved)} reserved in accounts`:''}`}/>
      <Action label="+ Create a savings goal" variant="primary" fullWidth onPress={()=>router.push('/goal/new')}/>
      <SectionTitle>What you’re working toward</SectionTitle>
      {!data.goals.length?<EmptyState message="Your next chapter starts here."/>:data.goals.map(goal=>{
        const summary=goalSummary(data,goal),pending=pendingForGoal(data,goal.id);
        return <Card key={goal.id} style={{padding:14}}><RecordLine icon={categoryIcon(goal.name)} title={goal.name} amount={formatMoney(summary.savedCents)} detail={`of ${formatMoney(goal.targetCents)}${pending?' · includes reserved funds':''}`} progress={{value:summary.savedCents,max:goal.targetCents,color:colors.teal,label:`${Math.round(summary.progressPercent)}%`}} onView={()=>router.push({pathname:'/goal/[id]',params:{id:goal.id}})} onEdit={()=>{setName(goal.name);setTarget((goal.targetCents/100).toFixed(2));setInitial((goal.initialSavedCents/100).toFixed(2));setTargetDate(goal.targetDate?formatDateInput(goal.targetDate):'');crud.setEditingId(goal.id);setFormOpen(true);}} onDelete={()=>crud.confirmDelete(goal.id)}/></Card>;
      })}

    </>}
  </Page>;
}
