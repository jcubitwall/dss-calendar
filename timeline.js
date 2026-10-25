// Timelines: a scrolling straight-line timeline, a 7000-year wheel, and print posters.
// Only the events passed in (already filtered by the user's toggles) are drawn.
import * as D from './engine/dss.js';

export const TYPES = {
  biblical: { label: 'Bible', color: '#B7862C' },
  scrolls: { label: 'Scrolls & Essenes', color: '#5E7F3A' },
  church: { label: 'Church', color: '#7B4F8E' },
  secular: { label: 'History', color: '#1B6577' },
  mine: { label: 'Yours', color: '#B4533A' },
  prophecy: { label: 'Prophecy', color: '#3B4FA0' },
};
const AGE_COLORS = ['#DCEBDD', '#F3E7CC', '#DCE7F2', '#F2DDD5'];
const AGE_NAMES = ['Age of Creation', 'Age of Torah', 'Age of Grace', 'Age of the Kingdom'];
const AGE_SPANS = [[1, 2000], [2001, 4000], [4001, 6000], [6001, 7000]];
const xmlEsc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** Fractional AM position of an event (e.g. 1656.13) */
export function amPos(jdn) {
  const x = D.fromJdn(jdn);
  if (!x) return 0;
  if (x.kind === 'creation') return 1 - (4 - x.creationDay) / 364;
  return x.am + (x.dayOfYear - 1) / D.yearLength(x.am);
}
export function whenText(e) {
  const x = D.fromJdn(e.j);
  if (!x) return '';
  const c = D.jdnToCivil(e.j);
  const yr = D.yearShort(c.y);
  if (x.kind === 'creation') return 'Creation week';
  if (e.p === 'm' && x.kind === 'month') return `${D.MONTHS[x.month - 1].name} ${x.am} AM · ${yr}`;
  if (x.kind === 'month') return `${x.day} ${D.MONTHS[x.month - 1].name} ${x.am} AM · ${yr}`;
  return `${x.am} AM · ${yr}`;
}
const civilYear = am => D.yearLabel(am - D.EPOCH_OFFSET);

