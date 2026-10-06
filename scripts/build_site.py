"""Build crawlable static pages from the existing design. Run: python3 scripts/build_site.py."""
from pathlib import Path
import base64
import hashlib
import json
import re
from html import escape

ROOT = Path(__file__).resolve().parents[1]
BASE = 'https://www.motunrayoakinsete.com'
source = (ROOT / 'site/template.html').read_text()
assets = ROOT / 'assets'
assets.mkdir(exist_ok=True)

def image(match):
    data = base64.b64decode(match[2])
    extension = {'jpeg': 'jpg', 'png': 'png', 'webp': 'webp'}[match[1]]
    name = 'portrait-' + hashlib.sha256(data).hexdigest()[:12] + '.' + extension
    (assets / name).write_bytes(data)
    return '/assets/' + name

source = re.sub(r'data:image/(jpeg|png|webp);base64,([^"\s]+)', image, source)
css = re.search(r'<style>(.*?)</style>', source, re.S)[1]
css += '\n' + (ROOT / 'site/redesign.css').read_text()
(assets / 'site.css').write_text(css + '\n.faq-list{max-width:760px}.faq-list details{padding:20px 0;border-bottom:1px solid var(--border)}.faq-list summary{cursor:pointer;font-weight:500}.faq-list p{margin-top:12px;line-height:1.8;color:var(--muted)}\n')
js = re.search(r'<script>(.*?)</script>', source, re.S)[1]
js = js[js.index('function filterPortfolio'):]
js = re.sub(r'function handleSubmit\(\) \{.*?\n\}', '', js, flags=re.S)
js += '\n' + (ROOT / 'site/interactions.js').read_text()
(assets / 'site.js').write_text(js)

routes = {
    'home': ('/', 'AI Consultant & Trainer in Nigeria | Motunrayo Akinsete', 'AI consulting, corporate training and speaking with Motunrayo Akinsete, a Google DeepMind Scholar and AI researcher based in Nigeria.'),
    'about': ('/about/', 'About Motunrayo Akinsete | AI Researcher & Consultant', 'Meet Motunrayo Akinsete, AI researcher, consultant, trainer and founder of AI Accelerator Academy. Learn about her background and mission.'),
    'services': ('/services/', 'AI Consulting, Training & Speaking | Motunrayo Akinsete', 'Explore AI strategy consulting, practical corporate workshops, individual AI training and speaking engagements with Motunrayo Akinsete.'),
    'portfolio': ('/portfolio/', 'AI Projects & Training Portfolio | Motunrayo Akinsete', 'Explore selected AI consulting, training and research engagements by Motunrayo Akinsete.'),
    'research': ('/research/', 'Responsible AI & LLM Fairness Research | Motunrayo Akinsete', 'Explore Motunrayo Akinsete’s research interests and projects in responsible AI, LLM fairness and AI for global health.'),
    'speaking': ('/ai-speaker-nigeria/', 'AI Speaker in Nigeria | Motunrayo Akinsete', 'Invite Motunrayo Akinsete to speak on responsible AI, African AI talent, practical AI adoption and automation at your conference or event.'),
    'book': ('/book/', 'Book AI Consulting, Training or Speaking | Motunrayo Akinsete', 'Contact Motunrayo Akinsete about AI strategy, corporate training, individual sessions, speaking engagements or research collaboration.'),
    'consulting': ('/ai-consulting-nigeria/', 'AI Consulting in Nigeria | Motunrayo Akinsete', 'AI readiness assessments, strategy roadmaps, tool selection and workflow design for Nigerian businesses and institutions.'),
    'corporate': ('/corporate-ai-training-nigeria/', 'Corporate AI Training in Nigeria | Motunrayo Akinsete', 'Practical AI workshops for businesses, government organisations and institutions. Build your team’s skills with Motunrayo Akinsete.'),
    'training': ('/ai-training-nigeria/', 'AI Training in Nigeria for Professionals | Motunrayo Akinsete', 'Focused one-on-one AI sessions for founders, researchers and professionals with Motunrayo Akinsete.'),
    'products': ('/building-products/', 'Building AI Products & Product Management | Motunrayo Akinsete', 'Explore Motunrayo Akinsete’s approach to building useful AI products, AI product management and research-led product decisions.'),
}

