// main.js  — v2: suppress menu hover while a lab article is open
document.addEventListener('DOMContentLoaded', () => {

  // --------------------------------------------------------------
  // 0.   cash registers (unchanged) + new "labView" flag
  // --------------------------------------------------------------
  const nav   = document.querySelector('.nav-menu');
  const title = document.getElementById('menu-title');
  const box   = document.querySelector('.content-box');
  const cache = new Map();
  let   active  = null;
  let   labView = false;                      // NEW

  // --------------------------------------------------------------
  // 1.   utilities
  // --------------------------------------------------------------
  const fileFor = id => `content/${id}.html`;
  const isLab   = url => url?.startsWith('labs/');        // NEW helper

  async function fetchFragment(url){
    if (!cache.has(url)){
      const res = await fetch(url);                       // Fetch API :contentReference[oaicite:0]{index=0}
      cache.set(url, await res.text());
    }
    box.innerHTML = cache.get(url);
    box.scrollTop = 0;
  }

  // --------------------------------------------------------------
  // 2.   menu logic (unchanged except labView reset)
  // --------------------------------------------------------------
  function showMenu(link){
    const id = link.getAttribute('href').slice(1);
    title.textContent = link.querySelector('span').textContent.trim();
    fetchFragment(fileFor(id)).catch(console.error);
    labView = false;                                     // leave lab mode
  }

  // --- delegated hover ----------------------------------------------------
  nav.addEventListener('mouseover', e => {
    if (labView) return;                                 // suppress preview
    const link = e.target.closest('.menu-item');
    if (link) showMenu(link);
  });

  nav.addEventListener('mouseout', e => {
    if (labView) return;                                 // nothing to restore
    const leaving = e.target.closest('.menu-item');
    if (!leaving || leaving.contains(e.relatedTarget)) return;
    if (active) showMenu(active);
  });

  // --- clicks -------------------------------------------------------------
  nav.addEventListener('click', e => {
    const link = e.target.closest('.menu-item');
    if (!link) return;
    e.preventDefault();                                  // stay on SPA :contentReference[oaicite:1]{index=1}
    active?.classList.remove('selected');
    (active = link).classList.add('selected');
    showMenu(active);                                    // resets labView
    history.pushState({url:fileFor(active.getAttribute('href').slice(1)),
                       friendly:title.textContent}, '', active.getAttribute('href'));
  });

  // --------------------------------------------------------------
  // 3.   clicks inside .content-box  (lab tiles)
  // --------------------------------------------------------------
  box.addEventListener('click', e => {
    const link = e.target.closest('a');
    if (!link) return;

    const url = link.getAttribute('href');
    if (link.closest('.homelabs') || isLab(url)){        // open article
      e.preventDefault();
      const friendly = link.dataset.title
                    || link.querySelector('h6')?.textContent
                    || url;

      title.textContent = friendly.trim();
      fetchFragment(url).catch(console.error);
      history.pushState({url, friendly}, '', `#${url}`); // History API :contentReference[oaicite:2]{index=2}
      labView = true;                                    // ENTER lab mode
    }
  });

  // --------------------------------------------------------------
  // 4.   back/forward buttons
  // --------------------------------------------------------------
  window.addEventListener('popstate', e => {
    if (e.state?.url){
      fetchFragment(e.state.url).catch(console.error);
      title.textContent = e.state.friendly || '';
      labView = isLab(e.state.url);                      // update flag
    }
  });

  // --------------------------------------------------------------
  // 5.   default selection
  // --------------------------------------------------------------
  active = document.querySelector('.menu-item[href="#about"]');
  if (active){
    active.classList.add('selected');
    showMenu(active);
  }

// ───────────────────────────────────────────────────────────────
// 3.1  Grab references
// ───────────────────────────────────────────────────────────────
const mailBtn   = document.getElementById('mail-btn');
const phoneBtn  = document.getElementById('phone-btn');
const mailDlg   = document.getElementById('mail-dialog');
const phoneDlg  = document.getElementById('phone-dialog');

// ADA: first focusable element inside each dialog
const mailFirst = document.getElementById('open-mail');
const phoneFirst= document.getElementById('call-phone');

// ───────────────────────────────────────────────────────────────
// 3.2  Helper to open / close
// ───────────────────────────────────────────────────────────────
function openDialog(dlg, firstFocusable){
  if (typeof dlg.showModal === 'function') dlg.showModal();
  else dlg.classList.remove('hidden');          // fallback

  firstFocusable.focus();                       // send focus inside
  document.addEventListener('keydown', escClose);
}

function closeDialog(dlg){
  if (typeof dlg.close === 'function') dlg.close();
  else dlg.classList.add('hidden');
  document.removeEventListener('keydown', escClose);
}

function escClose(e){
  if (e.key === 'Escape'){
    [mailDlg, phoneDlg].forEach(d=>d.open && closeDialog(d));
  }
}

// ───────────────────────────────────────────────────────────────
// 3.3  Wire icon clicks
// ───────────────────────────────────────────────────────────────
mailBtn.addEventListener('click', () => openDialog(mailDlg, mailFirst));
phoneBtn.addEventListener('click',()=> openDialog(phoneDlg, phoneFirst));

// ───────────────────────────────────────────────────────────────
// 3.4  Action buttons inside dialogs
// ───────────────────────────────────────────────────────────────
document.getElementById('open-mail')
        .addEventListener('click', () => window.location.href = 'mailto:eric@jumperlink.net');

document.getElementById('call-phone')
        .addEventListener('click', () => window.location.href = 'tel:+18179657116');

document.getElementById('sms-phone')
        .addEventListener('click', () => window.location.href = 'sms:+18179657116');  // :contentReference[oaicite:8]{index=8}

// Close-buttons (×) and backdrop clicks
document.querySelectorAll('.modal-close').forEach(btn=>{
  btn.addEventListener('click', e => closeDialog(e.target.closest('.modal')));
});
[mailDlg, phoneDlg].forEach(dlg=>{
  dlg.addEventListener('click', e=>{
    if (e.target === dlg) closeDialog(dlg);     // click on backdrop
  });
});
  
});
