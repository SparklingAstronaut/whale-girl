import {cpSync,mkdirSync,writeFileSync,existsSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';

if(process.platform!=='win32'||!process.env.LOCALAPPDATA)throw Error('This installer supports Windows only.');
// Optional staging directory permits validation without replacing a live installation.
const root=resolve(process.argv[2]||join(process.env.LOCALAPPDATA,'Programs','WhaleGirlDesktop'));
const source=resolve(import.meta.dirname,'..','desktop');
mkdirSync(root,{recursive:true});
for(const directory of ['lib','render'])cpSync(join(source,directory),join(root,directory),{recursive:true});
// Desktop UI matching the web pet (menu above, status card below), click-through and the walking fix.
cpSync(join(import.meta.dirname,'runtime-overrides'),root,{recursive:true});
cpSync(join(import.meta.dirname,'desktop-entry.mjs'),join(root,'integration-entry.mjs'));
writeFileSync(join(root,'package.json'),JSON.stringify({name:'whale-girl-desktop-runtime',version:'1.0.0',private:true,type:'module',dependencies:{electron:'45.1.0'}},null,2));
if(!existsSync(join(root,'integration.json')))writeFileSync(join(root,'integration.json'),JSON.stringify({visible:true,size:110,resetAt:0}));
const result=spawnSync('npm.cmd',['install','--omit=dev','--no-audit','--no-fund'],{cwd:root,stdio:'inherit',shell:true});
if(result.error)throw result.error;
if(result.status!==0)process.exit(result.status||1);
console.log('Runtime installed. Install and enable whale-girl plus the harness-integration package in Harness.');
