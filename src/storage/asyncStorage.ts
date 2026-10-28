import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppData } from '../domain/models';
import { migrateAppData } from '../domain/migrations';
import { StorageAdapter } from '../domain/store';

const KEY = '@scuttle/local-data-v1';
export class AsyncStorageAdapter implements StorageAdapter {
  async load(): Promise<AppData | null> {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return migrateAppData(parsed);
  }
  async save(data: AppData): Promise<void> { await AsyncStorage.setItem(KEY, JSON.stringify(data)); }
}
