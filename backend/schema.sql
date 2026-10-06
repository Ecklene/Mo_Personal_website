-- Run once in the Supabase SQL editor. All application access is server-side.
create table if not exists public.blog_posts (
  id uuid primary key,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null default '',
  description text not null default '',
  category text not null default 'Personal',
  body text not null default '',
  images jsonb not null default '[]'::jsonb,
  sources jsonb not null default '[]'::jsonb,
  status text not null default 'draft' check (status in ('draft','rejected','published')),
  review_nonce uuid not null,
  review_issued_at timestamptz not null default now(),
  ai_generated boolean not null default false,
  editorial_note text not null default '',
  rejection_note text not null default '',
  email_sent_at timestamptz,
  linkedin_post_id text,
  linkedin_claimed_at timestamptz,
  pinterest_pin_id text,
  pinterest_claimed_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists blog_posts_published on public.blog_posts(published_at desc) where status='published';
create table if not exists public.blog_jobs (
  slot text primary key,
  post_id uuid not null,
  state text not null check (state in ('working','failed','complete')),
  lease_until timestamptz,
  error text,
  updated_at timestamptz not null default now()
);
create table if not exists public.blog_login_limits (
  key text primary key,
  attempts integer not null,
  expires_at timestamptz not null
);
create table if not exists public.blog_integrations (
  name text primary key,
  encrypted_token text not null,
  member_id text not null,
  expires_at timestamptz not null
);
alter table public.blog_integrations add column if not exists board_id text;
alter table public.blog_posts enable row level security;
alter table public.blog_jobs enable row level security;
alter table public.blog_login_limits enable row level security;
alter table public.blog_integrations enable row level security;
revoke all on public.blog_posts,public.blog_jobs,public.blog_login_limits,public.blog_integrations from anon, authenticated;
grant all on public.blog_posts,public.blog_jobs,public.blog_login_limits,public.blog_integrations to service_role;

create or replace function public.blog_claim_job(p_slot text,p_post_id uuid)
returns setof public.blog_jobs language sql security definer set search_path=public as $$
  insert into blog_jobs(slot,post_id,state,lease_until) values(p_slot,p_post_id,'working',now()+interval '10 minutes')
  on conflict(slot) do update set state='working',lease_until=now()+interval '10 minutes',updated_at=now(),error=null
  where blog_jobs.state='failed' or (blog_jobs.state='working' and blog_jobs.lease_until<now())
  returning *;
$$;
create or replace function public.blog_login_attempt(p_key text)
returns integer language sql security definer set search_path=public as $$
  insert into blog_login_limits(key,attempts,expires_at) values(p_key,1,now()+interval '15 minutes')
  on conflict(key) do update set
    attempts=case when blog_login_limits.expires_at<now() then 1 else blog_login_limits.attempts+1 end,
    expires_at=case when blog_login_limits.expires_at<now() then now()+interval '15 minutes' else blog_login_limits.expires_at end
  returning attempts;
$$;
revoke all on function public.blog_claim_job(text,uuid),public.blog_login_attempt(text) from public,anon,authenticated;
grant execute on function public.blog_claim_job(text,uuid),public.blog_login_attempt(text) to service_role;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('blog-images','blog-images',true,5242880,array['image/png','image/jpeg','image/webp'])
on conflict(id) do nothing;
-- Public image reads are intentional. No anonymous upload/update policy is granted.
-- Keep SQL files and every secret key out of the public deployment.
