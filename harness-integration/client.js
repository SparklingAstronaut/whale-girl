window.__ModuleLoader__.load({id:'dsh-whale-desktop-integration',factory:(require)=>{
 const React=require('react'),h=React.createElement;
 const name='whale-desktop-integration',inject=['slots'];
 function apply(ctx){ctx.effect(()=>{
  let state={visible:false,running:false,size:140,error:''},busy=false,disposed=false;
  const listeners=new Set();const notify=()=>{for(const fn of listeners)fn();syncMenu();};
  async function request(patch){
   const res=await fetch('/whale-desktop/control',patch?{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(patch)}:{cache:'no-store'});
   const data=await res.json();if(!res.ok)throw Error(data.error||'操作失败');return data;
  }
  async function refresh(){try{const next=await request();if(!disposed){state=next;notify();}}catch(e){if(!disposed){state={...state,error:'桌宠连接暂不可用'};notify();}}}
  async function change(patch){if(busy)return;busy=true;notify();try{state=await request(patch);}catch(e){state={...state,error:e.message};}finally{busy=false;if(!disposed)notify();}}
  const style=document.createElement('style');style.dataset.whaleDesktop='true';
  style.textContent=`[data-whale-girl]{display:none!important}.wg-settings{color:var(--dsw-alias-label-primary);font:14px/1.6 system-ui}.wg-settings h2{font-size:23px;margin:0 0 8px}.wg-settings p{color:var(--dsw-alias-label-secondary);margin:0 0 20px}.wg-card{padding:22px;border:1px solid var(--dsw-alias-border-main, #5555);border-radius:14px;margin:16px 0}.wg-row{display:flex;align-items:center;justify-content:space-between;gap:20px;margin:16px 0}.wg-button{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-interactive-bg-hover,#7773);border:1px solid #8884;border-radius:9px;padding:7px 14px;font:inherit;cursor:pointer}.wg-settings option{background:#292a2c;color:#f4f4f5}.wg-button:disabled{opacity:.5;cursor:wait}.wg-preview{height:150px;width:150px;background-image:url('/whale-girl/assets/characters/whale-girl/idle.png');background-size:450px 150px;background-repeat:no-repeat;margin:auto}.wg-status{font-size:12px;color:var(--dsw-alias-label-secondary)}.wg-error{color:#f99;margin-top:12px}`;
  style.textContent+=`[data-whale-pet-nav] svg{background:currentColor;mask:url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%222%202%2020%2020%22%20fill%3D%22none%22%20stroke%3D%22black%22%20stroke-width%3D%221.6%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22M5%2012a7%207%200%200%201%2014%200v5a2%202%200%200%201-3.4%201.4L14%2020l-2-1.6L10%2020l-1.6-1.6A2%202%200%200%201%205%2017Z%22%2F%3E%3Ccircle%20cx%3D%229%22%20cy%3D%2212%22%20r%3D%22.9%22%20fill%3D%22black%22%20stroke%3D%22none%22%2F%3E%3Ccircle%20cx%3D%2215%22%20cy%3D%2212%22%20r%3D%22.9%22%20fill%3D%22black%22%20stroke%3D%22none%22%2F%3E%3C%2Fsvg%3E") center/contain no-repeat}[data-whale-pet-nav] svg>*{visibility:hidden}`;
  document.head.append(style);
  let inserted=null;
  function syncMenu(){
   if(disposed)return;
   for(const button of document.querySelectorAll('[data-shortcut-modal="settings"] nav button')){
    if(button.textContent.trim()==='虚拟宠物')button.setAttribute('data-whale-pet-nav','');
   }
   const trigger=document.querySelector('button[aria-label="账号菜单"][aria-expanded="true"],button[aria-label="Account menu"][aria-expanded="true"]');
   if(!trigger){inserted?.remove();inserted=null;return;}
   const menus=[...document.querySelectorAll('[role="menu"]')];
   const menu=menus.find(el=>[...el.querySelectorAll('[role="menuitem"]')].some(item=>/^(设置|Settings)/.test(item.textContent.trim()))&&[...el.querySelectorAll('[role="menuitem"]')].some(item=>/退出登录|Sign out|意见反馈|Contact/.test(item.textContent)));
   if(!menu)return;
   if(!inserted?.isConnected){
    const template=[...menu.querySelectorAll('[role="menuitem"]')].find(item=>/意见反馈|Contact/.test(item.textContent));
    if(!template)return;
    inserted=template.cloneNode(true);inserted.removeAttribute('id');inserted.dataset.whaleDesktopToggle='true';
    for(const el of inserted.querySelectorAll('[id]'))el.removeAttribute('id');
    const icon=document.createElementNS('http://www.w3.org/2000/svg','svg');
    for(const [key,value] of Object.entries({width:'16',height:'16',viewBox:'2 2 20 20',fill:'none',stroke:'currentColor','stroke-width':'1.6','stroke-linecap':'round','stroke-linejoin':'round','aria-hidden':'true',focusable:'false'}))icon.setAttribute(key,value);
    const originalIcon=inserted.querySelector('svg');
    if(originalIcon){for(const attr of ['width','height','class','style']){const value=originalIcon.getAttribute(attr);if(value!==null)icon.setAttribute(attr,value);}}
    const outline=document.createElementNS('http://www.w3.org/2000/svg','path');outline.setAttribute('d','M5 12a7 7 0 0 1 14 0v5a2 2 0 0 1-3.4 1.4L14 20l-2-1.6L10 20l-1.6-1.6A2 2 0 0 1 5 17Z');icon.append(outline);
    for(const x of [9,15]){const eye=document.createElementNS('http://www.w3.org/2000/svg','circle');eye.setAttribute('cx',String(x));eye.setAttribute('cy','12');eye.setAttribute('r','.9');eye.setAttribute('fill','currentColor');eye.setAttribute('stroke','none');icon.append(eye);}
    if(originalIcon)originalIcon.replaceWith(icon);
    const walker=document.createTreeWalker(inserted,NodeFilter.SHOW_TEXT);let labelNode;
    while(walker.nextNode()){if(/意见反馈|Contact/.test(walker.currentNode.textContent)){labelNode=walker.currentNode;break;}}
    if(!labelNode)return;
    const text=document.createElement('span');text.dataset.whaleDesktopLabel='true';labelNode.replaceWith(text);
    inserted.addEventListener('click',e=>{e.stopPropagation();change({visible:!state.visible});trigger.click();});
    menu.prepend(inserted);
   }
   const label=state.visible?'隐藏虚拟宠物':'显示虚拟宠物';
   const text=inserted.querySelector('[data-whale-desktop-label]');if(text.textContent!==label)text.textContent=label;
   inserted.disabled=busy;inserted.setAttribute('aria-label',label);
  }
  const observer=new MutationObserver(syncMenu);observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['aria-expanded']});
  function Panel(){
   const [,render]=React.useReducer(n=>n+1,0);React.useEffect(()=>{listeners.add(render);refresh();return()=>listeners.delete(render);},[]);
   return h('section',{className:'wg-settings'},
    h('h2',null,'虚拟宠物'),h('p',null,'鲸鱼娘陪你一起工作。记住显示状态，随 Harness 启动和退出。'),
    h('div',{className:'wg-card'},h('div',{className:'wg-preview',role:'img','aria-label':'鲸鱼娘预览'}),
     h('div',{className:'wg-row'},h('strong',null,'鲸鱼娘'),h('button',{className:'wg-button',disabled:busy,onClick:()=>change({visible:!state.visible})},state.visible?'隐藏虚拟宠物':'显示虚拟宠物')),
     h('div',{className:'wg-status'},state.running?'已显示在桌面':state.visible?'正在启动…':'已隐藏')),
    h('div',{className:'wg-row'},h('label',{htmlFor:'wg-desktop-size'},'宠物大小'),h('select',{id:'wg-desktop-size',className:'wg-button',value:state.size,disabled:busy,onChange:e=>change({size:Number(e.target.value)})},[110,140,180,220].map(size=>h('option',{value:size,key:size},({110:'小',140:'适中',180:'大',220:'特大'})[size])))),
    h('div',{className:'wg-row'},h('span',null,'桌面位置'),h('button',{className:'wg-button',disabled:busy,onClick:()=>change({reset:true})},'恢复默认位置')),
    h('p',null,'拖动可移动位置；单击可投喂或玩耍。也可以从左下角头像菜单快速显示或隐藏。'),
    state.error&&h('div',{className:'wg-error',role:'alert'},state.error));
  }
  const off=ctx.slots.inject('settings.section',()=>ctx.slots.register({name:'settings.section',id:'whale-desktop',order:15,label:()=> '虚拟宠物'},Panel));
  const interval=setInterval(refresh,2500);refresh();syncMenu();
  return()=>{disposed=true;clearInterval(interval);observer.disconnect();inserted?.remove();style.remove();for(const el of document.querySelectorAll('[data-whale-pet-nav]'))el.removeAttribute('data-whale-pet-nav');off?.();listeners.clear();};
 });}
 return{name,inject,apply};
}});