def links(html):
    def anchor(match):
        tag = match[0]
        action = re.search(r' onclick="showPage\(\'([^\']+)\'\)"', tag)
        if action:
            tag = tag.replace('href="#"', 'href="' + routes[action[1]][0] + '"')
            tag = tag.replace(action[0], '')
        return tag
    return re.sub(r'<a\b[^>]*>', anchor, html)

nav = links(re.search(r'<nav.*?</nav>', source, re.S)[0])
nav = nav.replace('<div class="nav-links">', '<button class="nav-toggle" aria-expanded="false" aria-controls="navigation-links" aria-label="Open navigation"><span></span><span></span></button><div class="nav-links" id="navigation-links">')
nav = nav.replace('<a href="/research/"', '<a href="/building-products/" id="nav-products">Products</a><a href="/research/"').replace('id="nav-research">Research', 'id="nav-research">AI Research')
pages = {}
for key in list(routes)[:7]:
    start = source.index('<div class="page' + (' active' if key == 'home' else '') + '" id="page-' + key + '">')
    end = source.index('</footer>', start) + len('</footer>')
    pages[key] = source[start:end] + '\n</div>'

person = {'@type': 'Person', '@id': BASE + '/#person', 'name': 'Motunrayo Akinsete', 'url': BASE + '/about/', 'jobTitle': 'AI Product Manager, Researcher, Consultant and Trainer', 'sameAs': ['https://linkedin.com/in/motunrayoakinsete'], 'knowsAbout': ['AI product management', 'Responsible AI', 'LLM fairness', 'AI automation', 'AI training']}
website = {'@type': 'WebSite', '@id': BASE + '/#website', 'url': BASE + '/', 'name': 'Motunrayo Akinsete'}

def faq(items):
    return '<section class="section white"><p class="sec-eyebrow blue">Questions &amp; Answers</p><h2 class="sec-title">Frequently asked questions</h2><div class="faq-list">' + ''.join('<details><summary>' + escape(q) + '</summary><p>' + escape(a) + '</p></details>' for q, a in items) + '</div></section>'

service_questions = {
    'consulting': [('What does an AI consultant do?', 'An AI consultant helps organisations identify where AI can improve operations and supports them with a practical adoption plan. Mo offers readiness assessments, strategic roadmaps, tool selection and workflow design.'), ('Which organisations does Mo work with?', 'Mo’s consulting services are designed for SMEs, startups and government agencies. Contact Mo to discuss your operations, priorities and the scope of an engagement.')],
    'corporate': [('Does Mo provide corporate AI training in Nigeria?', 'Yes. Motunrayo Akinsete provides practical AI workshops for businesses, institutions and government organisations in Nigeria, with virtual formats available for international audiences.'), ('What does corporate AI training cover?', 'Training is tailored to the team’s needs and can cover practical AI tools, automation and responsible AI adoption. Discuss your team’s existing skills and goals when making an enquiry.')],
    'training': [('Can I book a one-on-one AI session?', 'Yes. Mo offers focused one-on-one sessions for founders, researchers and professionals. Use the booking page to describe what you want to learn and your timeline.'), ('How much does AI training cost?', 'Pricing depends on the format and scope of the session. Contact Mo with your learning goals to discuss an appropriate engagement; fixed prices are not currently published on this website.')],
}
blocks = re.findall(r'(<div class="service-block".*?)(?=\n  <!-- (?:TRAIN|SPEAK) -->|\n  <div class="cta-banner">)', pages['services'], re.S)
footer = re.search(r'<footer.*?</footer>', pages['services'], re.S)[0]
for key, title, index in [('consulting', 'AI Consulting in Nigeria', 0), ('corporate', 'Corporate AI Training in Nigeria', 1), ('training', 'AI Training for Professionals in Nigeria', 1)]:
    block = blocks[index]
    if key == 'training':
        block = re.sub(r'<ul class="service-points">.*?</ul>', '<ul class="service-points"><li>Focused one-on-one sessions</li><li>For founders, researchers and professionals</li><li>Discuss your learning goals before booking</li></ul>', block, flags=re.S)
        block = re.sub(r'<p class="service-desc">.*?</p>', '<p class="service-desc">Book a focused one-on-one session with Mo to discuss your AI learning goals. Sessions are available for founders, researchers and professionals.</p>', block, flags=re.S)
    pages[key] = '<div class="page active"><section class="section navy"><p class="sec-eyebrow">Work with Mo</p><h1 class="sec-title on-dark">' + title + '</h1></section>' + block + faq(service_questions[key]) + footer + '</div>'

