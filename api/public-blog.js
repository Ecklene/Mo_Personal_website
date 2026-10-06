import { publicPosts } from '../lib/db.js';
import { databaseReady, CATEGORIES } from '../lib/config.js';
import { blogPage, postPage, layout } from '../lib/render.js';
import { query } from '../lib/http.js';
import { json } from '../lib/http.js';
export default async function handler(req, res) {
  if (!['GET', 'HEAD'].includes(req.method)) { res.statusCode = 405; return res.end(); }
  const params = query(req), slug = params.get('slug')?.replace(/\/$/, '');
  if (slug && !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) { res.statusCode = 404; return res.end('Not found'); }
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  try {
    const category = CATEGORIES.includes(params.get('category')) ? params.get('category') : '';
    const page = Math.max(1, Math.min(1000, Number.parseInt(params.get('page') || '1', 10) || 1));
    const posts = databaseReady() ? await publicPosts({ slug, category: slug ? '' : category, offset: slug ? 0 : (page - 1) * 12, limit: slug ? 1 : 13 }) : [];
    if (params.get('format') === 'json') return json(res,200,{posts:posts.slice(0,3).map(p=>({slug:p.slug,title:p.title,description:p.description,category:p.category,image:p.images[0]?.url,alt:p.images[0]?.alt}))});
    let html;
    if (slug && !posts[0]) { res.statusCode = 404; html = layout({ title: 'Article not found | Motunrayo Akinsete', description: 'This article is unavailable.', path: '/blog/', noindex: true, content: '<section class="section cloud"><h1>Article not found</h1><a href="/blog/">Explore the blog →</a></section>' }); }
    else html = slug ? postPage(posts[0]) : blogPage(posts.slice(0, 12), { category, page, more: posts.length > 12 });
    res.setHeader('Cache-Control', 'no-store');
    return res.end(req.method === 'HEAD' ? '' : html);
  } catch (error) { console.error(error.message); res.statusCode = 503; res.setHeader('Cache-Control', 'no-store'); return res.end(layout({ title: 'Blog temporarily unavailable | Motunrayo Akinsete', description: 'Please try again shortly.', path: '/blog/', noindex: true, content: '<section class="section cloud"><h1>Please check back shortly.</h1><p>The blog is temporarily unavailable.</p></section>' })); }
}
