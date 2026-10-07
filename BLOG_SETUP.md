# Blog and editorial setup

The public blog lives at `/blog/`; the private writing and approval workspace is
`/studio/`. Approved articles publish immediately from the database, without a
GitHub commit or Vercel rebuild. The homepage’s Blog section shows the latest three
published articles. Unpublished drafts are never included in public pages or feeds.

## Connect the required services

1. Create a Neon PostgreSQL project and run `backend/schema-neon.sql` in its SQL
   editor, using the same owner role as the connection string. Add the pooled
   connection string as `DATABASE_URL` in Vercel; keep it server-side. Create a
   **public** Vercel Blob store in your project’s Storage tab and connect it to
   production. Vercel adds `BLOB_READ_WRITE_TOKEN` for server-side image uploads.
   This stores posts privately in Neon and blog illustrations in Blob. Do not
   create an anonymous database endpoint or expose the connection string.

   Supabase remains an alternative: leave DATABASE_URL unset, run `backend/schema.sql`
   in Supabase, and set `SUPABASE_URL` and `SUPABASE_SECRET_KEY`. Only configure one
   database for this site. DATABASE_URL takes priority when present. Switching
   databases after publishing requires migrating posts, jobs and integration rows;
   changing an environment variable alone does not move existing data.
2. Add an OpenAI API key with API billing enabled as `OPENAI_API_KEY`. ChatGPT
   subscriptions do not provide API credits. Defaults are `gpt-4.1` for research
   and writing and `gpt-image-1.5` for illustrations; both are configurable. For Claude draft writing and summaries, add
   `ANTHROPIC_API_KEY` and optionally `ANTHROPIC_TEXT_MODEL` (default
   `claude-sonnet-4-6`). Choose the writer in the studio; set `TEXT_PROVIDER=claude`
   for scheduled drafts or leave it `openai`. OpenAI is still required for web
   research and generated images. Claude-only summaries work for manually written
   articles without an OpenAI key. API billing is separate from consumer chat plans.
3. In Resend, verify a sending domain with the DNS records it provides. Add
   `RESEND_API_KEY`, a verified `EMAIL_FROM` sender and your private `REVIEW_EMAIL`
   to Vercel. The recipient email is intentionally not stored in this public repo.
4. Set `SITE_URL=https://www.motunrayoakinsete.com`, a unique `ADMIN_PASSWORD`
   of at least 16 characters, and separate random `AUTH_SECRET` and `CRON_SECRET`
   values of at least 32 characters. Generate secrets with a password manager.
   Changing AUTH_SECRET invalidates sessions and review links; reconnect social
   accounts too, because stored access tokens use that key for encryption.
5. Redeploy after adding environment variables. Sign in at `/studio/`, generate
   one test draft, verify all three images and the email, edit it, and test approval.
   Review accuracy and tone before publishing; no automatic draft is public.

Never send API keys in chat or put real values in `.env.example`. For local work,
copy that file to `.env.local` (ignored by git), run `npm ci`, build, then run `npm run dev`.

## Activate three drafts per week

The GitHub workflow `.github/workflows/editorial.yml` runs Monday, Wednesday and
Friday at 08:00 UTC / 09:00 Lagos time. GitHub schedules may be delayed; this is
not a guarantee of exact inbox arrival times. One draft rotates across AI Research,
Cloud Computing, Cybersecurity and Tech. Personal posts require your own notes
and can be written or generated manually in the studio.

After a successful test, set `BLOG_AUTOMATION_ENABLED=true` in Vercel and redeploy.
In GitHub repository Settings → Secrets and variables → Actions, add:

- Variable `BLOG_ENDPOINT`: `https://www.motunrayoakinsete.com/api/automation/`
- Secret `BLOG_CRON_SECRET`: the same value as Vercel’s `CRON_SECRET`

Enable Actions if needed. Manual workflow runs only generate on scheduled days;
use the studio’s Generate button on other days. The service records a unique date
slot so a repeated trigger does not create a second scheduled article. Failed
images are retained for a retry; select the draft and choose Finish generation.
Failure before a draft is saved is visible in Actions/Vercel logs. A terminated
job’s ten-minute lease must expire before its date slot can be reclaimed.

Generation uses paid text/search/image APIs and email/storage services. Start with
provider spending limits. No paid calls happen while automation is disabled or
the required configuration is absent. The code and local tests are prepared;
real model, database, email and social account tests require your credentials.

## Approval, email and exports

The email contains the draft with a cover and two inline illustrations, a private
review link, HTML and Markdown attachments, and the cover attachment when its
file size permits. Opening the email link cannot approve or reject anything:
approval is an explicit POST from the studio. Links expire after 14 days; owner
sign-in remains available. Approve & publish makes the article public. Reject
keeps it private. Publishing checks for a title, description, article text and
cover, plus complete images and sources for generated technical drafts.

