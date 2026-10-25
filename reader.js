// In-app reader: full Wikipedia articles and whole Bible chapters, read inside the app.
// Links inside an article open in the same reader (with Back); Done returns you to where you were.
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const stack = [];
let dlg, body, titleEl, backBtn, extEl;

function ensure() {
  if (dlg) return;
  dlg = document.createElement('dialog');
  dlg.id = 'reader';
  dlg.className = 'reader';
  dlg.innerHTML = `<div class="sheet reader-sheet">
    <div class="reader-bar">
      <button class="icon-btn r-back" aria-label="Back">‹</button>
      <div class="r-title"></div>
      <button class="r-done">Done</button>
    </div>
    <div class="reader-body"></div>
    <div class="reader-ext"></div>
  </div>`;
  document.body.appendChild(dlg);
  body = dlg.querySelector('.reader-body');
  titleEl = dlg.querySelector('.r-title');
  backBtn = dlg.querySelector('.r-back');
  extEl = dlg.querySelector('.reader-ext');
  dlg.querySelector('.r-done').addEventListener('click', () => close());
  backBtn.addEventListener('click', () => { stack.pop(); const prev = stack.pop(); if (prev) show(prev); else close(); });
  dlg.addEventListener('cancel', e => { e.preventDefault(); close(); });
  body.addEventListener('click', e => {
    const a = e.target.closest('a'); if (!a) return;
    const wiki = a.dataset.wiki;
    if (wiki) { e.preventDefault(); show({ kind: 'wiki', title: wiki }); }
  });
}
function close() { stack.length = 0; dlg.close(); body.innerHTML = ''; }

export function openWiki(title) { ensure(); stack.length = 0; show({ kind: 'wiki', title }); }
export function openBible(ref) { ensure(); stack.length = 0; show({ kind: 'bible', ref }); }

async function show(item) {
  stack.push(item);
  backBtn.style.visibility = stack.length > 1 ? 'visible' : 'hidden';
  if (!dlg.open) dlg.showModal();
  body.innerHTML = '<p class="muted r-loading">Loading…</p>';
  body.scrollTop = 0; dlg.querySelector('.reader-sheet').scrollTop = 0;
  if (item.kind === 'wiki') return showWiki(item.title);
  return showBible(item.ref);
}

