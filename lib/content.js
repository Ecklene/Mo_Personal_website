import { CATEGORIES } from './config.js';
export const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export function safeUrl(value) { try { const url = new URL(value); return url.protocol === 'https:' ? url.href : ''; } catch { return ''; } }
export function slugify(value) { return String(value).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 100).replace(/-$/, ''); }
export function words(value) { return String(value || '').replace(/\[\[image:\d+\]\]/g, '').split(/\s+/).filter(Boolean).length; }
export function validateChanges(value) {
  const result = {};
  for (const [name, limit] of Object.entries({ title: 180, description: 300, social_excerpt:2000, body: 60000, editorial_note: 5000, rejection_note: 5000 })) {
    if (value[name] !== undefined) {
      if (typeof value[name] !== 'string' || value[name].length > limit) throw Object.assign(new Error(`Invalid ${name}`), { status: 400 });
      result[name] = value[name].trim();
    }
  }
  if (value.slug !== undefined) { if (typeof value.slug !== 'string' || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(value.slug) || value.slug.length > 100) throw Object.assign(new Error('Use a short URL slug with lowercase letters, numbers and hyphens.'), { status: 400 }); result.slug = value.slug; }
  if (value.category !== undefined) { if (!CATEGORIES.includes(value.category)) throw Object.assign(new Error('Invalid category'), { status: 400 }); result.category = value.category; }
  if (value.sources !== undefined) {
    if (!Array.isArray(value.sources) || value.sources.length > 20) throw Object.assign(new Error('Invalid sources'), { status: 400 });
    result.sources = value.sources.map(s => { const url = safeUrl(s.url); if (!url || typeof s.title !== 'string') throw Object.assign(new Error('Sources need a title and HTTPS URL.'), { status: 400 }); return { title: s.title.slice(0, 200), url }; });
  }
  return result;
}
export function publishable(post) {
  if (!post.title || !post.description || words(post.body) < 100) throw Object.assign(new Error('Add a title, search description and at least 100 words before publishing.'), { status: 400 });
  if (!safeUrl(post.images?.[0]?.url)) throw Object.assign(new Error('Add a cover image before publishing.'), { status: 400 });
  if (post.ai_generated && (post.images.length < 3 || post.images.some(image => !safeUrl(image.url)))) throw Object.assign(new Error('Finish generating the cover and both article images before publishing.'), { status: 400 });
  if (post.ai_generated && post.category !== 'Personal' && post.sources.length < 2) throw Object.assign(new Error('A researched draft needs at least two sources.'), { status: 400 });
}
function inline(text) {
  // Escape HTML first. Only deliberately supported Markdown can become markup.
  return escape(text).replace(/\[([^\]\n]+)\]\((https:\/\/[^\s)]+)\)/g, (_, label, href) => {
    const decoded = href.replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"');
    const url = safeUrl(decoded); return url ? `<a href="${escape(url)}" rel="noopener noreferrer">${label}</a>` : label;
  }).replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>').replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, '<em>$1</em>').replace(/`([^`\n]+)`/g, '<code>$1</code>');
}
export function figure(image, eager = false) {
  const url = safeUrl(image?.url);
  if (!url) return '';
  return `<figure class="article-figure"><img src="${escape(url)}" alt="${escape(image.alt)}" width="1536" height="1024" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'}><figcaption>${escape(image.caption || '')}${image.generated ? ' · AI-generated illustration' : ''}</figcaption></figure>`;
}
export function markdown(text, images = []) {
  const lines = String(text || '').split('\n'); let html = '', paragraph = [], list = [], numbered = false, code = null;
  const flushParagraph = () => { if (paragraph.length) html += `<p>${inline(paragraph.join(' '))}</p>`; paragraph = []; };
  const flushList = () => { if (list.length) html += `<${numbered ? 'ol' : 'ul'}>${list.map(item => `<li>${inline(item)}</li>`).join('')}</${numbered ? 'ol' : 'ul'}>`; list = []; };
  for (const line of lines) {
    if (line.startsWith('```')) { flushParagraph(); flushList(); if (code === null) code = []; else { html += `<pre><code>${escape(code.join('\n'))}</code></pre>`; code = null; } continue; }
    if (code !== null) { code.push(line); continue; }
    if (!line.trim()) { flushParagraph(); flushList(); continue; }
    const image = line.trim().match(/^\[\[image:(\d+)\]\]$/);
    const manualImage = line.trim().match(/^!\[([^\]]*)\]\((https:\/\/[^\s)]+)\)$/);
    const heading = line.match(/^(#{1,4})\s+(.+)$/), item = line.match(/^\s*(?:([-*])|\d+[.)])\s+(.+)$/);
    if (image || manualImage || heading || line.startsWith('> ')) {
      flushParagraph(); flushList();
      if (image) html += figure(images[Number(image[1])]);
      else if (manualImage) html += figure({ url: manualImage[2], alt: manualImage[1] });
      else if (heading) html += `<h${Math.max(2, heading[1].length)}>${inline(heading[2])}</h${Math.max(2, heading[1].length)}>`;
      else html += `<blockquote><p>${inline(line.slice(2))}</p></blockquote>`;
    } else if (item) {
      flushParagraph(); const isNumbered = !item[1]; if (list.length && isNumbered !== numbered) flushList(); numbered = isNumbered; list.push(item[2]);
    } else { flushList(); paragraph.push(line); }
  }
  flushParagraph(); flushList(); if (code !== null) html += `<pre><code>${escape(code.join('\n'))}</code></pre>`;
  return html;
}
export function articleContent(post) {
  return figure(post.images?.[0], true) + markdown(post.body, post.images) + (post.sources?.length ? `<section class="article-sources"><h2>Sources &amp; further reading</h2><ul>${post.sources.map(source => `<li><a href="${escape(safeUrl(source.url))}" rel="noopener noreferrer">${escape(source.title)}</a></li>`).join('')}</ul></section>` : '');
}
export function exportMarkdown(post) {
  const body = post.body.replace(/\[\[image:(\d+)\]\]/g, (_, n) => { const image = post.images[Number(n)]; return image?.url ? `![${image.alt}](${image.url})\n\n*${image.caption || ''}${image.generated ? ' · AI-generated illustration' : ''}*` : ''; });
  return `# ${post.title}\n\n${post.social_excerpt || post.description}\n\n${post.images[0]?.url ? `![${post.images[0].alt}](${post.images[0].url})\n\n` : ''}${body}\n\n${post.sources.length ? '## Sources\n\n' + post.sources.map(s => `- [${s.title}](${s.url})`).join('\n') : ''}`;
}