// ---------------------------------------------------------------------------
// Screen: vertical scrolling line on an elastic scale. Empty centuries keep their
// proportional length (ppy px/year) and the line stretches wherever rows need
// room, so every row sits right beside its own point on the line.
// Prophecies (optional) get a "foretold" row and a "fulfilled" row joined by an
// arrow drawn in the gutter left of the line.
export const PROPHECY_COLOR = '#3B4FA0';
export const FUTURE_AM = 5951.95;   // where arrows for unfulfilled prophecies end
const pYear = t => t.label || '';
export function renderLine(el, events, opts = {}) {
  const { ppy = 1, from = 1, to = 7000, prophecies = [] } = opts;
  const hasP = prophecies.length > 0;
  const top = 20, axisX = hasP ? 122 : 58, labelX = axisX + 18, rowH = 44, ageH = 28;
  const items = events.map(e => ({ e, am: amPos(e.j) })).filter(o => o.am >= from - 1 && o.am <= to + 1);
  AGE_SPANS.forEach(([a, b], i) => { if (b >= from && a <= to) items.push({ age: i, am: Math.max(a, from) - 0.0001 }); });
  const inSpan = am => am >= from - 1 && am <= to + 1;
  let anyFuture = false;
  for (const p of prophecies) {
    if (inSpan(p.g.am)) items.push({ pg: p, am: p.g.am });
    if (p.f && inSpan(p.f.am)) items.push({ pf: p, am: p.f.am });
    else if (!p.f && p.x && inSpan(p.x.am)) items.push({ px: p, am: p.x.am });
    else if (!p.f) anyFuture = true;
  }
  if (anyFuture && inSpan(FUTURE_AM)) items.push({ future: true, am: FUTURE_AM });
  items.sort((a, b) => a.am - b.am);
  let y = top, am0 = from;
  const anchors = [[from, top]];
  for (const o of items) {
    y += Math.max(o.age != null || o.future ? 4 : 0, (Math.max(o.am, from) - am0) * ppy);
    o.y = y; anchors.push([Math.max(o.am, from), y]);
    y += o.age != null || o.future ? ageH : rowH;
    am0 = Math.max(o.am, from);
    anchors.push([am0 + 1e-6, y]);
  }
  const yEnd = y + Math.max(30, (to + 1 - am0) * ppy);
  anchors.push([to + 1, yEnd]);
  const yAt = am => {
    let lo = 1, hi = anchors.length - 1;
    while (lo < hi) { const m = (lo + hi) >> 1; if (anchors[m][0] < am) lo = m + 1; else hi = m; }
    const i = lo;
    const [a0, y0] = anchors[i - 1], [a1, y1] = anchors[i];
    return a1 === a0 ? y1 : y0 + (y1 - y0) * (am - a0) / (a1 - a0);
  };
  const height = yEnd + 20;
  let svg = `<defs><marker id="parr" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="${PROPHECY_COLOR}"/></marker></defs>`;
  AGE_SPANS.forEach(([a, b], i) => {
    if (b < from || a > to) return;
    const y0 = yAt(Math.max(a, from)), y1 = yAt(Math.min(b + 1, to + 1));
    svg += `<rect x="${axisX - 9}" y="${y0}" width="7" height="${Math.max(0, y1 - y0)}" fill="${AGE_COLORS[i]}"/>`;
  });
  svg += `<line x1="${axisX}" y1="${top}" x2="${axisX}" y2="${yEnd}" stroke="var(--ink-2)" stroke-width="1.5"/>`;
  let html = '';
  const ticks = [];
  for (let am = Math.ceil(from / 100) * 100; am <= to; am += 100) ticks.push({ am, y: yAt(am), major: am % 500 === 0 });
  const keep = [];
  for (const t of ticks) {
    const near = ticks.some(u => u.major && u !== t && Math.abs(u.y - t.y) < 34);
    if (!t.major && near) continue;
    const prev = keep[keep.length - 1];
    if (prev && t.y - prev.y < 34) { if (t.major && !prev.major) keep[keep.length - 1] = t; continue; }
    keep.push(t);
  }
  for (const t of keep) {
    svg += `<line x1="${axisX - (t.major ? 7 : 4)}" y1="${t.y}" x2="${axisX + (t.major ? 7 : 4)}" y2="${t.y}" stroke="var(--ink-2)"/>`;
    html += `<div class="tl-tick${t.major ? ' major' : ''}" style="top:${t.y - 8}px">${t.am}<small>${civilYear(t.am)}</small></div>`;
  }
  // Everything above (axis, age bands, ticks) is static. Rows and arrows are only put in the
  // page when they are near the screen, so thousands of entries scroll smoothly on a phone.
  const rows = [], arcs = [], pos = {};
  let last = opts.lastId || '';
  if (hasP) {
    const fade = prophecies.length > 150 ? 0.12 : prophecies.length > 50 ? 0.22 : 0.4;
    const gutter = axisX - 54;
    const rowOf = {};
    for (const o of items) { if (o.pg) (rowOf[o.pg.id] ||= {}).g = o.y + 11; if (o.pf) (rowOf[o.pf.id] ||= {}).f = o.y + 11; if (o.px) (rowOf[o.px.id] ||= {}).f = o.y + 11; if (o.future) rowOf.__future = o.y + 14; }
    for (const p of prophecies) {
      const r = rowOf[p.id] || {};
      const yg = r.g ?? yAt(Math.max(from, Math.min(to, p.g.am)));
      const endAm = p.f ? p.f.am : p.x ? p.x.am : null;
      const yf = endAm != null ? (r.f ?? yAt(Math.max(from, Math.min(to, endAm)))) : rowOf.__future;
      if (yf == null || (r.g == null && r.f == null)) continue;
      const bulge = Math.min(gutter, 8 + Math.sqrt(Math.abs(yf - yg)) * 0.9);
      arcs.push({ id: p.id, lo: Math.min(yg, yf), hi: Math.max(yg, yf), d: `M${axisX - 2},${yg} C${axisX - bulge},${yg} ${axisX - bulge},${yf} ${axisX - 3},${yf}`, dash: !p.f, fade });
    }
  }
  for (const o of items) {
    if (o.age != null) { html += `<div class="tl-age" style="top:${o.y}px;left:${labelX}px">${AGE_NAMES[o.age]}</div>`; continue; }
    if (o.future) { html += `<div class="tl-age tl-future" style="top:${o.y}px;left:${labelX}px">Yet to be fulfilled (dashed arrows)</div>`; continue; }
    const cy = o.y + 11;
    if (o.pg || o.pf || o.px) {
      const p = o.pg || o.pf || o.px;
      const key = `p${o.pg ? 'g' : 'f'}-${p.id}`; pos[key] = o.y;
      const line2 = o.pg
        ? `Foretold ${pYear(p.g)} · ${p.ref}${p.f ? ` → ${pYear(p.f)}` : p.x ? ` → expected ${pYear(p.x)}` : ' → yet future'}`
        : o.pf ? `Fulfilled ${pYear(p.f)}${p.fr ? ' · ' + p.fr : ''} ← ${pYear(p.g)}`
        : `Expected ${pYear(p.x)} (Ken Johnson's projection) ← ${pYear(p.g)}`;
      const lead = o.pg ? 'Foretold: ' : o.pf ? 'Fulfilled: ' : 'Expected: ';
      rows.push({ y: o.y, id: p.id,
        svg: `<line x1="${axisX}" y1="${cy}" x2="${labelX - 2}" y2="${cy}" stroke="${PROPHECY_COLOR}" stroke-opacity=".6"/><circle cx="${axisX}" cy="${cy}" r="4.5" fill="${o.pf ? PROPHECY_COLOR : 'var(--bg)'}" stroke="${PROPHECY_COLOR}" stroke-width="2"${o.px ? ' stroke-dasharray="2 2"' : ''}/>`,
        html: cls => `<button class="tl-ev tl-p${cls}" style="top:${o.y}px;left:${labelX}px" data-pr="${xmlEsc(p.id)}" id="tl-${key}"><span class="tl-t">${lead}${p.n ? '#' + p.n + ' ' : ''}${xmlEsc(p.t)}</span><span class="tl-d">${xmlEsc(line2)}</span></button>` });
      continue;
    }
    const c = TYPES[o.e.k]?.color || '#555';
    pos['ev-' + o.e.id] = o.y;
    rows.push({ y: o.y, id: o.e.id,
      svg: `<line x1="${axisX}" y1="${cy}" x2="${labelX - 2}" y2="${cy}" stroke="${c}" stroke-opacity=".6"/><circle cx="${axisX}" cy="${cy}" r="4" fill="${c}"/>`,
      html: cls => `<button class="tl-ev${cls}" style="top:${o.y}px;left:${labelX}px" data-ev="${xmlEsc(o.e.id)}" id="tl-ev-${xmlEsc(o.e.id)}"><span class="tl-t">${xmlEsc(o.e.t)}</span><span class="tl-d">${xmlEsc(whenText(o.e))}</span></button>` });
  }
  if (!rows.length) html += `<p class="tl-empty" style="left:${labelX}px">No events are switched on for this span. Turn on a category above.</p>`;
  el.innerHTML = `<div class="tl" style="height:${height}px"><svg class="tl-svg" width="100%" height="${height}" aria-hidden="true">${svg}</svg><svg class="tl-svg tl-dyn" width="100%" height="${height}" aria-hidden="true"></svg>${html}<div class="tl-rows"></div></div>`;
  const box = el.querySelector('.tl'), dyn = el.querySelector('.tl-dyn'), rowBox = el.querySelector('.tl-rows');
  const BUF = 1200;
  let w0 = -1, w1 = -1, queued = false;
  function paint(force) {
    queued = false;
    if (!box.isConnected) return detach();
    const top = -box.getBoundingClientRect().top, a = top - BUF, b = top + innerHeight + BUF;
    if (!force && a >= w0 && b <= w1) return;            // still inside the painted window
    w0 = a - BUF / 2; w1 = b + BUF / 2;
    let lo = 0, hi = rows.length;                         // first row with y >= w0
    while (lo < hi) { const m = (lo + hi) >> 1; if (rows[m].y < w0) lo = m + 1; else hi = m; }
    let s = '', h = '';
    for (const ar of arcs) if (ar.hi >= w0 && ar.lo <= w1) {
      const hot = ar.id === last;
      s += `<path d="${ar.d}" fill="none" stroke="${PROPHECY_COLOR}" stroke-width="${hot ? 2.6 : 1.1}" stroke-opacity="${hot ? 0.95 : ar.fade}"${ar.dash ? ' stroke-dasharray="4 3"' : ''} marker-end="url(#parr)"/>`;
    }
    for (let i = lo; i < rows.length && rows[i].y <= w1; i++) { s += rows[i].svg; h += rows[i].html(rows[i].id === last ? ' seen' : ''); }
    dyn.innerHTML = s; rowBox.innerHTML = h;
  }
  const onScroll = () => { if (!queued) { queued = true; requestAnimationFrame(() => paint(false)); } };
  function detach() { removeEventListener('scroll', onScroll); removeEventListener('resize', onScroll); }
  if (activeLine) activeLine.detach();
  addEventListener('scroll', onScroll, { passive: true }); addEventListener('resize', onScroll, { passive: true });
  paint(true);
  activeLine = {
    detach,
    posOf: key => (pos[key] != null ? box.getBoundingClientRect().top + scrollY + pos[key] : null),
    setLast(id) { last = id; paint(true); },
    paint: () => paint(true),
  };
  return activeLine;
}
let activeLine = null;