// ---------- Wikipedia ----------
const DROP = 'script,style,link,meta,iframe,object,embed,form,input,button,noscript,.mw-editsection,.navbox,.vertical-navbox,.metadata,.noprint,.mw-empty-elt,.hatnote,.ambox,.sistersitebox,.mw-references-wrap,sup.reference,.reflist,.portalbox,.authority-control,.side-box,.mbox-small,.shortdescription';
async function showWiki(title) {
  const t = title.replace(/ /g, '_');
  titleEl.textContent = title.replace(/_/g, ' ');
  extEl.innerHTML = `<a href="https://en.wikipedia.org/wiki/${encodeURIComponent(t)}" target="_blank" rel="noopener">Open in Wikipedia</a>
    <a href="https://grokipedia.com/page/${encodeURIComponent(t)}" target="_blank" rel="noopener">Grokipedia</a>`;
  try {
    const r = await fetch(`https://en.wikipedia.org/api/rest_v1/page/html/${encodeURIComponent(t)}?redirect=true`);
    if (!r.ok) throw new Error(r.status);
    const doc = new DOMParser().parseFromString(await r.text(), 'text/html');
    doc.querySelectorAll(DROP).forEach(n => n.remove());
    // Cut the trailing reference/link sections
    doc.querySelectorAll('section').forEach(s => {
      const h = s.querySelector(':scope > h2')?.textContent?.trim().toLowerCase();
      if (h && /^(references|notes|citations|sources|further reading|external links|bibliography|footnotes)$/.test(h)) s.remove();
    });
    // Clean every element: no event handlers or inline styles; safe links and images only
    doc.body.querySelectorAll('*').forEach(el => {
      for (const at of [...el.attributes]) {
        const n = at.name;
        if (n.startsWith('on') || n === 'style' || n === 'id' || (n === 'class' && !/infobox|wikitable|thumb|gallery/.test(at.value))) el.removeAttribute(n);
      }
      if (el.tagName === 'A') {
        const href = el.getAttribute('href') || '';
        const m = /^\.\/([^#?]+)/.exec(href);
        if (m && !/^(File|Special|Help|Category|Template|Wikipedia|Portal|Talk):/.test(decodeURIComponent(m[1]))) { el.setAttribute('href', '#'); el.dataset.wiki = decodeURIComponent(m[1]); }
        else if (/^https:\/\//.test(href)) { el.setAttribute('target', '_blank'); el.setAttribute('rel', 'noopener'); }
        else { el.replaceWith(...el.childNodes); }
      }
      if (el.tagName === 'IMG') {
        let src = el.getAttribute('src') || '';
        if (src.startsWith('//')) src = 'https:' + src;
        if (!/^https:\/\/upload\.wikimedia\.org\//.test(src)) { el.remove(); return; }
        el.setAttribute('src', src); el.removeAttribute('srcset'); el.setAttribute('loading', 'lazy');
      }
    });
    const heading = doc.querySelector('title')?.textContent || title.replace(/_/g, ' ');
    titleEl.textContent = heading;
    body.innerHTML = `<h1 class="r-h1">${esc(heading)}</h1><div class="r-wiki">${doc.body.innerHTML}</div>
      <p class="muted small r-note">From Wikipedia, the free encyclopedia (CC BY-SA). Dates there follow standard (secular) dating.</p>`;
  } catch {
    body.innerHTML = `<p>Couldn't load this article. Check your connection, or open it in Wikipedia below.</p>`;
  }
}

// ---------- Bible (KJV) ----------
const BOOKS = { gen: 'Genesis', exod: 'Exodus', exo: 'Exodus', lev: 'Leviticus', num: 'Numbers', deut: 'Deuteronomy', deu: 'Deuteronomy', josh: 'Joshua', judg: 'Judges', sam: 'Samuel', kgs: 'Kings', chron: 'Chronicles', chr: 'Chronicles', neh: 'Nehemiah', esth: 'Esther', ps: 'Psalms', psa: 'Psalms', prov: 'Proverbs', eccl: 'Ecclesiastes', isa: 'Isaiah', jer: 'Jeremiah', lam: 'Lamentations', ezek: 'Ezekiel', eze: 'Ezekiel', dan: 'Daniel', hos: 'Hosea', obad: 'Obadiah', mic: 'Micah', nah: 'Nahum', hab: 'Habakkuk', zeph: 'Zephaniah', hag: 'Haggai', zech: 'Zechariah', mal: 'Malachi', matt: 'Matthew', mat: 'Matthew', mk: 'Mark', lk: 'Luke', jn: 'John', rom: 'Romans', cor: 'Corinthians', gal: 'Galatians', eph: 'Ephesians', phil: 'Philippians', col: 'Colossians', thess: 'Thessalonians', tim: 'Timothy', heb: 'Hebrews', pet: 'Peter', rev: 'Revelation' };
function normRef(ref) {
  return ref.replace(/^\s*([1-3]?)\s*([A-Za-z]+)\.?/, (m, n, b) => `${n ? n + ' ' : ''}${BOOKS[b.toLowerCase()] || b}`).replace(/\s+/g, ' ').trim();
}
async function showBible(ref) {
  ref = normRef(ref);
  const chap = /^(\d?\s?[A-Za-z]+\.?\s+\d+)/.exec(ref)?.[1] || ref;
  const m = /:(\d+)(?:-(\d+))?/.exec(ref);
  const hi = m ? [+m[1], +(m[2] || m[1])] : null;
  titleEl.textContent = chap;
  extEl.innerHTML = `<a href="https://www.biblegateway.com/passage/?search=${encodeURIComponent(chap)}&version=KJV" target="_blank" rel="noopener">Open in Bible Gateway</a>`;
  try {
    const r = await fetch(`https://bible-api.com/${encodeURIComponent(chap)}?translation=kjv`);
    if (!r.ok) throw new Error(r.status);
    const j = await r.json();
    const verses = (j.verses || []).map(v => `<p class="r-v${hi && v.verse >= hi[0] && v.verse <= hi[1] ? ' hi' : ''}" id="rv${v.verse}"><sup>${v.verse}</sup>${esc(v.text.trim())}</p>`).join('');
    body.innerHTML = `<h1 class="r-h1">${esc(j.reference || chap)}</h1><div class="r-bible">${verses}</div><p class="muted small r-note">King James Version.</p>`;
    if (hi) requestAnimationFrame(() => { const el = body.querySelector('#rv' + hi[0]); el?.scrollIntoView({ block: 'center' }); });
  } catch {
    body.innerHTML = `<p>Couldn't load ${esc(chap)}. Check your connection, or open it in Bible Gateway below.</p>`;
  }
}
