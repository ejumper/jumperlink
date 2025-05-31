// main.js  (no animations, full delegation)
document.addEventListener('DOMContentLoaded', () => {
  const nav     = document.querySelector('.nav-menu');     // menu container
  const title   = document.getElementById('menu-title');   // big heading
  const box     = document.querySelector('.content-box');  // content target
  const cache   = new Map();                               // fragment cache
  let active    = null;                                    // last clicked link

  // --- utility ------------------------------------------------------------
  const fileFor = id => `content/${id}.html`;               // id → URL

  async function load(id) {
    const url = fileFor(id);
    if (!cache.has(url)) {
      const res = await fetch(url);                         // Fetch API is promise-based :contentReference[oaicite:5]{index=5}
      cache.set(url, await res.text());
    }
    box.innerHTML = cache.get(url);
  }

  function show(link) {
    const id = link.getAttribute('href').slice(1);          // '#about' → 'about'
    title.textContent = link.querySelector('span').textContent.trim();
    load(id).catch(console.error);
  }

  // --- event delegation ---------------------------------------------------
  nav.addEventListener('mouseover', e => {                  // use mouseover for perf :contentReference[oaicite:6]{index=6}
    const link = e.target.closest('.menu-item');
    if (link) show(link);
  });

  nav.addEventListener('mouseout', e => {
    const leaving = e.target.closest('.menu-item');
    if (!leaving || leaving.contains(e.relatedTarget)) return; // still inside link
    if (active) show(active);          // restore last selection
  });

  nav.addEventListener('click', e => {
    const link = e.target.closest('.menu-item');
    if (!link) return;
    e.preventDefault();                // stay on page
    if (active) active.classList.remove('selected');
    active = link;
    active.classList.add('selected');
    show(active);                      // lock in choice
  });

  // --- default selection --------------------------------------------------
  active = document.querySelector('.menu-item[href="#about"]');
  if (active) {
    active.classList.add('selected');
    show(active);                      // load About Me on first paint
  }
});
