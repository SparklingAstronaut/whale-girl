import test from 'node:test';import assert from 'node:assert/strict';
import {normalize,allowed} from './controller.mjs';
test('saved visibility and size survive loading; malformed size is bounded',()=>{
 assert.deepEqual(normalize({visible:false,size:180}),{visible:false,size:180,resetAt:0});
 assert.equal(normalize({size:9999}).size,220);assert.equal(normalize({size:NaN}).size,140);
});
test('only local Harness origins can operate the desktop process',()=>{
 const req=(headers)=>({headers:{host:'127.0.0.1:61005',...headers}});
 assert.equal(allowed(req({origin:'dsh-app://app','sec-fetch-site':'cross-site'})),true);
 assert.equal(allowed(req({origin:'https://example.com'})),false);
 assert.equal(allowed(req({'sec-fetch-site':'cross-site'})),false);
 assert.equal(allowed(req({host:'attacker.example:61005'})),false);
 assert.equal(allowed(req({origin:'http://127.0.0.1:61005'})),true);
});
test('tolerates DSH changing its app origin host or local hostname, still rejects foreign pages',()=>{
 const req=(headers)=>({headers:{host:'127.0.0.1:61005',...headers}});
 assert.equal(allowed(req({origin:'dsh-app://desktop','sec-fetch-site':'cross-site'})),true);
 assert.equal(allowed(req({host:'localhost:61005',origin:'http://localhost:61005'})),true);
 assert.equal(allowed(req({origin:'dsh-app://app/evil path'})),false);
 assert.equal(allowed(req({origin:'http://127.0.0.1:9999'})),false);
 assert.equal(allowed(req({origin:'null'})),false);
});
