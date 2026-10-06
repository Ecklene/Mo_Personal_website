import { readFileSync } from 'node:fs';
import { publicPosts } from '../lib/db.js';
import { databaseReady, siteUrl } from '../lib/config.js';
import { escape, articleContent } from '../lib/content.js';
import { query } from '../lib/http.js';
export default async function handler(req, res) {
  if (!['GET','HEAD'].includes(req.method)) { res.statusCode = 405; return res.end(); }
  try {
    const type = query(req).get('type'), base = siteUrl();
    const posts = databaseReady() ? await publicPosts({ limit: 1000 }) : [];
    let content;
    if (type === 'sitemap') {
      const original = readFileSync(new URL('../sitemap.xml', import.meta.url), 'utf8');
      content = original.replace('</urlset>', posts.map(p => `<url><loc>${escape(base + '/blog/' + p.slug + '/')}</loc><lastmod>${new Date(p.updated_at).toISOString()}</lastmod></url>`).join('') + '</urlset>');
    } else {
      content = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:atom="http://www.w3.org/2005/Atom"><channel><title>Mo’s Blog | Motunrayo Akinsete</title><link>${base}/blog/</link><description>AI, cloud computing, cybersecurity, technology and personal essays.</description><language>en</language><atom:link href="${base}/rss.xml" rel="self" type="application/rss+xml"/>${posts.slice(0, 50).map(p => `<item><title>${escape(p.title)}</title><link>${base}/blog/${p.slug}/</link><guid isPermaLink="true">${base}/blog/${p.slug}/</guid><pubDate>${new Date(p.published_at).toUTCString()}</pubDate><description>${escape(p.description)}</description><category>${escape(p.category)}</category><content:encoded>${escape(`<h1>${escape(p.title)}</h1>` + articleContent(p))}</content:encoded></item>`).join('')}</channel></rss>`;
    }
    res.setHeader('Content-Type', 'application/xml; charset=utf-8'); res.setHeader('Cache-Control', 'no-store'); return res.end(req.method === 'HEAD' ? '' : content);
  } catch (error) { console.error(error.message); res.statusCode = 503; return res.end('Feed temporarily unavailable'); }
}
