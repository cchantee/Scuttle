import React, { useState } from 'react';
import { Text } from '../design/Text';
import { colors } from '../design/theme';
import { useData } from '../state/DataProvider';
import { Action, Card, DateField, Disclosure, Field, SelectId } from './ui';
import { PaydayFrequency } from '../domain/models';
import { calculateNextPayday, formatDateDisplay, formatDateInput, normalizeDateInput, todayDateInput, todayISODate } from '../domain/date';
import { TourHighlight } from './walkthrough';
export function PaydayCard() {
  const { data, saveNextPayday } = useData();
  const user = data.user;
  const [date, setDate] = useState(user.nextPayday ? formatDateInput(user.nextPayday) : todayDateInput(data.user));
  const [frequency, setFrequency] = useState<PaydayFrequency>(user.paydayFrequency || 'biweekly');
  const [interval, setInterval] = useState(user.paydayIntervalDays?.toString() || '');
  const [message, setMessage] = useState('');
  const upcoming = user.nextPayday && user.paydayFrequency ? calculateNextPayday(user.nextPayday, todayISODate(data.user), user.paydayFrequency, user.paydayIntervalDays) : user.nextPayday;
  const save = async () => {
    const normalized = normalizeDateInput(date);
    if (!normalized) { setMessage('Enter a valid payday date.'); return; }
    if (frequency === 'custom' && (!/^\d+$/.test(interval) || +interval < 1 || +interval > 365)) { setMessage('Choose a repeat interval from 1 to 365 days.'); return; }
    if (await saveNextPayday(normalized, frequency, frequency === 'custom' ? +interval : undefined)) setMessage('Payday schedule saved.');
  };
  return <TourHighlight id="home-next-payday"><Card><Text style={{ color: colors.muted }}>Next payday</Text><Text style={{ fontSize: 20, lineHeight: 28, fontWeight: '700' }}>{upcoming ? formatDateDisplay(upcoming) : 'Add your payday rhythm'}</Text><Disclosure title={upcoming ? 'Change payday schedule' : 'Set a payday schedule'}><DateField label="Next payday" value={date} onChangeText={setDate} /><SelectId label="How often are you paid?" value={frequency} onChange={value => { if (value) setFrequency(value as PaydayFrequency); }} choices={[{ id: 'weekly', title: 'Weekly' }, { id: 'biweekly', title: 'Every two weeks' }, { id: 'monthly', title: 'Monthly' }, { id: 'custom', title: 'Every N days' }]} />{frequency === 'custom' ? <Field label="Days between paychecks" value={interval} onChangeText={setInterval} keyboardType="numeric" /> : null}<Action label="Save payday schedule" onPress={save} />{message ? <Text accessibilityLiveRegion="polite">{message}</Text> : null}</Disclosure></Card></TourHighlight>;
}
