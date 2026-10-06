import { randomUUID } from 'node:crypto';
import { requireAdmin, cookies, sign, verify, equal, encrypt } from '../lib/auth.js';
import { required, siteUrl } from '../lib/config.js';
import { db } from '../lib/db.js';
import { query, failure } from '../lib/http.js';
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store'); res.setHeader('X-Robots-Tag','noindex,nofollow');
  try {
    if (req.method !== 'GET') throw Object.assign(new Error('Method not allowed'), { status: 405 });
    const params = query(req), redirectUri = `${siteUrl()}/api/linkedin`, secure = new URL(siteUrl()).protocol === 'https:' ? 'Secure; ' : '';
    if (params.get('action') === 'connect') {
      requireAdmin(req);
      const state = sign({ kind: 'linkedin-oauth', nonce: randomUUID() }, 600);
      res.setHeader('Set-Cookie', `mo_linkedin_state=${state}; HttpOnly; ${secure}SameSite=Lax; Path=/api/linkedin; Max-Age=600`);
      const url = new URL('https://www.linkedin.com/oauth/v2/authorization');
      for (const [name,value] of Object.entries({ response_type: 'code', client_id: required('LINKEDIN_CLIENT_ID'), redirect_uri: redirectUri, state, scope: 'openid profile w_member_social' })) url.searchParams.set(name,value);
      res.statusCode = 302; res.setHeader('Location',url.href); return res.end();
    }
    const state = params.get('state'), claims = verify(state);
    if (claims?.kind !== 'linkedin-oauth' || !equal(cookies(req).mo_linkedin_state,state)) throw Object.assign(new Error('Invalid or expired LinkedIn sign-in. Start again in the studio.'), { status: 403 });
    res.setHeader('Set-Cookie', `mo_linkedin_state=; HttpOnly; ${secure}SameSite=Lax; Path=/api/linkedin; Max-Age=0`);
    if (!params.get('code') || params.get('error')) throw Object.assign(new Error('LinkedIn connection was not authorised.'), { status: 400 });
    const response = await fetch('https://www.linkedin.com/oauth/v2/accessToken', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'authorization_code', code: params.get('code'), redirect_uri: redirectUri, client_id: required('LINKEDIN_CLIENT_ID'), client_secret: required('LINKEDIN_CLIENT_SECRET') }), signal: AbortSignal.timeout(20000) });
    if (!response.ok) throw new Error('LinkedIn token exchange failed');
    const token = await response.json();
    const profileResponse = await fetch('https://api.linkedin.com/v2/userinfo', { headers: { Authorization: `Bearer ${token.access_token}` }, signal: AbortSignal.timeout(15000) });
    if (!profileResponse.ok) throw new Error('LinkedIn profile lookup failed');
    const profile = await profileResponse.json(); if (!profile.sub) throw new Error('Missing LinkedIn member ID');
    await db('blog_integrations?on_conflict=name', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify({ name: 'linkedin', member_id: profile.sub, encrypted_token: encrypt(token.access_token), expires_at: new Date(Date.now() + Number(token.expires_in) * 1000).toISOString() }) });
    res.statusCode = 302; res.setHeader('Location', `${siteUrl()}/studio/#linkedin=connected`); return res.end();
  } catch (error) { return failure(res,error); }
}
