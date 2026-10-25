// Builds data/prophecy/*.json from Ken Johnson's tables (transcribed from the owner's copy of
// "Ancient Prophecies Revealed", 2008) plus the researchers' files in research/.
//   johnson.json     — Johnson #1–485, his numbers, titles, references and fulfilment years
//   supplement.json  — prophecies from the research that are not in Johnson's list
// Then run scripts/build-prophecies.mjs.
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';

const dir = new URL('../data/prophecy/', import.meta.url);
const rdir = new URL('../data/prophecy/research/', import.meta.url);
const tsv = f => readFileSync(new URL(f, dir), 'utf8').split('\n').filter(l => /^\d/.test(l)).map(l => l.split('\t'));

// ---- Book years -> calendar years ------------------------------------------------
// The 2008 book's BC years run 1–2 years later than Johnson's own AM figures used by the
// calendar (Creation 3925 BC, Flood 2270 BC = 1656 AM, Exodus 1478 BC = 2448 AM, Temple
// dedicated 991 BC = 2935 AM). Shift them so the arrows meet the calendar's own events.
const adjust = y => (y === -3924 ? -3925 : y <= -900 ? y - 2 : y < -580 ? y - 1 : y);

// ---- Reference parsing --------------------------------------------------------------
const BOOK = s => {
  const m = /^\s*([1-3]?)\s*([A-Za-z]+)/.exec(s); if (!m) return '';
  let b = m[2].toLowerCase();
  if (b.startsWith('jude')) b = 'jude'; else if (b.startsWith('judg')) b = 'judg';
  else if (b.startsWith('ps')) b = 'psa'; else if (b.startsWith('song')) b = 'son';
  else if (b.startsWith('phile')) b = 'phm'; else b = b.slice(0, 3);
  return m[1] + b;
};
function refKey(r) {
  const m = /([1-3]?\s*[A-Za-z]+)\.?\s*(\d+)(?::(\d+))?/.exec(r || '');
  return m ? { b: BOOK(m[1]), c: +m[2], v: m[3] ? +m[3] : 0 } : null;
}
function allKeys(r) { // every "Book c:v" in a reference string, carrying the book forward
  const out = []; let book = '';
  for (const part of String(r || '').split(/[;,(){}]/)) {
    const m = /^\s*([1-3]?\s*[A-Za-z]+)?\.?\s*(\d+)(?::(\d+))?/.exec(part);
    if (!m) continue;
    if (m[1]) book = BOOK(m[1]);
    if (book) out.push({ b: book, c: +m[2], v: m[3] ? +m[3] : 0 });
  }
  return out;
}
const kstr = k => `${k.b} ${k.c}:${k.v}`;

// ---- When was it foretold? ------------------------------------------------------------
// Approximate dates of the prophet / speaker, on the calendar's chronology.
const BYBOOK = {
  psa: -1010, pro: -950, isa: -710, jer: -610, lam: -587, eze: -590, hos: -755, joe: -820, amo: -760,
  oba: -590, jon: -760, mic: -730, nah: -660, hab: -607, zep: -630, hag: -520, zec: -518, mal: -430,
  rom: 57, '1cor': 55, '2cor': 56, gal: 49, eph: 60, phi: 61, col: 60, '1the': 51, '2the': 51, '1tim': 64,
  '2tim': 67, tit: 63, heb: 65, jam: 48, '1pet': 64, '2pet': 66, '1joh': 90, '2joh': 90, '3joh': 90, jude: 68, rev: 95,
  mat: 30, mar: 30, joh: 30, act: 32,
};
const GEN = [[3, -3925], [4, -3925], [6, -2390], [9, -2270], [11, -1933], [12, -1903], [13, -1902], [15, -1908],
  [17, -1879], [18, -1879], [21, -1876], [22, -1850], [26, -1800], [28, -1760], [37, -1716], [41, -1706], [46, -1688], [49, -1671]];
