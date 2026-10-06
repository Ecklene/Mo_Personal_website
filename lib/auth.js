import { createHmac, timingSafeEqual, createHash, randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';
import { required, siteUrl } from './config.js';
export function equal(a, b) { const x = Buffer.from(a || ''), y = Buffer.from(b || ''); return x.length === y.length && timingSafeEqual(x, y); }
export function sign(payload, seconds, expiresAt) {
  const secret = required('AUTH_SECRET');
  if (secret.length < 32) throw Object.assign(new Error('AUTH_SECRET must have at least 32 characters'), { status: 503 });
  const body = Buffer.from(JSON.stringify({ ...payload, exp: expiresAt || Math.floor(Date.now() / 1000) + seconds })).toString('base64url');
  return `${body}.${createHmac('sha256', secret).update(body).digest('base64url')}`;
}
export function verify(token) {
  if (typeof token !== 'string' || token.length > 2048) return null;
  const [body, signature, extra] = token.split('.');
  if (!body || !signature || extra) return null;
  const expected = createHmac('sha256', required('AUTH_SECRET')).update(body).digest('base64url');
  if (!equal(signature, expected)) return null;
  try { const data = JSON.parse(Buffer.from(body, 'base64url')); return data.exp > Date.now() / 1000 ? data : null; } catch { return null; }
}
export function cookies(req) { return Object.fromEntries((req.headers.cookie || '').split(';').map(v => v.trim().split('='))); }
export function session(req) { const value = verify(cookies(req).mo_editor); return value?.kind === 'session' ? value : null; }
export function authorization(req) {
  const admin = session(req);
  if (admin) return { admin: true };
  const token = (req.headers.authorization || '').replace(/^Bearer /, '');
  const review = verify(token);
  if (review?.kind === 'review') return { admin: false, review };
  throw Object.assign(new Error('Sign in or open a valid email review link.'), { status: 401 });
}
export function requireAdmin(req) { const auth = authorization(req); if (!auth.admin) throw Object.assign(new Error('Owner sign-in is required.'), { status: 403 }); return auth; }
export function checkOrigin(req) {
  if (req.headers.origin !== new URL(siteUrl()).origin) throw Object.assign(new Error('Invalid request origin'), { status: 403 });
}
export function sessionCookie(token = '') {
  const secure = new URL(siteUrl()).protocol === 'https:';
  return `mo_editor=${token}; HttpOnly; ${secure ? 'Secure; ' : ''}SameSite=Strict; Path=/; Max-Age=${token ? 28800 : 0}`;
}
export function loginKey(req) { return createHmac('sha256', required('AUTH_SECRET')).update((req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim()).digest('hex'); }
export function reviewToken(post) { return sign({ kind: 'review', id: post.id, nonce: post.review_nonce }, 14 * 86400, Math.floor(new Date(post.review_issued_at || post.created_at).getTime() / 1000) + 14 * 86400); }
export function canReview(auth, post) {
  if (auth.admin) return;
  if (!post || auth.review.id !== post.id || auth.review.nonce !== post.review_nonce) throw Object.assign(new Error('Invalid review link'), { status: 403 });
}
function encryptionKey() { return createHash('sha256').update(required('AUTH_SECRET')).digest(); }
export function encrypt(text) { const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv); const bytes = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]); return Buffer.concat([iv, cipher.getAuthTag(), bytes]).toString('base64'); }
export function decrypt(text) { const bytes = Buffer.from(text, 'base64'), cipher = createDecipheriv('aes-256-gcm', encryptionKey(), bytes.subarray(0, 12)); cipher.setAuthTag(bytes.subarray(12, 28)); return Buffer.concat([cipher.update(bytes.subarray(28)), cipher.final()]).toString('utf8'); }
