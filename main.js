// main.js  — one file drives the whole single-page site
document.addEventListener('DOMContentLoaded', () => {
  //-----------------------------------------------------------------
  // 0.  Handy references
  //-----------------------------------------------------------------
  const nav   = document.querySelector('.nav-menu');     // top nav bar
  const title = document.getElementById('menu-title');   // big heading
  const box   = document.querySelector('.content-box');  // injection pane
  const cache = new Map();                               // HTML fragment cache
  let   active = null;                                   // last selected menu link

  //-----------------------------------------------------------------
  // 1.  Generic loader (used by BOTH menus and lab tiles)
  //-----------------------------------------------------------------
  async function fetchFragment(url) {
    if (!cache.has(url)) {                               // simple memo-cache
      const res = await fetch(url);                      // Fetch returns a promise  :contentReference[oaicite:0]{index=0}
      cache.set(url, await res.text());
    }
    box.innerHTML = cache.get(url);
    box.scrollTop = 0;                                   // reset scroll position
  }

  //-----------------------------------------------------------------
  // 2.  Helpers for the *top* nav menu
  //-----------------------------------------------------------------
  const fileFor = id => `content/${id}.html`;            // e.g. “about” → content/about.html

  function showMenu(link) {
    const id = link.getAttribute('href').slice(1);       // “#about” → “about”
    title.textContent = link.querySelector('span').textContent.trim();
    fetchFragment(fileFor(id)).catch(console.error);
  }

  //-----------------------------------------------------------------
  // 3.  Delegated listeners — TOP NAV
  //-----------------------------------------------------------------
  nav.addEventListener('mouseover', e => {
    const link = e.target.closest('.menu-item');
    if (link) showMenu(link);
  });

  nav.addEventListener('mouseout', e => {
    const leaving = e.target.closest('.menu-item');
    if (!leaving || leaving.contains(e.relatedTarget)) return;
    if (active) showMenu(active);                        // restore highlight
  });

  nav.addEventListener('click', e => {
    const link = e.target.closest('.menu-item');
    if (!link) return;
    e.preventDefault();                                  // stay on page  :contentReference[oaicite:1]{index=1}
    active?.classList.remove('selected');
    (active = link).classList.add('selected');
    showMenu(active);
  });

  //-----------------------------------------------------------------
  // 4.  NEW  —  Delegated clicks inside .content-box (Home-Lab tiles)
  //-----------------------------------------------------------------
  box.addEventListener('click', e => {
    const link = e.target.closest('a');
    if (!link) return;                                   // not a link → ignore

    // Intercept only Lab links: either parent .homelabs or URL starts with “labs/”
    const url = link.getAttribute('href');
    if (link.closest('.homelabs') || url?.startsWith('labs/')) {
      e.preventDefault();                                // hijack navigation  :contentReference[oaicite:2]{index=2}
      const friendly =
            link.dataset.title ||                        // <a data-title="…">
            link.querySelector('h6')?.textContent ||     // fallback to inner h6
            url;

      title.textContent = friendly.trim();
      fetchFragment(url).catch(console.error);

      // Push into browser history so Back/Forward work  :contentReference[oaicite:3]{index=3}
      history.pushState({url, friendly}, '', `#${url}`);
    }
  });

  //-----------------------------------------------------------------
  // 5.  Browser Back/Forward support
  //-----------------------------------------------------------------
  window.addEventListener('popstate', e => {             // fires on back/forward  :contentReference[oaicite:4]{index=4}
    if (e.state?.url) {
      fetchFragment(e.state.url).catch(console.error);
      title.textContent = e.state.friendly || '';
    }
  });

  //-----------------------------------------------------------------
  // 6.  First paint — default to “Home Labs”
  //-----------------------------------------------------------------
  active = document.querySelector('.menu-item[href="#about"]');
  if (active) {
    active.classList.add('selected');
    showMenu(active);
  }
});
