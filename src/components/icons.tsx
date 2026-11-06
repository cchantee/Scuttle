import React from 'react';
import { View } from 'react-native';
import Svg, { Path, Circle, Rect, Line } from 'react-native-svg';
import { colors } from '../design/theme';
export type IconName = 'home' | 'accounts' | 'plus' | 'paycheck' | 'goals' | 'transaction' | 'move' | 'settings' | 'profile' | 'back' | 'more' | 'calendar' | 'category' | 'fuel' | 'shield' | 'search';
export function Icon({ name, size = 23, color = colors.text }: { name: IconName; size?: number; color?: string }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    {name === 'search' ? <><Circle cx="10.5" cy="10.5" r="6.5" /><Path d="m16 16 5 5" /></> : null}
    {name === 'home' ? <><Path d="m3 10 9-7 9 7v10H15v-7H9v7H3Z" /></> : null}
    {name === 'accounts' ? <><Path d="m2 8 10-5 10 5ZM3 21h18M4 18h16M6 10v6m6-6v6m6-6v6" /></> : null}
    {name === 'plus' ? <Path d="M12 4v16M4 12h16" /> : null}
    {name === 'paycheck' ? <><Rect x="3" y="7" width="18" height="14" rx="2" /><Path d="M8 7V4h8v3M3 12h18M10 15h4" /></> : null}
    {name === 'goals' ? <><Circle cx="12" cy="12" r="9" /><Circle cx="12" cy="12" r="5" /><Path d="m12 12 8-9m-4 1h4v4" /></> : null}
    {name === 'transaction' ? <><Path d="M6 3h12v18l-3-2-3 2-3-2-3 2ZM9 8h6M9 12h6M9 16h3" /></> : null}
    {name === 'move' ? <Path d="M3 7h17m-4-4 4 4-4 4M21 17H4m4-4-4 4 4 4" /> : null}
    {name === 'settings' ? <><Circle cx="12" cy="12" r="4" /><Path d="m9 3-1 3-3 1-2 5 2 5 3 1 1 3h6l1-3 3-1 2-5-2-5-3-1-1-3Z" /></> : null}
    {name === 'profile' ? <><Circle cx="12" cy="7" r="4" /><Path d="M4 21v-3a8 8 0 0 1 16 0v3" /></> : null}
    {name === 'back' ? <Path d="m15 5-7 7 7 7" /> : null}
    {name === 'more' ? <>{[5,12,19].map(x => <Circle key={x} cx={x} cy="12" r="1" fill={color} />)}</> : null}
    {name === 'calendar' ? <><Rect x="3" y="5" width="18" height="16" rx="2" /><Path d="M7 3v4m10-4v4M3 10h18m-13 4h2m4 0h2m-8 4h2" /></> : null}
    {name === 'fuel' ? <><Rect x="4" y="3" width="10" height="18" rx="1" /><Path d="M4 10h10M7 6h4m3 2 4 3v7a2 2 0 0 0 4 0v-7l-4-6M2 21h14" /></> : null}
    {name === 'shield' ? <Path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6Zm-4 9 3 3 5-6" /> : null}
    {name === 'category' ? <><Path d="M4 9h16l-2 11H6ZM8 10l4-7 4 7m-7 3v4m6-4v4" /></> : null}
  </Svg>;
}
export function IconTile({ name, tint = colors.glass }: { name: IconName; tint?: string }) {
  return <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: tint, alignItems: 'center', justifyContent: 'center' }}><Icon name={name} size={21} /></View>;
}

export function categoryIcon(name: string): IconName {
  if (/rent|hous|home/i.test(name)) return 'home';
  if (/gas|fuel|transport/i.test(name)) return 'fuel';
  if (/emergency|insur/i.test(name)) return 'shield';
  if (/saving|goal/i.test(name)) return 'goals';
  return 'category';
}