// ---------------------------------------------------------------------------
// Wheel (screen and print): Creation at the top, clockwise to 7000 AM.
export function wheelSVG(events, size, { from = 1, to = 7000, print = false, title = '', prophecies = [], lastId = '' } = {}) {
  const S = size, C = S / 2, span = to - from + 1;
  const ang = am => ((am - from) / span) * 2 * Math.PI - Math.PI / 2;
  const P = (r, a) => [C + r * Math.cos(a), C + r * Math.sin(a)];
  const f = n => n.toFixed(2);
  const font = print ? 'Helvetica, Arial, sans-serif' : 'var(--sans)';
  const serif = print ? 'Times, Georgia, serif' : 'var(--serif)';
  const ink = print ? '#1B2427' : 'var(--ink)', ink2 = print ? '#4E5D61' : 'var(--ink-2)';
  const wide = prophecies.length > 0;   // give the prophecy chords a larger inner circle
  const r0 = S * (wide ? 0.175 : 0.13), r1 = S * (wide ? 0.207 : 0.19), r2 = S * 0.235, r3 = S * 0.25, rDot = S * 0.262, rLab = S * 0.285, rMax = S * 0.495;
  let g = '';
  const arc = (ra, rb, a0, a1, fill) => {
    const large = a1 - a0 > Math.PI ? 1 : 0;
    const [x0, y0] = P(rb, a0), [x1, y1] = P(rb, a1), [x2, y2] = P(ra, a1), [x3, y3] = P(ra, a0);
    return `<path d="M${f(x0)},${f(y0)} A${f(rb)},${f(rb)} 0 ${large} 1 ${f(x1)},${f(y1)} L${f(x2)},${f(y2)} A${f(ra)},${f(ra)} 0 ${large} 0 ${f(x3)},${f(y3)}Z" fill="${fill}" stroke="#ffffff" stroke-width="${S * 0.001}"/>`;
  };
  // Ages ring
  AGE_SPANS.forEach(([a, b], i) => {
    const lo = Math.max(a, from), hi = Math.min(b + 1, to + 1);
    if (hi <= lo) return;
    g += arc(r0, r1, ang(lo), ang(hi), AGE_COLORS[i]);
    const mid = ang((lo + hi) / 2), [tx, ty] = P((r0 + r1) / 2, mid);
    let rot = mid * 180 / Math.PI + 90; if (rot > 90 && rot < 270) rot -= 180;
    g += `<text x="${f(tx)}" y="${f(ty)}" font-family="${font}" font-size="${f(S * 0.014)}" fill="${ink}" text-anchor="middle" dominant-baseline="middle" transform="rotate(${f(rot)} ${f(tx)} ${f(ty)})">${AGE_NAMES[i]}</text>`;
  });
  // Onah ring (500 years)
  for (let o = 0; o < 14; o++) {
    const lo = Math.max(o * 500 + 1, from), hi = Math.min(o * 500 + 501, to + 1);
    if (hi <= lo) continue;
    g += arc(r1, r2, ang(lo), ang(hi), o % 2 ? '#E8EEEC' : '#F6F8F7');
    const mid = ang((lo + hi) / 2), [tx, ty] = P((r1 + r2) / 2, mid);
    let rot = mid * 180 / Math.PI + 90; if (rot > 90 && rot < 270) rot -= 180;
    if ((hi - lo) / span > 0.02) g += `<text x="${f(tx)}" y="${f(ty)}" font-family="${font}" font-size="${f(S * 0.011)}" fill="${ink2}" text-anchor="middle" dominant-baseline="middle" transform="rotate(${f(rot)} ${f(tx)} ${f(ty)})">Onah ${o + 1}</text>`;
  }
  // Jubilee ticks (50 years) and millennium labels
  for (let am = Math.ceil(from / 50) * 50; am <= to; am += 50) {
    const a = ang(am + 1), big = am % 1000 === 0;
    const [x0, y0] = P(r2, a), [x1, y1] = P(big ? r3 + S * 0.006 : r3, a);
    g += `<line x1="${f(x0)}" y1="${f(y0)}" x2="${f(x1)}" y2="${f(y1)}" stroke="${ink2}" stroke-width="${S * (big ? 0.0016 : 0.0007)}"/>`;
  }
  for (let am = Math.ceil(from / 1000) * 1000; am <= to; am += 1000) {
    const a = ang(am + 1), [tx, ty] = P(r0 - S * 0.022, a);
    g += `<text x="${f(tx)}" y="${f(ty)}" font-family="${font}" font-size="${f(S * 0.0105)}" fill="${ink2}" text-anchor="middle" dominant-baseline="middle">${am}</text>`;
  }
  // Events: place labels so none overlap, spreading them round the circle
  const list = events.map(e => ({ e, am: amPos(e.j) })).filter(o => o.am >= from && o.am <= to + 1).sort((a, b) => a.am - b.am);
  const n = list.length;
  let fs = Math.min(S * 0.0125, (2 * Math.PI * rLab) / Math.max(1, n) / 1.2);
  const gap = (fs * 1.2) / rLab;
  list.forEach(o => { o.ideal = ang(o.am); });
  // forward pass, then pull back any overflow past the full circle
  let prev = -Infinity;
  list.forEach(o => { o.a = Math.max(o.ideal, prev + gap); prev = o.a; });
  const limit = -Math.PI / 2 + 2 * Math.PI - gap;
  for (let i = n - 1, next = Infinity; i >= 0; i--) { const o = list[i]; o.a = Math.min(o.a, next - gap, limit); next = o.a; }
  const maxChars = Math.floor((rMax - rLab) / (fs * 0.5));
  for (const o of list) {
    const c = TYPES[o.e.k]?.color || '#555';
    const [dx, dy] = P(rDot, o.ideal), [lx, ly] = P(rLab - fs * 0.4, o.a), [mx, my] = P(rDot + (rLab - rDot) * 0.5, o.ideal);
    g += `<path d="M${f(dx)},${f(dy)} Q${f(mx)},${f(my)} ${f(lx)},${f(ly)}" fill="none" stroke="${c}" stroke-width="${f(fs * 0.06)}" stroke-opacity=".7"/>`;
    g += `<circle cx="${f(dx)}" cy="${f(dy)}" r="${f(Math.max(fs * 0.28, S * 0.002))}" fill="${c}"/>`;
    const deg = o.a * 180 / Math.PI, flip = deg > 90 && deg < 270;
    const [tx, ty] = P(rLab, o.a);
    let label = o.e.t; if (label.length > maxChars) label = label.slice(0, maxChars - 1) + '…';
    g += `<text ${print ? '' : `data-ev="${xmlEsc(o.e.id)}" class="wh-ev" `}x="${f(tx)}" y="${f(ty)}" font-family="${font}" font-size="${f(fs)}" fill="${ink}" text-anchor="${flip ? 'end' : 'start'}" dominant-baseline="middle" transform="rotate(${f(flip ? deg - 180 : deg)} ${f(tx)} ${f(ty)})">${xmlEsc(label)}</text>`;
  }
  // Prophecy chords: from the moment foretold to the moment fulfilled, across the inner circle
  if (prophecies.length) {
    const rc = r0 * 0.97;
    g += `<defs><marker id="wparr" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="${f(S * 0.006)}" markerHeight="${f(S * 0.006)}" markerUnits="userSpaceOnUse" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="${PROPHECY_COLOR}"/></marker></defs>`;
    for (const p of prophecies) {
      const fa = p.f ? p.f.am : p.x ? p.x.am : FUTURE_AM;
      if (p.g.am < from || p.g.am > to + 1 || fa < from || fa > to + 1) continue;
      const a0 = ang(p.g.am), a1 = ang(fa);
      const d = Math.abs(a1 - a0), mid = (a0 + a1) / 2;
      const k = Math.max(0.05, 1 - d / Math.PI) * 0.85;      // short spans hug the rim, long spans cross the middle
      const [x0, y0] = P(rc, a0), [x1, y1] = P(rc, a1), [cx, cy] = P(rc * k, mid);
      const hot = p.id === lastId;
      g += `<path ${print ? '' : `data-pr="${xmlEsc(p.id)}" class="wh-ev" `}d="M${f(x0)},${f(y0)} Q${f(cx)},${f(cy)} ${f(x1)},${f(y1)}" fill="none" stroke="${PROPHECY_COLOR}" stroke-width="${f(S * (hot ? 0.003 : 0.0011))}" stroke-opacity="${hot ? 0.95 : (prophecies.length > 150 ? 0.18 : 0.4)}"${p.f ? '' : ` stroke-dasharray="${f(S * 0.004)} ${f(S * 0.003)}"`} marker-end="url(#wparr)"><title>${xmlEsc(p.t)} (${xmlEsc(p.ref)})</title></path>`;
    }
  }
  // centre
  g += `<text x="${C}" y="${f(C - S * 0.03)}" font-family="${serif}" font-size="${f(S * 0.034)}" fill="${print ? '#0F4C5A' : 'var(--brine)'}" text-anchor="middle">${from === 1 && to === 7000 ? '7000 years' : `${from}–${to} AM`}</text>`;
  g += `<text x="${C}" y="${f(C + S * 0.005)}" font-family="${font}" font-size="${f(S * 0.0135)}" fill="${ink2}" text-anchor="middle">${xmlEsc(civilYear(from))} – ${xmlEsc(civilYear(to))}</text>`;
  g += `<text x="${C}" y="${f(C + S * 0.03)}" font-family="${font}" font-size="${f(S * 0.0125)}" fill="${ink2}" text-anchor="middle">${n} events${prophecies.length ? ` · ${prophecies.length} prophecies` : ''}${title ? ' · ' + xmlEsc(title) : ''}</text>`;
  return { svg: g, fontSize: fs, count: n };
}

