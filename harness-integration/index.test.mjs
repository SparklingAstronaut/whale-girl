import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, rmSync, readFileSync, existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

const sandbox=mkdtempSync(join(tmpdir(),'wg-integration-test-'));
process.env.LOCALAPPDATA=sandbox;
const mod=await import('./index.mjs');
const {apply,normalizeClient,version,inject}=mod;

function makeRes(){
 const result={status:0,body:''};
 return {writeHead(code){result.status=code;},end(data){result.body+=String(data);},result};
}
function makeReq(method,payload,headers={}){
 const base={method,headers:{host:'127.0.0.1:1234','content-type':'application/json',...headers}};
 if(payload===undefined)return base;
 return {...base,async *[Symbol.asyncIterator](){yield Buffer.from(typeof payload==='string'?payload:JSON.stringify(payload));}};
}
async function readBody(res){
 return JSON.parse(res.result.body||'{}');
}
function boot(){
 let handler=null,cleanup=null;
 const ctx={effect(fn){cleanup=fn();},webServer:{port:0,register(spec){handler=spec.handler;return()=>{handler=null;};}}};
 apply(ctx);
 return {handler:()=>handler,cleanup:()=>cleanup()};
}

test('plugin metadata: only webServer is required; whale-girl is no longer a hard dependency',()=>{
 assert.deepEqual(inject,['webServer']);
 assert.equal(version,'1.1.6');
});

test('client status validation rejects malformed payloads',()=>{
 assert.deepEqual(normalizeClient({loaded:true,menu:'ok',version:'1.1.6',lang:'zh',at:1}),{loaded:true,menu:'ok',version:'1.1.6',lang:'zh',at:1});
 assert.throws(()=>normalizeClient({menu:'nope'}),/Invalid client\.menu/);
 assert.throws(()=>normalizeClient({loaded:'yes'}),/Invalid client\.loaded/);
 assert.throws(()=>normalizeClient(null),/Invalid client status/);
});

test('GET status is readable and reports client diagnostics',async()=>{
 const {handler,cleanup}=boot();
 try{
  const res=makeRes();
  await handler()(makeReq('GET'),res);
  assert.equal(res.result.status,200);
  const body=await readBody(res);
  assert.equal(body.running,false);
  assert.equal(body.version,'1.1.6');
  assert.deepEqual(body.client,{loaded:false,menu:'unknown',version:'',lang:'',at:0});
 } finally { cleanup(); }
});

test('client heartbeat is accepted, persisted in memory and never persisted to disk',async()=>{
 const {handler,cleanup}=boot();
 try{
  const post=makeRes();
  await handler()(makeReq('POST',{client:{loaded:true,menu:'ok',version:'1.1.6',lang:'zh',at:1}}),post);
  assert.equal(post.result.status,200);
  const get=makeRes();
  await handler()(makeReq('GET'),get);
  const body=await readBody(get);
  assert.equal(body.client.loaded,true);
  assert.equal(body.client.menu,'ok');
  assert.equal(body.client.version,'1.1.6');
 } finally { cleanup(); }
});

test('bad client status is rejected with 400 and visibility patch still works',async()=>{
 const {handler,cleanup}=boot();
 try{
  const bad=makeRes();
  await handler()(makeReq('POST',{client:{menu:'bogus'}}),bad);
  assert.equal(bad.result.status,400);
  const bad2=makeRes();
  await handler()(makeReq('POST',{visible:'yes'}),bad2);
  assert.equal(bad2.result.status,400);
  const ok=makeRes();
  await handler()(makeReq('POST',{visible:false,size:110}),ok);
  assert.equal(ok.result.status,200);
  const body=await readBody(ok);
  assert.equal(body.visible,false);
  assert.equal(body.size,110);
 } finally { cleanup(); }
});

test('foreign origins are rejected',async()=>{
 const {handler,cleanup}=boot();
 try{
  const res=makeRes();
  await handler()(makeReq('GET',undefined,{host:'example.com:1234'}),res);
  assert.equal(res.result.status,403);
 } finally { cleanup(); }
});

test('rejected UI requests are recorded so the health check can flag an origin change',async()=>{
 const {handler,cleanup}=boot();
 try{
  const denied=makeRes();
  await handler()(makeReq('POST',{visible:true},{origin:'https://evil.example'}),denied);
  assert.equal(denied.result.status,403);
  const get=makeRes();await handler()(makeReq('GET'),get);
  const body=await readBody(get);
  assert.equal(body.rejected.origin,'https://evil.example');
  assert.ok(body.rejected.at>0);
 } finally { cleanup(); }
});

test('the current port is published to host.json for the health check',async()=>{
 let cleanup=null;
 const ctx={effect(fn){cleanup=fn();},webServer:{port:4321,register(){return()=>{};}}};
 apply(ctx);
 try{
  await new Promise(resolve=>setTimeout(resolve,1400));
  const file=join(sandbox,'Programs','WhaleGirlDesktop','host.json');
  assert.ok(existsSync(file),'host.json should exist');
  const info=JSON.parse(readFileSync(file,'utf8'));
  assert.equal(info.port,4321);assert.equal(info.pid,process.pid);assert.equal(info.version,'1.1.6');
 } finally { cleanup(); }
});

test('cleanup removes the route registration',async()=>{
 const {handler,cleanup}=boot();
 assert.equal(typeof handler(),'function');
 cleanup();
 assert.equal(handler(),null);
 // 清理临时目录
 rmSync(sandbox,{recursive:true,force:true});
});
