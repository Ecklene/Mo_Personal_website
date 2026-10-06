# Personal Website

This repository contains the personal website for **Motunrayo Akinsete**.

## Files
- `index.html` — homepage; route directories contain the other static pages.

## Local Preview
Build with `python3 scripts/build_site.py`, then run a local server from this repository:

```bash
python3 -m http.server 3000
```

Then visit `http://localhost:3000`.

The site now has eleven independent static pages and shared assets. Edit
`site/template.html` for interior pages, `site/home.html` for the homepage,
`site/redesign.css` for the refreshed styling and `site/interactions.js` for
navigation and motion. Routes and SEO metadata live in `scripts/build_site.py`;
generated HTML is overwritten
on build. See [SEO_ROADMAP.md](SEO_ROADMAP.md) for redesign sequencing and launch checks.

Edit `site/products.json` to update product cards: name, description, image,
imageAlt, category and url. Cards appear on the homepage and Products page.
Current product illustrations can be replaced with screenshots in `assets/`.

Vercel serves the committed static output directly, using `vercel.json`.
Always rebuild before committing source changes. The contact page opens an
email draft; visitors must send it in their email app.
