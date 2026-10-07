import { randomUUID } from 'node:crypto';
import { requireAdmin, cookies, sign, verify, equal, encrypt } from '../lib/auth.js';
import { required, siteUrl } from '../lib/config.js';
import { db } from '../lib/db.js';
import { query, failure } from '../lib/http.js';
export default async function handler(req,res) {
  res.setHeader('Cache-Control','no-store'); res.setHeader('X-Robots-Tag','noindex,nofollow');
  try {
    if (req.method !== 'GET') throw Object.assign(new Error('Method not allowed'), { status: 405 });
    const params = query(req), redirectUri = `${siteUrl()}/api/pinterest/`, secure = new URL(siteUrl()).protocol === 'https:' ? 'Secure; ' : '';
    if (params.get('action') === 'connect') {
      requireAdmin(req); const state = sign({ kind: 'pinterest-oauth', nonce: randomUUID() },600);
      res.setHeader('Set-Cookie',`mo_pinterest_state=${state}; HttpOnly; ${secure}SameSite=Lax; Path=/api/pinterest; Max-Age=600`);
      const url = new URL('https://www.pinterest.com/oauth/');
      for (const [key,value] of Object.entries({ response_type:'code',client_id:required('PINTEREST_CLIENT_ID'),redirect_uri:redirectUri,state,scope:'boards:read,pins:write' })) url.searchParams.set(key,value);
      res.statusCode=302; res.setHeader('Location',url.href); return res.end();
    }
    const state=params.get('state'); if (verify(state)?.kind !== 'pinterest-oauth' || !equal(cookies(req).mo_pinterest_state,state)) throw Object.assign(new Error('Invalid or expired Pinterest sign-in. Start again in the studio.'), { status:403 });
    res.setHeader('Set-Cookie',`mo_pinterest_state=; HttpOnly; ${secure}SameSite=Lax; Path=/api/pinterest; Max-Age=0`);
    if (!params.get('code') || params.get('error')) throw Object.assign(new Error('Pinterest connection was not authorised.'), { status:400 });
    const response=await fetch('https://api.pinterest.com/v5/oauth/token',{method:'POST',headers:{Authorization:'Basic '+Buffer.from(`${required('PINTEREST_CLIENT_ID')}:${required('PINTEREST_CLIENT_SECRET')}`).toString('base64'),'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'authorization_code',code:params.get('code'),redirect_uri:redirectUri}),signal:AbortSignal.timeout(20000)});
    if (!response.ok) throw new Error('Pinterest token exchange failed');
    const token=await response.json();
    await db('blog_integrations?on_conflict=name',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify({name:'pinterest',member_id:'owner',encrypted_token:encrypt(token.access_token),expires_at:new Date(Date.now()+Number(token.expires_in)*1000).toISOString()})});
    res.statusCode=302;res.setHeader('Location',`${siteUrl()}/studio/#pinterest=connected`);return res.end();
  }catch(error){return failure(res,error);}
}
