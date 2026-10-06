export function post(overrides = {}) {
  return {
    id: '11111111-1111-4111-8111-111111111111', slug: 'a-useful-ai-question',
    title: 'A useful AI question', description: 'A practical explanation of an important question about AI systems and how to evaluate their results carefully.',
    category: 'AI Research', body: `## Start with the question\n\n${'Useful evidence helps people make thoughtful decisions. '.repeat(80)}\n\n[[image:1]]\n\n## Look at the evidence\n\nA second section with **useful examples**.\n\n[[image:2]]`,
    images: [0,1,2].map(i => ({ url: `https://db.example/storage/v1/object/public/blog-images/example/${i}.webp`, prompt: `Conceptual illustration ${i}`, alt: `Illustration ${i}`, caption: `Caption ${i}`, generated: true })),
    sources: [{title:'NIST research', url:'https://nist.gov/research'}, {title:'Research paper', url:'https://arxiv.org/abs/1234'}],
    status: 'draft', ai_generated: true, review_nonce: '22222222-2222-4222-8222-222222222222',
    review_issued_at: new Date().toISOString(), created_at: new Date().toISOString(), updated_at: '2026-10-06T08:00:00.000Z',
    editorial_note: 'Private fact-check note', rejection_note: '', email_sent_at: null,
    published_at: null, linkedin_post_id: null, linkedin_claimed_at: null, pinterest_pin_id: null, pinterest_claimed_at: null,
    ...overrides
  };
}
export function env() {
  Object.assign(process.env, { SITE_URL:'https://www.motunrayoakinsete.com', AUTH_SECRET:'test-only-'.repeat(5), ADMIN_PASSWORD:'test-owner-password-long', SUPABASE_URL:'https://db.example', SUPABASE_SECRET_KEY:'sb_secret_test-only', OPENAI_API_KEY:'test-only', RESEND_API_KEY:'test-only', EMAIL_FROM:'editor@example.com', REVIEW_EMAIL:'owner@example.com', CRON_SECRET:'test-only-cron-'.repeat(3), BLOG_AUTOMATION_ENABLED:'false' });
}
export function response(value, status = 200, headers = {}) { return new Response(typeof value === 'string' ? value : JSON.stringify(value), {status, headers:{'Content-Type':'application/json',...headers}}); }
export async function call(handler, { action, method = 'GET', data = {}, token, cookie, origin = process.env.SITE_URL, params = {} } = {}) {
  const req = {method, url:'/api/editor?' + new URLSearchParams({...(action?{action}:{}),...params}), headers: { ...(origin ? {origin} : {}), ...(token ? {authorization:'Bearer '+token} : {}), ...(cookie?{cookie}:{}), 'x-forwarded-for':'192.0.2.1' }};
  if (method === 'POST') req.body = {action,...data};
  const res = { statusCode:200, headers:{}, setHeader(name,value){this.headers[name.toLowerCase()]=value;}, end(value=''){this.body=String(value);} };
  await handler(req,res); res.json = () => JSON.parse(res.body); return res;
}
export function fakeDatabase(initial = []) {
  const state = {posts:structuredClone(initial), jobs:[], integrations:[], calls:[], attempts:0};
  state.fetch = async (input, options = {}) => {
    const url = new URL(input), method = options.method || 'GET';
    if (url.pathname.startsWith('/storage/v1/object/')) return response({ok:true});
    const data = options.body ? JSON.parse(options.body) : {};
    state.calls.push({url:url.href, method, data});
    const table = url.pathname.split('/').pop();
    if (table === 'blog_login_attempt') return response(++state.attempts);
    if (table === 'blog_claim_job') {
      let job = state.jobs.find(j => j.slot === data.p_slot);
      if (job && job.state !== 'failed') return response([]);
      if (!job) {job = {slot:data.p_slot, post_id:data.p_post_id};state.jobs.push(job);}
      job.state='working';return response([structuredClone(job)]);
    }
    const collection = table === 'blog_posts' ? state.posts : table === 'blog_jobs' ? state.jobs : table === 'blog_integrations' ? state.integrations : null;
    if (!collection) throw new Error('Unexpected database request '+url.href);
    if (method === 'POST') { const row = table === 'blog_posts' ? post(data) : data; collection.push(row);return response([row]); }
    let rows = collection.filter(row => [...url.searchParams].every(([key,value]) => !value.startsWith('eq.') && value !== 'is.null' || (value === 'is.null' ? row[key] == null : String(row[key]) === value.slice(3))));
    if (method === 'PATCH') { for (const row of rows) Object.assign(row,data);return response(rows); }
    const offset = Number(url.searchParams.get('offset') || 0), limit = Number(url.searchParams.get('limit') || 1000);
    return response(rows.slice(offset,offset+limit));
  };
  return state;
}
