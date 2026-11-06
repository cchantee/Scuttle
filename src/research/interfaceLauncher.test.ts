import { afterEach, expect, it } from 'vitest';
import { mkdtempSync, realpathSync, mkdirSync, writeFileSync, rmSync, existsSync, symlinkSync, lstatSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { INTERFACES, availableExpoPort, parseWorktrees, resolveInterfaces, expoEnvironment, prepareInterface, expoArguments } from '../../scripts/interface-launcher.mjs';
const roots:string[]=[];
afterEach(()=>{for(const root of roots.splice(0))rmSync(root,{recursive:true,force:true});});
function temp(){const root=mkdtempSync(path.join(tmpdir(),'scuttle launcher '));roots.push(root);return root;}
function git(root:string,args:string[]){const result=spawnSync('git',args,{cwd:root,encoding:'utf8'});if(result.status!==0)throw new Error(result.stderr);return result.stdout.trim();}
it('parses branch worktrees with spaces and keeps detached checkouts separate',()=>{
 expect(parseWorktrees('worktree /a path/human\0HEAD abc\0branch refs/heads/Chantes_Designed_App\0\0worktree /other\0HEAD def\0detached\0\0')).toEqual([{directory:'/a path/human',branch:'Chantes_Designed_App'},{directory:'/other',branch:undefined}]);
});
it('discovers the real branch checkouts without switching or modifying them',()=>{
 const root=temp();git(root,['init']);writeFileSync(path.join(root,'README.md'),'test');git(root,['add','README.md']);git(root,['-c','user.name=Scuttle Test','-c','user.email=scuttle-test@example.invalid','commit','--no-gpg-sign','-m','fixture']);
 for(const item of INTERFACES)git(root,['branch',item.branch]);
 const human=path.join(temp(),'human checkout');git(root,['worktree','add',human,'Chantes_Designed_App']);
 const before=git(root,['rev-parse','--abbrev-ref','HEAD']);
 const resolved=resolveInterfaces(root);
 expect(resolved.find(i=>i.number==='1')!.directory).toBe(realpathSync(human));
 expect(resolved.find(i=>i.number==='2')!.exists).toBe(false);
 expect(git(root,['rev-parse','--abbrev-ref','HEAD'])).toBe(before);
});
it('reuses only public Supabase config, preserves per-interface configuration, and strips admin credentials',()=>{
 const main=temp(),other=temp();writeFileSync(path.join(main,'.env'),'EXPO_PUBLIC_SUPABASE_URL=https://example.supabase.co\nEXPO_PUBLIC_SUPABASE_ANON_KEY=public-key\n');
 const env=expoEnvironment(other,main,{SUPABASE_SECRET_KEY:'DO_NOT_INHERIT',SUPABASE_SERVICE_ROLE_KEY:'DO_NOT_INHERIT',JORDAN_TAYLOR_PASSWORD:'DO_NOT_INHERIT',EXPO_ROUTER_APP_ROOT:'/wrong',PATH:process.env.PATH});
 expect(env.EXPO_PUBLIC_SUPABASE_URL).toBe('https://example.supabase.co');expect(env.SUPABASE_SECRET_KEY).toBeUndefined();expect(env.SUPABASE_SERVICE_ROLE_KEY).toBeUndefined();expect(env.EXPO_ROUTER_APP_ROOT).toBeUndefined();expect(existsSync(path.join(other,'.env'))).toBe(false);
 writeFileSync(path.join(other,'.env'),'EXPO_PUBLIC_SUPABASE_URL=https://other.supabase.co\nEXPO_PUBLIC_SUPABASE_ANON_KEY=other-public\n');
 expect(expoEnvironment(other,main,{}).EXPO_PUBLIC_SUPABASE_URL).toBe('https://other.supabase.co');
 writeFileSync(path.join(other,'.env'),'EXPO_PUBLIC_SUPABASE_URL=https://incomplete.supabase.co\n');
 expect(()=>expoEnvironment(other,main,{})).toThrow('incomplete');
});
it('replaces shared dependency symlinks with isolated installs and only reinstalls after lock changes',async()=>{
 const root=temp(),shared=temp();mkdirSync(path.join(shared,'untouched'));symlinkSync(shared,path.join(root,'node_modules'),'dir');writeFileSync(path.join(root,'package.json'),'{}');writeFileSync(path.join(root,'package-lock.json'),'{}');
 const item={...INTERFACES[0],directory:root,primaryRoot:root,exists:true};let installs=0;
 const install=async(command:string,args:string[])=>{installs++;expect(command).toBe('npm');expect(args[0]).toBe('ci');mkdirSync(path.join(root,'node_modules'),{recursive:true});return {code:0};};
 await prepareInterface(item,root,install);await prepareInterface(item,root,install);expect(installs).toBe(1);expect(lstatSync(path.join(root,'node_modules')).isSymbolicLink()).toBe(false);expect(existsSync(path.join(shared,'untouched'))).toBe(true);
 writeFileSync(path.join(root,'package-lock.json'),'{"changed":true}');await prepareInterface(item,root,install);expect(installs).toBe(2);
});
it('does not mark failed installs as ready and launches Expo Go from the correct directory with distinct ports',async()=>{
 const root=temp();writeFileSync(path.join(root,'package.json'),'{}');writeFileSync(path.join(root,'package-lock.json'),'{}');
 const item={...INTERFACES[1],directory:root,primaryRoot:root,exists:true};
 await expect(prepareInterface(item,root,async()=>({code:1}))).rejects.toThrow('installation');expect(existsSync(path.join(root,'node_modules/.scuttle-interface-lock'))).toBe(false);
 mkdirSync(path.join(root,'node_modules/expo'),{recursive:true});writeFileSync(path.join(root,'node_modules/expo/package.json'),JSON.stringify({bin:{expo:'bin/cli'}}));
 expect(expoArguments(item)).toEqual([path.join(root,'node_modules/expo/bin/cli'),'start','--go','--lan','--port','8082','--clear']);expect(expoArguments(item,true)).toContain('--tunnel');expect(new Set(INTERFACES.map(i=>i.port)).size).toBe(3);
});

it('uses a free alternate Expo port without killing existing servers, but reports permission errors',async()=>{
 const attempted:number[]=[];
 const port=await availableExpoPort(8081,async(port)=>{attempted.push(port);if(port===8081)throw Object.assign(new Error('occupied'),{code:'EADDRINUSE'});});
 expect(port).toBe(8084);expect(attempted).toEqual([8081,8084]);
 await expect(availableExpoPort(8081,async()=>{throw Object.assign(new Error('permission denied'),{code:'EPERM'});})).rejects.toThrow('permission denied');
});
