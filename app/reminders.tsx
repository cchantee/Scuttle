import React, { useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useData } from '../src/state/DataProvider';
import { colors } from '../src/design/theme';
import { Text } from '../src/components/typography';
import { IconTile } from '../src/components/icons';
import { Action, Card, Page, Feedback } from '../src/components/ui';
import { TourHighlight } from '../src/components/walkthrough';
import { nextSubscriptionDue } from '../src/domain/calculations';
import { formatMoney } from '../src/domain/money';
import { formatDateDisplay, todayISODate } from '../src/domain/date';
import { isBill } from '../src/domain/transactionKinds';
export default function Reminders(){
 const {data,planSubscription}=useData(),router=useRouter();
 const [adding,setAdding]=useState(''),busy=useRef(false);
 const paycheck=[...data.paychecks].filter(p=>!p.budgetArchived).sort((a,b)=>b.receivedAt.localeCompare(a.receivedAt))[0];
 const addToPaycheck=async(id:string)=>{if(busy.current)return;busy.current=true;setAdding(id);try{await planSubscription(id);}finally{busy.current=false;setAdding('');}};
 const rows=data.transactions.filter(t=>t.type==='subscription').map(t=>({t,due:nextSubscriptionDue(t,todayISODate(data.user))})).filter(r=>r.due).sort((a,b)=>a.due!.localeCompare(b.due!));
 return <Page title="Bills & reminders"><Feedback/><TourHighlight id="reminders-main">
   <View style={{flexDirection:'row',gap:10}}><View style={{flex:1}}><Action label="+ Bill reminder" fullWidth onPress={()=>router.push({pathname:'/transaction/new',params:{type:'bill',reminder:'1'}})}/></View><View style={{flex:1}}><Action label="+ Subscription" fullWidth onPress={()=>router.push({pathname:'/transaction/new',params:{type:'subscription'}})}/></View></View>
   {!rows.length?<Card><Text style={{color:colors.muted}}>No reminders yet.</Text></Card>:<Card style={{gap:0,paddingVertical:4}}>{rows.map(({t,due},index)=>{
     const allocation=paycheck?data.allocations.find(a=>a.subscriptionId===t.id&&a.paycheckId===paycheck.id):undefined;
     return <View key={t.id} style={{paddingVertical:16,gap:10,borderBottomWidth:index<rows.length-1?1:0,borderColor:colors.border}}>
       <Pressable accessibilityRole="button" accessibilityLabel={`Open ${t.description} reminder`} onPress={()=>router.push({pathname:'/transactions',params:{editId:t.id}})} style={{flexDirection:'row',alignItems:'center',gap:12}}><IconTile name={isBill(data,t)?'home':'calendar'} tint={isBill(data,t)?colors.glass:colors.shell}/><View style={{flex:1,gap:5}}><Text style={{fontSize:16,fontWeight:'500'}}>{t.description}</Text><Text style={{fontSize:12,color:colors.muted}}>Due {formatDateDisplay(due!)} · {t.subscriptionFrequency==='monthly'?'Monthly':t.subscriptionFrequency}</Text></View><Text role="money" style={{fontSize:17}}>{formatMoney(t.amountCents)}</Text><Text style={{color:colors.muted}}>›</Text></Pressable>
       {allocation?<Action label="In paycheck · View budget" fullWidth onPress={()=>router.push({pathname:'/allocation/[id]',params:{id:allocation.id}})}/>:<Action label={adding===t.id?'Adding…':'Add to paycheck'} fullWidth onPress={()=>void addToPaycheck(t.id)}/>}
     </View>;
   })}</Card>}

 </TourHighlight></Page>;
}
