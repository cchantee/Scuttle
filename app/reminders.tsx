import React from 'react';
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
 const {data}=useData(),router=useRouter();
 const rows=data.transactions.filter(t=>t.type==='subscription').map(t=>({t,due:nextSubscriptionDue(t,todayISODate(data.user))})).filter(r=>r.due).sort((a,b)=>a.due!.localeCompare(b.due!));
 return <Page title="Bills & reminders"><Feedback/><TourHighlight id="reminders-main">
   <View style={{flexDirection:'row',gap:10}}><View style={{flex:1}}><Action label="+ Bill reminder" fullWidth onPress={()=>router.push({pathname:'/transaction/new',params:{type:'bill',reminder:'1'}})}/></View><View style={{flex:1}}><Action label="+ Subscription" fullWidth onPress={()=>router.push({pathname:'/transaction/new',params:{type:'subscription'}})}/></View></View>
   {!rows.length?<Card><Text style={{color:colors.muted}}>No reminders yet.</Text></Card>:<Card style={{gap:0,paddingVertical:4}}>{rows.map(({t,due},index)=><Pressable accessibilityRole="button" accessibilityLabel={`Open ${t.description} reminder`} key={t.id} onPress={()=>router.push({pathname:'/transactions',params:{editId:t.id}})} style={{flexDirection:'row',alignItems:'center',gap:12,paddingVertical:18,borderBottomWidth:index<rows.length-1?1:0,borderColor:colors.border}}><IconTile name={isBill(data,t)?'home':'calendar'} tint={isBill(data,t)?colors.glass:colors.shell}/><View style={{flex:1,gap:5}}><Text style={{fontSize:16,fontWeight:'500'}}>{t.description}</Text><Text style={{fontSize:12,color:colors.muted}}>Due {formatDateDisplay(due!)} · {t.subscriptionFrequency==='monthly'?'Monthly':t.subscriptionFrequency}</Text></View><Text role="money" style={{fontSize:17}}>{formatMoney(t.amountCents)}</Text><Text style={{color:colors.muted}}>›</Text></Pressable>)}</Card>}
 </TourHighlight></Page>;
}