// ---------------------------------------------------------------------------
// Print poster: horizontal rows, labels stacked in lanes above each row's line.
// W and H are in points (1/72 inch). Returns the SVG body and the font size used.
export function linePosterSVG(events, W, H, { from = 1, to = 7000, header = 64 } = {}) {
  const span = to - from + 1;
  const rowsCount = Math.min(14, Math.max(1, Math.round(span / 500)));
  const rowSpan = span / rowsCount;
  const margin = 36, left = margin + 56, right = W - margin;
  const rowW = right - left;
  const list = events.map(e => ({ e, am: e.am ?? amPos(e.j) })).filter(o => o.am >= from && o.am < to + 1).sort((a, b) => a.am - b.am);
  const maxLen = 46;
  const text = e => (e.t.length > maxLen ? e.t.slice(0, maxLen - 1) + '…' : e.t);
  function layout(fs) {
    const rows = Array.from({ length: rowsCount }, () => ({ items: [], lanes: [] }));
    for (const o of list) {
      const r = Math.min(rowsCount - 1, Math.floor((o.am - from) / rowSpan));
      const x = left + ((o.am - from - r * rowSpan) / rowSpan) * rowW;
      const w = text(o.e).length * fs * 0.52 + fs * 0.6;
      const toLeft = x + w > right;           // flip label to the left near the row end
      const x0 = toLeft ? x - w : x, x1 = toLeft ? x : x + w;
      const row = rows[r];
      let lane = row.lanes.findIndex(end => end < x0 - fs * 0.4);
      if (lane < 0) { lane = row.lanes.length; row.lanes.push(0); }
      row.lanes[lane] = x1;
      row.items.push({ o, x, lane, toLeft });
    }
    const axisH = fs * 2.6;
    const total = rows.reduce((s, r) => s + Math.max(1, r.lanes.length) * fs * 1.35 + axisH, 0);
    return { rows, axisH, total };
  }
  let fs = 28, L;
  for (; fs > 3; fs *= 0.94) { L = layout(fs); if (L.total <= H - header - margin * 2) break; }
  L = L || layout(fs);
  const extra = (H - header - margin * 2 - L.total) / rowsCount; // share spare height
  let y = margin + header, g = '';
  L.rows.forEach((row, r) => {
    const lanesH = Math.max(1, row.lanes.length) * fs * 1.35 + Math.max(0, extra);
    const axisY = y + lanesH;
    const a0 = from + r * rowSpan, a1 = a0 + rowSpan;
    // age colour band under the axis
    AGE_SPANS.forEach(([a, b], i) => {
      const lo = Math.max(a, a0), hi = Math.min(b + 1, a1);
      if (hi <= lo) return;
      const x0 = left + ((lo - a0) / rowSpan) * rowW, x1 = left + ((hi - a0) / rowSpan) * rowW;
      g += `<rect x="${x0.toFixed(1)}" y="${(axisY).toFixed(1)}" width="${(x1 - x0).toFixed(1)}" height="${(fs * 0.7).toFixed(1)}" fill="${AGE_COLORS[i]}"/>`;
    });
    g += `<line x1="${left}" y1="${axisY.toFixed(1)}" x2="${right}" y2="${axisY.toFixed(1)}" stroke="#4E5D61" stroke-width="${(fs * 0.08).toFixed(2)}"/>`;
    // ticks every 50 years (jubilee), labels every 100
    for (let am = Math.ceil(a0 / 50) * 50; am < a1; am += 50) {
      const x = left + ((am - a0) / rowSpan) * rowW;
      g += `<line x1="${x.toFixed(1)}" y1="${axisY.toFixed(1)}" x2="${x.toFixed(1)}" y2="${(axisY + fs * (am % 100 ? 0.5 : 0.9)).toFixed(1)}" stroke="#4E5D61" stroke-width="${(fs * 0.06).toFixed(2)}"/>`;
      if (am % 100 === 0) g += `<text x="${x.toFixed(1)}" y="${(axisY + fs * 1.85).toFixed(1)}" font-family="Helvetica, Arial, sans-serif" font-size="${(fs * 0.78).toFixed(1)}" fill="#4E5D61" text-anchor="middle">${am} AM · ${xmlEsc(D.yearShort(am - D.EPOCH_OFFSET))}</text>`;
    }
    g += `<text x="${margin}" y="${(axisY - fs * 0.3).toFixed(1)}" font-family="Times, Georgia, serif" font-size="${(fs * 1.05).toFixed(1)}" fill="#0F4C5A">${Math.round(a0)}</text>`;
    g += `<text x="${margin}" y="${(axisY + fs * 0.9).toFixed(1)}" font-family="Helvetica, Arial, sans-serif" font-size="${(fs * 0.7).toFixed(1)}" fill="#4E5D61">${xmlEsc(D.yearShort(Math.round(a0) - D.EPOCH_OFFSET))}</text>`;
    const ty = it => axisY - (it.lane + 1) * fs * 1.35 + fs * 0.35;
    for (const it of row.items) {
      const c = TYPES[it.o.e.k]?.color || '#555';
      g += `<line x1="${it.x.toFixed(1)}" y1="${axisY.toFixed(1)}" x2="${it.x.toFixed(1)}" y2="${(ty(it) + fs * 0.25).toFixed(1)}" stroke="${c}" stroke-width="${(fs * 0.07).toFixed(2)}"/>`;
      g += `<circle cx="${it.x.toFixed(1)}" cy="${axisY.toFixed(1)}" r="${(fs * 0.22).toFixed(2)}" fill="${c}"/>`;
    }
    for (const it of row.items) {
      const c = TYPES[it.o.e.k]?.color || '#555';
      const w = text(it.o.e).length * fs * 0.52 + fs * 0.3, y0 = ty(it) - fs * 0.92;
      const bx = it.toLeft ? it.x - w - fs * 0.15 : it.x + fs * 0.1;
      g += `<rect x="${bx.toFixed(1)}" y="${y0.toFixed(1)}" width="${w.toFixed(1)}" height="${(fs * 1.2).toFixed(1)}" fill="#FFFFFF"/>`;
      g += `<rect x="${(it.toLeft ? it.x - fs * 0.12 : it.x + fs * 0.02).toFixed(1)}" y="${y0.toFixed(1)}" width="${(fs * 0.1).toFixed(1)}" height="${(fs * 1.2).toFixed(1)}" fill="${c}"/>`;
      g += `<text x="${(it.x + (it.toLeft ? -fs * 0.3 : fs * 0.3)).toFixed(1)}" y="${ty(it).toFixed(1)}" font-family="Helvetica, Arial, sans-serif" font-size="${fs.toFixed(1)}" fill="#1B2427" text-anchor="${it.toLeft ? 'end' : 'start'}">${xmlEsc(text(it.o.e))}</text>`;
    }
    y = axisY + L.axisH;
  });
  return { svg: g, fontSize: fs, count: list.length };
}

