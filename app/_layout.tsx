import { Stack } from 'expo-router';
import { DataProvider } from '../src/state/DataProvider';

export default function RootLayout() {
  return <DataProvider><Stack screenOptions={{ headerTitle: 'Scuttle', headerBackTitle: 'Back' }} /></DataProvider>;
}
