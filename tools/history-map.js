// History map: seven thousand years on one sheet.
// Seven equal "days" (millennia) form the spine. Each kind of history gets its own band (lane);
// prophecy is drawn as bundled ribbons from who foretold it to the era it was fulfilled, numbered
// and keyed to an index in which every prophecy has its own line and waiting bar.
// Output is plain SVG that both browsers and svg2pdf/jsPDF render the same way: no markers,
// patterns, halos or letter-spacing; arrows and circles are drawn as shapes.
//
// buildMap({ D, events, prophecies, cats, width, height, measure, now }) → { svg, width, height, indexPt, labelPt, counts }
//   D          the calendar engine (engine/dss.js), already initialised
//   events     [{ t, j, k }]  k = biblical | scrolls | church | secular | mine
//   prophecies prophecy records from data/prophecies.json (empty array to leave prophecy off)
//   cats       which event lanes to draw (array of k)
//   width, height  page size in points
//   measure(text, cssFont) → width in px for that font (canvas measureText)

const C = {
  paper: '#FAF7F0', ink: '#1B2427', body: '#34403F', muted: '#5C6A6E', faint: '#A3ADAF', rule: '#4E5D61', title: '#0F4C5A',
  messiah: '#B7862C', israel: '#1B6577', nations: '#8A5A3C', church: '#7B4F8E', future: '#3B4FA0',
};
const LANE = {
  biblical: { name: 'Bible', short: 'BIBLE', color: '#9A6B12' }, scrolls: { name: 'Dead Sea Scrolls & Essenes', short: 'SCROLLS', color: '#5E7F3A' },
  church: { name: 'Church', short: 'CHURCH', color: '#7B4F8E' }, secular: { name: 'World', short: 'WORLD', color: '#1B6577' }, mine: { name: 'Yours', short: 'YOURS', color: '#B4533A' },
};
const THEMES = [['messiah', "Messiah's first coming"], ['israel', 'Israel'], ['nations', 'The nations'], ['church', 'The church'], ['future', 'Yet future']];
const DAYBG = ['#F1E9D6', '#E9EFE6', '#E4EDEE', '#EFE7DC', '#ECE5EE', '#E6EAF1', '#F3ECD3'];
const DAYN = ['First day', 'Second day', 'Third day', 'Fourth day', 'Fifth day', 'Sixth day', 'Seventh day · the Sabbath millennium'];
const SRC_COLOR = { Genesis: '#8A5A3C', Moses: '#A0522D', 'Kings & prophets': '#9C6B4E', Psalms: '#B7862C', Isaiah: '#1B6577', Jeremiah: '#3B7F8F',
  Ezekiel: '#2F5E6B', Daniel: '#7B4F8E', Zechariah: '#5E7F3A', 'Minor prophets': '#6E8B3D', Jesus: '#B4533A', Apostles: '#C27A4A', Revelation: '#3B4FA0', 'Enoch, Esdras & scrolls': '#4E5D61' };
const ERAS = [[0, 2449, 'the patriarchs'], [2449, 2880, 'the Exodus & Judges'], [2880, 3010, 'the united kingdom'], [3010, 3338, 'the divided kingdom'],
  [3338, 3600, 'the exile & Persia'], [3600, 3900, 'Greece & Rome'], [3900, 3963, "the Messiah's first coming"], [3963, 4100, 'the apostles & AD 70'],
  [4100, 5800, 'the church age & empires'], [5800, 5951, 'Israel reborn'], [5951, 99999, 'yet future']];
// Yet-future prophecies are placed schematically by Johnson's section, after Today.
const FUT = { 'After 2008': 5956, 'The Birth Pangs': 5958, 'The Invasion of Israel': 5964, "The Antichrist's rise to power": 5965, 'The Person of the Antichrist': 5966,
  "The Antichrist's identifying characteristics": 5966, 'The wars of the Antichrist': 5968, 'First half of the Tribulation': 5970, 'The Religion of the Antichrist': 5971,
  'The Abomination of Desolation': 5973, 'Antichrist rules supreme': 5974, 'The Persecution': 5975, 'Second half of the Tribulation': 5976, 'The Wrath': 5977,
  "The Antichrist's Destruction": 5978, 'The Second Coming': 5979, 'The Millennium': 6400 };

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const f1 = n => (+n).toFixed(1);
const SANS = 'Alegreya Sans', SERIF = 'Alegreya';

