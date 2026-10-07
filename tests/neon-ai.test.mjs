import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {sqlOperation} from '../lib/neon.js';
import {neonConfig} from '@neondatabase/serverless';
import {db} from '../lib/db.js';
import {summarize,jsonAI,claudeSchema} from '../lib/ai.js';
import {env,post,response,fakeDatabase,call} from './helpers.mjs';
import {reviewToken} from '../lib/auth.js';
import editor from '../api/editor.js';
env();process.env.ANTHROPIC_API_KEY='test-only';
test('Neon schema and real PostgreSQL operations preserve drafts, revisions, claims and login limits',async()=>{
  const pg=new PGlite();
  try{
    const schema=await readFile('backend/schema-neon.sql','utf8');await pg.exec(schema);await pg.exec(schema);
    const execute=async(path,options={})=>{const q=sqlOperation(path,options),result=await pg.query(q.text,q.values);return q.scalar?result.rows[0][q.scalar]:result.rows;};
    const insert=(path,data)=>execute(path,{method:'POST',body:JSON.stringify(data)});
    const patch=(path,data)=>execute(path,{method:'PATCH',body:JSON.stringify(data)});
    const p=post();const rows=await insert('blog_posts',p);assert.equal(rows[0].status,'draft');assert.equal(rows[0].images.length,3);
    assert.equal((await execute('blog_posts?status=eq.published&order=published_at.desc&limit=12&offset=0')).length,0);
    assert.equal((await patch(`blog_posts?id=eq.${p.id}&updated_at=eq.2000-01-01T00%3A00%3A00Z`,{title:'unsafe'})).length,0);
    await patch(`blog_posts?id=eq.${p.id}&updated_at=eq.${encodeURIComponent(p.updated_at)}`,{status:'published',published_at:new Date().toISOString()});
    assert.equal((await execute('blog_posts?status=eq.published&order=published_at.desc&limit=12&offset=0')).length,1);
    const [job]=await insert('rpc/blog_claim_job',{p_slot:'weekly-test',p_post_id:p.id});assert.equal(job.state,'working');assert.equal((await insert('rpc/blog_claim_job',{p_slot:'weekly-test',p_post_id:crypto.randomUUID()})).length,0);
    await patch('blog_jobs?slot=eq.weekly-test',{state:'failed'});const [retry]=await insert('rpc/blog_claim_job',{p_slot:'weekly-test',p_post_id:crypto.randomUUID()});assert.equal(retry.post_id,p.id);
    for(let i=1;i<=6;i++)assert.equal(await insert('rpc/blog_login_attempt',{p_key:'test-ip'}),i);
    await insert('blog_integrations?on_conflict=name',{name:'pinterest',encrypted_token:'encrypted-test-token',member_id:'owner',expires_at:new Date().toISOString(),board_id:'one'});
    await insert('blog_integrations?on_conflict=name',{name:'pinterest',encrypted_token:'new-token',member_id:'owner',expires_at:new Date().toISOString()});
    assert.equal((await execute('blog_integrations?name=eq.pinterest&limit=1'))[0].board_id,'one');
    const [claim]=await patch(`blog_posts?id=eq.${p.id}&pinterest_claimed_at=is.null&pinterest_pin_id=is.null`,{pinterest_claimed_at:new Date().toISOString()});assert.ok(claim);
    assert.equal((await patch(`blog_posts?id=eq.${p.id}&pinterest_claimed_at=is.null&pinterest_pin_id=is.null`,{pinterest_claimed_at:new Date().toISOString()})).length,0);
    assert.equal((await pg.query("SELECT count(*)::int AS count FROM pg_class WHERE relname IN ('blog_posts','blog_jobs','blog_integrations','blog_login_limits') AND relrowsecurity")).rows[0].count,4);
  }finally{await pg.close();}
});
test('SQL values are bound and arbitrary identifiers are rejected',()=>{
  const injection="a'; DROP TABLE blog_posts;--",q=sqlOperation('blog_posts?title=eq.'+encodeURIComponent(injection));
  assert.doesNotMatch(q.text,/DROP/);assert.deepEqual(q.values,[injection]);
  for(const path of ['blog_posts?badcolumn=eq.x','unknown?limit=1','blog_posts?select=title;DROP','blog_posts?order=title.evil'])assert.throws(()=>sqlOperation(path));
  assert.throws(()=>sqlOperation('blog_posts',{method:'PATCH',body:JSON.stringify({title:'unscoped'})}));
});
test('The installed Neon HTTP driver reads and writes PostgreSQL data with server-only credentials',async()=>{
  const pg=new PGlite(),previousFetch=neonConfig.fetchFunction,previousUrl=process.env.DATABASE_URL;
  try{
    await pg.exec(await readFile('backend/schema-neon.sql','utf8'));
    process.env.DATABASE_URL='postgresql://owner:test-only@ep-tests.us-east-2.aws.neon.tech/neondb?sslmode=require';
    neonConfig.fetchFunction=async(input,options)=>{
      const request=JSON.parse(options.body),result=await pg.query(request.query,request.params);
      const fields=result.fields.map(field=>({name:field.name,dataTypeID:field.dataTypeID}));
      const encode=value=>value===null?null:value instanceof Date?value.toISOString().replace('T',' ').replace('Z','+00'):typeof value==='object'?JSON.stringify(value):typeof value==='boolean'?(value?'t':'f'):String(value);
      return response({fields,rows:result.rows.map(row=>fields.map(field=>encode(row[field.name]))),rowCount:result.affectedRows||result.rows.length,command:'SELECT',rowAsArray:true});
    };
    const p=post();const [created]=await db('blog_posts',{method:'POST',body:JSON.stringify(p)});assert.equal(created.images.length,3);assert.equal(created.updated_at,p.updated_at);assert.equal(created.ai_generated,true);
    assert.equal((await db('blog_posts?status=eq.published&limit=12')).length,0);
    assert.equal(await db('rpc/blog_login_attempt',{method:'POST',body:JSON.stringify({p_key:'driver-test'})}),1);
  }finally{neonConfig.fetchFunction=previousFetch;if(previousUrl===undefined)delete process.env.DATABASE_URL;else process.env.DATABASE_URL=previousUrl;await pg.close();}
});
test('OpenAI and Claude return editable summaries, and truncation never overwrites the draft',async()=>{
  const original=global.fetch;let provider='openai',incomplete=false;
  const summary={description:'An evidence-led guide to asking better questions about AI products and evaluating results before deciding what to build.',social_excerpt:'This article explores how thoughtful questions and careful evaluation help teams make better decisions about AI products.'};
  global.fetch=async(input,options)=>{
    const request=JSON.parse(options.body);
    if(provider==='claude'){assert.equal(input,'https://api.anthropic.com/v1/messages');assert.equal(request.output_config.format.type,'json_schema');return response({stop_reason:incomplete?'max_tokens':'end_turn',content:[{type:'text',text:JSON.stringify(summary)}]});}
    assert.equal(input,'https://api.openai.com/v1/responses');assert.equal(request.store,false);assert.equal(request.text.format.strict,true);return response({status:incomplete?'incomplete':'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(summary)}]}]});
  };
  try{for(provider of ['openai','claude'])assert.deepEqual(await summarize(post(),provider),summary);incomplete=true;await assert.rejects(summarize(post(),'claude'),{status:502});await assert.rejects(summarize(post({body:'short'}),'openai'),{status:400});await assert.rejects(jsonAI({},'prompt',{provider:'invalid'}),{status:400});}finally{global.fetch=original;}
});
test('Claude schema accommodates API limits without mutating OpenAI constraints',()=>{
  const schema={type:'object',properties:{images:{type:'array',minItems:3,maxItems:3,items:{type:'string'}}}},transformed=claudeSchema(schema);
  assert.equal(transformed.properties.images.minItems,1);assert.equal(transformed.properties.images.maxItems,undefined);assert.match(transformed.properties.images.description,/exactly 3/);assert.equal(schema.properties.images.minItems,3);
});
test('Summarising is authenticated, draft-scoped and never publishes automatically',async()=>{
  const p=post(),state=fakeDatabase([p]),original=global.fetch;
  global.fetch=async(input,options)=>new URL(input).hostname==='db.example'?state.fetch(input,options):response({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({description:'Reviewed search summary',social_excerpt:'An editable social summary'})}]}]});
  try{
    const token=reviewToken(p),data={id:p.id,version:p.updated_at,provider:'openai'};
    assert.equal((await call(editor,{action:'summarize',method:'POST',data})).statusCode,401);
    const result=await call(editor,{action:'summarize',method:'POST',token,data});assert.equal(result.statusCode,200);assert.equal(result.json().post.description,'Reviewed search summary');assert.equal(result.json().post.status,'draft');assert.equal(result.json().post.body,p.body);
  }finally{global.fetch=original;}
});
