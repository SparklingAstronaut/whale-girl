import {app,BrowserWindow,screen} from 'electron';
import {readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {runDesktop} from './lib/render/window.mjs';
import {loadConfig} from './lib/src/config.mjs';
const root=import.meta.dirname;
const prefsPath=join(root,'integration.json'),positionPath=join(root,'position.json');
const hostPid=Number(process.env.WHALE_GIRL_HOST_PID);
if(!Number.isSafeInteger(hostPid)||hostPid<1)throw Error('Harness parent process required');
if(!app.requestSingleInstanceLock()){app.quit();}else{
 let settings={},lastReset=0,window=null,timer,saveTimer,quitting=false;
 const reset=()=>{const area=screen.getPrimaryDisplay().workArea;const [w,h]=window.getSize();window.setPosition(area.x+area.width-w-24,area.y+area.height-h-24);};
 function refresh(){
  try{process.kill(hostPid,0);}catch{app.quit();return;}
  try{
   const next=JSON.parse(readFileSync(prefsPath,'utf8'));
   if(!next.visible){app.quit();return;}
   if(window&&!window.isDestroyed()){
    if(next.size!==settings.size){const zoom=next.size/110;window.webContents.setZoomFactor(zoom);window.setSize(Math.ceil(150*zoom),Math.ceil(150*zoom));}
    if(next.resetAt!==lastReset){lastReset=next.resetAt;reset();}
   }
   settings=next;
  }catch{}
 }
 app.on('browser-window-created',(_e,win)=>{
  window=win;
  win.webContents.on('did-finish-load',()=>{
   refresh();
   try{const pos=JSON.parse(readFileSync(positionPath,'utf8'));const area=screen.getDisplayMatching({x:pos.x,y:pos.y,width:150,height:150}).workArea;const [w,h]=win.getSize();win.setPosition(Math.max(area.x,Math.min(pos.x,area.x+area.width-w)),Math.max(area.y,Math.min(pos.y,area.y+area.height-h)));}catch{reset();}
  });
  win.on('move',()=>{clearTimeout(saveTimer);saveTimer=setTimeout(()=>{if(!win.isDestroyed()){const[x,y]=win.getPosition();writeFileSync(positionPath,JSON.stringify({x,y}));}},200);});
 });
 app.on('before-quit',()=>{if(quitting)return;quitting=true;clearInterval(timer);clearTimeout(saveTimer);});
 process.nextTick(()=>runDesktop({cfg:loadConfig(),log:{info(){},warn(){},error:console.error}}).then(()=>{timer=setInterval(refresh,1000);}).catch(e=>{console.error(e);app.quit();}));
}