/** Wrap poster content in a full SVG document with title, legend and credit. */
export function posterDoc(kind, events, W, H, { from, to, cats, prophecies = [] }) {
  const margin = 36;
  const titleSize = Math.max(18, Math.min(W, H) * 0.028);
  let body, fs;
  if (kind === 'wheel') {
    const size = Math.min(W, H - titleSize * 2.4) - margin;
    const r = wheelSVG(events, size, { from, to, print: true, prophecies });
    body = `<g transform="translate(${((W - size) / 2).toFixed(1)}, ${(H - size - margin * 0.5).toFixed(1)})">${r.svg}</g>`;
    fs = r.fontSize;
  } else {
    // prophecies print as a 'foretold' and a 'fulfilled' label each
    const pe = [];
    for (const p of prophecies) {
      pe.push({ t: `Foretold: ${p.t} (${p.ref})`, k: 'prophecy', am: p.g.am });
      if (p.f) pe.push({ t: `Fulfilled: ${p.t}${p.f.label ? ' (' + p.f.label + ')' : ''}`, k: 'prophecy', am: p.f.am });
    }
    const r = linePosterSVG([...events, ...pe], W, H, { from, to, header: titleSize * 2.2 });
    body = r.svg; fs = r.fontSize;
  }
  const legend = cats.map((k, i) => `<circle cx="${(W - margin - (cats.length - i) * titleSize * 4.2).toFixed(1)}" cy="${(margin + titleSize * 0.15).toFixed(1)}" r="${(titleSize * 0.22).toFixed(1)}" fill="${TYPES[k].color}"/><text x="${(W - margin - (cats.length - i) * titleSize * 4.2 + titleSize * 0.4).toFixed(1)}" y="${(margin + titleSize * 0.35).toFixed(1)}" font-family="Helvetica, Arial, sans-serif" font-size="${(titleSize * 0.55).toFixed(1)}" fill="#1B2427">${TYPES[k].label}</text>`).join('');
  const head = `<text x="${margin}" y="${(margin + titleSize * 0.5).toFixed(1)}" font-family="Times, Georgia, serif" font-size="${titleSize.toFixed(1)}" fill="#0F4C5A">The Dead Sea Scroll Calendar Timeline</text>
    <text x="${margin}" y="${(margin + titleSize * 1.25).toFixed(1)}" font-family="Helvetica, Arial, sans-serif" font-size="${(titleSize * 0.42).toFixed(1)}" fill="#4E5D61">${from}–${to} AM (${xmlEsc(civilYear(from))} – ${xmlEsc(civilYear(to))}) · Creation = 3925 BC · Bible dates per Scripture and Ken Johnson's chronology · dss-calendar.pages.dev</text>${legend}`;
  return {
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${W}pt" height="${H}pt" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="#FFFFFF"/>${head}${body}</svg>`,
    fontSize: fs,
  };
}
