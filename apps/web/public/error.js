// Minimal shared behaviour for the static error pages (403/404/500).
// These documents can be served at any URL depth (Pages answers unmatched
// routes with 404.html while keeping the address bar), so they use
// root-absolute asset paths and deliberately skip the full site script.js,
// whose navigation rewriting assumes a root-level page. The mobile drawer
// behaviour from script.js is ported here so the navbar/sidebar work the
// same as on the rest of the site.
(() => {
  const year = document.getElementById('copyrightYear');
  if (year) year.textContent = String(new Date().getFullYear());

  const sidebar = document.getElementById('sidebar');
  const hamburger = document.querySelector('.hamburger');
  if (!sidebar || !hamburger) return;

  const desktopQuery = typeof window.matchMedia === 'function'
    ? window.matchMedia('(min-width: 901px)')
    : { matches: false, addEventListener() { }, addListener() { } };

  sidebar.setAttribute('aria-label', 'Mobile navigation');
  sidebar.setAttribute('aria-hidden', 'true');
  sidebar.inert = true;

  if (!document.querySelector('.sidebar-close')) {
    const closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.className = 'sidebar-close';
    closeButton.setAttribute('aria-label', 'Close navigation menu');
    closeButton.innerHTML = '<i class="fas fa-times" aria-hidden="true"></i>';
    // The close chip shares the top lane with the brand mark, theme toggle
    // and "Explore Sholynk" heading.
    const brandRow = sidebar.querySelector('.sidebar-brand');
    if (brandRow) brandRow.appendChild(closeButton);
    else sidebar.prepend(closeButton);
  }

  let backdrop = document.querySelector('.sidebar-backdrop');
  if (!backdrop) {
    backdrop = document.createElement('button');
    backdrop.type = 'button';
    backdrop.className = 'sidebar-backdrop';
    backdrop.setAttribute('aria-label', 'Close navigation menu');
    document.body.append(backdrop);
  }

  hamburger.setAttribute('aria-label', 'Open navigation menu');
  hamburger.setAttribute('aria-controls', 'sidebar');
  hamburger.setAttribute('aria-expanded', 'false');

  const focusableSelector = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

  const openSidebar = () => {
    if (desktopQuery.matches) return;
    sidebar.inert = false;
    sidebar.classList.add('active');
    backdrop.classList.add('is-visible');
    document.body.classList.add('sidebar-open');
    sidebar.setAttribute('aria-hidden', 'false');
    hamburger.setAttribute('aria-expanded', 'true');
    sidebar.querySelector(focusableSelector)?.focus({ preventScroll: true });
  };

  const closeSidebar = () => {
    if (sidebar.contains(document.activeElement)) {
      document.activeElement.blur();
    }
    sidebar.inert = true;
    sidebar.classList.remove('active');
    backdrop.classList.remove('is-visible');
    document.body.classList.remove('sidebar-open');
    sidebar.setAttribute('aria-hidden', 'true');
    hamburger.setAttribute('aria-expanded', 'false');
  };

  const toggleSidebar = () => {
    if (sidebar.classList.contains('active')) closeSidebar();
    else openSidebar();
  };

  const handleDesktopChange = (event) => {
    if (event.matches) closeSidebar();
  };
  if (typeof desktopQuery.addEventListener === 'function') {
    desktopQuery.addEventListener('change', handleDesktopChange);
  } else {
    desktopQuery.addListener(handleDesktopChange);
  }

  hamburger.addEventListener('click', toggleSidebar);
  hamburger.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      toggleSidebar();
    }
  });

  sidebar.querySelector('.sidebar-close')?.addEventListener('click', closeSidebar);
  backdrop.addEventListener('click', closeSidebar);

  sidebar.addEventListener('click', (event) => {
    if (event.target.closest('a')) closeSidebar();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && sidebar.classList.contains('active')) {
      closeSidebar();
      hamburger.focus({ preventScroll: true });
    }
  });
})();
