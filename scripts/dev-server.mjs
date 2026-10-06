import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
try { process.loadEnvFile(path.join(root,'.env.local')); } catch {}
process.env.SITE_URL ||= 'http://127.0.0.1:3001';
const port = Number(process.env.PORT || 3001);
const handlers = {};
for (const name of ['editor','automation','public-blog','feed','linkedin','pinterest']) handlers[name] = (await import(`../api/${name}.js`)).default;
const types = { '.html':'text/html; charset=utf-8','.css':'text/css','.js':'application/javascript','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.xml':'application/xml','.txt':'text/plain' };
const server = http.createServer(async (req,res) => {
  try {
    const url = new URL(req.url,process.env.SITE_URL), pathname = decodeURIComponent(url.pathname);
    if (pathname.startsWith('/api/')) { const name = pathname.slice(5).replace(/\/$/,''); if (!handlers[name]) { res.statusCode=404;return res.end('Not found'); } return await handlers[name](req,res); }
    if (pathname === '/blog/' || /^\/blog\/[a-z0-9-]+\/$/.test(pathname)) { req.query = Object.fromEntries(url.searchParams); if (pathname !== '/blog/') req.query.slug = pathname.split('/')[2]; return await handlers['public-blog'](req,res); }
    if (pathname === '/sitemap.xml' || pathname === '/rss.xml') { req.query = {type:pathname==='/sitemap.xml'?'sitemap':'rss'};return await handlers.feed(req,res); }
    if (pathname === '/blog') {res.statusCode=308;res.setHeader('Location','/blog/');return res.end();}
    const allowed = pathname === '/' || pathname === '/robots.txt' || pathname.startsWith('/assets/') || /^\/(about|services|portfolio|research|ai-speaker-nigeria|book|ai-consulting-nigeria|corporate-ai-training-nigeria|ai-training-nigeria|building-products|studio)\/$/.test(pathname);
    if (!allowed) {res.statusCode=404;return res.end('Not found');}
    const filename = path.resolve(root,'.'+pathname+(pathname.endsWith('/')?'index.html':''));
    if (!filename.startsWith(root+path.sep)) {res.statusCode=403;return res.end('Forbidden');}
    const bytes=await fs.readFile(filename);res.setHeader('Content-Type',types[path.extname(filename)]||'application/octet-stream');res.end(bytes);
  } catch(error){ console.error(error.message);res.statusCode=500;res.end('Local preview error'); }
});
server.listen(port,'127.0.0.1',()=>console.log(`Preview ready at http://127.0.0.1:${port}`));
