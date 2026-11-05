import React from 'react';
import { Text as NativeText, TextProps, StyleSheet, TextInput as NativeInput, TextInputProps } from 'react-native';
import { colors, fonts } from '../design/theme';

/** Currency fragments retain their human-approved font even inside a longer label. */
function currencyChildren(children: React.ReactNode): React.ReactNode {
  return React.Children.map(children, child => {
    if (typeof child !== 'string') return child;
    return child.split(/([+−-]?\$[\d,]+(?:\.\d{2})?)/g).map((part, index) =>
      /^[+−-]?\$/.test(part)
        ? <NativeText key={index} style={{ fontFamily: fonts.money, fontWeight: '600', fontStyle: 'normal' }}>{part}</NativeText>
        : part);
  });
}
export function Text({ style, children, role = 'default', ...props }: Omit<TextProps, 'role'> & { role?: keyof typeof fonts }) {
  // The supplied decorative faces have one weight. System financial text uses a real semibold weight.
  const merged = StyleSheet.flatten(style) ?? {};
  return <NativeText {...props} style={[{ color: colors.text, fontSize: 16 }, merged, { fontFamily: fonts[role], fontWeight: role === 'money' ? '600' : '400', fontStyle: 'normal' }]}>{currencyChildren(children)}</NativeText>;
}
export function TextInput({ style, keyboardType, ...props }: TextInputProps) {
  const numeric = keyboardType === 'decimal-pad';
  return <NativeInput {...props} keyboardType={keyboardType} style={[{ color: colors.text, fontSize: 16 }, style, { fontFamily: numeric ? fonts.money : fonts.default, fontWeight: numeric ? '500' : '400' }]} />;
}
