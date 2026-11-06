import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Href, useRouter } from 'expo-router';
import { Text } from '../src/components/typography';
import { Action, Card, DateField, Field, Feedback, Page, SelectId } from '../src/components/ui';
import { EmptyState } from '../src/components/coastal';
import { IconTile } from '../src/components/icons';
import { colors } from '../src/design/theme';
import { formatMoney } from '../src/domain/money';
import { useData } from '../src/state/DataProvider';
import { formatDateDisplay, normalizeDateInput } from '../src/domain/date';
import { filterHistory, historyRows, historyTotals, HistoryKind, HistoryRow } from '../src/domain/history';

const kinds:{id:HistoryKind|'all';title:string}[]=[{id:'all',title:'All activity'},{id:'income',title:'Money in'},{id:'expense',title:'Spending'},{id:'transfer',title:'Transfers'},{id:'planning',title:'Plans & goals'}];
export default function History(){
  const {data}=useData(),router=useRouter();
  const [from,setFrom]=useState(''),[to,setTo]=useState(''),[category,setCategory]=useState(''),[paycheck,setPaycheck]=useState(''),[account,setAccount]=useState(''),[search,setSearch]=useState('');
  const [kind,setKind]=useState<HistoryKind|'all'>('all'),[filtersOpen,setFiltersOpen]=useState(false);
  const start=from?normalizeDateInput(from):'',end=to?normalizeDateInput(to):'';
  const filterError=from&&!start?'Choose a valid From date.':to&&!end?'Choose a valid To date.':start&&end&&start>end?'The From date must be before the To date.':'';
  const all=useMemo(()=>historyRows(data),[data]);
  const items=useMemo(()=>filterError?[]:filterHistory(all,{from:start||undefined,to:end||undefined,categoryId:category,accountId:account,paycheckId:paycheck,kind,search}),[all,start,end,category,account,paycheck,kind,search,filterError]);
  const totals=historyTotals(items),filterCount=[from,to,category,paycheck,account].filter(Boolean).length;
  const groups=items.reduce((map,row)=>{const key=row.date.slice(0,7);map.set(key,[...(map.get(key)??[]),row]);return map;},new Map<string,HistoryRow[]>());
  const clear=()=>{setFrom('');setTo('');setCategory('');setPaycheck('');setAccount('');setSearch('');setKind('all');};
  return <Page title="Financial history"><Feedback/>

    <View style={{flexDirection:'row',gap:12}}><Card style={{flex:1,backgroundColor:colors.glass}}><Text style={{fontSize:12,color:colors.muted}}>Money in</Text><Text role="money" style={{fontSize:23}}>{formatMoney(totals.income)}</Text></Card><Card style={{flex:1,backgroundColor:colors.shell}}><Text style={{fontSize:12,color:colors.muted}}>Recorded spending</Text><Text role="money" style={{fontSize:23}}>{formatMoney(totals.spending)}</Text></Card></View>
    <Text style={{fontSize:11,color:colors.muted}}>Selected activity · paid records only</Text>
    <Field label="Search your history" value={search} onChangeText={setSearch} placeholder="Paycheck, bill, goal, or description"/>
    <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}><Text style={{fontSize:13,color:colors.muted}}>{items.length} {items.length===1?'record':'records'}</Text><Action label={`${filtersOpen?'Hide':'Show'} filters${filterCount?` (${filterCount})`:''}`} variant="text" onPress={()=>setFiltersOpen(!filtersOpen)}/></View>
    {filtersOpen?<Card><View style={{flexDirection:'row',gap:10}}><View style={{flex:1}}><DateField label="From date" value={from} onChangeText={setFrom} optional/></View><View style={{flex:1}}><DateField label="To date" value={to} onChangeText={setTo} optional/></View></View><SelectId label="Account" choices={data.accounts.map(a=>({id:a.id,title:a.name}))} value={account} onChange={setAccount}/><SelectId label="Category" choices={data.categories.map(c=>({id:c.id,title:c.name}))} value={category} onChange={setCategory}/><SelectId label="Paycheck" choices={data.paychecks.map(p=>({id:p.id,title:`${formatDateDisplay(p.receivedAt)} · ${formatMoney(p.amountCents)}`}))} value={paycheck} onChange={setPaycheck}/><Action label="Clear all filters" variant="text" fullWidth onPress={clear}/></Card>:null}
    {filterError?<Text accessibilityRole="alert" style={{fontSize:13}}>{filterError}</Text>:null}
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:7}}>{kinds.map(item=><Pressable key={item.id} accessibilityRole="button" accessibilityState={{selected:kind===item.id}} onPress={()=>setKind(item.id)} style={{minHeight:44,justifyContent:'center',paddingHorizontal:14,borderRadius:14,borderWidth:1,borderColor:kind===item.id?colors.text:colors.border,backgroundColor:kind===item.id?colors.text:colors.surface}}><Text style={{fontSize:12,color:kind===item.id?colors.surface:colors.text}}>{item.title}</Text></Pressable>)}</ScrollView>
    {!items.length?<EmptyState message={filterError?'Check your date range.':'No matching money moments.'}/>:null}
    {[...groups].map(([month,rows])=><View key={month} style={{gap:10}}><Text style={{fontSize:16,fontWeight:'600'}}>{new Date(`${month}-01T12:00:00`).toLocaleDateString(undefined,{month:'long',year:'numeric'})}</Text><Card style={{paddingVertical:0,gap:0}}>{rows.map((row,index)=><Pressable key={row.id} accessibilityRole="button" accessibilityLabel={`Open ${row.title}, ${formatDateDisplay(row.date)}`} onPress={()=>router.push(row.destination as Href)} style={{flexDirection:'row',alignItems:'center',gap:11,paddingVertical:15,borderBottomWidth:index<rows.length-1?1:0,borderColor:colors.border}}><IconTile name={row.kind==='transfer'?'move':row.kind==='income'?'paycheck':row.kind==='planning'?'goals':'transaction'} tint={row.kind==='income'?colors.glass:row.kind==='planning'?colors.mist:colors.shell}/><View style={{flex:1,gap:4}}><Text style={{fontSize:14,fontWeight:'500'}}>{row.title}</Text><Text style={{fontSize:11,color:colors.muted}}>{formatDateDisplay(row.date)} · {row.detail}</Text></View><View style={{maxWidth:'31%',alignItems:'flex-end',gap:3}}><Text role="money" style={{fontSize:15}}>{row.cashEffect===null?'':row.cashEffect<0?'−':'+'}{formatMoney(row.amountCents)}</Text><Text style={{fontSize:10,color:colors.muted}}>{row.kind==='planning'?'Plan / reminder':row.kind==='transfer'?'Internal transfer':row.kind==='income'?'Received':'Paid'}</Text></View><Text style={{color:colors.muted}}>›</Text></Pressable>)}</Card></View>)}
  </Page>;
}