You can write original personal posts, upload your own images (PNG/JPEG/WebP under
2 MB), put Image 1 and Image 2 between sections, and preview the final article.
Image alt text and captions are set when uploading; re-upload to replace them.
Supported Markdown: headings, paragraphs, bold/italic, lists, links, quotes and
code blocks. Raw HTML is escaped. Use a short title and a specific 140–160-character
search description. The editor is designed for one owner; it is not a multi-user CMS.

The Create article summary button lets you select OpenAI or Claude. It saves an
editable search description and article/social summary while retaining the full
article body. Review both before approving. The summary appears beneath the
article title and is used in LinkedIn sharing. The weekly writer creates these
summaries along with the draft. Summaries cannot publish a post by themselves.

The public pages render article text on the server, with BlogPosting/Breadcrumb
data, canonical URLs, social image metadata, readable author details and related
links. `/sitemap.xml` adds published articles dynamically; `/rss.xml` contains the
latest 50 full articles with images. Submit the sitemap in Google Search Console.
Publishing useful original articles can help discovery; rankings are not guaranteed.

## LinkedIn

Create an app in the LinkedIn Developer Portal and enable Share on LinkedIn and
Sign In with LinkedIn using OpenID Connect. Add this exact callback URL:
`https://www.motunrayoakinsete.com/api/linkedin/`. Set `LINKEDIN_CLIENT_ID` and
`LINKEDIN_CLIENT_SECRET` in Vercel and redeploy. The default API version is 202606;
update `LINKEDIN_API_VERSION` as LinkedIn sunsets versions.

Choose Connect LinkedIn in the studio and grant the requested scopes. For a
published post, Share link to LinkedIn creates an article-style feed post linking
to your website. This does not create a native long-form LinkedIn article.
For that format, use Copy formatted article and paste in LinkedIn’s article editor.
Reconnect when the account token expires. Provider permissions/access can affect
availability; the app connection must be tested with your actual account.

## Pinterest

Use a Pinterest business account, register an app and request the required access.
Set its exact callback to `https://www.motunrayoakinsete.com/api/pinterest/`, then
add `PINTEREST_CLIENT_ID` and `PINTEREST_CLIENT_SECRET` to Vercel. Redeploy, choose
Connect Pinterest and select a board in the studio. Create Pinterest pin publishes
the approved post’s cover, title, description and website link. The current image
is landscape; dedicated vertical pin artwork is a future enhancement. Reconnect
when the token expires. Board selection shows the first 100 accessible boards.

LinkedIn/Pinterest submissions use a persistent claim to prevent duplicate clicks.
If the provider’s response is ambiguous, check the platform before retrying. The
studio does not automatically resubmit an uncertain publication. After verifying
that nothing was published, the owner can clear the relevant claimed_at field in
your database. Never clear it just because a network request timed out.

## Substack

No supported direct publishing API was verified. Use Copy formatted article or
the HTML download to paste into its editor, or import this site’s RSS feed through
Substack Settings → Import/Export. Importing is a user action, not automatic
delivery to subscribers. Review formatting and images after pasting. To email an
imported post to subscribers, use Substack’s publish/delivery controls.

## Maintenance

`npm test` verifies rendering, authentication, publication boundaries, scheduling
and pipeline retries using mocks, without paid API calls. Rebuild static pages with
`npm run build` before a git push. Vercel deploys committed static pages and six
Node functions. Source templates, SQL, tests, local screenshots and env files are
excluded from static deployment. Keep backups of your database and images. PostgreSQL checks run locally with PGlite; provider requests are mocked. These tests do not prove real account delivery or permissions.

Official documentation used:

- [OpenAI web search](https://developers.openai.com/api/docs/guides/tools-web-search)
- [OpenAI images](https://developers.openai.com/api/reference/resources/images/methods/generate)
- [Neon serverless driver](https://github.com/neondatabase/serverless/blob/main/CONFIG.md)
- [Vercel Blob SDK](https://vercel.com/docs/vercel-blob/using-blob-sdk)
- [Claude structured outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs)
- [Supabase secret keys](https://supabase.com/docs/guides/getting-started/api-keys)
- [Resend emails](https://resend.com/docs/api-reference/emails/send-email)
- [LinkedIn Posts API](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api?view=li-lms-2026-06)
- [Pinterest authentication](https://developers.pinterest.com/docs/getting-started/set-up-authentication-and-authorization/)
- [Substack imports](https://support.substack.com/hc/en-us/articles/360037830351-How-do-I-import-my-posts-from-another-platform-such-as-Mailchimp-WordPress-Medium-or-Ghost)
