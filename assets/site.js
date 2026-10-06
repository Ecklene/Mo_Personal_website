function filterPortfolio(cat, btn) {
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.querySelectorAll('.portfolio-item').forEach(item => {
    if (cat === 'all' || item.dataset.cat === cat) {
      item.style.display = 'block';
    } else {
      item.style.display = 'none';
    }
  });
}



const navigationToggle = document.querySelector('.nav-toggle');
const navigation = document.querySelector('.nav-links');
if (navigationToggle && navigation) {
  const closeNavigation = () => {
    navigationToggle.setAttribute('aria-expanded', 'false');
    navigationToggle.setAttribute('aria-label', 'Open navigation');
    navigation.classList.remove('is-open');
  };
  navigationToggle.addEventListener('click', () => {
    const open = navigationToggle.getAttribute('aria-expanded') !== 'true';
    navigationToggle.setAttribute('aria-expanded', String(open));
    navigationToggle.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
    navigation.classList.toggle('is-open', open);
  });
  navigation.addEventListener('click', event => {
    if (event.target.closest('a')) closeNavigation();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && navigationToggle.getAttribute('aria-expanded') === 'true') {
      closeNavigation();
      navigationToggle.focus();
    }
  });
  document.addEventListener('click', event => {
    if (!event.target.closest('#main-nav')) closeNavigation();
  });
  window.matchMedia('(min-width: 1101px)').addEventListener('change', closeNavigation);
}

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
if ('IntersectionObserver' in window && !reducedMotion.matches) {
  const reveals = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        reveals.unobserve(entry.target);
      }
    });
  }, { threshold: 0.08 });
  document.querySelectorAll('[data-reveal]').forEach(element => {
    element.classList.add('reveal-ready');
    reveals.observe(element);
  });
  reducedMotion.addEventListener('change', event => {
    if (event.matches) {
      reveals.disconnect();
      document.querySelectorAll('.reveal-ready').forEach(element => element.classList.add('is-visible'));
    }
  });
}

const enquiryFields = document.querySelectorAll('.book-right input, .book-right select, .book-right textarea');
enquiryFields.forEach((field, index) => {
  field.id = 'enquiry-field-' + index;
  const label = field.closest('.form-group')?.querySelector('label');
  if (label) label.htmlFor = field.id;
  if ([0, 2, 4, 5].includes(index)) field.required = true;
});
function handleSubmit() {
  if (!enquiryFields.length) return;
  for (const field of enquiryFields) {
    if (!field.reportValidity()) return;
  }
  const values = Array.from(enquiryFields, field => field.value.trim());
  const subject = values[4] || 'Website enquiry';
  const body = `Name: ${values[0]} ${values[1]}\nEmail: ${values[2]}\nOrganisation: ${values[3]}\nEnquiry: ${values[4]}\n\n${values[5]}\n\nHow I found Mo: ${values[6]}`;
  window.location.href = 'mailto:hello@motunrayoakinsete.com?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
  document.querySelector('.enquiry-status').textContent = 'Your email draft is ready to open. Please send it from your email app. If nothing opens, email hello@motunrayoakinsete.com directly.';
}
