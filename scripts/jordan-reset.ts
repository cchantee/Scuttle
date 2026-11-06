import { SupabaseClient } from '@supabase/supabase-js';
import { isDeepStrictEqual } from 'node:util';
import { buildJordanTaylorSnapshot, verifyJordanTaylorStartingData } from '../src/domain/jordanStudy';

export const RESET_TITLE = 'Reset Jordan Taylor Study Data?';
export const RESET_WARNING = 'This will erase all changes made during the current testing session and restore Jordan Taylor\'s original financial data. This action cannot be undone.';
export const RESET_SUCCESS = "Jordan Taylor's study data has been restored. The account is ready for the next testing session.";

// Server-side tooling only: never imported by the Expo app. Auth access is read-only.
async function findJordanId(supabase: SupabaseClient): Promise<string> {
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw error;
    const user = data.users.find(u => u.email?.toLowerCase() === 'jordan.taylor@example.com');
    if (user) return user.id;
    if (data.users.length < 100) break;
  }
  throw new Error('Existing Jordan Taylor account not found. No auth identity or credentials were changed.');
}

function verifyStoredSnapshot(userId: string, value: unknown) {
  const expected = buildJordanTaylorSnapshot(userId);
  if (!isDeepStrictEqual(value, expected)) throw new Error('Jordan stored data does not match the complete study baseline.');
  verifyJordanTaylorStartingData(expected);
  return expected;
}

/** Read-only readiness check of the actual database, rather than just the local fixture. */
export async function verifyLiveJordan(supabase: SupabaseClient) {
  const userId = await findJordanId(supabase);
  const { data, error } = await supabase.from('scuttle_user_data').select('data').eq('user_id', userId).single();
  if (error) throw error;
  return verifyStoredSnapshot(userId, data.data);
}

export async function resetJordan(supabase: SupabaseClient) {
  const userId = await findJordanId(supabase);
  const snapshot = buildJordanTaylorSnapshot(userId);
  verifyJordanTaylorStartingData(snapshot);
  const { data: current, error: readError } = await supabase.from('scuttle_user_data')
    .select('revision').eq('user_id', userId).single();
  if (readError) throw readError;
  if (!Number.isSafeInteger(current.revision) || current.revision < 1) throw new Error('Invalid study snapshot revision.');
  // One atomic PostgreSQL row UPDATE replaces every financial collection together.
  // Never rewind revision: stale participant sessions must fail rather than undo the reset.
  const { data: saved, error } = await supabase.from('scuttle_user_data')
    .update({ data: snapshot, revision: current.revision + 1, updated_at: new Date().toISOString() })
    .eq('user_id', userId).eq('revision', current.revision).select('user_id,data,revision');
  if (error) throw error;
  if (saved?.length !== 1) throw new Error('Concurrent save detected. Close study sessions and retry reset.');
  if (saved[0].user_id !== userId || saved[0].revision !== current.revision + 1) throw new Error('Reset could not verify the saved owner and revision.');
  return verifyStoredSnapshot(userId, saved[0].data);
}

export async function confirmAndResetJordan(
  supabase: SupabaseClient,
  confirm: () => Promise<boolean>,
  feedback: (message: string) => void,
) {
  feedback(RESET_TITLE);
  feedback(RESET_WARNING);
  if (!await confirm()) { feedback('Reset cancelled. No data was changed.'); return false; }
  await resetJordan(supabase);
  feedback(RESET_SUCCESS);
  return true;
}
