import test from 'node:test';
import assert from 'node:assert/strict';
import {env,post,fakeDatabase,call} from './helpers.mjs';
import {reviewToken,sign} from '../lib/auth.js';
import editor from '../api/editor.js';
import publicBlog from '../api/public-blog.js';
import feed from '../api/feed.js';
import automation from '../api/automation.js';
import {shareLinkedIn} from '../lib/linkedin.js';
import {publishPin} from '../lib/pinterest.js';
env();
test('Approval requires an explicit same-origin POST and matching draft version',async()=>{
  const p=post(),state=fakeDatabase([p]),original=global.fetch;global.fetch=state.fetch;
  try{
    const token=reviewToken(p),data={id:p.id,version:p.updated_at};
    assert.equal((await call(editor,{action:'approve',params:{id:p.id},token})).statusCode,405);assert.equal(state.posts[0].status,'draft');
    assert.equal((await call(editor,{action:'approve',method:'POST',token,data,origin:'https://bad.example'})).statusCode,403);
    assert.equal((await call(editor,{action:'approve',method:'POST',token,data:{...data,version:'stale'}})).statusCode,409);
    const result=await call(editor,{action:'approve',method:'POST',token,data});assert.equal(result.statusCode,200);assert.equal(result.json().post.status,'published');assert.ok(result.json().post.published_at);
    assert.equal((await call(editor,{action:'save',method:'POST',token,data:{...data,changes:{title:'change'}}})).statusCode,409);
  }finally{global.fetch=original;}
});
test('Scoped review cannot list other drafts, edit another draft or connect accounts',async()=>{
  const p=post(),other=post({id:'33333333-3333-4333-8333-333333333333'}),state=fakeDatabase([p,other]),original=global.fetch;global.fetch=state.fetch;
  try{
    const token=reviewToken(p);
    assert.equal((await call(editor,{action:'list',token})).statusCode,403);
    assert.equal((await call(editor,{action:'get',params:{id:other.id},token})).statusCode,403);
    assert.equal((await call(editor,{action:'boards',token})).statusCode,403);
    assert.equal((await call(editor,{action:'get',params:{id:p.id}})).statusCode,401);
    const result=await call(editor,{action:'session',token});assert.equal(result.statusCode,200);assert.equal(result.json().configuration,undefined);
    const rejected=await call(editor,{action:'reject',method:'POST',token,data:{id:p.id,version:p.updated_at,note:'Needs changes'}});assert.equal(rejected.json().post.status,'rejected');
  }finally{global.fetch=original;}
});
test('Owner sign-in is rate limited and returns a private secure cookie',async()=>{
  const state=fakeDatabase(),original=global.fetch;global.fetch=state.fetch;
  try{
    const good=await call(editor,{action:'login',method:'POST',data:{password:process.env.ADMIN_PASSWORD}});assert.equal(good.statusCode,200);assert.match(good.headers['set-cookie'],/HttpOnly; Secure; SameSite=Strict/);
    for(let i=0;i<4;i++) assert.equal((await call(editor,{action:'login',method:'POST',data:{password:'bad'}})).statusCode,401);
    assert.equal((await call(editor,{action:'login',method:'POST',data:{password:process.env.ADMIN_PASSWORD}})).statusCode,429);
  }finally{global.fetch=original;}
});
test('Unpublishing revokes existing review access and requires a current version',async()=>{
  const p=post({status:'published',published_at:new Date().toISOString(),email_sent_at:new Date().toISOString()}),state=fakeDatabase([p]),original=global.fetch;global.fetch=state.fetch;
  try{
    const cookie='mo_editor='+sign({kind:'session'},60),token=reviewToken(p);
    assert.equal((await call(editor,{action:'unpublish',method:'POST',cookie,data:{id:p.id}})).statusCode,409);
    const result=await call(editor,{action:'unpublish',method:'POST',cookie,data:{id:p.id,version:p.updated_at}});assert.equal(result.statusCode,200);assert.equal(result.json().post.status,'draft');assert.equal(result.json().post.email_sent_at,null);
    assert.equal((await call(editor,{action:'get',params:{id:p.id},token})).statusCode,403);
  }finally{global.fetch=original;}
});
test('Public article pages, homepage JSON, RSS and sitemap exclude every unpublished post',async()=>{
  const published=post({slug:'public-article',status:'published',published_at:new Date().toISOString()}),draft=post({slug:'private-secret-draft',title:'Private secret draft'}),rejected=post({slug:'rejected-secret',status:'rejected'}),state=fakeDatabase([published,draft,rejected]),original=global.fetch;global.fetch=state.fetch;
  try{
    const listing=await call(publicBlog,{params:{}});assert.equal(listing.statusCode,200);assert.match(listing.body,/public-article/);assert.doesNotMatch(listing.body,/private-secret-draft|rejected-secret|Private fact-check note/);
    const hidden=await call(publicBlog,{params:{slug:draft.slug}});assert.equal(hidden.statusCode,404);
    const json=await call(publicBlog,{params:{format:'json'}});assert.equal(json.json().posts.length,1);assert.equal(json.json().posts[0].body,undefined);assert.equal(json.json().posts[0].editorial_note,undefined);
    for(const type of ['rss','sitemap']) {const result=await call(feed,{params:{type}});assert.equal(result.statusCode,200);assert.match(result.body,/public-article/);assert.doesNotMatch(result.body,/private-secret-draft|rejected-secret|Private fact-check note/);}
    assert.ok(state.calls.every(c=>!c.url.includes('/blog_posts?')||new URL(c.url).searchParams.get('status')==='eq.published'));
  }finally{global.fetch=original;}
});
test('Disabled automation and unpublished social sharing make no provider calls',async()=>{
  const original=global.fetch;global.fetch=()=>{throw new Error('No network call expected');};
  try{
    const result=await call(automation,{token:process.env.CRON_SECRET});assert.equal(result.statusCode,200);assert.equal(result.json().skipped,true);
    assert.equal((await call(automation,{})).statusCode,401);
    await assert.rejects(shareLinkedIn(post()),{status:400});await assert.rejects(publishPin(post()),{status:400});
    const p=post({status:'published',linkedin_post_id:'existing',pinterest_pin_id:'existing'});assert.equal(await shareLinkedIn(p),p);assert.equal(await publishPin(p),p);
  }finally{global.fetch=original;}
});
