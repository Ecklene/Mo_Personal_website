# Audit implementation and redesign sequence

Reviewed the 9 September 2026 audit against the local repository. Its scores are
qualitative opinions, not measured search performance.

## Implemented locally

- Eleven static pages with real navigation, including Products, consulting,
  corporate training and individual training pages.
- Unique titles, descriptions, canonical URLs and social sharing metadata.
- Homepage positioning, identity summary and specific calls to action.
- Answer-first service FAQs based on existing service information.
- Person, WebSite, WebPage and Service structured data.
- Sitemap, crawler instructions and shared CSS, JavaScript and portrait assets.
- Replaced the missing speaker-kit download with an email request link.

## Recommended order

1. Agree positioning and page structure using this first implementation.
2. Redesign the UI around these pages, prioritising mobile navigation, readable
   content, evidence and clear enquiry paths. Keep the established URLs.
3. Verify claims and complete enquiry functionality before launch.
4. Deploy, verify Search Console ownership, submit the sitemap and inspect indexing.
5. Publish original articles based on your teaching and practical experience.

## Outstanding information and launch checks

- Research needs full paper titles, authors, venue, year, status and public links.
  The existing generic 2020 journal card is insufficient evidence.
- Verify training totals, engagement totals, countries and affiliations. Scholarship
  status should not imply employment or endorsement.
- Confirm whether AI Accelerator Academy and MotunBiz Academy are the same entity,
  their official URLs and current offer before adding a page or Organization data.
- Publish reviewed articles before creating an Insights index.
- Enquiries currently open an email draft with validated fields. Visitors must send
  that draft in their email app. A backend submission service is a future improvement.
- Canonical URLs use the verified production domain (`https://www.motunrayoakinsete.com`). Review
  existing indexed URLs and add redirects if replacing previously published paths.
- Complete visual/mobile QA, accessibility, PageSpeed and structured-data validation.
  Search rankings and AI citations are not guaranteed.

Search Console setup remains outstanding. Existing credibility claims remain
owner-supplied. GitHub pushes to the connected production branch trigger Vercel.

## Maintaining this version

Edit `site/template.html` for interior pages, `site/home.html` for the redesigned
homepage, `site/redesign.css` for styling, `site/interactions.js` for motion, and
`scripts/build_site.py` for routes, metadata and new service content.
Run `python3 scripts/build_site.py` after changes. Generated HTML is overwritten.
Preview from the repository root with `python3 -m http.server 3000` and visit
http://localhost:3000. Opening local files directly does not support root-relative
links. Publish generated pages, `assets`, `robots.txt` and `sitemap.xml` to a static
host with directory index support; source templates and scripts need not be hosted.

## UI implementation

Centered portrait with side text on desktop; stacked layout on phones. The original
navy, horizon blue and sky blue remain, with champagne gold accents. A gold halo
appears on portrait hover or keyboard focus. Entrance motion, a floating accent
and section reveals respect reduced-motion preferences. Shared mobile navigation
supports Escape and closes when a link is selected. Desktop and 390px phone layouts
were visually reviewed, and hover, menu behavior and reduced motion were checked
in an isolated headless Chrome preview. Complete ten-page link/metadata checks pass.
