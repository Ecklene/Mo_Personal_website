import { db, savePost } from './db.js';
import { decrypt } from './auth.js';
import { siteUrl } from './config.js';
import { safeUrl } from './content.js';
async function connection() { const row = (await db('blog_integrations?name=eq.pinterest&limit=1'))[0]; if (!row || new Date(row.expires_at) <= new Date()) throw Object.assign(new Error('Connect or reconnect Pinterest in the studio first.'), { status: 400 }); return row; }
export async function pinterestBoards() {
  const row = await connection();
  const response = await fetch('https://api.pinterest.com/v5/boards?page_size=100', { headers: { Authorization: `Bearer ${decrypt(row.encrypted_token)}` }, signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw Object.assign(new Error('Pinterest boards could not be loaded.'), { status: 502 });
  const result = await response.json(); return { boards: (result.items || []).map(b => ({ id: b.id, name: b.name })), selected: row.board_id };
}
export async function selectPinterestBoard(boardId) {
  const result = await pinterestBoards(); if (!result.boards.some(b => b.id === boardId)) throw Object.assign(new Error('Choose one of your Pinterest boards.'), { status: 400 });
  await db('blog_integrations?name=eq.pinterest', { method: 'PATCH', body: JSON.stringify({ board_id: boardId }) });
}
export async function publishPin(post) {
  if (post.status !== 'published') throw Object.assign(new Error('Publish the article before creating a pin.'), { status: 400 });
  if (post.pinterest_pin_id) return post;
  if (post.pinterest_claimed_at) throw Object.assign(new Error('A pin submission is in progress or needs checking. Check Pinterest to avoid a duplicate.'), { status: 409 });
  const row = await connection(); if (!row.board_id) throw Object.assign(new Error('Choose your Pinterest board in the studio first.'), { status: 400 });
  if (!safeUrl(post.images[0]?.url)) throw Object.assign(new Error('Add a public cover image first.'), { status: 400 });
  const claim = await db(`blog_posts?id=eq.${post.id}&pinterest_claimed_at=is.null&pinterest_pin_id=is.null`, { method: 'PATCH', body: JSON.stringify({ pinterest_claimed_at: new Date().toISOString() }) });
  if (!claim.length) throw Object.assign(new Error('A pin submission is already in progress.'), { status: 409 });
  const response = await fetch('https://api.pinterest.com/v5/pins', { method: 'POST', headers: { Authorization: `Bearer ${decrypt(row.encrypted_token)}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ board_id: row.board_id, title: post.title.slice(0,100), description: post.description.slice(0,500), link: `${siteUrl()}/blog/${post.slug}/`, alt_text: post.images[0].alt.slice(0,500), media_source: { source_type: 'image_url', url: post.images[0].url } }), signal: AbortSignal.timeout(25000) });
  if (!response.ok) { if (response.status < 500) await savePost(post.id, { pinterest_claimed_at: null }); throw Object.assign(new Error('Pinterest could not confirm publication. Check the connection and your board.'), { status: 502 }); }
  const pin = await response.json(); if (!pin.id) throw Object.assign(new Error('Check Pinterest: the pin may have published, but its identifier was not returned.'), { status: 502 });
  return savePost(post.id, { pinterest_pin_id: pin.id });
}
