import { randomUUID } from 'node:crypto';
import { authorization, requireAdmin, canReview, checkOrigin, equal, sign, sessionCookie, loginKey } from '../lib/auth.js';
import { required, configuration, CATEGORIES } from '../lib/config.js';
import { db, getPost, savePost, uploadImage } from '../lib/db.js';
import { validateChanges, publishable, exportMarkdown } from '../lib/content.js';
import { postPage, exportHtml } from '../lib/render.js';
import { generate } from '../lib/generate.js';
import { sendDraft } from '../lib/email.js';
import { shareLinkedIn } from '../lib/linkedin.js';
import { pinterestBoards, selectPinterestBoard, publishPin } from '../lib/pinterest.js';
import { json, failure, body, method, query } from '../lib/http.js';

function validId(id) { if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id)) throw Object.assign(new Error('Invalid draft ID'), { status: 400 }); return id; }
function editable(post, auth) { canReview(auth, post); if (post.status === 'published') throw Object.assign(new Error('This post is already published. Unpublish it before editing.'), { status: 409 }); }
export default async function handler(req, res) {
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  try {
    const params = query(req), data = req.method === 'POST' ? await body(req) : {}, action = data.action || params.get('action') || 'session';
    if (req.method === 'POST') checkOrigin(req);
    if (action === 'login') {
      method(req, 'POST');
      const password = required('ADMIN_PASSWORD'); if (password.length < 16) throw Object.assign(new Error('Use an owner password of at least 16 characters.'), { status: 503 });
      const attempts = await db('rpc/blog_login_attempt', { method: 'POST', body: JSON.stringify({ p_key: loginKey(req) }) });
      if (attempts > 5) throw Object.assign(new Error('Too many attempts. Try again in 15 minutes.'), { status: 429 });
      if (!equal(String(data.password || ''), password)) throw Object.assign(new Error('Incorrect password'), { status: 401 });
      res.setHeader('Set-Cookie', sessionCookie(sign({ kind: 'session' }, 28800)));
      return json(res, 200, { signedIn: true });
    }
    if (action === 'logout') { method(req, 'POST'); res.setHeader('Set-Cookie', sessionCookie()); return json(res, 200, { signedIn: false }); }
    const auth = authorization(req);
    if (action === 'session') {
      method(req, 'GET');
      const integrations = auth.admin ? await db('blog_integrations?select=name,expires_at') : [];
      return json(res, 200, { admin: auth.admin, reviewId: auth.review?.id, configuration: auth.admin ? configuration() : undefined, linkedinConnected: integrations.some(i => i.name === 'linkedin' && new Date(i.expires_at) > new Date()), pinterestConnected: integrations.some(i => i.name === 'pinterest' && new Date(i.expires_at) > new Date()), automationEnabled: auth.admin ? process.env.BLOG_AUTOMATION_ENABLED === 'true' : undefined });
    }
    if (action === 'list') { method(req, 'GET'); requireAdmin(req); return json(res, 200, { posts: await db('blog_posts?select=id,title,category,status,created_at,updated_at,email_sent_at&order=created_at.desc&limit=100') }); }
    if (action === 'create') {
      method(req, 'POST'); requireAdmin(req); const id = randomUUID();
      const post = (await db('blog_posts', { method: 'POST', body: JSON.stringify({ id, slug: `draft-${id}`, review_nonce: randomUUID(), category: CATEGORIES.includes(data.category) ? data.category : 'Personal' }) }))[0];
      return json(res, 201, { post });
    }
    if (action === 'generate') {
      method(req, 'POST'); requireAdmin(req);
      let options = { category: data.category, context: typeof data.context === 'string' ? data.context : '' };
      if (data.retryId) {
        const post = await getPost(validId(data.retryId)); if (!post || post.status === 'published') throw Object.assign(new Error('No unfinished draft to retry.'), { status: 400 });
        const job = (await db(`blog_jobs?post_id=eq.${post.id}&limit=1`))[0];
        if (!job) throw Object.assign(new Error('This is a manually written draft.'), { status: 400 });
        options = { category: post.category, context: post.category === 'Personal' ? post.body : '', slot: job.slot };
      }
      return json(res, 200, await generate(options));
    }
    if (action === 'boards') { method(req,'GET'); requireAdmin(req); return json(res,200,await pinterestBoards()); }
    if (action === 'board') { method(req,'POST'); requireAdmin(req); await selectPinterestBoard(String(data.boardId)); return json(res,200,{saved:true}); }
    const id = validId(data.id || params.get('id')), post = await getPost(id);
    if (!post) throw Object.assign(new Error('Draft not found'), { status: 404 });
    canReview(auth, post);
    if (action === 'get') { method(req, 'GET'); return json(res, 200, { post }); }
    if (action === 'export') {
      method(req, 'GET'); res.setHeader('Cache-Control', 'no-store');
      const format = params.get('format');
      if (format === 'preview') { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.setHeader('Content-Security-Policy', "script-src 'none'; form-action 'none'; base-uri 'none'"); return res.end(postPage(post, true)); }
      res.setHeader('Content-Disposition', `attachment; filename="${post.slug}.${format === 'markdown' ? 'md' : 'html'}"`);
      res.setHeader('Content-Type', format === 'markdown' ? 'text/markdown; charset=utf-8' : 'text/html; charset=utf-8');
      return res.end(format === 'markdown' ? exportMarkdown(post) : exportHtml(post));
    }
    method(req, 'POST');
    if (action === 'email') { requireAdmin(req); if (post.status === 'published') throw Object.assign(new Error('Choose an unpublished draft.'), { status: 400 }); return json(res, 200, { post: await sendDraft(post) }); }
    if (action === 'linkedin') return json(res, 200, { post: await shareLinkedIn(post) });
    if (action === 'pinterest') return json(res,200,{post:await publishPin(post)});
    if (action === 'unpublish') { requireAdmin(req); if (!data.version) throw Object.assign(new Error('Reload the post before unpublishing.'), { status: 409 }); return json(res, 200, { post: await savePost(id, { status: 'draft', review_nonce: randomUUID(), review_issued_at: new Date().toISOString(), email_sent_at: null }, data.version) }); }
    editable(post, auth);
    if (!data.version) throw Object.assign(new Error('Reload the draft before saving.'), { status: 409 });
    if (action === 'save') return json(res, 200, { post: await savePost(id, validateChanges(data.changes || {}), data.version) });
    if (action === 'approve') { publishable(post); return json(res, 200, { post: await savePost(id, { status: 'published', published_at: post.published_at || new Date().toISOString(), rejection_note: '' }, data.version) }); }
    if (action === 'reject') return json(res, 200, { post: await savePost(id, { status: 'rejected', rejection_note: String(data.note || '').slice(0, 5000) }, data.version) });
    if (action === 'upload') {
      const bytes = Buffer.from(typeof data.base64 === 'string' ? data.base64 : '', 'base64');
      if (!bytes.length || bytes.length > 2_000_000) throw Object.assign(new Error('Choose a PNG, JPEG or WebP under 2 MB.'), { status: 400 });
      const png = bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
      const jpg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
      const webp = bytes.subarray(0,4).toString() === 'RIFF' && bytes.subarray(8,12).toString() === 'WEBP';
      if (!png && !jpg && !webp) throw Object.assign(new Error('Unsupported image file'), { status: 400 });
      const index = Number(data.index); if (![0,1,2].includes(index)) throw Object.assign(new Error('Choose cover, image one or image two.'), { status: 400 });
      if (index > post.images.length) throw Object.assign(new Error('Upload the preceding image first.'), { status: 400 });
      const url = await uploadImage(id, bytes, png ? 'png' : jpg ? 'jpg' : 'webp');
      const images = [...post.images]; images[index] = { url, alt: String(data.alt || post.title).slice(0,300), caption: String(data.caption || '').slice(0,400), generated: false };
      return json(res, 200, { post: await savePost(id, { images }, data.version) });
    }
    throw Object.assign(new Error('Unknown action'), { status: 400 });
  } catch (error) { return failure(res, error); }
}