pages['home'] = pages['home'].replace('Motunrayo<br><span>Akinsete</span></h1>', 'Motunrayo<br><span>Akinsete</span><span style="display:block;font-family:var(--font-body);font-size:20px;line-height:1.5;color:var(--sky);margin-top:18px">AI Consultant, Trainer &amp; Researcher</span></h1>')
pages['home'] = pages['home'].replace('class="btn-primary">Book Mo</a>', 'class="btn-primary">Book an AI Strategy Call</a>', 1).replace('onclick="showPage(\'about\')" class="btn-secondary">Learn More', 'onclick="showPage(\'services\')" class="btn-secondary">Explore AI Training', 1)
answer = '<section class="section white"><p class="sec-eyebrow blue">About Mo</p><h2 class="sec-title" style="margin-bottom:24px">Who is Motunrayo Akinsete?</h2><p class="service-desc">Motunrayo Akinsete is an AI researcher, consultant and trainer based in Nigeria, and the founder of AI Accelerator Academy. A Google DeepMind Scholar, her work focuses on responsible AI, fairness in large language models and practical AI adoption. She works with businesses, government institutions and professionals on AI strategy, automation and training.</p><a href="/about/" class="btn-primary">Meet Mo</a></section>'
pages['home'] = pages['home'].replace('  <!-- OFFERINGS PREVIEW -->', answer + '\n  <!-- OFFERINGS PREVIEW -->')
pages['home'] = pages['home'].replace("onclick=\"showPage('services')\" class=\"offering-link\"", 'href="/ai-consulting-nigeria/" class="offering-link"', 1).replace('href="#" href=', 'href=')
pages['home'] = pages['home'].replace("href=\"#\" onclick=\"showPage('services')\" class=\"offering-link\"", 'href="/corporate-ai-training-nigeria/" class="offering-link"', 1)

service_links = '<section class="section cloud"><h2 class="sec-title">Explore AI services</h2><div class="hero-btns"><a class="btn-primary" href="/ai-consulting-nigeria/">AI Consulting</a><a class="btn-primary" href="/corporate-ai-training-nigeria/">Corporate AI Training</a><a class="btn-primary" href="/ai-training-nigeria/">One-on-one AI Training</a></div></section>'
pages['services'] = pages['services'].replace('  <!-- CONSULT -->', service_links + '\n  <!-- CONSULT -->')
pages['home'] = (ROOT / 'site/home.html').read_text()
pages['products'] = (ROOT / 'site/products.html').read_text()
products = json.loads((ROOT / 'site/products.json').read_text())
product_cards = ''.join('<a class="selected-card" href="' + escape(p['url'], quote=True) + '" data-reveal><img class="product-preview" src="' + escape(p['image'], quote=True) + '" alt="' + escape(p['imageAlt'], quote=True) + '" width="800" height="500" loading="lazy"><div class="selected-meta"><span>' + escape(p['category']) + '</span><span aria-hidden="true">↗</span></div><h3>' + escape(p['name']) + '</h3><p>' + escape(p['description']) + '</p><span class="product-view-link">View project <span aria-hidden="true">↗</span></span></a>' for p in products)
pages['home'] = pages['home'].replace('<!-- PRODUCT_SHOWCASE -->', '<div class="selected-grid product-showcase">' + product_cards + '</div>')
pages['products'] = pages['products'].replace('<!-- PRODUCT_SHOWCASE -->', '<section class="section cloud"><div class="section-heading"><div><p class="sec-eyebrow blue">Building Products</p><h2 class="sec-title">Ideas made useful.</h2></div></div><div class="selected-grid product-showcase">' + product_cards + '</div></section>')
pages['portfolio'] = pages['portfolio'].replace('<h3 class="portfolio-item-title">Make.com Workflow Systems', '<h3 class="portfolio-item-title" id="workflow-systems">Make.com Workflow Systems').replace('<h3 class="portfolio-item-title">Photography Prompt Library', '<h3 class="portfolio-item-title" id="prompt-library">Photography Prompt Library')

