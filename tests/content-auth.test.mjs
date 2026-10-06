import test from 'node:test';
import assert from 'node:assert/strict';
import {env,post} from './helpers.mjs';
import {markdown,articleContent,publishable,exportMarkdown,validateChanges} from '../lib/content.js';
import {postPage,exportHtml} from '../lib/render.js';
import {sign,verify,authorization,canReview,reviewToken,checkOrigin,encrypt,decrypt} from '../lib/auth.js';
import {scheduleSlot,sourcesFrom,generate} from '../lib/generate.js';
env();
test('Markdown escapes scripts and unsafe links, preserves useful formatting',()=>{
  const html=markdown('# Heading\n\n<script>alert(1)</script>\n\n[unsafe](javascript:alert(1))\n\n[safe](https://example.com/?q="onmouseover=x)\n\n- **Item**\n\n```js\n<img onerror=bad>\n```');
  assert.doesNotMatch(html,/<script|<img|href="javascript:| onmouseover=/);
  assert.match(html,/&lt;script&gt;/);assert.match(html,/<h2>Heading<\/h2>/);assert.match(html,/<ul><li><strong>Item/);assert.match(html,/<pre><code>&lt;img/);
});
test('Article and exports contain the cover and two inline images',()=>{
  const p=post(); assert.equal((articleContent(p).match(/<figure/g)||[]).length,3);
  assert.equal((exportHtml(p).match(/<figure/g)||[]).length,3);
  assert.equal((exportMarkdown(p).match(/!\[/g)||[]).length,3);
  const html=postPage({...p,status:'published',published_at:p.created_at});
  assert.equal((html.match(/<h1[ >]/g)||[]).length,1);assert.match(html,/"@type":"BlogPosting"/);assert.match(html,/rel="canonical" href="https:\/\/www.motunrayoakinsete.com\/blog\/a-useful-ai-question\//);
  assert.doesNotMatch(html,/Private fact-check note/);assert.match(postPage(p,true),/noindex,nofollow/);
});
test('Structured data safely encodes an adversarial title',()=>{
  const html=postPage(post({title:'</script><script>alert(1)</script>'}));
  assert.doesNotMatch(html,/<script>alert/);assert.match(html,/\\u003c\/script>/);
});
test('Publishing refuses missing images, evidence, text and unsafe covers',()=>{
  assert.doesNotThrow(()=>publishable(post()));
  for(const patch of [{images:[]},{images:[post().images[0]]},{sources:[]},{body:'too short'},{images:[{url:'javascript:alert(1)'}]}]) assert.throws(()=>publishable(post(patch)),{status:400});
  assert.throws(()=>validateChanges({sources:[{title:'bad',url:'http://example.com'}]}),{status:400});
  assert.throws(()=>validateChanges({slug:'UPPER case'}),{status:400});
});
test('Review tokens expire, resist tampering and grant access to one draft only',()=>{
  const p=post(),token=reviewToken(p);assert.equal(token,reviewToken(p));
  assert.equal(verify(token).id,p.id);assert.equal(verify(token+'x'),null);assert.equal(verify(sign({kind:'review'},-1)),null);
  const auth=authorization({headers:{authorization:'Bearer '+token}});assert.equal(auth.admin,false);
  assert.doesNotThrow(()=>canReview(auth,p));assert.throws(()=>canReview(auth,post({id:'different'})),{status:403});assert.throws(()=>canReview(auth,post({review_nonce:'revoked'})),{status:403});
  assert.throws(()=>authorization({headers:{cookie:'mo_editor='+token}}),{status:401});
});
test('Owner cookies and same-origin protections enforce ownership',()=>{
  const auth=authorization({headers:{cookie:'mo_editor='+sign({kind:'session'},60)}});assert.equal(auth.admin,true);
  assert.doesNotThrow(()=>checkOrigin({headers:{origin:process.env.SITE_URL}}));assert.throws(()=>checkOrigin({headers:{origin:'https://untrusted.example'}}),{status:403});assert.throws(()=>checkOrigin({headers:{}}),{status:403});
  const encrypted=encrypt('test-provider-token');assert.notEqual(encrypted,'test-provider-token');assert.equal(decrypt(encrypted),'test-provider-token');
  const bytes=Buffer.from(encrypted,'base64');bytes[15]^=1;assert.throws(()=>decrypt(bytes.toString('base64')));
});
test('Three weekly slots use Lagos dates and are stable for retries',()=>{
  for (const date of ['2026-10-05T08:00:00Z','2026-10-07T08:00:00Z','2026-10-09T08:00:00Z']) assert.match(scheduleSlot(new Date(date)).slot,/scheduled-2026-10/);
  assert.equal(scheduleSlot(new Date('2026-10-06T08:00:00Z')),null);
  assert.equal(scheduleSlot(new Date('2026-10-04T23:30:00Z')).slot,'scheduled-2026-10-05');
  assert.deepEqual(scheduleSlot(new Date('2026-10-05T08:00:00Z')),scheduleSlot(new Date('2026-10-05T09:00:00Z')));
});
test('Only actual retrieved HTTPS sources enter the research record',()=>{
  assert.equal(sourcesFrom({output:[{content:[{annotations:[{type:'url_citation',url:'https://nist.gov/paper'},{type:'url_citation',url:'http://bad'}]}],action:{sources:[{url:'https://nist.gov/paper'},{url:'https://arxiv.org/paper'}]}}]}).length,2);
});
test('Personal writing requires the owner’s notes before any paid request',async()=>{
  const previous=global.fetch;global.fetch=()=>{throw new Error('No request should occur');};
  try{await assert.rejects(generate({category:'Personal',context:'Invent a story'}),{status:400});}finally{global.fetch=previous;}
});
