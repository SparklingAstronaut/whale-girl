import {spawn} from 'node:child_process';
import {readFileSync,writeFileSync,renameSync,mkdirSync,existsSync,appendFileSync} from 'node:fs';
import {join} from 'node:path';
import {normalize,allowed,LOCAL_HOST} from './controller.mjs';
export const name='whale-desktop-integration';
export const version='1.1.5';
// v1.1.0：不再硬依赖 whale-girl.pet 服务——whale-girl 插件缺失、更新改名或加载失败时，本插件仍会加载，
// 设置页/侧栏按钮可用并显示可读错误；启动失败会每 5s 自动重试，Harness 更新后不需要手动点两次。
export const inject=['webServer'];
const CLIENT_MENUS=new Set(['pending','ok','no-menu','failed','unsupported']);
export function normalizeClient(input){
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Invalid client status');
 const next={};
 if(input.loaded!==undefined){if(typeof input.loaded!=='boolean')throw Error('Invalid client.loaded');next.loaded=input.loaded;}
 if(input.menu!==undefined){if(typeof input.menu!=='string'||!CLIENT_MENUS.has(input.menu))throw Error('Invalid client.menu');next.menu=input.menu;}
 if(input.version!==undefined){if(typeof input.version!=='string'||input.version.length>24)throw Error('Invalid client.version');next.version=input.version;}
 if(input.lang!==undefined){if(typeof input.lang!=='string'||input.lang.length>16)throw Error('Invalid client.lang');next.lang=input.lang;}
 if(input.at!==undefined){if(!Number.isFinite(input.at))throw Error('Invalid client.at');next.at=input.at;}
 return next;
}
export function apply(ctx){
 ctx.effect(()=>{
  const root=join(process.env.LOCALAPPDATA,'Programs','WhaleGirlDesktop');
  const prefs=join(root,'integration.json'); mkdirSync(root,{recursive:true});
  let state;try {state=normalize(JSON.parse(readFileSync(prefs,'utf8')));}catch{state=normalize();}
  let child=null,disposed=false,error='',starting=false;
  let clientStatus={loaded:false,menu:'unknown',version:'',lang:'',at:0};let rejected=null,hostWritten='';
  const save=()=>{try{writeFileSync(prefs+'.tmp',JSON.stringify(state));renameSync(prefs+'.tmp',prefs);}catch{}};
  save();
  const status=()=>({...state,running:!!child,error,client:clientStatus,version,rejected});
   // 把当前端口写进 host.json：体检脚本优先读它，DSH 改了进程特征也找得到本地服务
   const writeHost=()=>{const port=ctx.webServer.port;if(!port)return;const key=port+':'+process.pid;if(key===hostWritten)return;
    try{writeFileSync(join(root,'host.json.tmp'),JSON.stringify({port,pid:process.pid,version,at:Date.now()}));renameSync(join(root,'host.json.tmp'),join(root,'host.json'));hostWritten=key;}catch{}};
  const stop=()=>{const current=child;child=null;if(current)current.kill();};
  const start=async()=>{
   if(child||starting||disposed||!state.visible)return;
   starting=true;
   try{
    const executable=join(root,'node_modules','electron','dist','electron.exe');
    if(!existsSync(executable))throw Error('桌宠运行组件缺失，请重新安装。');
    const port=ctx.webServer.port;
    if(!port)throw Error('Harness 服务尚未就绪');
    const base=`http://127.0.0.1:${port}`;
    const response=await fetch(base+'/whale-girl/state',{signal:AbortSignal.timeout(3000)});
    if(!response.ok)throw Error('请先启用 whale-girl 插件');
    if(disposed||!state.visible)return;
    const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
    const current=spawn(executable,[join(root,'integration-entry.mjs'),`--base-url=${base}`],{
      cwd:root,windowsHide:true,env:{...env,WHALE_GIRL_HOST_PID:String(process.pid)},stdio:['ignore','ignore','pipe']});
    child=current;error='';
    current.stderr.on('data',d=>{try{appendFileSync(join(root,'integration.log'),d);}catch{}});
    current.on('error',e=>{if(child===current){child=null;error=e.message;}});
    current.on('exit',()=>{if(child===current){child=null;if(!disposed){state.visible=false;save();}}});
   }catch(e){error=e.message;}finally{starting=false;}
  };
  const handler=async(req,res)=>{
   const json=(code,body)=>{res.writeHead(code,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});res.end(JSON.stringify(body));};
   if(!allowed(req)){if(LOCAL_HOST.test(req.headers.host||''))rejected={origin:String(req.headers.origin||'(none)').slice(0,80),at:Date.now()};json(403,{error:'Forbidden origin'});return;}
   if(req.method==='GET'){json(200,status());return;}
   if(req.method!=='POST'){json(405,{error:'Method not allowed'});return;}
   try{
    if(!String(req.headers['content-type']).startsWith('application/json')){json(415,{error:'Expected JSON'});return;}
    let body='';for await(const chunk of req){body+=chunk;if(body.length>1024)throw Error('Request too large');}
    const patch=JSON.parse(body);
    const next={};
    if(patch.visible!==undefined){if(typeof patch.visible!=='boolean')throw Error('Invalid visibility');next.visible=patch.visible;}
    if(patch.size!==undefined){if(!Number.isFinite(patch.size)||patch.size<80||patch.size>220)throw Error('Invalid size');next.size=patch.size;}
    if(patch.reset===true)next.resetAt=Date.now();
    if(patch.client!==undefined)clientStatus={...clientStatus,...normalizeClient(patch.client)};
    state=normalize({...state,...next});
    save();if(state.visible)await start();else stop();json(200,status());
   }catch(e){json(400,{error:e.message});}
  };
  const off=ctx.webServer.register({kind:'exact',path:'/whale-desktop/control',handler});
  const retry=setInterval(()=>{if(!disposed){writeHost();start().catch(()=>{});}},5000);
  const timer=setTimeout(()=>{writeHost();start();},1200);
  return ()=>{disposed=true;clearTimeout(timer);clearInterval(retry);off();stop();};
 });
}
