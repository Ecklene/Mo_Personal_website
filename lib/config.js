export const CATEGORIES = ['AI Research', 'Cloud Computing', 'Cybersecurity', 'Tech', 'Personal'];
export function siteUrl() { return (process.env.SITE_URL || 'https://www.motunrayoakinsete.com').replace(/\/$/, ''); }
export function required(name) {
  const value = process.env[name];
  if (!value) throw Object.assign(new Error(`Missing ${name}`), { status: 503, publicMessage: 'The editorial service needs configuration. See BLOG_SETUP.md.' });
  return value;
}
export function databaseReady() { return Boolean(process.env.DATABASE_URL || process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY); }
export function configuration() {
  const groups = {
    publishing: ['AUTH_SECRET', 'ADMIN_PASSWORD'],
    generation: ['OPENAI_API_KEY'],
    email: ['RESEND_API_KEY', 'EMAIL_FROM', 'REVIEW_EMAIL'],
    automation: ['CRON_SECRET'],
    linkedin: ['LINKEDIN_CLIENT_ID', 'LINKEDIN_CLIENT_SECRET'],
    pinterest: ['PINTEREST_CLIENT_ID', 'PINTEREST_CLIENT_SECRET']
  };
  const status=Object.fromEntries(Object.entries(groups).map(([name, keys]) => [name, keys.every(key => Boolean(process.env[key]))]));
  status.publishing &&= databaseReady();
  status.images=Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY);
  status.claude=Boolean(process.env.ANTHROPIC_API_KEY);
  if(process.env.TEXT_PROVIDER==='claude')status.generation &&= status.claude;
  return status;
}
