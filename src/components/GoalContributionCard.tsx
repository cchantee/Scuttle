import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { SavingsContribution } from '../domain/models';
import { formatMoney } from '../domain/money';
import { formatDateDisplay } from '../domain/date';
import { colors } from '../design/theme';
import { Action, Card } from './ui';
import { Icon } from './icons';
import { Text } from './typography';

export function GoalContributionCard({ contribution, accountName, onComplete, onTransfer, onEdit, onCancel }: {
  contribution: SavingsContribution; accountName: string;
  onComplete: () => void; onTransfer: () => void; onEdit: () => void; onCancel: () => void;
}) {
  const [menu, setMenu] = useState(false), [noteOpen, setNoteOpen] = useState(false);
  return <Card style={{ gap: 14 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <Text role="money" style={{ fontSize: 25 }}>{formatMoney(contribution.amountCents)}</Text>
      <View style={{ paddingHorizontal: 9, paddingVertical: 5, borderRadius: 20, backgroundColor: colors.glass }}><Text style={{ fontSize: 10, fontWeight: '600', letterSpacing: 0.5 }}>{contribution.status === 'pending' ? 'RESERVED' : 'SAVED'}</Text></View>
      <View style={{ flex: 1 }}/>
      <Pressable accessibilityRole="button" accessibilityLabel="Contribution actions" accessibilityState={{ expanded: menu }} onPress={() => setMenu(!menu)} style={{ width: 44, height: 44, justifyContent: 'center', alignItems: 'center' }}><Icon name="more" size={20}/></Pressable>
    </View>
    <View style={{ gap: 4 }}><Text style={{ fontSize: 13, color: colors.text }}>{accountName}</Text><Text style={{ fontSize: 12, color: colors.muted }}>{formatDateDisplay(contribution.date)}</Text></View>
    {contribution.status === 'pending' ? <Text style={{ fontSize: 12, color: colors.muted }}>Reserved money stays in this account but is unavailable for other spending.</Text> : null}<View style={{ flexDirection: 'row', gap: 10 }}>{contribution.status === 'pending' ? <View style={{ flex: 1 }}><Action label="Confirm saved" variant="primary" fullWidth onPress={onComplete}/></View> : null}<View style={{ flex: 1 }}><Action label="Move money" fullWidth onPress={onTransfer}/></View></View>
    {menu ? <View style={{ gap: 2, borderTopWidth: 1, borderColor: colors.border, paddingTop: 5 }}><Action label="Edit contribution" variant="text" onPress={() => { setMenu(false); onEdit(); }}/>{contribution.note ? <Action label={noteOpen ? 'Hide note' : 'View note'} variant="text" onPress={() => setNoteOpen(!noteOpen)}/> : null}<Action label="Cancel reservation" variant="text" destructive onPress={onCancel}/></View> : null}
    {noteOpen && contribution.note ? <Text style={{ fontSize: 12, color: colors.muted }}>{contribution.note}</Text> : null}
  </Card>;
}