function sourceOf(p) {
  const m = /^\s*([1-3]?\s?[A-Za-z]+)/.exec(p.ref || ''); const b = (m ? m[1] : '').toLowerCase().replace(/\s/g, '');
  if (/^gen/.test(b)) return 'Genesis';
  if (/^(exo|ex|lev|num|deu|dt|jos)/.test(b)) return 'Moses';
  if (/^([12]sa|[12]ki|[12]ch|jdg|judg|ruth|neh|ezra|esth)/.test(b)) return 'Kings & prophets';
  if (/^ps/.test(b)) return 'Psalms';
  if (/^isa/.test(b)) return 'Isaiah';
  if (/^(jer|lam)/.test(b)) return 'Jeremiah';
  if (/^eze/.test(b)) return 'Ezekiel';
  if (/^dan/.test(b)) return 'Daniel';
  if (/^zec/.test(b)) return 'Zechariah';
  if (/^(hos|joel|amos|oba|jon|mic|nah|hab|zep|hag|mal)/.test(b)) return 'Minor prophets';
  if (/^(mat|mar|mk|luk|lk|joh|jn)/.test(b) && !/^[123]joh/.test(b)) return 'Jesus';
  if (/^(act|rom|[12]co|gal|eph|phi|col|[12]th|[12]ti|tit|heb|jam|jas|[12]pe|[123]jo|jude)/.test(b)) return 'Apostles';
  if (/^rev/.test(b)) return 'Revelation';
  return 'Enoch, Esdras & scrolls';
}
function themeOf(p) {
  if (p.st === 'future' || !p.f) return 'future';
  if (/^age-/.test(p.id)) return 'church';
  const a = p.f.am;
  if (a >= 3900 && a < 3963) return 'messiah';
  if (a >= 3963 && /church|Papal|Rome|Christian|gospel|apostle|Paul|Peter|James|disciples|believ/i.test(p.t)) return 'church';
  if (/Israel|Jew|Judah|Jerusalem|Temple|Zion|Hebrew|shekel|Negev|land|Messiah/i.test(p.t)) return 'israel';
  return 'nations';
}
const eraOf = am => ERAS.find(([a, b]) => am >= a && am < b)[2];
const shortLbl = (l, am, D) => { if (!l) { const y = Math.floor(am) - D.EPOCH_OFFSET; return y <= 0 ? `${1 - y} BC` : `AD ${y}`; } let s = l.replace(/\s*\([^)]*\)?/g, '').split(';')[0].replace(/\s+/g, ' ').trim(); if (/^(night|Thu|Sun|Fri|\d+ [A-Z][a-z]+)/.test(s)) { const y = Math.floor(am) - D.EPOCH_OFFSET; s = y <= 0 ? `${1 - y} BC` : `AD ${y}`; } return s.replace(/^curses to /, ''); };
const cleanTitle = t => t.replace(/\s*\((?:[1-3]?\s?[A-Z][a-z]+\.?\s+\d+[^)]*|[^)]*\d+:\d+[^)]*)\)\s*$/, '').replace(/\s+/g, ' ').trim();
const cleanRef = r => (r || '').replace(/\s*\((?:the book|see|in 4QMMT|on |cf\.|Esdras)[^)]*\)/g, '').replace(/\s+/g, ' ').trim();
const dssShort = s => (s || '').split(/[;,]/)[0].replace(/\s*\(.*$/, '').trim();

export function buildMap({ D, events = [], prophecies = [], cats = ['biblical', 'scrolls', 'church', 'secular'], width = 4320, height = 1440, measure, now = 5951, title } = {}) {
  const K = Math.min(width / 4320, height / 1440);       // design scale vs the 60 × 20 in layout
  const W = width / K, H = height / K, M = 44;
  const left = M + 96, right = W - M, span = right - left, dayW = span / 7;
  const PROPH = prophecies.length > 0;
  const fontCss = (fs, { b, it, ff } = {}) => `${it ? 'italic ' : ''}${b ? '700' : '400'} ${fs}px "${ff || SANS}"`;
  const tw = (s, fs, o) => measure(String(s), fontCss(fs, o));
  let svg = '';
  const T = (x, y, s, o = {}) => `<text x="${f1(x)}" y="${f1(y)}" font-family="${o.ff || SANS}" font-size="${f1(o.fs || 12)}"${o.b ? ' font-weight="bold"' : ''}${o.it ? ' font-style="italic"' : ''} fill="${o.fill || C.ink}"${o.a ? ` text-anchor="${o.a}"` : ''}${o.op ? ` opacity="${o.op}"` : ''}>${esc(s)}</text>`;
  // text on a paper-coloured backing, so it stays legible over lines
  const TB = (x, y, s, o = {}) => { const fs = o.fs || 12, w = tw(s, fs, o); const x0 = o.a === 'middle' ? x - w / 2 : o.a === 'end' ? x - w : x; return `<rect x="${f1(x0 - 2)}" y="${f1(y - fs * 0.82)}" width="${f1(w + 4)}" height="${f1(fs * 1.08)}" rx="2" fill="${o.bg || C.paper}" opacity="0.92"/>` + T(x, y, s, o); };
  const arrowW = fs => fs * 1.05;
  const arrow = (x, y, fs, color) => { const w = arrowW(fs), yy = y - fs * 0.32; return `<path d="M${f1(x + fs * 0.12)},${f1(yy)} L${f1(x + w - fs * 0.22)},${f1(yy)}" stroke="${color}" stroke-width="${f1(fs * 0.07)}"/><path d="M${f1(x + w - fs * 0.42)},${f1(yy - fs * 0.2)} L${f1(x + w - fs * 0.1)},${f1(yy)} L${f1(x + w - fs * 0.42)},${f1(yy + fs * 0.2)} Z" fill="${color}"/>`; };
  // "a → b" with a drawn arrow; returns [svg, width]
  const pair = (x, y, a, b, o = {}) => {
    const fs = o.fs || 12, wa = tw(a, fs, o), wb = tw(b, fs, o), w = wa + arrowW(fs) + wb;
    const x0 = o.a === 'end' ? x - w : o.a === 'middle' ? x - w / 2 : x;
    return [T(x0, y, a, { ...o, a: undefined }) + arrow(x0 + wa, y, fs, o.fill || C.ink) + T(x0 + wa + arrowW(fs), y, b, { ...o, a: undefined }), w];
  };
  const yearOf = am => { const y = Math.floor(am) - D.EPOCH_OFFSET; return y <= 0 ? `${1 - y} BC` : `AD ${y}`; };

  // ---------- data ----------
  const evs = events.filter(e => cats.includes(e.k)).map(e => ({ e, am: D.fromJdn(e.j).am + (D.fromJdn(e.j).dayOfYear || 0) / 364 }));
  const P = prophecies.map(p => ({ p, g: p.g.am, f: p.f ? p.f.am : (FUT[p.sec] ?? 5980), src: sourceOf(p), th: themeOf(p) }));
  for (const r of P) r.era = eraOf(r.f);

  // ---------- scale: seven equal days, stretched inside each by how much happens there ----------
  const dens = new Float64Array(700);
  for (const r of P) { dens[Math.min(699, Math.floor(r.g / 10))] += 0.5; dens[Math.min(699, Math.floor(r.f / 10))] += 1; }
  for (const o of evs) dens[Math.min(699, Math.max(0, Math.floor(o.am / 10)))] += 0.8;
  const cdf = [];
  for (let d = 0; d < 7; d++) { const seg = [0]; let s = 0; for (let i = 0; i < 100; i++) { s += 0.4 + Math.sqrt(dens[d * 100 + i]) * 1.4; seg.push(s); } cdf.push(seg.map(v => v / s)); }
  const X = am => { const a = Math.max(1, Math.min(6999.99, am)); const d = Math.min(6, Math.floor((a - 1) / 1000)); const t = (a - 1 - d * 1000) / 10; const i = Math.min(99, Math.floor(t)); const c = cdf[d][i] + (cdf[d][i + 1] - cdf[d][i]) * (t - i); return left + d * dayW + dayW * (0.015 + 0.97 * c); };

  // ---------- vertical plan ----------
  const headH = 104;
  const upper = ['biblical', 'scrolls'].filter(k => cats.includes(k));
  const lower = ['church', 'secular', 'mine'].filter(k => cats.includes(k));
  const spineH = 36;
  const ribbonH = PROPH ? Math.round(Math.min(H * 0.2, 300)) : 0;
  const lanesAll = [...upper, ...lower];
  const freeH = H - headH - ribbonH - spineH - 26 - M - 30;
  // how many label rows a lane would use if it had them all (greedy packing of labels left to right)
  const rowsWanted = (k, fs) => { const ends = []; for (const o of evs.filter(o => o.e.k === k).map(o => ({ ...o, x: X(o.am) })).sort((a, b) => a.x - b.x)) { const w = tw(o.e.t, fs) + 6; let r = ends.findIndex(e => e < o.x - 3); if (r < 0) { r = ends.length; ends.push(0); } ends[r] = o.x + w; } return ends.length; };
  let labelFs = PROPH ? 9.5 : 12, rowH = labelFs * 1.32;
  const cap = PROPH ? 4 : 14;
  const laneH = {};
  for (const k of lanesAll) laneH[k] = Math.min(cap, Math.max(1, rowsWanted(k, labelFs))) * rowH + 18;
  if (!PROPH) { const used = lanesAll.reduce((s, k) => s + laneH[k] + 10, 0); const f = Math.min(1.8, (freeH - 20) / Math.max(1, used)); if (f > 1) for (const k of lanesAll) laneH[k] *= f; }
  const indexH = PROPH ? freeH - lanesAll.reduce((s, k) => s + laneH[k] + 10, 0) - 20 : 0;
  let y = headH + ribbonH;
  const laneY = {};
  for (const k of upper) { y += laneH[k]; laneY[k] = y - 6; y += 10; }
  y += 26;                       // room for the landmark names on top of the spine
  const spY = y; y += spineH;
  for (const k of lower) { laneY[k] = y + 8; y += laneH[k] + 10; }
  const indexTop = y + 14;

  svg += `<rect width="${W}" height="${H}" fill="${C.paper}"/>`;

  // ---------- yet-future tint and Today ----------
  const xNow = X(now);
  svg += `<rect x="${f1(xNow)}" y="${headH - 6}" width="${f1(right - xNow)}" height="${f1(spY - headH + 6)}" fill="${C.future}" opacity="0.045"/>`;
  svg += `<line x1="${f1(xNow)}" y1="${headH - 6}" x2="${f1(xNow)}" y2="${f1(spY + spineH)}" stroke="${C.future}" stroke-width="1.2"/>`;
  svg += T(xNow - 5, headH + 8, `TODAY · ${now} AM · ${yearOf(now)}`, { b: 1, fs: 10, a: 'end', fill: C.future });
  svg += T(xNow + 5, headH + 8, 'YET FUTURE (placed by Johnson\'s sections)', { b: 1, fs: 10, fill: C.future });

  // ---------- prophecy ribbons ----------
  const bmap = new Map();
  for (const r of P) { const k = r.src + '|' + r.era; if (!bmap.has(k)) bmap.set(k, []); bmap.get(k).push(r); }
  const med = a => { const s = [...a].sort((x, y) => x - y); return s[s.length >> 1]; };
  const bundles = [...bmap.values()].map(rs => {
    const cnt = {}; rs.forEach(r => cnt[r.th] = (cnt[r.th] || 0) + 1);
    rs.sort((a, b) => a.f - b.f || a.g - b.g || (a.p.n || 999) - (b.p.n || 999));
    return { rs, src: rs[0].src, era: rs[0].era, n: rs.length, g: med(rs.map(r => r.g)), f: med(rs.map(r => r.f)), th: Object.entries(cnt).sort((a, b) => b[1] - a[1])[0][0] };
  }).sort((a, b) => a.f - b.f || a.g - b.g);
  const ribbons = bundles.filter(b => b.n >= 2);
  ribbons.forEach((b, i) => b.num = i + 1);
  const singles = bundles.filter(b => b.n === 1).map(b => b.rs[0]);
  if (PROPH) {
    const base = headH + ribbonH - 8, maxH = ribbonH - 54;
    const geo = b => { const x1 = X(b.g), x2 = X(b.f), dx = Math.abs(x2 - x1); const h = Math.min(maxH, 26 + maxH * Math.pow(dx / span, 0.62) * 1.3); return { x1, x2, cy: base - h * 1.333 }; };
    const pt = (g, t) => { const u = 1 - t; return [u * u * u * g.x1 + 3 * u * u * t * g.x1 + 3 * u * t * t * g.x2 + t * t * t * g.x2, u * u * u * base + 3 * u * u * t * g.cy + 3 * u * t * t * g.cy + t * t * t * base]; };
    // single prophecies: hairlines
    for (const r of singles) { const g = geo({ g: r.g, f: r.f }); svg += `<path d="M${f1(g.x1)},${base} C${f1(g.x1)},${f1(g.cy)} ${f1(g.x2)},${f1(g.cy)} ${f1(g.x2)},${base}" fill="none" stroke="${C[r.th]}" stroke-width="0.9" opacity="0.45"${r.th === 'future' ? ' stroke-dasharray="4 3"' : ''}/>`; }
    // ribbons, longest first so short ones sit on top
    const order = [...ribbons].sort((a, b) => Math.abs(X(b.f) - X(b.g)) - Math.abs(X(a.f) - X(a.g)));
    for (const b of order) {
      const g = geo(b), sw = Math.max(2, Math.sqrt(b.n) * 3.1);
      svg += `<path d="M${f1(g.x1)},${base} C${f1(g.x1)},${f1(g.cy)} ${f1(g.x2)},${f1(g.cy)} ${f1(g.x2)},${base}" fill="none" stroke="${C[b.th]}" stroke-width="${f1(sw)}" stroke-linecap="round" opacity="${b.th === 'future' ? 0.5 : 0.6}"${b.th === 'future' ? ` stroke-dasharray="${f1(sw * 1.5)} ${f1(sw * 0.9)}"` : ''}/>`;
    }
    // ends: open circle = foretold, solid = fulfilled
    for (const b of ribbons) svg += `<circle cx="${f1(X(b.g))}" cy="${base}" r="3.4" fill="${C.paper}" stroke="${C[b.th]}" stroke-width="1.6"/><circle cx="${f1(X(b.f))}" cy="${base}" r="3.8" fill="${C[b.th]}"/>`;
    // numbered badges, placed along each ribbon where they don't collide
    const placed = [];
    for (const b of [...ribbons].sort((a, c) => c.n - a.n)) {
      const g = geo(b); let best = null;
      for (const t of [0.5, 0.42, 0.58, 0.34, 0.66, 0.26, 0.74, 0.2, 0.8, 0.14, 0.86]) {
        const [x, yy] = pt(g, t); if (yy > base - 14) continue;
        if (!placed.some(q => Math.hypot(q[0] - x, q[1] - yy) < 21)) { best = [x, yy]; break; }
        if (!best) best = [x, yy];
      }
      if (!best) best = pt(g, 0.5);
      placed.push(best); b.badge = best;
    }
    for (const b of ribbons) {
      const [x, yy] = b.badge, r = b.num > 99 ? 11.5 : 10;
      svg += `<circle cx="${f1(x)}" cy="${f1(yy)}" r="${r}" fill="${C.paper}" stroke="${C[b.th]}" stroke-width="2"/>` + T(x, yy + 4, String(b.num), { b: 1, fs: 11, a: 'middle', fill: C[b.th] });
    }
    svg += T(left - 10, base - 2, 'PROPHECY', { b: 1, fs: 11, a: 'end', fill: C.future });
    const capT = 'fulfilled · ribbon width = number of prophecies · each number is a group in the index below', cw = tw(capT, 10.5, { it: 1 });
    const cx0 = W - M - cw - 108, cyy = M + 43;
    svg += `<circle cx="${f1(cx0 + 4)}" cy="${f1(cyy - 3.5)}" r="3.4" fill="${C.paper}" stroke="${C.rule}" stroke-width="1.4"/>` + T(cx0 + 11, cyy, 'foretold', { fs: 10.5, fill: C.muted, it: 1 });
    svg += `<circle cx="${f1(cx0 + 66)}" cy="${f1(cyy - 3.5)}" r="3.6" fill="${C.rule}"/>` + T(cx0 + 74, cyy, capT, { fs: 10.5, fill: C.muted, it: 1 });
  }

  // ---------- event lanes ----------
  const lmText = [];
  let leaders = '', labels = '';
  for (const k of [...upper, ...lower]) {
    const up = upper.includes(k), y0 = laneY[k], col = LANE[k].color;
    const rows = Math.max(1, Math.floor((laneH[k] - 14) / rowH));
    svg += `<line x1="${left}" y1="${f1(y0)}" x2="${right}" y2="${f1(y0)}" stroke="${col}" stroke-width="0.9" opacity="0.45"/>`;
    svg += T(left - 10, y0 + 4, LANE[k].short, { b: 1, fs: 10.5, a: 'end', fill: col });
    const list = evs.filter(o => o.e.k === k).map(o => ({ ...o, x: X(o.am) })).sort((a, b) => a.x - b.x);
    const ends = new Array(rows).fill(-1e9);
    let labelled = 0;
    for (const o of list) {
      svg += `<circle cx="${f1(o.x)}" cy="${f1(y0)}" r="2.7" fill="${col}"/>`;
      const t = o.e.t.replace(/\s+/g, ' '), w = tw(t, labelFs) + 6;
      let r = ends.findIndex(e => e < o.x - 3);
      if (r < 0) continue;
      if (o.x + w > right) { // near the right edge, hang the label to the left
        const r2 = ends.findIndex(e => e < o.x - w - 3); if (r2 < 0) continue;
        r = r2; ends[r] = o.x + 4;
        const ly = up ? y0 - 8 - r * rowH : y0 + 8 + labelFs + r * rowH;
        leaders += `<line x1="${f1(o.x)}" y1="${f1(y0)}" x2="${f1(o.x)}" y2="${f1(up ? ly + 2 : ly - labelFs + 1)}" stroke="${col}" stroke-width="0.5" opacity="0.6"/>`; labels += TB(o.x - 3, ly, t, { fs: labelFs, a: 'end', fill: C.body });
      } else {
        ends[r] = o.x + w;
        const ly = up ? y0 - 8 - r * rowH : y0 + 8 + labelFs + r * rowH;
        leaders += `<line x1="${f1(o.x)}" y1="${f1(y0)}" x2="${f1(o.x)}" y2="${f1(up ? ly + 2 : ly - labelFs + 1)}" stroke="${col}" stroke-width="0.5" opacity="0.6"/>`; labels += TB(o.x + 2.5, ly, t, { fs: labelFs, fill: C.body });
      }
      labelled++;
    }
    LANE[k].labelled = labelled; LANE[k].total = list.length;
  }

  svg += leaders + labels;
  // ---------- spine ----------
  for (let d = 0; d < 7; d++) {
    const x0 = left + d * dayW;
    svg += `<rect x="${f1(x0)}" y="${f1(spY)}" width="${f1(dayW)}" height="${spineH}" fill="${DAYBG[d]}"/>`;
    if (d) svg += `<line x1="${f1(x0)}" y1="${f1(spY - 5)}" x2="${f1(x0)}" y2="${f1(spY + spineH + 5)}" stroke="${C.rule}" stroke-width="1.3"/>`;
    svg += T(x0 + dayW / 2, spY + 15, DAYN[d].toUpperCase(), { b: 1, fs: 12.5, a: 'middle', fill: C.title });
    svg += T(x0 + dayW / 2, spY + 28, `${d * 1000 + 1}–${(d + 1) * 1000} AM · ${yearOf(d * 1000 + 1)} – ${yearOf((d + 1) * 1000)}`, { fs: 10, a: 'middle', fill: C.muted });
  }
  svg += `<rect x="${left}" y="${f1(spY)}" width="${f1(span)}" height="${spineH}" fill="none" stroke="${C.rule}" stroke-width="1"/>`;
  svg += T(left - 10, spY + 15, 'AM', { b: 1, fs: 10.5, a: 'end', fill: C.title }) + T(left - 10, spY + 28, 'BC / AD', { fs: 9.5, a: 'end', fill: C.muted });
  // century ticks where there is room, landmarks on the spine
  let lastT = -1e9;
  for (let am = 100; am < 7000; am += 100) { const x = X(am); if (x - lastT < 26) continue; lastT = x; svg += `<line x1="${f1(x)}" y1="${f1(spY + spineH)}" x2="${f1(x)}" y2="${f1(spY + spineH + (am % 500 ? 4 : 7))}" stroke="${C.rule}" stroke-width="0.8"/>`; }
  const LM = [[1, 'Creation'], [1656, 'Flood'], [2008, 'Abraham'], [2448, 'Exodus'], [2935, "Solomon's Temple"], [3338, 'Jerusalem falls'], [3389, 'Return'], [3924, 'Birth of Jesus'], [3957, 'The Cross'], [3995, 'AD 70'], [4057, 'Bar Kokhba'], [5442, 'Reformation'], [5873, '1948'], [5892, '1967'], [6000, '6000 AM']];
  const lmp = [];
  for (const [am, n] of LM) {
    const x = X(am), w = tw(n, 10, { b: 1 }) + 8; let lane = 0;
    while (lmp.some(q => q.lane === lane && Math.abs(q.x - x) < (q.w + w) / 2)) lane++;
    lmp.push({ x, w, lane });
    svg += `<circle cx="${f1(x)}" cy="${f1(spY)}" r="3.2" fill="${C.paper}" stroke="${C.rule}" stroke-width="1.3"/>`;
    lmText.push(TB(x, spY - 6 - lane * 12, n, { b: 1, fs: 10, a: am < 50 ? 'start' : 'middle', fill: C.rule }));
  }
  svg += lmText.join('');

  // ---------- magnified boxes: the Messiah's first coming, and Israel reborn ----------
  const insets = []; let indexPt = 0;
  const ORDER = ['Genesis', 'Moses', 'Kings & prophets', 'Psalms', 'Isaiah', 'Jeremiah', 'Ezekiel', 'Daniel', 'Zechariah', 'Minor prophets', 'Jesus', 'Apostles', 'Revelation', 'Enoch, Esdras & scrolls'];
  function drawInset({ a0, a1, cx, heading, note, color, labelEvery, keyYears, marks }) {
    const mz = P.filter(r => r.p.f && r.f >= a0 && r.f < a1);
    if (mz.length < 10) return;
    const iw = Math.min(980, span * 0.24), ih = Math.min(indexH * 0.6, 340);
    let ix0 = Math.max(left, Math.min(right - iw, X(cx) - iw / 2));
    for (const o of insets) if (ix0 < o.x1 && ix0 + iw > o.x0) ix0 = Math.min(right - iw, o.x1 + 20);
    const iy = indexTop;
    insets.push({ x0: ix0 - 16, x1: ix0 + iw + 16, y1: iy + ih + 14 });
    svg += `<path d="M${f1(X(a0))},${f1(spY + spineH)} L${f1(X(a1))},${f1(spY + spineH)} L${f1(ix0 + iw)},${f1(iy)} L${f1(ix0)},${f1(iy)} Z" fill="${color}" opacity="0.07"/>`;
    svg += `<rect x="${f1(ix0)}" y="${f1(iy)}" width="${f1(iw)}" height="${f1(ih)}" rx="12" fill="#FFFDF7" stroke="${color}" stroke-width="1.5"/>`;
    svg += T(ix0 + 16, iy + 24, heading, { b: 1, fs: 13, fill: color });
    svg += T(ix0 + 16, iy + 41, `${mz.length} ${note}`, { fs: 10.5, fill: C.muted, it: 1 });
    let lx = ix0 + 16, ly = iy + 60;
    for (const s of ORDER) { const n = mz.filter(r => r.src === s).length; if (!n) continue; const t = `${s} ${n}`, w = tw(t, 10.5) + 30; if (lx + w > ix0 + iw - 10) { lx = ix0 + 16; ly += 16; } svg += `<rect x="${f1(lx)}" y="${f1(ly - 8)}" width="14" height="9" rx="2" fill="${SRC_COLOR[s]}"/>` + T(lx + 19, ly, t, { fs: 10.5 }); lx += w; }
    const yrs = a1 - a0, cell = (iw - 80) / yrs, bw = Math.min(18, cell * 0.82);
    const zx = am => ix0 + 40 + (am - a0) / yrs * (iw - 80), zy = iy + ih - 34;
    svg += `<line x1="${f1(ix0 + 28)}" y1="${f1(zy)}" x2="${f1(ix0 + iw - 28)}" y2="${f1(zy)}" stroke="${C.rule}" stroke-width="1.1"/>`;
    for (let am = a0; am < a1; am++) {
      const x = zx(am + 0.5), y = Math.floor(am) - D.EPOCH_OFFSET;
      svg += `<line x1="${f1(x)}" y1="${f1(zy)}" x2="${f1(x)}" y2="${f1(zy + (y % 5 ? 3.5 : 7))}" stroke="${C.rule}" stroke-width="0.7"/>`;
      if (y % labelEvery === 0 || keyYears.includes(am)) svg += T(x, zy + 19, yearOf(am), { fs: 10, a: 'middle', fill: keyYears.includes(am) ? C.ink : C.muted, b: keyYears.includes(am) ? 1 : 0 });
    }
    const by = {}; mz.forEach(r => { const k = Math.floor(r.f); (by[k] = by[k] || []).push(r); });
    const maxSt = Math.max(...Object.values(by).map(a => a.length));
    const step = Math.min(9, (zy - ly - 44) / maxSt);
    for (const [k, rs] of Object.entries(by)) { rs.sort((a, b) => ORDER.indexOf(a.src) - ORDER.indexOf(b.src)); rs.forEach((r, i) => { svg += `<rect x="${f1(zx(+k + 0.5) - bw / 2)}" y="${f1(zy - 3 - (i + 1) * step)}" width="${f1(bw)}" height="${f1(Math.max(1, step - 0.8))}" rx="1" fill="${SRC_COLOR[r.src]}"/>`; }); }
    // marker labels sit above their stack; nudge up when two would touch
    const placed = [];
    for (const [k, t] of marks) {
      if (!by[k]) continue;
      const x = zx(k + 0.5), w = tw(t, 11, { b: 1 }) + 8; let y = zy - 10 - by[k].length * step;
      while (placed.some(q => Math.abs(q.x - x) < (q.w + w) / 2 && Math.abs(q.y - y) < 14)) y -= 15;
      placed.push({ x, y, w });
      svg += TB(x, y, t, { b: 1, fs: 11, a: 'middle', bg: '#FFFDF7' });
    }
  }
  if (PROPH) {
    drawInset({ a0: 3922, a1: 3962, cx: 3942, color: C.messiah, heading: "MAGNIFIED · THE MESSIAH'S FIRST COMING, 3 BC – AD 35",
      note: 'prophecies fulfilled in 38 years. Each block is one prophecy, stacked on the year it was fulfilled and coloured by who foretold it.',
      labelEvery: 5, keyYears: [3924, 3957], marks: [[3924, 'Birth · 2 BC'], [3953, 'Ministry begins · AD 28'], [3957, 'Cross, resurrection, Pentecost · AD 32']] });
    drawInset({ a0: 5866, a1: 5932, cx: 5900, color: C.israel, heading: 'MAGNIFIED · ISRAEL REBORN, 1941 – 2006',
      note: 'prophecies fulfilled in these years, stacked on the year fulfilled and coloured by who foretold them.',
      labelEvery: 10, keyYears: [5873, 5892, 5898], marks: [[5873, 'Israel reborn · 1948'], [5892, 'Jerusalem reunited · 1967'], [5898, 'Yom Kippur War · 1973'], [5925, 'The land restored · c. 2000']] });
  }

  // ---------- index: every prophecy, grouped by ribbon ----------
  if (PROPH) {
    const blocks = ribbons.map(b => ({ head: b, rows: b.rs }));
    const singleByEra = new Map(); for (const r of singles) { if (!singleByEra.has(r.era)) singleByEra.set(r.era, []); singleByEra.get(r.era).push(r); }
    for (const [era, rs] of [...singleByEra.entries()].sort((a, b) => a[1][0].f - b[1][0].f)) blocks.push({ era, rows: rs.sort((a, b) => a.f - b.f) });
    const items = [];
    for (const bl of blocks) {
      items.push({ head: bl });
      for (const r of bl.rows) {
        const p = r.p;
        const tok = [];
        cleanRef(p.ref).split(' ').filter(Boolean).forEach(s => tok.push({ s, k: 'ref' }));
        const ds = dssShort(p.dss); if (ds && !(p.ref || '').includes(ds)) ds.split(' ').forEach(s => tok.push({ s, k: 'dss' }));
        (cleanTitle(p.t) + (p.st === 'partial' ? ' (in part)' : '')).split(' ').filter(Boolean).forEach(s => tok.push({ s, k: 'title' }));
        if (p.n) tok.push({ s: '#' + p.n, k: 'num' });
        items.push({ r, tok, g: shortLbl(p.g.label, p.g.am, D).replace(/^before /, 'before '), f: p.f ? shortLbl(p.f.label, p.f.am, D) : 'yet future' });
      }
    }
    const x0 = left - 60, xs = right - x0, top = indexTop, bot = H - M - 14;
    const KFS = { ref: { b: 1 }, dss: { it: 1 }, title: {}, num: {} };
    const wcache = new Map();
    const w10 = (s, k) => { const key = k + s; let v = wcache.get(key); if (v == null) { v = tw(s, 10, KFS[k]); if (k === 'num') v *= 0.84; wcache.set(key, v); } return v; };
    const BAR = 8, DATEW = 10.5;  // waiting bar and date column widths, in ems
    function wrap(it, fs, colW) {
      const sc = fs / 10, gw = Math.max(fs * DATEW, (w10(it.g, 'title') + w10(it.f, 'title')) * sc + arrowW(fs));
      const lines = [[]]; let x = 0, lim = colW - fs * 0.7 - gw - fs * (BAR + 1.2);
      for (const t of it.tok) {
        const w = w10(t.s, t.k) * sc, gap = x ? fs * 0.27 + (t.k !== lines.at(-1).at(-1)?.k ? fs * 0.15 : 0) : 0;
        if (x && x + gap + w > lim) { const prev = lines.at(-1); lines.push([]); lim = colW - fs * 1.2; if (t.k === 'num' && prev.length > 1) { const mv = prev.pop(); lines.at(-1).push({ ...mv, x: 0 }); x = w10(mv.s, mv.k) * sc; } else x = 0; }
        const g = x ? gap : 0; lines.at(-1).push({ ...t, x: x + g }); x += g + w;
      }
      return lines;
    }
    const headLines = 1.55;
    const heightOf = (it, fs, colW) => it.head ? fs * 1.22 * headLines : wrap(it, fs, colW).length * fs * 1.22 + fs * 0.3;
    // columns: those overlapping the inset start below it
    function slots(n, colW) { return Array.from({ length: n }, (_, c) => { const a = x0 + c * (colW + 14), b = a + colW; const over = insets.filter(o => b > o.x0 && a < o.x1); return { a, b, top: over.length ? Math.max(...over.map(o => o.y1)) : top }; }); }
    function pack(fs, n) {
      const colW = (xs - 14 * (n - 1)) / n, S = slots(n, colW); let c = 0, yy = S[0].top; const out = [];
      for (let i = 0; i < items.length; i++) {
        const it = items[i]; let h = heightOf(it, fs, colW);
        const need = it.head ? h + heightOf(items[i + 1] || it, fs, colW) : h;   // keep a heading with its first line
        while (c < n && yy + need > bot) { c++; if (c < n) yy = S[c].top; }
        if (c >= n) return null;
        out.push({ it, c, y: yy }); yy += h;
      }
      return { out, colW, S };
    }
    let L = null, fs;
    for (fs = 11; fs > 4; fs = +(fs - 0.1).toFixed(2)) {
      const n = Math.max(4, Math.floor(xs / (fs * 64)));
      L = pack(fs, n) || pack(fs, n + 1); if (L) break;
    }
    indexPt = fs * K;
    const MINI = am => (X(am) - left) / span;
    for (const { it, c, y: yy } of L.out) {
      const a = L.S[c].a, b = L.S[c].b;
      if (it.head) {
        const bl = it.head, hy = yy + fs * 1.05;
        if (bl.head) {
          const h = bl.head, col = C[h.th];
          svg += `<circle cx="${f1(a + fs * 0.85)}" cy="${f1(hy - fs * 0.34)}" r="${f1(fs * 0.82)}" fill="${C.paper}" stroke="${col}" stroke-width="1.5"/>` + T(a + fs * 0.85, hy, String(h.num), { b: 1, fs: fs * 0.82, a: 'middle', fill: col });
          const [s1, w1] = pair(a + fs * 2.1, hy, h.src, h.era.replace(/^the /, ''), { b: 1, fs: fs * 1.02, fill: col });
          svg += s1 + T(a + fs * 2.1 + w1 + fs * 0.5, hy, `${h.n} prophecies`, { fs: fs * 0.95, fill: C.muted });
        } else svg += T(a, hy, `Also fulfilled in ${bl.era}`.toUpperCase(), { b: 1, fs: fs * 0.9, fill: C.rule });
        svg += `<line x1="${f1(a)}" y1="${f1(hy + fs * 0.32)}" x2="${f1(b)}" y2="${f1(hy + fs * 0.32)}" stroke="${bl.head ? C[bl.head.th] : C.faint}" stroke-width="0.6"/>`;
        continue;
      }
      const r = it.r, col = C[r.th], lines = wrap(it, fs, L.colW);
      const base = yy + fs * 0.15 + fs * 0.98;
      svg += `<rect x="${f1(a)}" y="${f1(base - fs * 0.78)}" width="${f1(fs * 0.26)}" height="${f1((lines.length - 1) * fs * 1.22 + fs * 0.92)}" fill="${col}"/>`;
      lines.forEach((ln, li) => {
        const ly = base + li * fs * 1.22, lx = a + fs * 0.6 + (li ? fs * 0.6 : 0); let run = null;
        const flush = () => { if (!run) return; const o = run.k === 'ref' ? { b: 1, fs, fill: C.ink } : run.k === 'dss' ? { it: 1, fs, fill: '#4F6E2E' } : run.k === 'num' ? { fs: fs * 0.84, fill: C.faint } : { fs, fill: C.body }; svg += T(lx + run.x, ly, run.s, o); run = null; };
        for (const t of ln) { if (run && run.k === t.k) run.s += ' ' + t.s; else { flush(); run = { k: t.k, s: t.s, x: t.x }; } }
        flush();
      });
      // waiting bar on a tiny seven-day scale, then the dates
      const [ds, dw] = pair(b, base, it.g, it.f, { fs, fill: r.th === 'future' ? C.future : C.muted, a: 'end' });
      const bx1 = b - Math.max(fs * DATEW, dw) - fs * 0.8, bx0 = bx1 - fs * BAR, by = base - fs * 0.32;
      svg += `<line x1="${f1(bx0)}" y1="${f1(by)}" x2="${f1(bx1)}" y2="${f1(by)}" stroke="${C.faint}" stroke-width="0.5"/>`;
      for (let d = 1; d < 7; d++) svg += `<line x1="${f1(bx0 + (bx1 - bx0) * d / 7)}" y1="${f1(by - fs * 0.18)}" x2="${f1(bx0 + (bx1 - bx0) * d / 7)}" y2="${f1(by + fs * 0.18)}" stroke="${C.faint}" stroke-width="0.4"/>`;
      const g1 = bx0 + (bx1 - bx0) * MINI(r.g), g2 = bx0 + (bx1 - bx0) * MINI(r.f);
      svg += `<line x1="${f1(Math.min(g1, g2))}" y1="${f1(by)}" x2="${f1(Math.max(g1, g2))}" y2="${f1(by)}" stroke="${col}" stroke-width="${f1(fs * 0.3)}" stroke-linecap="round"${r.th === 'future' ? ` stroke-dasharray="${f1(fs * 0.5)} ${f1(fs * 0.3)}"` : ''}/>`;
      svg += `<circle cx="${f1(g1)}" cy="${f1(by)}" r="${f1(fs * 0.22)}" fill="${C.paper}" stroke="${col}" stroke-width="0.8"/>`;
      svg += ds;
    }
    svg += T(x0, indexTop - 2, '', {});
  }

  // ---------- header and footer ----------
  const ttl = title || (PROPH ? 'Seven Thousand Years of History & Prophecy' : 'Seven Thousand Years of History');
  svg += T(M, M + 34, ttl, { ff: SERIF, fs: 42, fill: C.title });
  const tx = M + tw(ttl, 42, { ff: SERIF }) + 26;
  const laneNames = [...upper, ...lower].map(k => LANE[k].name);
  svg += T(tx, M + 17, `From Creation (1 AM · 3925 BC) to the end of the seventh millennium · ${[...laneNames, ...(PROPH ? [`${P.length} prophecies`] : [])].join(' · ')}`, { fs: 14, fill: C.ink });
  svg += T(tx, M + 35, 'Each millennium is one "day" of equal width; inside a day, busier centuries get more room. Dates follow Scripture and Ken Johnson\'s chronology (AM = AD + 3925). "c." = approximate.', { fs: 11.5, fill: C.muted, it: 1 });
  // legend
  let lx = W - M;
  const leg = [];
  for (const k of [...upper, ...lower]) leg.push(['dot', LANE[k].color, LANE[k].name]);
  if (PROPH) for (const [k, n] of THEMES) leg.push(['rib', C[k], n, k === 'future']);
  const legW = leg.map(l => tw(l[2], 11.5) + (l[0] === 'dot' ? 22 : 40));
  lx -= legW.reduce((s, w) => s + w, 0);
  leg.forEach((l, i) => {
    if (l[0] === 'dot') svg += `<circle cx="${f1(lx + 5)}" cy="${M + 20}" r="4.5" fill="${l[1]}"/>` + T(lx + 14, M + 24, l[2], { fs: 11.5 });
    else svg += `<path d="M${f1(lx)},${M + 25} q12,-16 26,0" fill="none" stroke="${l[1]}" stroke-width="3.2"${l[3] ? ' stroke-dasharray="4 3"' : ''}/>` + T(lx + 31, M + 24, l[2], { fs: 11.5 });
    lx += legW[i];
  });
  svg += `<line x1="${M}" y1="${M + 50}" x2="${W - M}" y2="${M + 50}" stroke="${C.title}" stroke-width="1"/>`;
  const shownNote = [...upper, ...lower].map(k => `${LANE[k].name} ${LANE[k].labelled} of ${LANE[k].total} labelled`).join(' · ');
  svg += T(M, H - M + 18, `Sources: Scripture (KJV); Ken Johnson, Ancient Prophecies Revealed (#1–485) and his chronology; the Dead Sea Scrolls; standard histories. Events: ${shownNote} (the rest are dots; every event is in the app).`, { fs: 9.5, fill: C.muted });
  svg += T(W - M, H - M + 18, 'DSS Calendar · dss-calendar.pages.dev · after Ken Johnson & dsscalendar.org', { fs: 9.5, a: 'end', fill: C.muted });

  const out = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}pt" height="${height}pt" viewBox="0 0 ${width} ${height}"><g transform="scale(${K})">${svg}</g></svg>`;
  return { svg: out, width, height, indexPt, labelPt: labelFs * K, counts: { ribbons: ribbons.length, singles: singles.length, prophecies: P.length, events: evs.length } };
}
