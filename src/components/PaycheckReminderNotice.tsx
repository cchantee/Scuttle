import React, { useEffect, useRef, useState } from 'react';
import { Modal, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useData } from '../state/DataProvider';
import { AppData, Paycheck } from '../domain/models';
import { newlyReceivedPaychecks, remindersForPaycheck } from '../domain/paycheckActivity';
import { formatDateDisplay } from '../domain/date';
import { formatMoney } from '../domain/money';
import { colors } from '../design/theme';
import { Text } from './typography';
import { Action } from './ui';

export function PaycheckReminderNotice() {
  const { data, loading, authUser }=useData(), router=useRouter();
  const previous=useRef<{owner:string;data:AppData}|null>(null);
  const [notice,setNotice]=useState<{paycheck:Paycheck;rows:ReturnType<typeof remindersForPaycheck>}|null>(null);
  useEffect(()=>{
    if(loading)return;
    const owner=authUser?.id??data.user.id, last=previous.current;
    previous.current={owner,data};
    if(!last||last.owner!==owner){setNotice(null);return;}
    const received=newlyReceivedPaychecks(last.data,data).sort((a,b)=>b.receivedAt.localeCompare(a.receivedAt))[0];
    if(received){const rows=remindersForPaycheck(data,received);if(rows.length)setNotice({paycheck:received,rows});}
  },[data,loading,authUser?.id]);
  const dismiss=()=>setNotice(null);
  return <Modal visible={Boolean(notice)} transparent animationType="fade" onRequestClose={dismiss}>
    <View style={{flex:1,backgroundColor:'rgba(52,68,71,0.35)',justifyContent:'center',alignItems:'center',padding:24}}>
      <View accessibilityViewIsModal style={{width:'100%',maxWidth:420,maxHeight:'80%',backgroundColor:colors.background,borderRadius:24,padding:22,gap:16}}>
        <Text style={{fontSize:22,fontWeight:'600'}}>Coming out of this paycheck</Text>
        <Text style={{color:colors.muted,fontSize:13}}>Due before your next payday · reminders only</Text>
        <ScrollView style={{flexGrow:0}} contentContainerStyle={{gap:14}}>{notice?.rows.map(({transaction,dueDate})=><View key={`${transaction.id}:${dueDate}`} style={{flexDirection:'row',gap:12,alignItems:'center'}}><View style={{flex:1,gap:4}}><Text style={{fontSize:15,fontWeight:'500'}}>{transaction.description}</Text><Text style={{fontSize:12,color:colors.muted}}>Due {formatDateDisplay(dueDate)}</Text></View><Text role="money">{formatMoney(transaction.amountCents)}</Text></View>)}</ScrollView>
        <View style={{flexDirection:'row',justifyContent:'space-between',borderTopWidth:1,borderColor:colors.border,paddingTop:12}}><Text>Total due</Text><Text role="money">{formatMoney(notice?.rows.reduce((n,r)=>n+r.transaction.amountCents,0)??0)}</Text></View>
        <Action label="View bills & reminders" variant="primary" fullWidth onPress={()=>{dismiss();router.push('/reminders');}}/>
        <Action label="Continue to my paycheck" variant="text" fullWidth onPress={dismiss}/>
      </View>
    </View>
  </Modal>;
}
