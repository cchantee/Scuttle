import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, lstatSync, unlinkSync, mkdirSync } from 'node:fs';
import { createServer } from 'node:net';
import path from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';

export const INTERFACES = [
  { number: '1', label: 'Human-Only Interface', branch: 'Chantes_Designed_App', folder: 'human-only', port: 8081 },
  { number: '2', label: 'AI-Only Interface', branch: 'AI_Designed_App', folder: 'ai-only', port: 8082 },
  { number: '3', label: 'Human + AI Interface', branch: 'AI_And_Me_Designed_App', folder: 'human-and-ai', port: 8083 },
];
function git(root, args) {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr?.trim() || 'Git command failed.');
  return result.stdout.trim();
}
export function parseWorktrees(output) {
  return output.split('\0\0').filter(Boolean).map(record => {
    const fields = record.split('\0');
    return { directory: fields.find(f => f.startsWith('worktree '))?.slice(9), branch: fields.find(f => f.startsWith('branch refs/heads/'))?.slice(18) };
  });
}
export function resolveInterfaces(root) {
  const common = git(root, ['rev-parse', '--path-format=absolute', '--git-common-dir']);
  const primaryRoot = path.dirname(common);
  const worktrees = parseWorktrees(git(root, ['worktree', 'list', '--porcelain', '-z']));
  return INTERFACES.map(item => {
    git(root, ['show-ref', '--verify', `refs/heads/${item.branch}`]);
    const existing = worktrees.find(w => w.branch === item.branch);
    return { ...item, primaryRoot, directory: existing?.directory ?? path.join(path.dirname(primaryRoot), 'Scuttle-interfaces', item.folder), exists: Boolean(existing) };
  });
}
function publicConfiguration(directory) {
  let values = {};
  for (const name of ['.env', '.env.local', '.env.development', '.env.development.local']) {
    const filename = path.join(directory,name);
    if (existsSync(filename)) Object.assign(values, parseEnv(readFileSync(filename,'utf8')));
  }
  return { url: values.EXPO_PUBLIC_SUPABASE_URL?.trim(), key: values.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() };
}
export function expoEnvironment(directory, primaryRoot, inherited = process.env) {
  const env = { ...inherited };
  // Never carry researcher/admin credentials into the participant app's process.
  for (const key of Object.keys(env)) if (/SUPABASE.*(SECRET|SERVICE_ROLE)|JORDAN_TAYLOR_PASSWORD/.test(key)) delete env[key];
  delete env.EXPO_ROUTER_APP_ROOT;
  const selected = publicConfiguration(directory);
  const fallback = publicConfiguration(primaryRoot);
  const configured = selected.url || selected.key ? selected : fallback;
  const url = inherited.EXPO_PUBLIC_SUPABASE_URL?.trim() || configured.url;
  const key = inherited.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() || configured.key;
  if (!url || !key) throw new Error(`Public Supabase configuration is incomplete. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in ${directory}/.env or ${primaryRoot}/.env. No server secret is needed by Expo.`);
  env.EXPO_PUBLIC_SUPABASE_URL = url;
  env.EXPO_PUBLIC_SUPABASE_ANON_KEY = key;
  return env;
}
export function dependencyFingerprint(directory) {
  return createHash('sha256').update(readFileSync(path.join(directory,'package.json'))).update(readFileSync(path.join(directory,'package-lock.json'))).digest('hex');
}
function run(command, args, options) {
  return new Promise((resolve,reject) => {
    const child = spawn(command,args,{...options,stdio:'inherit'});
    const interrupt = () => { if (!child.killed) child.kill('SIGINT'); };
    process.on('SIGINT',interrupt);
    child.once('error',error => { process.off('SIGINT',interrupt); reject(error); });
    child.once('exit',(code,signal) => { process.off('SIGINT',interrupt); resolve({code,signal}); });
  });
}
export async function prepareInterface(item, root, install = run) {
  if (!item.exists) {
    mkdirSync(path.dirname(item.directory),{recursive:true});
    git(root,['worktree','add',item.directory,item.branch]);
  }
  const modules = path.join(item.directory,'node_modules');
  // A shared dependency symlink can load a different branch's native/JS packages.
  if (lstatSync(modules,{throwIfNoEntry:false})?.isSymbolicLink()) unlinkSync(modules);
  const fingerprint = dependencyFingerprint(item.directory);
  const marker = path.join(modules,'.scuttle-interface-lock');
  if (!existsSync(marker) || readFileSync(marker,'utf8') !== fingerprint) {
    console.log(`Installing ${item.label}'s own locked dependencies…`);
    const result = await install('npm',['ci','--prefer-offline','--no-audit','--no-fund'],{cwd:item.directory});
    if (result.code !== 0) throw new Error('Dependency installation stopped or failed. No dependency versions were changed; resolve the npm error and retry.');
    writeFileSync(marker,fingerprint);
  }
}
function checkPort(port) {
  return new Promise((resolve,reject) => {
    const server = createServer();
    server.once('error',reject);
    server.listen(port,'0.0.0.0',()=>server.close(resolve));
  });
}
export async function availableExpoPort(preferred, check = checkPort) {
  for (const port of [preferred, ...Array.from({length: 20},(_,index)=>8084+index)].filter((port,index,ports)=>ports.indexOf(port)===index)) {
    try { await check(port); return port; }
    catch (error) { if (error.code !== 'EADDRINUSE') throw new Error(`Cannot open Expo port ${port}: ${error.message}`); }
  }
  throw new Error('No free Expo port was found. Stop an existing Expo server and retry.');
}
export function expoArguments(item, tunnel = false) {
  const pkg = JSON.parse(readFileSync(path.join(item.directory,'node_modules/expo/package.json'),'utf8'));
  const bin = typeof pkg.bin === 'string' ? pkg.bin : pkg.bin.expo;
  return [path.join(item.directory,'node_modules/expo',bin),'start','--go',tunnel?'--tunnel':'--lan','--port',String(item.port),'--clear'];
}
async function choose() {
  console.log('\nScuttle — Designed Without a Soul');
  for (const item of INTERFACES) console.log(`${item.number} — ${item.label} (${item.branch})`);
  console.log('0 — Exit');
  return new Promise(resolve => {
    const terminal = createInterface({input:process.stdin,output:process.stdout});
    terminal.on('SIGINT',()=>terminal.close());
    terminal.on('close',()=>resolve('0'));
    terminal.question('Select interface: ',answer => { resolve(answer.trim()); terminal.close(); });
  });
}
export async function main(args = process.argv.slice(2)) {
  const root = git(process.cwd(),['rev-parse','--show-toplevel']);
  const choices = resolveInterfaces(root);
  if (args.includes('--check')) {
    for (const item of choices) {
      console.log(`${item.number}: ${item.branch} → ${item.directory}${item.exists?'':' (will create isolated worktree)'}`);
      const env = expoEnvironment(item.exists?item.directory:item.primaryRoot,item.primaryRoot);
      console.log(`   Supabase configured; Expo port ${item.port}; SDK ${JSON.parse(readFileSync(path.join(item.exists?item.directory:root,'package.json'),'utf8')).dependencies.expo}`);
      void env;
    }
    return;
  }
  const flag = args.indexOf('--interface');
  const selected = flag === -1 ? undefined : args[flag+1];
  if (selected && !INTERFACES.some(i => i.number === selected)) throw new Error('--interface must be 1, 2, or 3.');
  if (!selected && !process.stdin.isTTY && !args.includes('--prepare')) throw new Error('Run the selector in an interactive terminal, or use --interface 1, 2, or 3.');
  if (args.includes('--prepare')) {
    for (const item of choices.filter(i => !selected || i.number===selected)) {
      await prepareInterface(item,root);
      expoEnvironment(item.directory,item.primaryRoot);
      console.log(`${item.label} is ready at ${item.directory}`);
    }
    return;
  }
  do {
    const number = selected ?? await choose();
    if (number === '0') return;
    const item = resolveInterfaces(root).find(i => i.number === number);
    if (!item) { console.log('Choose 1, 2, 3, or 0.'); continue; }
    try {
      await prepareInterface(item,root);
      const env = expoEnvironment(item.directory,item.primaryRoot);
      const port = await availableExpoPort(item.port);
      if (port !== item.port) console.log(`Port ${item.port} is already in use; using port ${port} without stopping your existing server.`);
      const running = { ...item, port };
      console.log(`\nStarting ${item.label} from ${item.branch} on port ${running.port}.\nScan this server's QR code on your iPhone. Press Ctrl+C to stop Expo and return to the selector.\nThe app requires an Expo Go build matching its SDK. Sign in to the same Expo account on CLI and iPhone when required.\n`);
      const result = await run(process.execPath,expoArguments(running,args.includes('--tunnel')),{cwd:item.directory,env});
      if (result.code && result.code !== 130) console.error(`Expo exited with code ${result.code}. See the error above.`);
    } catch (error) { console.error(error.message); if (selected) throw error; }
  } while (!selected);
}
if (process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  main().catch(error=>{console.error(`Interface launcher: ${error.message}`);process.exitCode=1;});
}
