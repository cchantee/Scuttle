import { createClient } from '@supabase/supabase-js';
import { existsSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { buildJordanTaylorSnapshot, verifyJordanTaylorStartingData } from '../src/domain/jordanStudy';
import { confirmAndResetJordan, verifyLiveJordan } from './jordan-reset';

async function main() {
  const command = process.argv[2] ?? 'verify';
  if (!['verify', 'verify-live', 'reset'].includes(command)) throw new Error('Usage: npm run study:jordan -- [verify|verify-live|reset]');
  if (command === 'verify') {
    verifyJordanTaylorStartingData(buildJordanTaylorSnapshot('fixture-validation-user'));
    console.log('Local Jordan baseline verified: checking $245; savings $680 ($560 available); Cash $300; no historical overdrafts. Database readiness has not been checked.');
    return;
  }
  if (existsSync('study.secrets.local')) process.loadEnvFile('study.secrets.local');
  const url = process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error('Set SUPABASE_URL and SUPABASE_SECRET_KEY in ignored study.secrets.local. No password is needed.');
  const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } });
  if (command === 'verify-live') {
    await verifyLiveJordan(supabase);
    console.log("Jordan Taylor's stored financial data matches the complete study baseline. Reload the next interface before testing.");
    return;
  }
  await confirmAndResetJordan(supabase, async () => {
    if (!process.stdin.isTTY) throw new Error('Reset requires interactive researcher confirmation. Run this command in a terminal.');
    const terminal = createInterface({ input: process.stdin, output: process.stdout });
    try { return (await terminal.question('Type RESET JORDAN to confirm: ')).trim() === 'RESET JORDAN'; }
    finally { terminal.close(); }
  }, console.log);
}
try { await main(); }
catch (error) { console.error(`Jordan study operation failed: ${error instanceof Error ? error.message : String(error)}`); process.exit(1); }
