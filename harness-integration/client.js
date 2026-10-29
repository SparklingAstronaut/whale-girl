window.__ModuleLoader__.load({id:'dsh-whale-desktop-integration',factory:(require)=>{
 const React=require('react'),h=React.createElement;
 // DSH 官方界面组件：从平台内置的组件表按需取用（无需在 package.json 声明依赖）；取不到就用自绘控件
 let UI=null;try{UI=require('@deepseek-ai/dsh-client-ui-primitives');}catch(_){UI=null;}
 const VERSION='1.1.6',NAME='whale-desktop-integration',NS='settings.whale-desktop';
 // v1.1.1：按用户要求移除“账号菜单注入”这个最容易随 DSH 界面变化而失效的入口。
 // 现在只有两个官方槽入口：设置 → 虚拟宠物（settings.section）与侧栏底部鲸鱼按钮（sidebar.footer.action）。
 // 任何一步失败都不影响另一个入口和桌宠本体；locale 服务存在时自动中英文切换。
 const zh={
  nav:'虚拟宠物',title:'虚拟宠物',intro:'鲸鱼娘陪你一起工作。记住显示状态，随 Harness 启动和退出。',
  show:'显示虚拟宠物',hide:'隐藏虚拟宠物',pet:'鲸鱼娘',size:'宠物大小',position:'桌面位置',reset:'恢复默认位置',
  statusShown:'已显示在桌面',statusStarting:'正在启动…',statusHidden:'已隐藏',hint:'单击桌宠打开喂食 / 玩耍菜单，悬停查看等级；左下侧栏的鲸鱼按钮也能快速开关。',rowShow:'显示桌宠',sizeDesc:'桌宠在桌面上的显示大小',positionDesc:'拖动桌宠可随时移动；点按钮回到屏幕右下角',
  size110:'小',size140:'适中',size180:'大',size220:'特大',connectFail:'桌宠连接暂不可用（Harness 插件可能未启用或正在启动）',
  diag:'客户端界面：正常',footerHint:'显示/隐藏鲸鱼娘桌宠'
 };
 const en={
  nav:'Virtual pet',title:'Virtual pet',intro:'The whale girl works with you. The visibility is remembered across Harness restarts.',
  show:'Show virtual pet',hide:'Hide virtual pet',pet:'Whale girl',size:'Pet size',position:'Desktop position',reset:'Reset position',
  statusShown:'Shown on the desktop',statusStarting:'Starting…',statusHidden:'Hidden',hint:'Click the pet for the feed / play menu and hover to see its level; the whale button in the lower-left sidebar toggles it too.',rowShow:'Show desktop pet',sizeDesc:'How large the pet appears on your desktop',positionDesc:'Drag the pet to move it anytime; reset puts it back at the lower-right corner',
  size110:'Small',size140:'Medium',size180:'Large',size220:'Extra large',connectFail:'Desktop pet unavailable (plugin disabled or still starting)',
  diag:'Client UI: ready',footerHint:'Show or hide the whale girl desktop pet'
 };
 const inject=['slots'];
 function apply(ctx){
  ctx.effect(()=>{
   let disposed=false,busy=false,inSync=false,reportAt=0;
   let locale=null,offLocale=null;
   const state={visible:false,running:false,size:140,error:''};
   const listeners=new Set();
   try{ if(typeof ctx.get==='function') locale=ctx.get('locale')||null; }catch(_){ locale=null; }
   const hasLocale=!!(locale&&typeof locale.register==='function'&&typeof locale.bind==='function');
   try{ if(hasLocale) offLocale=locale.register(NS,{zh,en}); }catch(_){ offLocale=null; }
   const fallback=(key)=>zh[key]!==undefined?zh[key]:(en[key]!==undefined?en[key]:key);
   const t=(key)=>{ if(!hasLocale)return fallback(key); try{const value=locale.bind(NS)(key);return (value===undefined||value===null||value===key)?fallback(key):value;}catch(_){return fallback(key);} };
   const snapshot=()=>({...state,busy:!!busy,version:VERSION});
   const notify=()=>{ for(const fn of listeners){ try{fn();}catch(_){} } try{syncDom();}catch(_){} };
   const request=async(patch)=>{
    const init=patch?{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(patch)}:{cache:'no-store'};
    const res=await fetch('/whale-desktop/control',init);
    let data=null; try{data=await res.json();}catch(_){}
    if(!res.ok)throw Error((data&&data.error)||('HTTP '+res.status));
    return data||{};
   };
   const applyStatus=(next)=>{ if(!next||typeof next!=='object')return; for(const key of ['visible','running','size','error']){ if(next[key]!==undefined) state[key]=next[key]; } };
   const refresh=async()=>{ try{const next=await request();applyStatus(next);if(next&&next.client&&next.client.loaded!==true)reportClient();}catch(_){state.error=t('connectFail');} if(!disposed)notify(); };
   const change=async(patch)=>{ if(busy)return; busy=true; notify();
    try{ if(patch&&typeof patch.visible==='boolean')state.visible=patch.visible; applyStatus(await request(patch)); state.error=''; }
    catch(e){ state.error=e.message||String(e); }
    finally{ busy=false; if(!disposed){notify();reportClient();} } };
   const reportClient=()=>{ if(disposed)return; const now=Date.now(); if(now-reportAt<1500)return; reportAt=now; try{
    const lang=(document.documentElement&&document.documentElement.lang)||navigator.language||'';
    // menu: 'unsupported' 表示“已按设计不注入账号菜单”，让自检脚本不要把默认行为当成降级
    request({client:{loaded:true,version:VERSION,menu:'unsupported',ui:uiMode,lang:String(lang).slice(0,16),at:now}}).catch(()=>{});
   }catch(_){}};
   const style=document.createElement('style'); style.dataset.whaleDesktop='true';
   style.textContent=`[data-whale-girl]{display:none!important}.wg-settings{max-width:760px;color:var(--dsw-alias-label-primary);display:flex;flex-direction:column}.wg-heading{margin:0;font-size:18px;font-weight:600;line-height:1.4}.wg-intro{color:var(--dsw-alias-label-tertiary);margin:6px 0 4px;font-size:13px;line-height:1.5}.wg-row{border-bottom:.5px solid var(--dsw-alias-border-l2,#8883);justify-content:space-between;align-items:center;gap:24px;padding:16px 0;display:flex}.wg-row-main{display:flex;align-items:center;gap:12px;min-width:0}.wg-row-title{font-size:14px;line-height:20px}.wg-row-desc{color:var(--dsw-alias-label-secondary);margin-top:4px;font-size:12px;line-height:18px}.wg-row-control{flex:none}.wg-thumb{flex:none;width:44px;height:44px;border-radius:10px;background-color:var(--dsw-alias-interactive-bg-hover,#7772);background-image:url('/whale-girl/assets/characters/whale-girl/idle.png');background-size:132px 44px;background-repeat:no-repeat;background-position:0 0}.wg-error{color:var(--dsw-alias-state-danger-primary,#f66);font-size:12px;line-height:18px;margin-top:12px}.wg-foot{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px;margin:14px 0 0}.wg-button{color:var(--dsw-alias-label-primary);background:transparent;border:1px solid var(--dsw-alias-border-l2,#8885);border-radius:8px;padding:5px 12px;font:inherit;font-size:13px;cursor:pointer}.wg-button:disabled{opacity:.5;cursor:default}.wg-select option{background:#292a2c;color:#f4f4f5}.wg-footer-action{display:flex;align-items:center;gap:8px;height:32px;padding:0 8px;color:var(--dsw-alias-label-secondary);background:0 0;border:0;border-radius:var(--dsw-radius-md);cursor:pointer;font:inherit}.wg-footer-action:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}.wg-footer-action[data-wg-visible=true]{color:var(--dsw-alias-state-business-primary)}.wg-footer-label{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}`;
   style.textContent+=`[data-whale-pet-nav] svg{background:currentColor;mask:url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%222%202%2020%2020%22%20fill%3D%22none%22%20stroke%3D%22black%22%20stroke-width%3D%221.6%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22M5%2012a7%207%200%200%201%2014%200v5a2%202%200%200%201-3.4%201.4L14%2020l-2-1.6L10%2020l-1.6-1.6A2%202%200%200%201%205%2017Z%22%2F%3E%3Ccircle%20cx%3D%229%22%20cy%3D%2212%22%20r%3D%22.9%22%20fill%3D%22black%22%20stroke%3D%22none%22%2F%3E%3Ccircle%20cx%3D%2215%22%20cy%3D%2212%22%20r%3D%22.9%22%20fill%3D%22black%22%20stroke%3D%22none%22%2F%3E%3C%2Fsvg%3E") center/contain no-repeat}[data-whale-pet-nav] svg>*{visibility:hidden}`;
   document.head.append(style);
   // 保留的唯一 DOM 操作：设置弹窗侧栏里给我们自己那一项加个小鲸鱼图标（纯装饰，失败静默跳过）
   const NAV_LABELS=[zh.nav,en.nav,'虚拟宠物','Virtual pet'];
   const syncNavIcon=()=>{
    for(const panel of document.querySelectorAll('[data-shortcut-modal="settings"]')){
     const nav=panel.querySelector('nav');if(!nav)continue;
     for(const button of nav.querySelectorAll('button')){
      const text=(button.textContent||'').trim();
      if(NAV_LABELS.includes(text)){ if(!button.hasAttribute('data-whale-pet-nav'))button.setAttribute('data-whale-pet-nav',''); }
     }
    }
   };
   let rafPending=false;
   const syncDom=()=>{ if(disposed||inSync)return; if(rafPending)return; rafPending=true; const run=()=>{rafPending=false;inSync=true;try{syncNavIcon();}catch(_){}inSync=false;}; if(typeof requestAnimationFrame==='function')requestAnimationFrame(run);else setTimeout(run,16); };
   let observer=null;
   try{ observer=new MutationObserver(()=>syncDom()); observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['aria-expanded','data-shortcut-modal']}); }catch(_){ observer=null; }

   // 官方槽 1：设置 → 虚拟宠物。布局与 DSH 官方设置页一致（标题 + 说明 + 每项一行），
   // 控件优先用 DSH 自带的 Switch / SegmentedControl / Button；拿不到时退回自绘控件，页面照常可用。
   const isComponent=(value)=>typeof value==='function'||(typeof value==='object'&&value!==null);
   const OfficialSwitch=UI&&isComponent(UI.Switch)?UI.Switch:null;
   const OfficialSegmented=UI&&isComponent(UI.SegmentedControl)?UI.SegmentedControl:null;
   const OfficialButton=UI&&isComponent(UI.Button)?UI.Button:null;
   const uiMode=OfficialSwitch&&OfficialSegmented&&OfficialButton?'official':(OfficialSwitch||OfficialSegmented||OfficialButton?'partial':'fallback');
   const SIZES=[110,140,180,220];
   const Row=({title,desc,lead,children})=>h('div',{className:'wg-row'},
    h('div',{className:'wg-row-main'},lead||null,h('div',null,h('div',{className:'wg-row-title'},title),desc?h('div',{className:'wg-row-desc'},desc):null)),
    h('div',{className:'wg-row-control'},children));
   const Panel=()=>{
    const [,force]=React.useReducer(n=>n+1,0);
    React.useEffect(()=>{const off=store.subscribe(force);refresh();return()=>off();},[]);
    const current=store.snapshot();
    const status=current.running?t('statusShown'):current.visible?t('statusStarting'):t('statusHidden');
    const toggle=(next)=>change({visible:!!next});
    const visibility=OfficialSwitch
     ?h(OfficialSwitch,{checked:!!current.visible,label:t('rowShow'),disabled:current.busy,onChange:toggle})
     :h('button',{type:'button',className:'wg-button',role:'switch','aria-checked':current.visible?'true':'false',disabled:current.busy,onClick:()=>toggle(!current.visible)},current.visible?t('hide'):t('show'));
    const size=OfficialSegmented
     ?h(OfficialSegmented,{id:'wg-desktop-size',label:t('size'),value:String(current.size),disabled:current.busy,options:SIZES.map(s=>({value:String(s),label:t('size'+s)})),onChange:(next)=>change({size:Number(next)})})
     :h('select',{id:'wg-desktop-size',className:'wg-button wg-select','aria-label':t('size'),value:current.size,disabled:current.busy,onChange:e=>change({size:Number(e.target.value)})},SIZES.map(s=>h('option',{value:s,key:s},t('size'+s))));
    const reset=OfficialButton
     ?h(OfficialButton,{variant:'outline',size:'sm',disabled:current.busy,onClick:()=>change({reset:true})},t('reset'))
     :h('button',{type:'button',className:'wg-button',disabled:current.busy,onClick:()=>change({reset:true})},t('reset'));
    return h('section',{className:'wg-settings','data-wg-ui':uiMode},
     h('h2',{className:'wg-heading'},t('title')),
     h('p',{className:'wg-intro'},t('intro')),
     h(Row,{title:t('rowShow'),desc:status,lead:h('div',{className:'wg-thumb',role:'img','aria-label':t('pet')})},visibility),
     h(Row,{title:t('size'),desc:t('sizeDesc')},size),
     h(Row,{title:t('position'),desc:t('positionDesc')},reset),
     current.error?h('div',{className:'wg-error',role:'alert'},current.error):null,
     h('p',{className:'wg-foot'},t('hint')+' · v'+VERSION));
   };
   // 官方槽 2：侧栏底部鲸鱼按钮（DSH 官方 list slot）
   const FooterAction=(props)=>{
    const [,force]=React.useReducer(n=>n+1,0);
    React.useEffect(()=>{const off=store.subscribe(force);return()=>off();},[]);
    const current=store.snapshot();
    const label=current.visible?t('hide'):t('show');
    return h('button',{type:'button',className:'wg-footer-action',title:t('footerHint'),'aria-label':label,'aria-pressed':current.visible?'true':'false','data-wg-visible':current.visible?'true':'false',onClick:()=>store.toggle()},
     h('svg',{width:16,height:16,viewBox:'2 2 20 20',fill:'none',stroke:'currentColor',strokeWidth:1.6,strokeLinecap:'round',strokeLinejoin:'round','aria-hidden':'true',focusable:'false'},
      h('path',{d:'M5 12a7 7 0 0 1 14 0v5a2 2 0 0 1-3.4 1.4L14 20l-2-1.6L10 20l-1.6-1.6A2 2 0 0 1 5 17Z'}),
      h('circle',{cx:'9',cy:'12',r:'.9',fill:'currentColor',stroke:'none'}),
      h('circle',{cx:'15',cy:'12',r:'.9',fill:'currentColor',stroke:'none'})),
     props.wide?h('span',{className:'wg-footer-label'},label):null);
   };
   const store={snapshot,subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);},refresh,toggle:()=>change({visible:!state.visible}),change};
   let offSettings=null;try{
    offSettings=ctx.slots.inject('settings.section',()=>ctx.slots.register({name:'settings.section',id:'whale-desktop',order:15,label:()=>t('nav')},Panel));
   }catch(_){}
   let offFooter=null;try{
    const registration={name:'sidebar.footer.action',id:'whale-desktop',order:10,inject:()=>({store})};
    if(hasLocale)registration.locale=NS;
    offFooter=ctx.slots.inject('sidebar.footer.action',()=>ctx.slots.register(registration,FooterAction));
   }catch(_){}
   const interval=setInterval(()=>{if(!disposed)refresh();},2500);
   refresh();syncDom();reportClient();
   return()=>{
    disposed=true;
    clearInterval(interval);
    try{if(observer)observer.disconnect();}catch(_){}
    try{style.remove();}catch(_){}
    try{for(const el of document.querySelectorAll('[data-whale-pet-nav]'))el.removeAttribute('data-whale-pet-nav');}catch(_){}
    try{if(offSettings)offSettings();}catch(_){}
    try{if(offFooter)offFooter();}catch(_){}
    try{if(offLocale)offLocale();}catch(_){}
    listeners.clear();
   };
  });}
  return {name:NAME,inject,apply};
 }});
