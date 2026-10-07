import { db, savePost } from './db.js';
import { decrypt } from './auth.js';
import { required, siteUrl } from './config.js';
export async function shareLinkedIn(post) {
  if (post.status !== 'published') throw Object.assign(new Error('Approve and publish the blog post before sharing it.'), { status: 400 });
  if (post.linkedin_post_id) return post;
  if (post.linkedin_claimed_at) throw Object.assign(new Error('A LinkedIn submission is already in progress or needs checking. Check LinkedIn before trying again to avoid a duplicate.'), { status: 409 });
  const connection = (await db('blog_integrations?name=eq.linkedin&limit=1'))[0];
  if (!connection || new Date(connection.expires_at) <= new Date()) throw Object.assign(new Error('Connect or reconnect LinkedIn in the studio first.'), { status: 400 });
  const claim = await db(`blog_posts?id=eq.${post.id}&linkedin_claimed_at=is.null&linkedin_post_id=is.null`, { method: 'PATCH', body: JSON.stringify({ linkedin_claimed_at: new Date().toISOString() }) });
  if (!claim.length) throw Object.assign(new Error('LinkedIn share is already being submitted.'), { status: 409 });
  const response = await fetch('https://api.linkedin.com/rest/posts', { method: 'POST', headers: { Authorization: `Bearer ${decrypt(connection.encrypted_token)}`, 'Content-Type': 'application/json', 'LinkedIn-Version': process.env.LINKEDIN_API_VERSION || '202606', 'X-Restli-Protocol-Version': '2.0.0' }, body: JSON.stringify({ author: `urn:li:person:${connection.member_id}`, commentary: `${post.title}\n\n${post.social_excerpt || post.description}\n\nRead the full article on my blog.`, visibility: 'PUBLIC', distribution: { feedDistribution: 'MAIN_FEED', targetEntities: [], thirdPartyDistributionChannels: [] }, content: { article: { source: `${siteUrl()}/blog/${post.slug}/`, title: post.title, description: post.description } }, lifecycleState: 'PUBLISHED', isReshareDisabledByAuthor: false }), signal: AbortSignal.timeout(25000) });
  if (!response.ok) {
    // 4xx is a definite rejection. Leave an ambiguous server/network outcome locked.
    if (response.status >= 400 && response.status < 500) await savePost(post.id, { linkedin_claimed_at: null });
    throw Object.assign(new Error('LinkedIn could not confirm publication. Check the connection, permissions and your LinkedIn feed.'), { status: 502 });
  }
  const id = response.headers.get('x-restli-id');
  if (!id) throw Object.assign(new Error('Check LinkedIn: the post may have published, but its identifier was not returned.'), { status: 502 });
  return savePost(post.id, { linkedin_post_id: id });
}
