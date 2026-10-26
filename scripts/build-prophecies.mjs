// Merges data/prophecy/*.json into data/prophecies.json for the app.
// Years in the sources are historical (586 BC = -586); positions are stored in AM.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import * as D from '../engine/dss.js';
D.init(JSON.parse(readFileSync(new URL('../engine/tekufah-table.json', import.meta.url))));

const astro = y => (y < 0 ? y + 1 : y);
function pos(t) {
  if (!t || t.year == null) return null;
  const y = astro(t.year);
  if (t.m && t.d) {
    const jdn = (t.cal === 'julian' || (t.cal !== 'gregorian' && y < 1582)) ? D.julToJdn(y, t.m, t.d) : D.gregToJdn(y, t.m, t.d);
    const x = D.fromJdn(jdn);
    return { am: x.am + (x.dayOfYear - 1) / D.yearLength(x.am), j: jdn, label: t.label || '', approx: false };
  }
  // year only: middle of the DSS year that begins in that civil spring
  return { am: y + D.EPOCH_OFFSET + 0.5, label: t.label || D.yearLabel(y), approx: !!t.approx };
}
const dir = new URL('../data/prophecy/', import.meta.url);
const out = [], seen = new Set(), seenPair = new Set(), problems = [];
for (const f of readdirSync(dir).filter(f => f.endsWith('.json')).sort()) {
  for (const p of JSON.parse(readFileSync(new URL(f, dir)))) {
    const pair = p.num ? `#${p.num}` : `${(p.prophecy || '').toLowerCase()}|${(p.fulfilment || '').toLowerCase()}|${(p.title || '').toLowerCase().slice(0, 20)}`;
    if (seen.has(p.id) || seenPair.has(pair)) { problems.push(`${f}: duplicate ${p.id}`); continue; }
    const g = pos(p.given), fl = p.status === 'future' ? null : pos(p.fulfilled);
    if (!g) { problems.push(`${f}: ${p.id} has no given year`); continue; }
    if (p.status !== 'future' && !fl) { problems.push(`${f}: ${p.id} has no fulfilment year`); continue; }
    if (fl && g.am > fl.am && g.am - fl.am < 1) g.am = fl.am - 0.01; // same year: foretold just before
    const lookBack = /^age-/.test(p.id);   // church ages: John wrote c. AD 95 about ages that had already begun
    if (fl && fl.am < g.am - 1 && !lookBack) { problems.push(`${f}: ${p.id} fulfilled before given`); continue; }
    seen.add(p.id); seenPair.add(pair);
    out.push({
      id: p.id, t: p.title, ref: p.prophecy || '', who: p.prophet || '', g, f: fl, fr: p.fulfilment || '',
      ...(p.status !== 'fulfilled' && p.expected ? { x: pos(p.expected) } : {}),
      ...(p.num ? { n: p.num } : {}), ...(/^age-|^apr-/.test(p.id) ? { kj: 1 } : {}), ...(p.section ? { sec: p.section } : {}), ...(p.notJohnson ? { nj: 1 } : {}),
      st: p.status || 'fulfilled', s: p.summary || '', a: p.agreement || [], dss: p.dss || '',
      src: (p.sources || []).map(s => ({ n: s.name, u: s.url || '' })), ys: [p.given?.yearSource, p.fulfilled?.yearSource].filter(Boolean),
    });
  }
}
// ---- Audit corrections (data/prophecy/audit/fixes.json), applied last ----
const FIX = JSON.parse(readFileSync(new URL('../data/prophecy/audit/fixes.json', import.meta.url)));
const amOfYear = y => (y <= 0 ? 3926 + y : y + 3925) + 0.5;   // y: negative = BC
for (const p of out) {
  // the same anchors always carry the same label
  for (const k of ['g', 'f']) if (p[k]?.label) p[k].label = p[k].label.replace(/c\. 534 BC \(3rd year of Cyrus\)/, 'c. 535 BC (3rd year of Cyrus)').replace(/1670 BC \(Jacob's death, 2255 AM\)/, "1671 BC (Jacob's death, 2255 AM)");
  const x = FIX[p.id]; if (!x) continue;
  if ('dss' in x) p.dss = x.dss;
  if ('t' in x) p.t = x.t;
  if ('ref' in x) p.ref = x.ref;
  if ('s' in x) p.s = x.s;
  for (const [a, b] of x.sRep || []) { if (!p.s.includes(a)) console.warn('audit sRep not found', p.id, a.slice(0, 40)); p.s = p.s.replace(a, b); }
  for (const k of ['g', 'f']) if (x[k]) p[k] = { ...(p[k] || {}), am: amOfYear(x[k].year), label: x[k].label, approx: /^c\.|before/.test(x[k].label) };
}
for (const id of Object.keys(FIX)) if (id[0] !== '_' && !out.some(p => p.id === id)) console.warn('audit fix for missing id', id);
out.sort((a, b) => a.g.am - b.g.am);
writeFileSync(new URL('../data/prophecies.json', import.meta.url), JSON.stringify(out));
console.log(`${out.length} prophecies written (${out.filter(p => p.st === 'future').length} future)`);
if (problems.length) console.log('Skipped:\n' + problems.join('\n'));
