const $ = id => document.getElementById(id);
let currentPost = null, owner = false, token = new URLSearchParams(location.hash.slice(1)).get('review') || '', busy = false;
// Remove the private review token from visible browser history. Keep it only in memory.
if (token) history.replaceState(null, '', location.pathname);
function status(message, error = false) { $('studio-status').textContent = message; $('studio-status').classList.toggle('is-error', error); }
async function api(action, data, options = {}) {
  const headers = token ? { Authorization: 'Bearer ' + token } : {};
  const query = new URLSearchParams({ action, ...(options.params || {}) });
  const response = await fetch('/api/editor?' + query, data ? { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ action, ...data }) } : { headers });
  if (!response.ok) { let message = 'The request could not be completed.'; try { message = (await response.json()).error || message; } catch {} throw new Error(message); }
  return options.raw ? response : response.json();
}
async function run(task) {
  if (busy) return;
  busy = true; document.body.classList.add('studio-busy');
  try { await task(); } catch (error) { status(error.message, true); }
  finally { busy = false; document.body.classList.remove('studio-busy'); }
}
function changes() {
  return { title: $('post-title').value, slug: $('post-slug').value, category: $('post-category').value, description: $('post-description').value, body: $('post-body').value, sources: $('post-sources').value.split('\n').filter(line => line.trim()).map(line => { const separator = line.indexOf('|'); if (separator < 1) throw new Error('Each source needs a title and URL separated by |.'); return { title: line.slice(0, separator).trim(), url: line.slice(separator + 1).trim() }; }) };
}
function updateWords() { $('word-count').textContent = $('post-body').value.split(/\s+/).filter(Boolean).length + ' words'; }
function renderPost(post) {
  currentPost = post; $('editor-empty').hidden = true; $('editor-content').hidden = false;
  for (const [field, name] of Object.entries({ 'post-title': 'title', 'post-slug': 'slug', 'post-category': 'category', 'post-description': 'description', 'post-body': 'body' })) $(field).value = post[name];
  $('post-sources').value = post.sources.map(source => `${source.title} | ${source.url}`).join('\n');
  $('post-state').textContent = post.status; $('editorial-note').textContent = post.editorial_note || post.rejection_note; $('editorial-note').hidden = !$('editorial-note').textContent;
  const published = post.status === 'published';
  for (const id of ['post-title','post-slug','post-category','post-description','post-body','post-sources','save-post','approve-post','reject-post']) $(id).disabled = published;
  $('unpublish-post').hidden = !published || !owner;
  $('live-post-link').hidden = !published; $('live-post-link').href = '/blog/' + post.slug + '/';
  $('email-draft').hidden = !owner || published;
  $('retry-draft').hidden = !owner || !post.ai_generated || published || post.images.every(image => image.url);
  $('share-linkedin').disabled = !published || Boolean(post.linkedin_post_id);
  $('share-linkedin').textContent = post.linkedin_post_id ? 'Shared to LinkedIn ✓' : 'Share link to LinkedIn ↗';
  $('share-pinterest').disabled = !published || Boolean(post.pinterest_pin_id);
  $('share-pinterest').textContent = post.pinterest_pin_id ? 'Published on Pinterest ✓' : 'Create Pinterest pin ↗';
  $('article-preview').hidden = true; renderImages(); updateWords();
}
function renderImages() {
  $('image-slots').replaceChildren();
  for (let index = 0; index < 3; index++) {
    const slot = document.createElement('div'); slot.className = 'image-slot'; const image = currentPost.images[index];
    const heading = document.createElement('h3'); heading.textContent = index === 0 ? 'Cover image' : `Image ${index}`; slot.append(heading);
    if (image?.url) { const img = document.createElement('img'); img.src = image.url; img.alt = image.alt; slot.append(img); }
    else { const empty = document.createElement('p'); empty.textContent = 'Add an image'; slot.append(empty); }
    if (currentPost.status !== 'published') {
      const alt = document.createElement('input'); alt.placeholder = 'Describe the image for readers'; alt.value = image?.alt || ''; alt.setAttribute('aria-label', `${heading.textContent} description`);
      const caption = document.createElement('input'); caption.placeholder = 'Caption or credit'; caption.value = image?.caption || ''; caption.setAttribute('aria-label', `${heading.textContent} caption`);
      const file = document.createElement('input'); file.type = 'file'; file.accept = 'image/png,image/jpeg,image/webp'; file.setAttribute('aria-label', `Upload ${heading.textContent.toLowerCase()}`);
      file.addEventListener('change', () => run(async () => {
        if (!file.files[0]) return; if (file.files[0].size > 2_000_000) throw new Error('Choose an image under 2 MB.');
        await save();
        const base64 = await new Promise((resolve,reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result.split(',')[1]); reader.onerror = reject; reader.readAsDataURL(file.files[0]); });
        const result = await api('upload', { id: currentPost.id, version: currentPost.updated_at, index, base64, alt: alt.value, caption: caption.value });
        renderPost(result.post); status('Image added.');
      }));
      slot.append(alt,caption,file);
    }
    $('image-slots').append(slot);
  }
}
async function save() {
  if (!currentPost || currentPost.status === 'published') return;
  const result = await api('save', { id: currentPost.id, version: currentPost.updated_at, changes: changes() }); currentPost = result.post;
  $('post-state').textContent = currentPost.status;
}
async function list() {
  if (!owner) return;
  const result = await api('list'); $('post-list').replaceChildren();
  for (const post of result.posts) {
    const button = document.createElement('button'); button.type = 'button';
    const title = document.createElement('strong'); title.textContent = post.title || 'Untitled draft';
    const meta = document.createElement('span'); meta.textContent = `${post.category} · ${post.status}`; button.append(title,meta);
    button.addEventListener('click', () => run(async () => { const result = await api('get', null, { params: { id: post.id } }); renderPost(result.post); status(''); }));
    $('post-list').append(button);
  }
}
async function start() {
  try {
    const session = await api('session'); owner = session.admin;
    $('studio-login').hidden = true; $('studio-workspace').hidden = false; $('studio-sidebar').hidden = !owner;
    $('studio-workspace').classList.toggle('review-only', !owner);
    if (owner) {
      const config = session.configuration; $('integration-status').textContent = `Writing: ${config.generation ? 'ready' : 'needs setup'} · Email: ${config.email ? 'ready' : 'needs setup'} · Schedule: ${session.automationEnabled ? 'enabled' : 'not activated'}`;
      $('connect-linkedin').textContent = session.linkedinConnected ? 'Reconnect LinkedIn ↗' : 'Connect LinkedIn ↗';
      $('connect-pinterest').textContent = session.pinterestConnected ? 'Reconnect Pinterest ↗' : 'Connect Pinterest ↗';
      if (session.pinterestConnected) {
        try {
          const result = await api('boards'); $('pinterest-board-group').hidden = false; $('pinterest-board').replaceChildren();
          for (const board of result.boards) { const option = document.createElement('option'); option.value = board.id; option.textContent = board.name; $('pinterest-board').append(option); }
          $('pinterest-board').value = result.selected || '';
        } catch (error) { status(error.message, true); }
      }
      await list();
    } else { const result = await api('get', null, { params: { id: session.reviewId } }); renderPost(result.post); }
  } catch (error) { status(error.message, true); }
}
$('studio-login').addEventListener('submit', event => { event.preventDefault(); run(async () => { token = ''; await api('login', { password: $('owner-password').value }); $('owner-password').value = ''; await start(); status('Signed in.'); }); });
$('studio-logout').addEventListener('click', () => run(async () => { await api('logout', {}); location.reload(); }));
$('new-personal').addEventListener('click', () => run(async () => { const result = await api('create', { category: 'Personal' }); renderPost(result.post); await list(); status('Your new draft is ready.'); }));
$('generate-draft').addEventListener('click', () => run(async () => { status('Researching and writing your draft, then creating three images. This can take a few minutes.'); const result = await api('generate', { category: $('generate-category').value, context: $('generate-notes').value }); if (result.post) { renderPost(result.post); await list(); status(result.emailed ? 'Draft saved and emailed for review.' : 'Draft saved. Configure email delivery to receive it in your inbox.'); } else status(result.message); }));
$('retry-draft').addEventListener('click', () => run(async () => { status('Finishing the images and email for this draft…'); const result = await api('generate', { retryId: currentPost.id }); if (result.post) renderPost(result.post); status(result.message || 'Generation complete.'); }));
$('save-post').addEventListener('click', () => run(async () => { await save(); await list(); status('Draft saved.'); }));
$('approve-post').addEventListener('click', () => run(async () => { await save(); const result = await api('approve', { id: currentPost.id, version: currentPost.updated_at }); renderPost(result.post); await list(); status('Approved and published on your website.'); }));
$('reject-post').addEventListener('click', () => run(async () => { await save(); const note = prompt('Optional note: what should change in this draft?'); if (note === null) return; const result = await api('reject', { id: currentPost.id, version: currentPost.updated_at, note }); renderPost(result.post); await list(); status('Draft rejected. It remains private.'); }));
$('unpublish-post').addEventListener('click', () => run(async () => { const result = await api('unpublish', { id: currentPost.id, version: currentPost.updated_at }); renderPost(result.post); await list(); status('Unpublished. Edit and approve again when ready.'); }));
$('post-body').addEventListener('input',updateWords);
document.querySelectorAll('[data-insert]').forEach(button => button.addEventListener('click', () => { const input = $('post-body'); if (input.disabled) return; const text = button.dataset.insert.replace(/\\n/g,'\n'); input.setRangeText(text,input.selectionStart,input.selectionEnd,'end'); input.focus(); updateWords(); }));
async function exported(format) { await save(); return api('export', null, { params: { id: currentPost.id, format }, raw: true }); }
$('preview-post').addEventListener('click', () => run(async () => { const response = await exported('preview'); $('article-preview').hidden = false; $('article-preview').querySelector('iframe').srcdoc = await response.text(); $('article-preview').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); }));
$('close-preview').addEventListener('click', () => $('article-preview').hidden = true);
for (const [id,format] of [['download-html','html'],['download-markdown','markdown']]) $(id).addEventListener('click', () => run(async () => { const blob = await (await exported(format)).blob(); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = currentPost.slug + (format === 'markdown' ? '.md' : '.html'); a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000); }));
$('copy-article').addEventListener('click', () => run(async () => { const html = await (await exported('html')).text(); const article = new DOMParser().parseFromString(html,'text/html').querySelector('article'); if (navigator.clipboard?.write && window.ClipboardItem) await navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([article.outerHTML],{type:'text/html'}), 'text/plain': new Blob([article.innerText || article.textContent],{type:'text/plain'}) })]); else throw new Error('Formatted copy is unavailable in this browser. Download the HTML and copy from that document.'); status('Formatted article copied. Paste into the Substack or LinkedIn article editor, then review the formatting and images.'); }));
$('email-draft').addEventListener('click', () => run(async () => { await save(); const result = await api('email', { id: currentPost.id }); renderPost(result.post); status('The review email was sent or was already delivered for this draft.'); }));
$('share-linkedin').addEventListener('click', () => run(async () => { const result = await api('linkedin', { id: currentPost.id }); renderPost(result.post); status('Your article link was shared to LinkedIn.'); }));
$('share-pinterest').addEventListener('click', () => run(async () => { const result = await api('pinterest', { id: currentPost.id }); renderPost(result.post); status('Your article was pinned with its cover image and website link.'); }));
$('save-pinterest-board').addEventListener('click', () => run(async () => { await api('board', { boardId: $('pinterest-board').value }); status('Pinterest board selected.'); }));
start();
