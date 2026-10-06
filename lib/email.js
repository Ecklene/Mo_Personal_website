import { required, siteUrl } from './config.js';
import { reviewToken } from './auth.js';
import { escape, articleContent, exportMarkdown, safeUrl } from './content.js';
import { exportHtml } from './render.js';
import { savePost } from './db.js';
import { randomUUID } from 'node:crypto';
export async function sendDraft(post) {
  if (post.email_sent_at) return post;
  if (Date.now() - new Date(post.review_issued_at || post.created_at).getTime() > 13 * 86400000) post = await savePost(post.id, { review_nonce: randomUUID(), review_issued_at: new Date().toISOString() });
  const token = reviewToken(post), review = `${siteUrl()}/studio/#review=${encodeURIComponent(token)}`;
  const attachments = [
    { filename: `${post.slug}.html`, content: Buffer.from(exportHtml(post)).toString('base64') },
    { filename: `${post.slug}.md`, content: Buffer.from(exportMarkdown(post)).toString('base64') }
  ];
  // Only fetch attachments from our own storage, never an arbitrary supplied URL.
  const cover = safeUrl(post.images?.[0]?.url), storage = required('SUPABASE_URL').replace(/\/$/, '');
  if (cover.startsWith(storage + '/storage/v1/object/public/blog-images/')) {
    const image = await fetch(cover, { signal: AbortSignal.timeout(15000) });
    const length = Number(image.headers.get('content-length'));
    if (image.ok && length > 0 && length < 2_000_000) attachments.push({ filename: `${post.slug}-cover.${cover.split('.').pop()}`, content: Buffer.from(await image.arrayBuffer()).toString('base64') });
  }
  const html = `<html><head><style>body{font-family:Arial,sans-serif;color:#0D1F3C;line-height:1.8;margin:0;padding:24px}main{max-width:680px;margin:auto}img{max-width:100%;height:auto;border-radius:10px}figure{margin:28px 0}figcaption{font-size:12px;color:#6B7A8D}h1,h2{line-height:1.25}a{color:#2D7DD2}blockquote{border-left:3px solid #D8B66A;padding-left:20px}pre{white-space:pre-wrap}.review{display:inline-block;background:#D8B66A;color:#07131F;padding:14px 24px;border-radius:30px;text-decoration:none}</style></head><body><main><p>Mo Editorial · Private draft for your review</p><h1>${escape(post.title)}</h1><p>${escape(post.description)}</p><p><a class="review" href="${escape(review)}">Review, edit, approve or reject →</a></p><p>This email does not publish the draft. Open the review page and choose Approve &amp; publish. Images are illustrations, and factual claims still need your editorial review.</p>${post.editorial_note ? `<p><strong>Editorial note:</strong> ${escape(post.editorial_note)}</p>` : ''}${articleContent(post)}<hr><p>The full HTML and Markdown versions are attached, along with the cover image when available. All three images also appear in the article. The review link expires 14 days after draft creation; you can always sign in to the studio.</p></main></body></html>`;
  const response = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${required('RESEND_API_KEY')}`, 'Content-Type': 'application/json', 'Idempotency-Key': `draft-${post.id}-${post.updated_at}` }, body: JSON.stringify({ from: required('EMAIL_FROM'), to: [required('REVIEW_EMAIL')], subject: `[Draft for review] ${post.title}`, html, text: `Review this draft: ${review}\n\n${exportMarkdown(post)}`, attachments }), signal: AbortSignal.timeout(25000) });
  if (!response.ok) { console.error('Email provider rejected request', response.status); throw Object.assign(new Error('The draft is saved, but email delivery failed. Check your verified sender and retry from the studio.'), { status: 502 }); }
  return savePost(post.id, { email_sent_at: new Date().toISOString() });
}
