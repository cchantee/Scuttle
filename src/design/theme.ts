import { Platform } from 'react-native';
/** Human-authored Scuttle palette and typography assignments, approved 2026-11-05. */
export const colors = {
  background: '#FAF9F6', surface: '#FFFFFF', text: '#344447', muted: '#69777A',
  border: '#E9E7E2', track: '#ECEBE7', blue: '#8FB3C0', glass: '#DCE7DA',
  coral: '#D58A71', sand: '#E4B793', shell: '#EFD3C1', mist: '#D9DFE6', teal: '#869F9F',
};
const readable = Platform.select({ ios: 'System', android: 'sans-serif', default: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' })!;
export const fonts = { default: readable, wordmark: 'Playful Lines', message: 'Mayonice', money: Platform.select({ ios: 'System', android: 'sans-serif', default: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' })!, greeting: 'Stay Playful' };
export const fontAssets = {
  'Playful Lines': require('../../assets/fonts/playful-lines/PlayfulLines.otf'),
  Mayonice: require('../../assets/fonts/mayonice/Mayonice.ttf'),
  'Stay Playful': require('../../assets/fonts/stay-playful/StayPlayful.ttf'),
};
