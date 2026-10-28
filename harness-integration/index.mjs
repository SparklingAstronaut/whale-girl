import {spawn} from 'node:child_process';
import {readFileSync,writeFileSync,renameSync,mkdirSync,existsSync,appendFileSync} from 'node:fs';
import {join} from 'node:path';
import {normalize,allowed} from './controller.mjs';
export const name='whale-desktop-integration';
export const inject=['webServer','whale-girl.pet'];
export function apply(ctx) {
 ctx.effect(()=>{
  const root=join(process.env.LOCALAPPDATA,'Programs','WhaleGirlDesktop');
  const prefs=join(root,'integration.json'); mkdirSync(root,{recursive:true});
  let state;try {state=normalize(JSON.parse(readFileSync(prefs,'utf8')));}catch{state=normalize();}
  let child=null,disposed=false,error='',starting=false;
  const save=()=>{writeFileSync(prefs+'.tmp',JSON.stringify(state));renameSync(prefs+'.tmp',prefs);};save();
  const status=()=>({...state,running:!!child,error});
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
    current.stderr.on('data',d=>appendFileSync(join(root,'integration.log'),d));
    current.on('error',e=>{if(child===current){child=null;error=e.message;}});
    current.on('exit',()=>{if(child===current){child=null;if(!disposed){state.visible=false;save();}}});
   }catch(e){error=e.message;}finally{starting=false;}
  };
  const handler=async(req,res)=>{
   const json=(code,body)=>{res.writeHead(code,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});res.end(JSON.stringify(body));};
   if(!allowed(req)){json(403,{error:'Forbidden origin'});return;}
   if(req.method==='GET'){json(200,status());return;}
   if(req.method!=='POST'){json(405,{error:'Method not allowed'});return;}
   try{
    if(!String(req.headers['content-type']).startsWith('application/json')){json(415,{error:'Expected JSON'});return;}
    let body='';for await(const chunk of req){body+=chunk;if(body.length>1024)throw Error('Request too large');}
    const patch=JSON.parse(body);
    if(patch.visible!==undefined&&typeof patch.visible!=='boolean')throw Error('Invalid visibility');
    if(patch.size!==undefined&&(!Number.isFinite(patch.size)||patch.size<80||patch.size>220))throw Error('Invalid size');
    state=normalize({...state,...(patch.visible===undefined?{}:{visible:patch.visible}),...(patch.size===undefined?{}:{size:patch.size}),...(patch.reset===true?{resetAt:Date.now()}:{} )});
    save();if(state.visible)await start();else stop();json(200,status());
   }catch(e){json(400,{error:e.message});}
  };
  const off=ctx.webServer.register({kind:'exact',path:'/whale-desktop/control',handler});
  const timer=setTimeout(start,1200);
  return ()=>{disposed=true;clearTimeout(timer);off();stop();};
 });
}
