import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform, View } from 'react-native';
import Svg, { Circle, Ellipse, Path } from 'react-native-svg';
import { colors } from '../design/theme';
import { Text } from './typography';

function SnappingClaws({ progress }: { progress: Animated.Value }) {
  const [closed, setClosed] = useState(0);
  useEffect(() => {
    const listener = progress.addListener(({ value }) => setClosed(value));
    return () => progress.removeListener(listener);
  }, [progress]);
  // Both fingers meet at the center of each pincer; the cups and arms stay anchored.
  const left = `M20 27 C5 27 ${6 + 4 * closed} 10 ${16 + 4.5 * closed} ${6 + 2.5 * closed} L15 17 L${26 - 4.5 * closed} ${12 - 2.5 * closed} C${32 - 4 * closed} 20 28 28 20 27 Z`;
  const right = `M100 27 C115 27 ${114 - 4 * closed} 10 ${104 - 4.5 * closed} ${6 + 2.5 * closed} L105 17 L${94 + 4.5 * closed} ${12 - 2.5 * closed} C${88 + 4 * closed} 20 92 28 100 27 Z`;
  return <><Path d={left} fill={colors.shell}/><Path d={right} fill={colors.shell}/></>;
}

/** Both sides of each claw open and close while the body and arms stay still. */
export function LoadingRecords({ label = 'Loading your records…' }: { label?: string }) {
  const [reduced, setReduced] = useState(true);
  const claws = useRef(new Animated.Value(0)).current;
  const tide = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduced).catch(() => setReduced(true));
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => subscription.remove();
  }, []);
  useEffect(() => {
    if (reduced) { claws.setValue(0); tide.setValue(0); return; }
    const snapping = Animated.loop(Animated.sequence([
      Animated.timing(claws, { toValue: 1, duration: 260, easing: Easing.inOut(Easing.quad), useNativeDriver: false }),
      Animated.delay(150),
      Animated.timing(claws, { toValue: 0, duration: 360, easing: Easing.inOut(Easing.quad), useNativeDriver: false }),
      Animated.delay(500),
    ]));
    const waves = Animated.loop(Animated.sequence([
      Animated.timing(tide, { toValue: 1, duration: 2200, easing: Easing.inOut(Easing.sin), useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(tide, { toValue: 0, duration: 2200, easing: Easing.inOut(Easing.sin), useNativeDriver: Platform.OS !== 'web' }),
    ]));
    snapping.start(); waves.start();
    return () => { snapping.stop(); waves.stop(); };
  }, [reduced, claws, tide]);
  return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 28, backgroundColor: colors.background }}>
    <View accessible={false} style={{ width: 280, maxWidth: '100%', height: 198, alignItems: 'center', overflow: 'hidden' }}>
      <View style={{ position: 'absolute', bottom: 64 }}>
        <Svg width={164} height={115} viewBox="0 0 120 84" fill="none" stroke={colors.text} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M36 43 20 35 13 23M84 43l16-8 7-12M34 51l-17 1-10 9m28-3-13 9-4 8m68-24 17 1 10 9m-28-3 13 9 4 8" />
          <SnappingClaws progress={claws} />
          <Ellipse cx={60} cy={50} rx={29} ry={18} fill={colors.coral} />
          <Path d="M48 33v-9m24 9v-9" /><Circle cx={48} cy={23} r={3} fill={colors.text}/><Circle cx={72} cy={23} r={3} fill={colors.text}/><Path d="M53 50q7 7 14 0"/>
        </Svg>
      </View>
      {[0,1].map(layer=><Animated.View key={layer} style={{ position:'absolute',left:-18,bottom:layer?10:0,width:320,height:76,overflow:'hidden',opacity:layer?0.3:0.85,transform:[{translateX:tide.interpolate({inputRange:[0,1],outputRange:layer?[10,-10]:[-12,12]})}] }}>
        <Animated.Image accessible={false} source={require('../../assets/coastal/shoreline-watercolor-v2.png')} resizeMode="cover" style={{ position:'absolute',left:0,bottom:0,width:640,height:214 }}/>
      </Animated.View>)}
    </View>
    <View accessibilityRole="progressbar" accessibilityLabel={label} accessibilityLiveRegion="polite" style={{ paddingTop: 16 }}><Text style={{ fontSize:16,fontWeight:'500',color:colors.text,textAlign:'center' }}>{label}</Text></View>
  </View>;
}
