import { AppData, emptyData } from '../domain/models';
import { migrateAppData } from '../domain/migrations';
import { StorageAdapter } from '../domain/store';
import { supabase } from '../backend/supabase';

/** One owner-scoped snapshot is read and written atomically by a Postgres RPC. */
export class SupabaseStorageAdapter implements StorageAdapter {
  private revision = 0;
  constructor(private readonly userId: string) {}

  async load(): Promise<AppData | null> {
    if (!supabase) throw new Error('Cloud storage is not configured.');
    const { data, error } = await supabase
      .from('scuttle_user_data')
      .select('data, revision')
      .eq('user_id', this.userId)
      .maybeSingle();
    if (error) throw error;
    if (!data) {
      this.revision = 0;
      return { ...emptyData(), user: { id: this.userId, displayName: '' } };
    }
    if (!data.data || (data.data.version !== 1 && data.data.version !== 2)) throw new Error('Cloud data is invalid or from an unsupported version.');
    this.revision = data.revision;
    return { ...migrateAppData(data.data), user: { ...data.data.user, id: this.userId } } as AppData;
  }

  async save(value: AppData): Promise<void> {
    if (!supabase) throw new Error('Cloud storage is not configured.');
    const { data, error } = await supabase.rpc('save_scuttle_data', {
      p_data: value,
      p_expected_revision: this.revision,
    });
    if (error) throw error;
    if (typeof data !== 'number') throw new Error('Cloud save did not return a revision.');
    this.revision = data;
  }
}
