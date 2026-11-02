import React from 'react';
import { Text as NativeText, TextProps } from 'react-native';
import { colors } from './theme';
/** Keep native font scaling; never set a global maximum multiplier. */
export function Text({ style, ...props }: TextProps) {
  return <NativeText {...props} style={[{ color: colors.text, fontSize: 15, lineHeight: 23 }, style]} />;
}