const DAN = { 2: -604, 4: -583, 5: -537, 7: -553, 8: -551, 9: -537, 10: -535, 11: -535, 12: -535 };
const MOSES = { exo: -1478, lev: -1477, num: -1477, deu: -1438, jos: -1438 };
function givenFor(pred, fulfilled) {
  const k = refKey(pred); const label = y => (y <= 0 ? `c. ${-y} BC` : `c. AD ${y}`);
  let y = null;
  if (!k) {
    if (/josephus/i.test(pred)) y = -3200;                   // Adam's prediction (Josephus, Ant. 1.2.3)
    else if (/esdras/i.test(pred)) y = -458;                 // Johnson places 2 Esdras in Ezra's day
    else if (/jonah/i.test(pred)) y = -760;
  } else if (k.b === 'gen') { y = GEN.filter(([c]) => c <= k.c).pop()?.[1] ?? -3925; }
  else if (k.b === 'dan') y = DAN[k.c] ?? -550;
  else if (MOSES[k.b]) { y = MOSES[k.b]; if (k.b === 'num' && k.c >= 22) y = -1439; if (k.b === 'exo' && k.c <= 12) y = -1478; }
  else if (k.b === 'luk') y = k.c === 1 ? -3 : k.c === 2 ? -2 : 30;
  else if (k.b === 'joh' && k.c <= 2) y = 28;
  else if (k.b === 'act') y = k.c <= 1 ? 32 : k.c <= 11 ? 44 : 57;
  else if (k.b === '2sa' && k.c === 7) y = -1007;
  else if (k.b === '1ki' && k.c === 13) y = -977;
  else if (BYBOOK[k.b] != null) y = BYBOOK[k.b];
  // Narrative books (Samuel, Kings, Chronicles) and anything unmapped: shortly before fulfilment
  if (y == null) y = fulfilled != null ? fulfilled - (fulfilled < 0 ? 3 : 1) : 0;
  if (fulfilled != null && y > fulfilled) y = fulfilled - (fulfilled < 0 ? 2 : 0);
  return { year: y, approx: true, label: label(y), yearSource: 'derived' };
}

// ---- Exact days Johnson gives ------------------------------------------------------------
const DAY = {
  187: [32, 4, 6, 'julian'],  // 69 weeks end April 6, AD 32
  217: [32, 4, 10, 'julian'], 226: [32, 4, 10, 'julian'], 227: [32, 4, 10, 'julian'], 228: [32, 4, 10, 'julian'],
  244: [32, 4, 13, 'julian'],
  246: [32, 6, 1, 'julian'], 247: [32, 6, 1, 'julian'], 248: [32, 6, 1, 'julian'], 249: [32, 6, 1, 'julian'], 251: [32, 6, 1, 'julian'], 252: [32, 6, 1, 'julian'],
  265: [70, 8, 4, 'julian'], 267: [70, 8, 4, 'julian'], 268: [70, 8, 4, 'julian'],
  288: [1090, 7, 14, 'julian'], 289: [1095, 7, 14, 'julian'], 290: [1290, 7, 18, 'julian'], 291: [1492, 8, 2, 'julian'],
  296: [1914, 8, 1, 'gregorian'], 302: [1942, 7, 10, 'gregorian'],
  306: [1948, 5, 14, 'gregorian'], 309: [1948, 5, 14, 'gregorian'], 316: [1948, 5, 14, 'gregorian'],
  330: [1967, 6, 7, 'gregorian'],
};
const NINTH_OF_AV = new Set([288, 289, 290, 291, 296, 302]);
const NOTE = {
  217: "Johnson: 483 prophetic years of 360 days (173,880 days) from Artaxerxes' decree in Nisan 444 BC end on April 6, AD 32.",
  316: 'Johnson: 2,520 prophetic years (907,200 days) after the end of the captivity, counted from August 3, 537 BC, end on May 14, 1948 (Ezekiel 4:4-6 with Leviticus 26:18).',
  330: "Johnson: the writing on the wall (Mene, Mene, Tekel, Upharsin = 2,520 garahs) counted as 2,520 prophetic years from Darius' decree, August 25, 518 BC, ends on June 7, 1967, the day Israel took the Temple Mount.",
};

// ---- Researchers' files --------------------------------------------------------------------
const research = existsSync(rdir) ? readdirSync(rdir).filter(f => f.endsWith('.json')).sort()
  .flatMap(f => JSON.parse(readFileSync(new URL(f, rdir))).map(p => ({ ...p, _f: f }))) : [];
const byNum = new Map();
for (const p of research) for (const s of p.sources || []) {
  const m = /Ancient Prophecies Revealed,?\s*#(\d+)/.exec(s.name || ''); if (m && !byNum.has(+m[1])) byNum.set(+m[1], p);
}
const byKey = new Map();
for (const p of research) for (const k of allKeys(p.prophecy)) { const s = kstr(k); (byKey.get(s) || byKey.set(s, []).get(s)).push(p); }
const used = new Set();
function match(num, pred, fy) {
  if (byNum.has(num)) return byNum.get(num);
  let best = null, bestD = Infinity;
  for (const k of allKeys(pred)) for (const p of byKey.get(kstr(k)) || []) {
    const pf = p.fulfilled?.year;
    const d = fy == null ? (p.status === 'future' ? 0 : 1e6) : pf == null ? 1e6 : Math.abs(pf - fy);
    const tol = fy == null ? 1 : Math.max(60, Math.abs(fy) * 0.08);
    if (d <= tol && d < bestD && !used.has(p)) { best = p; bestD = d; }
  }
  return best;
}

