import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppData } from '../domain/models';
import { StorageAdapter } from '../domain/store';

const KEY = '@scuttle/local-data-v1';
export class AsyncStorageAdapter implements StorageAdapter {
  async load(): Promise<AppData | null> {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || (parsed as { version?: number }).version !== 1) throw new Error('Saved Scuttle data is invalid or from an unsupported version.');
    return parsed as AppData;
  }
  async save(data: AppData): Promise<void> { await AsyncStorage.setItem(KEY, JSON.stringify(data)); }
}
