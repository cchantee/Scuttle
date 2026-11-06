import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { Action, Card, Feedback, Field, Page, ProgressBar, SectionTitle } from '../src/components/ui';
import { Text } from '../src/components/typography';
import { HarborBalance } from '../src/components/collaborative';
import { LoadingRecords } from '../src/components/LoadingRecords';
import { Icon, IconTile, categoryIcon } from '../src/components/icons';
import { TourHighlight, useWalkthrough } from '../src/components/walkthrough';
import { activeBudgetAllocations, allocatedForPaycheck, allocationSummary, cashAccountSummary, nextSubscriptionDue, unallocatedForPaycheck } from '../src/domain/calculations';
import { currentPaycheck, paycheckDestination } from '../src/domain/navigation';
import { searchScuttle } from '../src/domain/scuttleSearch';
import { formatMoney } from '../src/domain/money';
import { formatDateDisplay, todayISODate } from '../src/domain/date';
import { useData } from '../src/state/DataProvider';
import { colors } from '../src/design/theme';

export default function Dashboard(){
 const {data,loading,authConfigured,authLoading,authUser}=useData(),router=useRouter();
 const tour=useWalkthrough(),params=useLocalSearchParams<{walkthrough?:string}>();
 const [searchOpen,setSearchOpen]=useState(false),[search,setSearch]=useState('');
 const results=useMemo(()=>searchScuttle(data,search),[data,search]);
 useEffect(()=>{if(!tour?.active&&!tour?.dismissed&&(params.walkthrough==='1'||authUser?.walkthroughNeeded))tour?.start();},[params.walkthrough,authUser?.walkthroughNeeded,tour?.active,tour?.dismissed]);
 if(authConfigured&&authLoading||loading)return <LoadingRecords/>;
 if(authConfigured&&!authUser)return <Redirect href="/welcome"/>;
 const current=currentPaycheck(data),cash=cashAccountSummary(data);
 const allocated=current?allocatedForPaycheck(data,current.id):0,left=current?unallocatedForPaycheck(data,current.id):0;
 const budget=activeBudgetAllocations(data).sort((a,b)=>allocationSummary(data,a).remainingCents-allocationSummary(data,b).remainingCents).slice(0,3);
 const due=data.transactions.filter(t=>t.type==='subscription').map(t=>({t,date:nextSubscriptionDue(t,todayISODate(data.user))})).filter(r=>r.date).sort((a,b)=>a.date!.localeCompare(b.date!));
 const name=(authUser?.displayName||data.user.displayName||'there').trim().split(/\s+/)[0];
 return <Page title={`Good morning, ${name}`} headerRight={<View style={{flexDirection:'row',gap:6}}><Pressable accessibilityRole="button" accessibilityLabel={searchOpen?'Close search':'Search Scuttle'} onPress={()=>{setSearchOpen(!searchOpen);if(searchOpen)setSearch('');}} style={{width:44,height:44,alignItems:'center',justifyContent:'center',borderRadius:16,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border}}><Icon name="search"/></Pressable><Pressable accessibilityRole="button" accessibilityLabel="More and settings" onPress={()=>router.push('/more')} style={{width:44,height:44,alignItems:'center',justifyContent:'center'}}><Icon name="more"/></Pressable></View>}>
  <Feedback/>
  {searchOpen?<><Field label="Search Scuttle" value={search} onChangeText={setSearch} placeholder="Names, amounts, dates, or pages"/>{search.trim()?<Card>{results.map(r=><Action key={r.key} label={`${r.label} · ${r.detail}`} variant="text" onPress={()=>router.push(r.destination as Parameters<typeof router.push>[0])}/>)}{!results.length?<Text style={{color:colors.muted}}>No matching records.</Text>:null}</Card>:null}</>:null}
  <TourHighlight id="home-quick-views"><Pressable accessibilityRole="button" accessibilityLabel="Open current paycheck plan" onPress={()=>router.push(paycheckDestination(data))}><HarborBalance title="Current paycheck" amount={current?formatMoney(current.amountCents):'A fresh start'} subtitle={current?`${current.source||'Paycheck'} · ${formatDateDisplay(current.receivedAt)}`:'Record a paycheck to begin'}/></Pressable>
   {current?<><View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center'}}><View style={{gap:4}}><Text style={{fontSize:12,color:colors.muted}}>Allocated</Text><Text role="money" style={{fontSize:19}}>{formatMoney(allocated)}</Text></View><View style={{gap:4,alignItems:'flex-end'}}><Text style={{fontSize:12,color:colors.muted}}>{left<0?'Over assigned':'Left to assign'}</Text><Text role="money" style={{fontSize:23}}>{formatMoney(Math.abs(left))}</Text></View></View><ProgressBar value={allocated} max={current.amountCents} color={colors.teal}/></>:null}
   <Action label={current?'Open paycheck plan':'Add a paycheck'} variant="primary" fullWidth onPress={()=>router.push(current?paycheckDestination(data):{pathname:'/paychecks',params:{add:'1'}})}/>
  </TourHighlight>
  <View style={{flexDirection:'row',gap:12}}><Pressable accessibilityRole="button" accessibilityLabel="View accounts" onPress={()=>router.push('/accounts')} style={{flex:1,borderRadius:18,padding:16,gap:7,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border}}><Text style={{fontSize:12,color:colors.muted}}>In your accounts</Text><Text role="money" style={{fontSize:22}}>{formatMoney(cash.totalCashCents)}</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel="Edit next payday" onPress={()=>router.push('/payday')} style={{flex:1,borderRadius:18,padding:16,gap:7,backgroundColor:colors.shell}}><Text style={{fontSize:12,color:colors.muted}}>Next payday</Text><Text style={{fontSize:20,fontWeight:'600'}}>{data.user.nextPayday?formatDateDisplay(data.user.nextPayday):'Set a date'}</Text></Pressable></View>
  <Pressable accessibilityRole="button" accessibilityLabel="Open bills and reminders" onPress={()=>router.push('/reminders')} style={{flexDirection:'row',alignItems:'center',gap:12,padding:17,borderRadius:20,backgroundColor:colors.glass}}><IconTile name="calendar" tint={colors.surface}/><View style={{flex:1,gap:5}}><Text style={{fontSize:16,fontWeight:'600'}}>Bills & reminders</Text><Text style={{fontSize:12,color:colors.muted}}>{due.length?`Next: ${due[0].t.description} · ${formatDateDisplay(due[0].date!)}`:'No reminders scheduled'}</Text></View><Text>›</Text></Pressable>
  <SectionTitle right={<Action label="View all" variant="text" onPress={()=>router.push('/budget')}/>}>Budget check-in</SectionTitle>
  <Card style={{gap:0,paddingVertical:4}}>{budget.length?budget.map((a,index)=>{const s=allocationSummary(data,a),name=data.categories.find(c=>c.id===a.categoryId)?.name??'Category';return <Pressable accessibilityRole="button" accessibilityLabel={`Open ${name} budget`} key={a.id} onPress={()=>router.push({pathname:'/allocation/[id]',params:{id:a.id}})} style={{paddingVertical:15,borderBottomWidth:index<budget.length-1?1:0,borderColor:colors.border,gap:9}}><View style={{flexDirection:'row',alignItems:'center',gap:10}}><IconTile name={categoryIcon(name)} tint={s.remainingCents<0?colors.shell:colors.mist}/><Text style={{flex:1,fontSize:14,fontWeight:'500'}}>{name}</Text><Text style={{fontSize:12,color:s.remainingCents<0?colors.text:colors.muted}}>{formatMoney(Math.abs(s.remainingCents))} {s.remainingCents<0?'over budget':'left'}</Text></View><ProgressBar value={s.spentCents} max={a.amountCents} color={s.remainingCents<0?colors.coral:colors.teal}/></Pressable>;}):<Action label="Plan your categories" onPress={()=>router.push('/budget')}/>}</Card>
  <View style={{flexDirection:'row',gap:8}}><View style={{flex:1}}><Action label="Transactions" fullWidth onPress={()=>router.push('/transactions')}/></View><View style={{flex:1}}><Action label="Your insights" fullWidth onPress={()=>router.push('/insights')}/></View></View>
 </Page>;
}
