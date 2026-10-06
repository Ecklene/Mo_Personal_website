import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readdir} from 'node:fs/promises';
import {env,post,fakeDatabase,response} from './helpers.mjs';
import {encrypt} from '../lib/auth.js';
import {shareLinkedIn} from '../lib/linkedin.js';
import {publishPin} from '../lib/pinterest.js';
env();
test('Deployment contains public pages and assets, excluding server source and configuration',async()=>{
  execFileSync(process.execPath,['scripts/prepare-static.mjs']);
  const files=await readdir('public',{recursive:true});
  assert.ok(files.includes('index.html'));assert.ok(files.includes('studio/index.html'));assert.ok(files.includes('blog/index.html'));assert.ok(files.includes('assets/studio.js'));
  assert.ok(files.every(name=>!/(^|\/)(lib|api|backend|site|tests|scripts)(\/|$)|(^|\/)(\.env|BLOG_SETUP|package\.json)/.test(name)));
  assert.equal(files.filter(name=>name.endsWith('index.html')).length,13);
});
test('LinkedIn and Pinterest share approved articles and persist duplicate protection',async()=>{
  const p=post({status:'published',published_at:new Date().toISOString()}),state=fakeDatabase([p]),original=global.fetch;const providers=[];
  state.integrations.push(...['linkedin','pinterest'].map(name=>({name,member_id:'member',board_id:'board123',encrypted_token:encrypt('mock-access-token'),expires_at:new Date(Date.now()+86400000).toISOString()})));
  global.fetch=async(input,options={})=>{
    const url=new URL(input);if(url.hostname==='db.example')return state.fetch(input,options);
    const data=JSON.parse(options.body);providers.push({host:url.hostname,data});
    assert.equal(options.headers.Authorization,'Bearer mock-access-token');
    if(url.hostname==='api.linkedin.com'){assert.equal(data.content.article.source,process.env.SITE_URL+'/blog/'+p.slug+'/');return response('',201,{'x-restli-id':'urn:li:share:123'});}
    assert.equal(url.hostname,'api.pinterest.com');assert.equal(data.board_id,'board123');assert.equal(data.media_source.url,p.images[0].url);assert.equal(data.link,process.env.SITE_URL+'/blog/'+p.slug+'/');return response({id:'pin123'},201);
  };
  try{
    const linked=await shareLinkedIn(p);assert.equal(linked.linkedin_post_id,'urn:li:share:123');const pinned=await publishPin(linked);assert.equal(pinned.pinterest_pin_id,'pin123');
    await shareLinkedIn(pinned);await publishPin(pinned);assert.equal(providers.length,2);
    assert.ok(state.posts[0].linkedin_claimed_at);assert.ok(state.posts[0].pinterest_claimed_at);
  }finally{global.fetch=original;}
});
test('An ambiguous social submission remains locked to prevent duplicate publishing',async()=>{
  const p=post({status:'published'}),state=fakeDatabase([p]),original=global.fetch;
  state.integrations.push({name:'pinterest',board_id:'board123',encrypted_token:encrypt('token'),expires_at:new Date(Date.now()+86400000).toISOString()});
  global.fetch=async(input,options={})=>{if(new URL(input).hostname==='db.example')return state.fetch(input,options);throw new Error('Connection ended after submission');};
  try{await assert.rejects(publishPin(p));assert.ok(state.posts[0].pinterest_claimed_at);await assert.rejects(publishPin(state.posts[0]),{status:409});}finally{global.fetch=original;}
});