for key, (route, title, description) in routes.items():
    content = links(pages[key])
    if key == 'book':
        content = content.replace('Send a message</h2>', 'Start a conversation</h2>').replace('Fill in the form and Mo will be in touch within 48 hours with the right starting point.', 'Fill in your details to open an email draft. Send that email from your email app to reach Mo.').replace('Send Message →</button>', 'Open Email Draft →</button>')
        content = content.replace('<button class="form-submit"', '<p class="enquiry-status" role="status"></p><button type="button" class="form-submit"')
    content = re.sub(r'<div class="page(?: active)?"[^>]*>', '<main class="page active" id="main-content">', content, count=1)
    content = content.rsplit('</div>', 1)[0] + '</main>'
    # The source speaker kit points to a nonexistent local generation path.
    content = content.replace('href="/mnt/user-data/outputs/speaker-kit.pdf" class="btn-secondary" download>Download Speaker Kit', 'href="mailto:hello@motunrayoakinsete.com?subject=Speaker%20kit%20request" class="btn-secondary">Request Speaker Kit')
    page_nav = re.sub(r' class="active"', '', nav)
    page_nav = page_nav.replace('id="nav-' + key + '"', 'id="nav-' + key + '" aria-current="page"')
    graph = [person, website, {'@type': 'WebPage', '@id': BASE + route + '#webpage', 'url': BASE + route, 'name': title, 'description': description, 'about': {'@id': BASE + '/#person'}, 'isPartOf': {'@id': BASE + '/#website'}}]
    if key in service_questions:
        graph.append({'@type': 'Service', 'name': title.split('|')[0].strip(), 'url': BASE + route, 'provider': {'@id': BASE + '/#person'}, 'areaServed': {'@type': 'Country', 'name': 'Nigeria'}, 'description': description})
    html = '<!DOCTYPE html>\n<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">\n<title>' + escape(title) + '</title>\n<meta name="description" content="' + escape(description, quote=True) + '">\n<link rel="canonical" href="' + BASE + route + '">\n<meta property="og:type" content="website"><meta property="og:title" content="' + escape(title, quote=True) + '"><meta property="og:description" content="' + escape(description, quote=True) + '"><meta property="og:url" content="' + BASE + route + '">\n<meta name="twitter:card" content="summary">\n<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;1,400;1,500&family=DM+Sans:wght@300;400;500&display=swap" rel="stylesheet">\n<link rel="stylesheet" href="/assets/site.css">\n<script type="application/ld+json">' + json.dumps({'@context': 'https://schema.org', '@graph': graph}, ensure_ascii=False) + '</script>\n</head><body>' + page_nav + content + '<script src="/assets/site.js" defer></script></body></html>\n'
    path = ROOT / route.strip('/') / 'index.html' if route != '/' else ROOT / 'index.html'
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(html)

(ROOT / 'robots.txt').write_text('User-agent: *\nAllow: /\nDisallow: /site/\nDisallow: /scripts/\nSitemap: ' + BASE + '/sitemap.xml\n')
(ROOT / 'sitemap.xml').write_text('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + ''.join('  <url><loc>' + BASE + route + '</loc></url>\n' for route, _, _ in routes.values()) + '</urlset>\n')
print('Built', len(routes), 'static pages with shared assets and sitemap.')
