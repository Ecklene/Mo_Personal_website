import test from 'node:test';
import assert from 'node:assert/strict';
import {env,post,fakeDatabase,response} from './helpers.mjs';
import {generate} from '../lib/generate.js';
env();
test('Failed images retain the draft and retry only missing images before one email',async()=>{
  const state=fakeDatabase(),original=global.fetch;let researches=0,writes=0,images=0,emails=0,failSecond=true;
  global.fetch=async(input,options={})=>{
    const url=new URL(input);
    if(url.hostname==='db.example') return url.pathname.startsWith('/storage/v1/object/public/') ? new Response('image',{headers:{'content-length':'5'}}) : state.fetch(input,options);
    if(url.hostname==='api.resend.com'){emails++;const payload=JSON.parse(options.body);assert.equal(payload.to[0],'owner@example.com');assert.equal((payload.html.match(/<figure/g)||[]).length,3);assert.match(payload.html,/studio\/#review=/);assert.equal(payload.attachments.length,3);return response({id:'email-id'});}
    assert.equal(url.hostname,'api.openai.com');const data=JSON.parse(options.body);
    if(url.pathname.endsWith('/images/generations')) { images++;if(failSecond&&images===2) return response({},500);return response({data:[{b64_json:Buffer.from('image').toString('base64')}]}); }
    if(data.tools){researches++;assert.equal(data.tool_choice,'required');return response({output:[{type:'message',content:[{type:'output_text',text:'Two primary sources establish a useful development.',annotations:[{type:'url_citation',url:'https://nist.gov/research'},{type:'url_citation',url:'https://arxiv.org/paper'}]}]}]});}
    writes++;const p=post();return response({output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({title:p.title,slug:p.slug,description:p.description,social_excerpt:p.social_excerpt,body:p.body,editorial_note:p.editorial_note,images:p.images.map(({prompt,alt,caption})=>({prompt,alt,caption}))})}]}]});
  };
  try{
    await assert.rejects(generate({category:'AI Research',slot:'scheduled-test'}));assert.equal(state.posts.length,1);assert.equal(state.posts[0].status,'draft');assert.equal(state.posts[0].images.filter(i=>i.url).length,2);assert.equal(state.jobs[0].state,'failed');assert.equal(emails,0);
    failSecond=false;const result=await generate({category:'AI Research',slot:'scheduled-test'});assert.equal(images,4);assert.equal(researches,1);assert.equal(writes,1);assert.equal(emails,1);assert.equal(result.post.status,'draft');assert.equal(result.post.images.length,3);assert.ok(result.post.email_sent_at);assert.equal(state.jobs[0].state,'complete');
    assert.equal((await generate({category:'AI Research',slot:'scheduled-test'})).skipped,true);assert.equal(images,4);assert.equal(emails,1);
  }finally{global.fetch=original;}
});
test('Research with insufficient evidence creates no article or images',async()=>{
  const state=fakeDatabase(),original=global.fetch;let requests=0;
  global.fetch=async(input,options={})=>{if(new URL(input).hostname==='db.example')return state.fetch(input,options);requests++;return response({output:[{type:'message',content:[{type:'output_text',text:'An unsupported claim',annotations:[]}]}]});};
  try{await assert.rejects(generate({category:'Cybersecurity',slot:'insufficient'}),/verifiable sources/);assert.equal(requests,1);assert.equal(state.posts.length,0);assert.equal(state.jobs[0].state,'failed');}finally{global.fetch=original;}
});
test('Email retry reuses saved images and the same provider idempotency key and payload',async()=>{
  const p=post(),state=fakeDatabase([p]),original=global.fetch,deliveries=[];
  state.jobs.push({slot:'email-retry',post_id:p.id,state:'failed'});
  global.fetch=async(input,options={})=>{
    const url=new URL(input);
    if(url.hostname==='db.example')return url.pathname.startsWith('/storage/v1/object/public/')?new Response('image',{headers:{'content-length':'5'}}):state.fetch(input,options);
    assert.equal(url.hostname,'api.resend.com');deliveries.push({key:options.headers['Idempotency-Key'],body:options.body});return response({},deliveries.length===1?500:200);
  };
  try{
    await assert.rejects(generate({category:'AI Research',slot:'email-retry'}));assert.equal(state.jobs[0].state,'failed');
    const result=await generate({category:'AI Research',slot:'email-retry'});assert.equal(result.emailed,true);assert.equal(deliveries.length,2);assert.deepEqual(deliveries[0],deliveries[1]);
  }finally{global.fetch=original;}
});
test('Retry cannot change an article that was already approved',async()=>{
  const p=post({status:'published'}),state=fakeDatabase([p]),original=global.fetch;
  state.jobs.push({slot:'approved-retry',post_id:p.id,state:'failed'});global.fetch=state.fetch;
  try{const result=await generate({category:'AI Research',slot:'approved-retry'});assert.equal(result.skipped,true);assert.equal(state.posts[0].updated_at,p.updated_at);assert.equal(state.jobs[0].state,'complete');}finally{global.fetch=original;}
});
