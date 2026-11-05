import React from 'react';
import { Pressable, View } from 'react-native';
import { colors } from '../design/theme';
import { Crab } from './coastal';
import { Text } from './typography';

export function HarborHero({ safeToSpend, detail, action }: { safeToSpend: string; detail: string; action: { label: string; onPress: () => void } }) {
  return <View style={{ minHeight: 184, padding: 18, borderRadius: 18, overflow: 'hidden', backgroundColor: colors.text, gap: 7 }}>
    <View pointerEvents="none" style={{ position: 'absolute', right: -28, bottom: -18, width: 235, height: 85, borderRadius: 90, backgroundColor: '#315866', opacity: .72 }} />
    <View pointerEvents="none" style={{ position: 'absolute', left: -28, bottom: -36, width: 225, height: 88, borderRadius: 90, backgroundColor: '#42716F', opacity: .56 }} />
    <Text style={{ color: '#fff', fontSize: 15 }}>Safe to Spend ⓘ</Text>
    <Text role="money" style={{ color: '#fff', fontSize: 40, lineHeight: 45 }}>{safeToSpend}</Text>
    <Text style={{ color: '#EAF4F0', fontSize: 13, maxWidth: '82%' }}>{detail}</Text>
    <Pressable accessibilityRole="button" onPress={action.onPress} style={({ pressed }) => ({ alignSelf: 'flex-start', minHeight: 35, paddingHorizontal: 12, borderRadius: 18, justifyContent: 'center', backgroundColor: pressed ? '#DDEBE5' : '#FFFDFC' })}><Text style={{ color: colors.text, fontSize: 13, fontWeight: '700' }}>{action.label} →</Text></Pressable>
  </View>;
}

export function CompanionCard({ title = "You've got this!", message, action }: { title?: string; message: string; action?: { label: string; onPress: () => void } }) {
  return <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 14, backgroundColor: '#FFF9F0', flexDirection: 'row', gap: 10, alignItems: 'center' }}>
    <Crab size={48} />
    <View style={{ flex: 1, gap: 3 }}><Text style={{ fontWeight: '700', fontSize: 15 }}>{title}</Text><Text style={{ color: colors.muted, fontSize: 13, lineHeight: 18 }}>{message}</Text>{action ? <Pressable accessibilityRole="button" onPress={action.onPress} style={{ alignSelf: 'flex-start', paddingTop: 5 }}><Text style={{ color: colors.teal, fontWeight: '700', fontSize: 13 }}>{action.label} →</Text></Pressable> : null}</View>
  </View>;
}

export function PlanGroup({ title, detail, amount, icon, onPress }: { title: string; detail: string; amount: string; icon: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => ({ borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 13, backgroundColor: pressed ? colors.glass : colors.surface, flexDirection: 'row', alignItems: 'center', gap: 10 })}>
    <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.shell, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 18 }}>{icon}</Text></View>
    <View style={{ flex: 1 }}><Text style={{ fontWeight: '700' }}>{title}</Text><Text style={{ color: colors.muted, fontSize: 12 }}>{detail}</Text></View><Text role="money" style={{ fontSize: 16 }}>{amount}</Text><Text>›</Text>
  </Pressable>;
}
