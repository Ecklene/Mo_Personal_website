import { required } from './config.js';
import {neonDb} from './neon.js';
export async function db(path, options = {}) {
  if(process.env.DATABASE_URL)return neonDb(path,options);
  const key = required('SUPABASE_SECRET_KEY');
  const url = required('SUPABASE_URL').replace(/\/$/, '');
  const headers = { apikey: key, 'Content-Type': 'application/json', Prefer: 'return=representation', ...options.headers };
  if (key.startsWith('eyJ')) headers.Authorization = `Bearer ${key}`;
  const response = await fetch(`${url}/rest/v1/${path}`, { ...options, headers, signal: AbortSignal.timeout(15000) });
  if (!response.ok) {
    const details = await response.text();
    console.error('Database request failed', response.status, details.slice(0, 300));
    throw Object.assign(new Error('Database request failed'), { status: response.status === 409 ? 409 : 503, publicMessage: response.status === 409 ? 'This URL is already in use. Choose another slug.' : 'Storage is temporarily unavailable.' });
  }
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}
export async function getPost(id) { return (await db(`blog_posts?id=eq.${encodeURIComponent(id)}&limit=1`))[0]; }
export async function savePost(id, changes, version) {
  if(version!==undefined&&(typeof version!=='string'||!/^\d{4}-\d{2}-\d{2}T/.test(version)||!Number.isFinite(Date.parse(version))))throw Object.assign(new Error('Reload the draft before saving.'),{status:409});
  const rows = await db(`blog_posts?id=eq.${encodeURIComponent(id)}${version ? `&updated_at=eq.${encodeURIComponent(version)}` : ''}`, { method: 'PATCH', body: JSON.stringify({ ...changes, updated_at: new Date().toISOString() }) });
  if (!rows.length) throw Object.assign(new Error('This draft changed in another window. Reload before saving.'), { status: 409 });
  return rows[0];
}
export async function publicPosts({ slug, category, offset = 0, limit = 12 } = {}) {
  const query = `blog_posts?status=eq.published&order=published_at.desc&limit=${Math.min(limit, 1000)}&offset=${offset}` + (slug ? `&slug=eq.${encodeURIComponent(slug)}` : '') + (category ? `&category=eq.${encodeURIComponent(category)}` : '');
  return db(query);
}
export async function uploadImage(postId, bytes, extension = 'png') {
  if(process.env.BLOB_READ_WRITE_TOKEN){
    const {put}=await import('@vercel/blob');
    const result=await put(`blog-images/${postId}/${crypto.randomUUID()}.${extension}`,bytes,{access:'public',addRandomSuffix:true,contentType:{png:'image/png',jpg:'image/jpeg',webp:'image/webp'}[extension],token:required('BLOB_READ_WRITE_TOKEN'),abortSignal:AbortSignal.timeout(20000)});
    return result.url;
  }
  const key = required('SUPABASE_SECRET_KEY');
  const base = required('SUPABASE_URL').replace(/\/$/, '');
  const path = `${postId}/${crypto.randomUUID()}.${extension}`;
  const headers = { apikey: key, 'Content-Type': { png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp' }[extension], 'x-upsert': 'false' };
  if (key.startsWith('eyJ')) headers.Authorization = `Bearer ${key}`;
  const result = await fetch(`${base}/storage/v1/object/blog-images/${path}`, { method: 'POST', headers, body: bytes, signal: AbortSignal.timeout(20000) });
  if (!result.ok) throw Object.assign(new Error('Image upload failed'), { status: 503 });
  return `${base}/storage/v1/object/public/blog-images/${path}`;
}
