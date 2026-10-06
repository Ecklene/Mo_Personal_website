# Personal Website

This repository contains the personal website for **Motunrayo Akinsete**.

## Files
- `index.html` — homepage; route directories contain the other static pages.

## Local Preview
Build the pages, then run the local server (Node 22 or newer):

```bash
npm run build
npm run dev
```

Then visit `http://127.0.0.1:3001`. Without service credentials, the blog shows
its empty state and the private editor requires setup. Use an ignored `.env.local`
file to configure local services; never commit credentials.

The site has thirteen generated pages, shared assets and six server functions. Edit
`site/template.html` for interior pages, `site/home.html` for the homepage,
`site/redesign.css` for the refreshed styling and `site/interactions.js` for
navigation and motion. Routes and SEO metadata live in `scripts/build_site.py`;
generated HTML is overwritten
on build. See [SEO_ROADMAP.md](SEO_ROADMAP.md) for redesign sequencing and launch checks.

Edit `site/products.json` to update product cards: name, description, image,
imageAlt, category and url. Cards appear on the homepage and Products page.
Current product illustrations can be replaced with screenshots in `assets/`.

Vercel copies the committed static output into a public-only deployment directory
with `scripts/prepare-static.mjs`, using `vercel.json`.
Always rebuild before committing source changes. The contact page opens an
email draft; visitors must send it in their email app.

The public `/blog/` and article pages render from Supabase on the server.
The private `/studio/` supports writing, image uploads, AI draft generation,
email review, approval and LinkedIn/Pinterest sharing. See [BLOG_SETUP.md](BLOG_SETUP.md)
for Resend, database, AI, social account and weekly schedule setup. Automation
ships disabled until those services are connected and tested. Run `npm test`
for checks that do not contact paid services.
