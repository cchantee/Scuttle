import React from 'react';
import { View } from 'react-native';
import { Text } from '../design/Text';
import { colors } from '../design/theme';

/** Native geometric recreation of the supplied forward-moving Scuttle mark. */
export function Mascot({ size = 48, mood = 'ready' }: { size?: number; mood?: 'ready' | 'rest' | 'celebrate' }) {
  return <View accessible={false} importantForAccessibility="no-hide-descendants" style={{ width: size, height: size }}>
    <View style={{ width: 48, height: 48, transform: [{ scale: size / 48 }], transformOrigin: 'top left' }}>
      <View style={{ position: 'absolute', left: 7, top: 12, width: 32, height: 23, backgroundColor: colors.evergreen, borderTopLeftRadius: 24, borderTopRightRadius: 20, borderBottomLeftRadius: 13, borderBottomRightRadius: 8, transform: [{ rotate: '-12deg' }] }} />
      <View style={{ position: 'absolute', left: 29, top: 19, width: 13, height: 9, backgroundColor: colors.evergreen, borderTopRightRadius: 12, borderBottomRightRadius: 3 }} />
      <View style={{ position: 'absolute', left: 29, top: 18, width: 4, height: mood === 'rest' ? 2 : 4, borderRadius: 3, backgroundColor: colors.lime }} />
      <View style={{ position: 'absolute', left: 14, top: 32, height: 10, width: 3, borderRadius: 2, backgroundColor: colors.evergreen, transform: [{ rotate: mood === 'celebrate' ? '45deg' : '28deg' }] }} />
      <View style={{ position: 'absolute', left: 30, top: 31, height: 10, width: 3, borderRadius: 2, backgroundColor: colors.evergreen, transform: [{ rotate: '-32deg' }] }} />
      {mood === 'celebrate' ? <Text style={{ position: 'absolute', top: -8, right: -5, color: colors.teal, fontSize: 17 }}>✦</Text> : null}
    </View>
  </View>;
}
export function Wordmark({ light = false }: { light?: boolean }) {
  return <View accessibilityLabel="Scuttle" style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><View style={{ backgroundColor: colors.lime, padding: 3, borderRadius: 15 }}><Mascot size={36} /></View><Text style={{ color: light ? colors.paper : colors.evergreen, fontSize: 30, lineHeight: 39, fontWeight: '800', letterSpacing: -1.7 }}>scuttle.</Text></View>;
}
export function Eyebrow({ children, light = false }: React.PropsWithChildren<{ light?: boolean }>) {
  return <Text style={{ color: light ? colors.mutedOnDark : colors.teal, fontSize: 11, lineHeight: 17, fontWeight: '800', letterSpacing: 1.6, textTransform: 'uppercase' }}>{children}</Text>;
}
export function Hero({ label, amount, detail, children }: React.PropsWithChildren<{ label: string; amount: string; detail?: string }>) {
  return <View style={{ backgroundColor: colors.evergreen, padding: 24, borderRadius: 24, gap: 9 }}><Eyebrow light>{label}</Eyebrow><Text style={{ color: colors.paper, fontSize: 38, lineHeight: 47, fontWeight: '800', letterSpacing: -1.5, fontVariant: ['tabular-nums'] }}>{amount}</Text>{detail ? <Text style={{ color: colors.mutedOnDark, fontSize: 13 }}>{detail}</Text> : null}{children}</View>;
}
export function EmptyState({ title, detail, children }: React.PropsWithChildren<{ title: string; detail: string }>) {
  return <View style={{ backgroundColor: colors.subtle, borderRadius: 22, padding: 24, gap: 10 }}><Mascot size={52} mood="rest" /><Text style={{ fontSize: 20, fontWeight: '700' }}>{title}</Text><Text style={{ color: colors.muted }}>{detail}</Text>{children}</View>;
}
export function Metric({ label, amount, detail, caution = false }: { label: string; amount: string; detail?: string; caution?: boolean }) {
  return <View style={{ flexGrow: 1, flexBasis: 145, padding: 16, borderRadius: 18, gap: 5, backgroundColor: caution ? colors.dangerSurface : colors.subtle }}><Text style={{ color: colors.muted, fontSize: 12, lineHeight: 18 }}>{label}</Text><Text style={{ fontSize: 23, lineHeight: 31, fontWeight: '800', color: caution ? colors.danger : colors.text, fontVariant: ['tabular-nums'] }}>{amount}</Text>{detail ? <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 18 }}>{detail}</Text> : null}</View>;
}
