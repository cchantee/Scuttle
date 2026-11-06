import { createClient } from '@supabase/supabase-js';
import { existsSync } from 'node:fs';
import { buildJordanTaylorSnapshot, verifyJordanTaylorStartingData } from './jordan-taylor-fixture.mjs';

if (existsSync('study.secrets.local')) process.loadEnvFile('study.secrets.local');

const command = process.argv[2] ?? 'reset';
const email = 'jordan.taylor@example.com';
const name = 'Jordan Taylor';
const url = process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;
const password = process.env.JORDAN_TAYLOR_PASSWORD;

function requireValue(value, variable) {
  if (!value) throw new Error(`Missing ${variable}. Add it to ignored study.secrets.local; never put it in app code.`);
  return value;
}

if (!['provision', 'reset', 'verify'].includes(command)) {
  throw new Error('Usage: npm run study:jordan -- [provision|reset|verify]');
}

let supabase;

async function findJordan() {
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw error;
    const user = data.users.find(item => item.email?.toLowerCase() === email);
    if (user) return user;
    if (data.users.length < 100) return null;
  }
  throw new Error('Jordan could not be located after scanning the user directory.');
}

async function provisionUser() {
  const requestedPassword = requireValue(password, 'JORDAN_TAYLOR_PASSWORD');
  const existing = await findJordan();
  const attributes = { email_confirm: true, password: requestedPassword, user_metadata: { full_name: name, scuttle_walkthrough_complete: true } };
  if (existing) {
    const { data, error } = await supabase.auth.admin.updateUserById(existing.id, attributes);
    if (error) throw error;
    return data.user;
  }
  const { data, error } = await supabase.auth.admin.createUser({ email, ...attributes });
  if (error) throw error;
  if (!data.user) throw new Error('Supabase did not return the created study user.');
  return data.user;
}

async function resetSnapshot(userId) {
  const fixture = buildJordanTaylorSnapshot(userId);
  verifyJordanTaylorStartingData(fixture);
  const { error } = await supabase.from('scuttle_user_data').upsert({
    user_id: userId,
    data: fixture,
    revision: 1,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' });
  if (error) throw error;
  return fixture;
}

async function main() {
  if (command === 'verify') {
    verifyJordanTaylorStartingData(buildJordanTaylorSnapshot('fixture-validation-user'));
    console.log('Jordan study fixture validates locally. No Supabase data was changed.');
    return;
  }
  supabase = createClient(requireValue(url, 'SUPABASE_URL'), requireValue(secretKey, 'SUPABASE_SECRET_KEY'), {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
  const user = await provisionUser();
  const fixture = await resetSnapshot(user.id);
  console.log(`${command === 'provision' ? 'Provisioned' : 'Reset'} ${email}: ${fixture.paychecks.length} historical paychecks, ${fixture.transactions.length} transactions, and the upcoming $15 streaming reminder.`);
}

main().catch((error) => {
  console.error(`Jordan study setup failed: ${error.message}`);
  process.exitCode = 1;
});