// ---- Build Johnson items ------------------------------------------------------------------
const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48);
const SRC = n => ({ name: `Ancient Prophecies Revealed, #${n}`, url: 'https://biblefacts.org' });
const out = [];
for (const [n, yr, title, pred, ful] of tsv('johnson-table.tsv')) {
  const num = +n, bookY = +yr, fy = adjust(bookY);
  const m = match(num, pred, fy); if (m) used.add(m);
  const fl = { year: fy, approx: false, label: fy <= 0 ? `${-fy} BC` : `AD ${fy}`, yearSource: 'johnson' };
  if (DAY[num]) { const [y, mo, d, cal] = DAY[num]; Object.assign(fl, { year: y, m: mo, d, cal }); }
  if (bookY !== fy) fl.label += ` (book: ${-bookY} BC)`;
  let given = m?.given?.year != null ? { ...m.given } : givenFor(pred, fy);
  if (m && /p[12]-/.test(m._f) && m.given?.yearSource === 'johnson' && adjust(given.year) !== given.year) {
    given.year = adjust(given.year); given.label = (given.approx ? 'c. ' : '') + (given.year <= 0 ? `${-given.year} BC` : `AD ${given.year}`);
  }
  if (given.year > fy) given = givenFor(pred, fy);
  // Research notes written before the book was available may say Johnson's view couldn't be found; drop those.
  const clean = t => (t || '').split(/(?<=\.)\s+/).filter(x => !(/Johnson/.test(x) && /(not use|does not|doesn't|not found|could not|couldn't|no Johnson|unconfirmed|visible|did not)/i.test(x))).join(' ');
  if (m) m.summary = clean(m.summary);
  const notes = [NOTE[num], NINTH_OF_AV.has(num) ? "Johnson lists this among the calamities that fell on the Ninth of Av (Tisha B'Av)." : '', m?.summary].filter(Boolean);
  out.push({
    id: `apr-${num}`, num, title, prophecy: pred || (NINTH_OF_AV.has(num) ? 'Num. 14 (Ninth of Av)' : ''),
    prophet: m?.prophet || '', given, fulfilled: fl, fulfilment: ful || m?.fulfilment || '',
    status: num === 38 || num === 28 || num === 137 ? 'partial' : 'fulfilled',
    summary: notes.join(' '), agreement: [...new Set(['Ken Johnson', ...(m?.agreement || [])])], dss: m?.dss || '',
    sources: [SRC(num), ...(m?.sources || []).filter(s => !/Ancient Prophecies Revealed/.test(s.name))],
  });
}
for (const [n, section, title, refs] of tsv('johnson-future.tsv')) {
  const num = +n;
  const m = match(num, refs, null); if (m) used.add(m);
  out.push({
    id: `apr-${num}`, num, section, title, prophecy: refs, prophet: m?.prophet || '',
    given: m?.given?.year != null ? m.given : givenFor(refs, null), fulfilled: null, fulfilment: '',
    status: 'future', summary: m?.summary || '', agreement: [...new Set(['Ken Johnson', ...(m?.agreement || [])])],
    dss: m?.dss || '', expected: m?.expected || null,
    sources: [SRC(num), ...(m?.sources || []).filter(s => !/Ancient Prophecies Revealed/.test(s.name))],
  });
}
writeFileSync(new URL('johnson.json', dir), JSON.stringify(out, null, 1));

// ---- Supplement: research items not matched to Johnson ---------------------------------------
// A research item whose title closely restates a Johnson item (same era) is folded into it.
const STOP = new Set('the a of and will be to in his he by on from for with is as an at it that this who over into their they its'.split(' '));
const words = t => new Set(t.toLowerCase().replace(/[^a-z ]/g, ' ').split(/\s+/).filter(x => x.length > 2 && !STOP.has(x)));
const supp = [];
for (const p of research.filter(p => !used.has(p))) {
  const ws = words(p.title); let best = 0, bj = null;
  for (const j of out) {
    const wj = words(j.title); let i = 0; for (const x of ws) if (wj.has(x)) i++;
    const sc = i / Math.max(1, Math.min(ws.size, wj.size));
    const fy = p.fulfilled?.year, jy = j.fulfilled?.year;
    const close = (fy == null && jy == null) || (fy != null && jy != null && Math.abs(fy - adjust(jy)) <= Math.max(40, Math.abs(jy) * 0.05));
    if (close && sc > best) { best = sc; bj = j; }
  }
  if (best >= 0.6) {
    bj.agreement = [...new Set([...bj.agreement, ...(p.agreement || [])])];
    if (!bj.dss && p.dss) bj.dss = p.dss;
    if (!bj.summary && p.summary) bj.summary = p.summary;
    bj.sources.push(...(p.sources || []).filter(s => !/Ancient Prophecies Revealed/.test(s.name) && !bj.sources.some(t => t.name === s.name)));
    continue;
  }
  supp.push({ ...p, notJohnson: true, _f: undefined });
}
writeFileSync(new URL('johnson.json', dir), JSON.stringify(out, null, 1));
writeFileSync(new URL('supplement.json', dir), JSON.stringify(supp, null, 1));
console.log(`Johnson items: ${out.length} (${out.filter(o => o.status === 'future').length} future); matched to research: ${used.size}; supplement: ${supp.length}`);
