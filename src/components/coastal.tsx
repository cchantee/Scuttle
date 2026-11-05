import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Image, View } from 'react-native';
import Svg, { Path, Circle, Ellipse } from 'react-native-svg';
import { colors } from '../design/theme';
import { Text } from './typography';

/** Minimal line artwork created with the human's explicit approval. */
export function Crab({ animate = false, size = 76 }: { animate?: boolean; size?: number }) {
  const offset = useRef(new Animated.Value(0)).current;
  const [reduced, setReduced] = useState(true);
  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduced);
    const listener = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => listener.remove();
  }, []);
  useEffect(() => {
    if (!animate || reduced) { offset.setValue(0); return; }
    const motion = Animated.sequence([
      Animated.timing(offset, { toValue: -9, duration: 350, useNativeDriver: true }),
      Animated.timing(offset, { toValue: 9, duration: 650, useNativeDriver: true }),
      Animated.timing(offset, { toValue: 0, duration: 350, useNativeDriver: true }),
    ]);
    motion.start();
    return () => { motion.stop(); offset.setValue(0); };
  }, [animate, reduced, offset]);
  return <Animated.View accessible={false} style={{ width: size, height: size * .7, transform: [{ translateX: offset }] }}>
    <Svg width="100%" height="100%" viewBox="0 0 120 84" fill="none" stroke={colors.text} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <Path d="M36 43 20 35 13 23M84 43l16-8 7-12M34 51l-17 1-10 9m28-3-13 9-4 8m68-24 17 1 10 9m-28-3 13 9 4 8" />
      <Path d="M20 27C5 27 6 10 16 6l-1 11 11-5c6 8 2 16-6 15ZM100 27c15 0 14-17 4-21l1 11-11-5c-6 8-2 16 6 15Z" fill={colors.shell} />
      <Ellipse cx="60" cy="50" rx="29" ry="18" fill={colors.coral} />
      <Path d="M48 33v-9m24 9v-9" />
      <Circle cx="48" cy="23" r="3" fill={colors.text} /><Circle cx="72" cy="23" r="3" fill={colors.text} />
      <Path d="M53 50q7 7 14 0" />
    </Svg>
  </Animated.View>;
}
export function Shoreline() {
  return <View accessible={false} style={{ width: '100%', height: 60 }}><Svg width="100%" height="60" viewBox="0 0 360 60" fill="none">
    <Path d="M0 22q30-15 60 0t60 0 60 0 60 0 60 0 60 0" stroke={colors.blue} strokeWidth="2" />
    <Path d="M0 34q30-12 60 0t60 0 60 0 60 0 60 0 60 0" stroke={colors.teal} strokeWidth="1.3" />
    <Path d="M20 51h55m210 0h35" stroke={colors.sand} strokeWidth="2" strokeLinecap="round" />
  </Svg></View>;
}
export function EmptyState({ message }: { message: string }) {
  return <View style={{ alignItems: 'center', paddingVertical: 24, gap: 12 }}><Crab size={56} /><Text role="message" style={{ fontSize: 22, textAlign: 'center', color: colors.muted }}>{message}</Text></View>;
}
export function Completion({ message = 'Your money has a plan.' }: { message?: string }) {
  return <View accessibilityRole="alert" style={{ backgroundColor: colors.glass, borderRadius: 10, padding: 18, alignItems: 'center', gap: 12 }}><Crab animate /><Text role="message" style={{ fontSize: 24, textAlign: 'center' }}>{message}</Text></View>;
}

/** User-directed watercolor variant of the existing doodle crab; no embedded text. */
export function CoastalScene({ height = 96, detail = false }: { height?: number; detail?: boolean }) {
  return <View accessible={false} style={{ width: '100%', height, overflow: 'hidden' }}><Image accessible={false} source={require('../../assets/coastal/shoreline-watercolor-v2.png')} resizeMode="contain" style={detail ? { position: 'absolute', width: 360, height: 120, right: -25, bottom: -4 } : { width: '100%', height }} /></View>;
}

/** Reference-format financial card: clear text above a full-width coastal illustration. */
export function CoastalBalance({ title, amount, subtitle }: { title: string; amount: string; subtitle?: string }) {
  return <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 10, backgroundColor: colors.surface, minHeight: 160, padding: 16, overflow: 'hidden' }}>
    <View pointerEvents="none" style={{ position: 'absolute', left: -2, right: -2, bottom: -6 }}><CoastalScene height={122} /></View>
    <View style={{ gap: 8, alignItems: 'flex-start', paddingBottom: 28 }}>
      <Text style={{ fontSize: 16 }}>{title}</Text>
      <Text role="money" style={{ fontSize: 33 }}>{amount}</Text>
      {subtitle ? <Text style={{ fontSize: 13, color: colors.muted, maxWidth: '60%' }}>{subtitle}</Text> : null}
    </View>
  </View>;
}
