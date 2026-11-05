import { Platform } from 'react-native';
/** Collaborative visual tokens: human coastal direction, AI-proposed clarity refinements. */
export const colors = {
  background: '#F7F2E8', surface: '#FFFDFC', text: '#203E4B', muted: '#5F7378',
  border: '#E3D9C9', track: '#EDE4D8', blue: '#85AFA3', glass: '#DDEBE5',
  coral: '#F58A70', sand: '#E5C89C', shell: '#F4E1C7', mist: '#D8E7E5', teal: '#5D9588',
};
const system = Platform.select({ ios: 'System', android: 'sans-serif', default: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' })!;
export const fonts = { default: system, wordmark: 'Playful Lines', message: 'Mayonice', money: system, greeting: system };
export const fontAssets = {
  'Playful Lines': require('../../assets/fonts/playful-lines/PlayfulLines.otf'),
  Mayonice: require('../../assets/fonts/mayonice/Mayonice.ttf'),
  'Stay Playful': require('../../assets/fonts/stay-playful/StayPlayful.ttf'),
};
