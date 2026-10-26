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
const DAN = { 2: -604, 4: -583, 5: -537, 7: -553, 8: -551, 9: -536, 10: -535, 11: -535, 12: -535 };
const MOSES = { exo: -1478, lev: -1477, num: -1477, deu: -1438, jos: -1438 };
function givenFor(pred, fulfilled) {
  const k = refKey(pred); const label = y => (y <= 0 ? `c. ${-y} BC` : `c. AD ${y}`);
  let y = null;
  if (/esdras/i.test(pred || '')) y = -458;               // Johnson places 2 Esdras in Ezra's day
  else if (!k) {
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
  289: [1095, 7, 14, 'julian'], 290: [1290, 7, 18, 'julian'], 291: [1492, 8, 2, 'julian'],
  296: [1914, 8, 1, 'gregorian'], 302: [1942, 7, 10, 'gregorian'],
  306: [1948, 5, 14, 'gregorian'], 309: [1948, 5, 14, 'gregorian'], 316: [1948, 5, 14, 'gregorian'],
  330: [1967, 6, 7, 'gregorian'],
};
const NINTH_OF_AV = new Set([288, 289, 290, 291, 296, 302]);
// Evident misprints in the book that the app corrects (data/prophecy/book-corrections.tsv)
const CORR = Object.fromEntries(tsv('book-corrections.tsv').map(([n, book, app]) => [+n, `The book prints "${book}"; corrected here to ${app}.`]));
// Years the book marks as approximate ("1880s", "1920s", "~2000")
const APPROX = { 295: 'AD 1880s', 299: 'AD 1920s', 344: 'c. AD 2000', 345: 'c. AD 2000', 346: 'c. AD 2000', 347: 'c. AD 2000', 348: 'c. AD 2000', 349: 'c. AD 2000', 350: 'c. AD 2000', 351: 'c. AD 2000', 352: 'c. AD 2000', 353: 'c. AD 2000', 354: 'c. AD 2000' };
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


// ---- Audit fixes (Oct 2026) -----------------------------------------------------------------
// Research notes that were attached to the wrong Johnson entry: ignore the match.
const NOMATCH = new Set([100, 123, 124, 155, 241, 315, 325, 329, 332, 335, 338, 343, 347, 360, 394, 439, 475]);
// Keep the research item's dates but not its note.
const NOSUM = new Set([186, 217, 234, 249]);
// "Foretold" dates fixed by hand: [year (negative = BC), label]; 'f' = same as the fulfilment.
const GFIX = {
  13: 'f', 15: 'f', 29: 'f', 49: 'f', 53: 'f', 55: 'f', 56: 'f', 58: 'f', 63: 'f',
  14: [-1710, 'c. 1710 BC (Joseph aged 17)'], 31: [-1070, 'c. 1070 BC'], 132: [-3925, '3925 BC (the Fall)'],
  47: [-1438, 'c. 1438 BC (fall of Jericho)'], 157: [-1438, 'c. 1438 BC (end of the wilderness years)'],
  172: [-1438, 'c. 1438 BC (Moses on the plains of Moab)'], 279: [-1438, 'c. 1438 BC (Moses on the plains of Moab)'],
  214: [-1478, 'c. 1478 BC (Exodus / Sinai)'], 138: [-1007, 'c. 1007 BC (Nathan)'], 158: [-710, 'c. 710 BC'], 159: [-2, 'c. 2 BC'],
  248: [32, 'night of 9-10 Apr AD 32'], 249: [32, 'night of 9-10 Apr AD 32'], 271: [32, 'night of 9-10 Apr AD 32'],
  373: [51, 'c. AD 51'], 387: [51, 'c. AD 51'], 394: [-430, 'c. 430 BC'], 439: [-480, 'c. 480 BC (Zechariah 9-14)'], 475: [57, 'c. AD 57'],
};
// Fulfilment year fixed by hand where the book's year contradicts the Bible's own sequence.
const FFIX = { 14: [-1689, 'c. 1689 BC (book: 1876 BC)'] };
// Where secular dating differs from the book's year, say so (source priority: the book's year is shown).
const SECULAR = {
  86: 'Secular dating: Babylon fell to Cyrus in 539 BC.', 88: 'Secular dating: Lydia fell to Cyrus c. 547-546 BC.',
  99: 'Secular dating: Alexander took Tyre in 332 BC.', 105: 'Secular dating: Seleucus regained Babylon after the battle of Gaza, 312 BC.',
  106: 'Secular dating: the marriage was c. 252 BC.', 107: 'Secular dating: Antiochus II and Berenice died in 246 BC.',
  119: 'Secular dating: Onias III was deposed in 175 BC and killed c. 171 BC.', 264: 'Secular dating: James was stoned c. AD 62 (Josephus, Antiquities 20.9.1).',
  287: 'Secular dating: the East-West Schism is usually dated 1054.', 292: 'Secular dating: the Golden Gate was walled up c. 1541 under Suleiman; the Ottomans took Jerusalem in 1517.',
  301: 'Secular dating: the Republic of Turkey was proclaimed in 1923.', 288: '',
};
const NOTE_ADD = {
  124: "Micah says the ruler from Bethlehem has goings forth \"from of old, from everlasting\"; John 1:1, 14 calls him the Word who was with God in the beginning and was made flesh.",
  155: "Micah named Bethlehem Ephratah as the birthplace of Israel's ruler; Jesus was born there, and the scribes quoted Micah to Herod (Matt. 2:4-6).",
};
// One date per prophet section, so the same chapter is never dated two ways.
function canonGiven(pred, g) {
  if (!g || g.yearSource === 'johnson') return g;
  const k = refKey(pred); if (!k) return g;
  let y = null, lbl = null;
  if (k.b === 'isa' && k.c === 7) y = -735; else if (k.b === 'isa' && (k.c === 8 || k.c === 9)) y = -734;
  else if (k.b === 'zec') { y = k.c <= 8 ? -518 : -480; lbl = k.c <= 8 ? 'c. 518 BC' : 'c. 480 BC (Zechariah 9-14)'; }
  else if (k.b === 'dan' && k.c === 9) { y = -536; lbl = '536 BC (1st year of Darius the Mede)'; }
  else if (k.b === 'dan' && k.c >= 10) { y = -535; lbl = 'c. 535 BC (3rd year of Cyrus)'; }
  else if (k.b === 'joe') y = -835;
  if (y == null) return g;
  return { year: y, approx: !/^536/.test(lbl || ''), label: lbl || `c. ${-y} BC`, yearSource: 'derived' };
}

// Research notes written before the book was available may say Johnson's view couldn't be found, or that a reference is inferred; drop those sentences.
const cleanNote = t => (t || '').split(/(?<=\.)\s+/).filter(x => !(/Johnson/.test(x) && /(not use|does not|doesn't|not found|could not|couldn't|no Johnson|unconfirmed|visible|did not)/i.test(x)) && !/could not be read|not seen|reference here is inferred|verse he uses could not/i.test(x)).join(' ');
// ---- Build Johnson items ------------------------------------------------------------------
const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48);
const SRC = n => ({ name: `Ancient Prophecies Revealed, #${n}`, url: 'https://biblefacts.org' });
const out = [];
for (let [n, yr, title, pred, ful] of tsv('johnson-table.tsv')) {
  const num = +n, bookY = +yr, fy = adjust(bookY);
  // a wrongly matched research item is still consumed here, so it cannot drift onto a neighbouring entry
  const mr = match(num, pred, fy); if (mr) used.add(mr);
  const m0 = NOMATCH.has(num) ? null : mr;
  const m = m0 && NOSUM.has(num) ? { ...m0, summary: '', fulfilment: '' } : m0;
  const fl = { year: fy, approx: false, label: fy <= 0 ? `${-fy} BC` : `AD ${fy}`, yearSource: 'johnson' };
  if (DAY[num]) { const [y, mo, d, cal] = DAY[num]; Object.assign(fl, { year: y, m: mo, d, cal }); }
  if (bookY !== fy) fl.label += ` (book: ${-bookY} BC)`;
  if (APPROX[num]) Object.assign(fl, { approx: true, label: APPROX[num] });
  if (FFIX[num]) Object.assign(fl, { year: FFIX[num][0], approx: true, label: FFIX[num][1] });
  // Prophecies with no verse in the table: the Ninth-of-Av calamities trace to Numbers 14; the eagle vision is 2 Esdras 11.
  if (!pred && NINTH_OF_AV.has(num)) pred = 'Num. 14 (Ninth of Av)';
  if (!pred && /esdras apocalypse/i.test(ful || '')) pred = '2 Esdras 11-12 (Esdras Apocalypse)';
  let given = m?.given?.year != null ? { ...m.given } : givenFor(pred, fy);
  if (m && /p[12]-/.test(m._f) && m.given?.yearSource === 'johnson' && adjust(given.year) !== given.year) {
    given.year = adjust(given.year); given.label = (given.approx ? 'c. ' : '') + (given.year <= 0 ? `${-given.year} BC` : `AD ${given.year}`);
  }
  given = canonGiven(pred, given);
  if (GFIX[num]) given = GFIX[num] === 'f' ? { year: fl.year, approx: true, label: 'c. ' + fl.label.replace(/ \(book.*$/, ''), yearSource: 'derived' } : { year: GFIX[num][0], approx: /^c\./.test(GFIX[num][1]), label: GFIX[num][1], yearSource: 'derived' };
  if (given.year > fl.year) given = givenFor(pred, fl.year);
  // Research notes written before the book was available may say Johnson's view couldn't be found; drop those.
  const clean = t => (t || '').split(/(?<=\.)\s+/).filter(x => !(/Johnson/.test(x) && /(not use|does not|doesn't|not found|could not|couldn't|no Johnson|unconfirmed|visible|did not)/i.test(x)) && !/could not be read|not seen|reference here is inferred|verse he uses could not/i.test(x)).join(' ');
  if (m) m.summary = cleanNote(m.summary);
  const notes = [NOTE[num], NOTE_ADD[num], CORR[num], SECULAR[num], NINTH_OF_AV.has(num) ? "Johnson lists this among the calamities that fell on the Ninth of Av (Tisha B'Av)." : '', m?.summary].filter(Boolean);
  out.push({
    id: `apr-${num}`, num, title, prophecy: pred || (NINTH_OF_AV.has(num) ? 'Num. 14 (Ninth of Av)' : ''),
    prophet: m?.prophet || '', given, fulfilled: fl, fulfilment: ful || m?.fulfilment || '',
    status: num === 38 || num === 28 ? 'partial' : 'fulfilled',
    summary: notes.join(' '), agreement: [...new Set(['Ken Johnson', ...(m?.agreement || [])])], dss: m?.dss || '',
    sources: [SRC(num), ...(m?.sources || []).filter(s => !/Ancient Prophecies Revealed/.test(s.name))],
  });
}
for (const [n, section, title, refs] of tsv('johnson-future.tsv')) {
  const num = +n;
  const mr = match(num, refs, null); if (mr) used.add(mr);
  const m = NOMATCH.has(num) ? null : mr;
  let gv = canonGiven(refs, m?.given?.year != null ? m.given : givenFor(refs, null));
  if (GFIX[num]) gv = { year: GFIX[num][0], approx: /^c\./.test(GFIX[num][1]), label: GFIX[num][1], yearSource: 'derived' };
  out.push({
    id: `apr-${num}`, num, section, title, prophecy: refs, prophet: m?.prophet || '',
    given: gv, fulfilled: null, fulfilment: '',
    status: 'future', summary: [CORR[num], cleanNote(m?.summary)].filter(Boolean).join(' '), agreement: [...new Set(['Ken Johnson', ...(m?.agreement || [])])],
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
    if (!NOMATCH.has(bj.num)) {
      if (!bj.dss && p.dss) bj.dss = p.dss;
      if (!bj.summary && p.summary) bj.summary = cleanNote(p.summary);
    }
    bj.sources.push(...(p.sources || []).filter(s => !/Ancient Prophecies Revealed/.test(s.name) && !bj.sources.some(t => t.name === s.name)));
    continue;
  }
  supp.push({ ...p, notJohnson: true, _f: undefined });
}
writeFileSync(new URL('johnson.json', dir), JSON.stringify(out, null, 1));
writeFileSync(new URL('supplement.json', dir), JSON.stringify(supp, null, 1));
console.log(`Johnson items: ${out.length} (${out.filter(o => o.status === 'future').length} future); matched to research: ${used.size}; supplement: ${supp.length}`);
