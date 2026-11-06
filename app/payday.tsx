import React, { useState } from 'react';
import { useRouter } from 'expo-router';
import { useData } from '../src/state/DataProvider';
import { Action, Card, DateField, Feedback, Field, Page, SelectId } from '../src/components/ui';
import { PaydayFrequency } from '../src/domain/models';
import { formatDateInput, normalizeDateInput, todayDateInput } from '../src/domain/date';
export default function Payday(){
 const {data,saveNextPayday,reportError}=useData(),router=useRouter();
 const [date,setDate]=useState(data.user.nextPayday?formatDateInput(data.user.nextPayday):todayDateInput(data.user));
 const [frequency,setFrequency]=useState<PaydayFrequency>(data.user.paydayFrequency??'biweekly'),[interval,setInterval]=useState(String(data.user.paydayIntervalDays??'')),[saving,setSaving]=useState(false);
 const save=async()=>{if(saving)return;const iso=normalizeDateInput(date);if(!iso)return reportError('Enter a valid date as M/D/YYYY.');if(frequency==='custom'&&!/^\d+$/.test(interval))return reportError('Enter a whole number of days between paychecks.');setSaving(true);try{if(await saveNextPayday(iso,frequency,frequency==='custom'?Number(interval):undefined))router.back();}finally{setSaving(false);}};
 return <Page title="Next payday"><Feedback/><Card><DateField label="Next paycheck date" value={date} onChangeText={setDate}/><SelectId label="How often are you paid?" choices={[{id:'weekly',title:'Weekly'},{id:'biweekly',title:'Every two weeks'},{id:'monthly',title:'Monthly'},{id:'custom',title:'Other interval'}]} value={frequency} onChange={v=>{if(v)setFrequency(v as PaydayFrequency);}}/>{frequency==='custom'?<Field label="Days between paychecks" value={interval} onChangeText={setInterval} keyboardType="numeric"/>:null}</Card><Action label={saving?'Saving…':'Save payday'} variant="primary" fullWidth onPress={()=>void save()}/><Action label="Cancel" variant="text" onPress={()=>router.back()}/></Page>;
}
