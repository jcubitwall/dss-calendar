// Turns the Josephus research files into data/sources/josephus.json.
// Usage: node scripts/import-josephus.mjs <war.json> <ant.json> ...
//   • day dates given in a Jewish/Macedonian month are recomputed with scripts/lib/jewish-lunar.mjs,
//     so every Josephus date uses one method; Roman calendar dates are kept as researched;
//   • month-only dates sit on day 1 of the month (precision "month");
//   • year-only events sit on 1 July of that year (precision "year"; never shown as "on this day").
import { readFileSync, writeFileSync } from 'node:fs';
import * as D from '../engine/dss.js';
import { jewishToJulian } from './lib/jewish-lunar.mjs';
D.init(JSON.parse(readFileSync(new URL('../engine/tekufah-table.json', import.meta.url))));
const files = process.argv.slice(2);
// The same event told in both Jewish War and Antiquities: [war id, antiquities id]. The better-dated telling is kept
// (day > month > year; Antiquities wins ties before AD 66, War from AD 66), and both references are cited.
const SAME = [['war-onias-temple-built', 'onias-temple-leontopolis'], ['war-judas-maccabeus-killed', 'judas-killed-elasa'], ['war-simon-murdered-by-ptolemy', 'simon-murdered-dok'],
  ['war-sabbatical-year-siege-of-dagon', 'dagon-siege-sabbatical-year'], ['war-hyrcanus-takes-samaria', 'samaria-destroyed-voice'], ['war-hyrcanus-dies', 'hyrcanus-i-dies'],
  ['war-aristobulus-first-diadem', 'aristobulus-i-diadem'], ['war-judas-essene-antigonus', 'judas-essene-prophecy-antigonus'], ['war-jannaeus-crucifies-800', 'jannaeus-crucifies-800'],
  ['war-pompey-takes-temple', 'pompey-takes-temple-fast-day'], ['war-gabinius-five-councils', 'gabinius-five-councils'], ['war-crassus-plunders-temple', 'crassus-plunders-temple'],
  ['war-antipater-poisoned', 'antipater-poisoned'], ['war-parthians-pentecost-40bc', 'parthians-invade-pentecost'], ['war-herod-made-king-by-senate', 'herod-made-king-rome'],
  ['war-herod-takes-jerusalem', 'herod-takes-jerusalem-fast-day'], ['war-antigonus-beheaded', 'antigonus-beheaded'], ['war-earthquake-31bc', 'earthquake-herod-7th-year'],
  ['war-herod-meets-octavian-rhodes', 'herod-confirmed-by-octavian'], ['war-sebaste-founded', 'sebaste-founded'], ['war-caesarea-dedicated', 'caesarea-dedicated'],
  ['war-herods-sons-strangled', 'alexander-aristobulus-strangled'], ['war-archelaus-passover-massacre', 'archelaus-passover-massacre'], ['war-sabinus-pentecost-revolt', 'pentecost-revolt-sabinus'],
  ['war-herod-dies', 'herod-dies'], ['war-varus-crucifies-2000', 'varus-crucifies-2000'], ['war-augustus-divides-kingdom', 'augustus-divides-herods-kingdom'],
  ['war-simon-essene-dream', 'simon-essene-archelaus-dream'], ['war-judas-galilean-tax-revolt', 'census-quirinius-judas-galilean'], ['war-tiberias-caesarea-philippi-founded', 'tiberias-founded'],
  ['war-pilate-standards', 'pilate-standards'], ['war-tiberius-dies-agrippa-freed', 'agrippa-i-made-king'], ['war-antipas-banished', 'antipas-banished-lyons'],
  ['war-caligula-statue-petronius', 'caligula-statue-petronius'], ['war-agrippa-i-whole-kingdom', 'claudius-gives-agrippa-judea'], ['war-agrippa-third-wall-begun', 'agrippa-third-wall'],
  ['war-agrippa-i-dies', 'agrippa-i-dies-caesarea'], ['war-cumanus-passover-crush', 'cumanus-passover-disaster'], ['war-torah-scroll-burned', 'soldier-burns-torah'],
  ['war-galilean-killed-at-geman', 'galileans-samaritans-cumanus-deposed'], ['war-jonathan-high-priest-sicarii', 'high-priest-jonathan-murdered'], ['war-egyptian-false-prophet', 'egyptian-prophet-olives'],
  ['war-florus-procurator', 'florus-procurator'], ['war-begins-caesarea-synagogue', 'war-begins-nero-12th-year']];
// Where the researcher's date is better than the lunar rule (e.g. tied to an eclipse), keep it.
const KEEP_DATE = new Set(['golden-eagle-matthias-burned']);
// Corrections after review
const FIX = {
  'testimonium-flavianum': { y: 93, julian: null, precision: 'year', title: 'Josephus writes about Jesus in the Antiquities (Testimonium Flavianum)' },
  'herod-dies': { note_add: 'Placed in 4 BC, the usual date (after the lunar eclipse Josephus mentions). Those who date Jesus\u2019 birth to 2 BC, as Ken Johnson does, put Herod\u2019s death in 1 BC, after the eclipse of 10 January 1 BC.' },
  'john-baptist-executed': { note_add: 'Josephus gives no year; placed about AD 31, before the cross in AD 32.' },
};
const CHURCH_ONLY = /john-baptist|testimonium|james-brother-of-jesus/;
const out = [], report = [], seen = new Set();
const parseJ = s => { const m = /^(-?\d+)-(\d{2})-(\d{2})$/.exec(s || ''); return m ? { y: +m[1], m: +m[2], d: +m[3] } : null; };
const all = files.flatMap(f => JSON.parse(readFileSync(f, 'utf8')));
for (const e0 of all) {
  const fx = FIX[e0.id] || {}; const e = { ...e0, ...fx }; if (fx.note_add) e.note = (e.note || '') + ' ' + fx.note_add;
  if (e.type === 'church' && !CHURCH_ONLY.test(e.id)) e.type = 'secular';
  if (!e.id || seen.has(e.id)) { report.push(`skip duplicate ${e.id}`); continue; }
  seen.add(e.id);
  let y, m, d, precision = e.precision, how = '';
  const r = parseJ(e.julian);
  if (precision === 'day' && e.jmonth && e.jday && !KEEP_DATE.has(e.id)) {
    const c = jewishToJulian(e.y, e.jmonth, e.jday);
    ({ y, m, d } = c);
    if (r) { const diff = c.jdn - D.julToJdn(r.y, r.m, r.d); if (Math.abs(diff) > 2) report.push(`${e.id}: researcher ${e.julian}, converter ${y}-${m}-${d} (${diff > 0 ? '+' : ''}${diff} days)`); }
    how = `${e.jday} ${e.jmonth} converted by the Jewish lunar month`;
  } else if (precision === 'month' && e.jmonth) {
    ({ y, m, d } = jewishToJulian(e.y, e.jmonth, 1));
  } else if ((precision === 'day' || precision === 'month') && r) {
    ({ y, m, d } = r); if (precision === 'month') d = 1;
  } else { precision = 'year'; y = e.y; m = 7; d = 1; }
  const note = [e.note, e.native ? `Josephus: "${e.native}".` : '', e.conversion && precision !== 'year' ? e.conversion : ''].filter(Boolean).join(' ').replace(/\s+/g, ' ');
  out.push({ id: 'jos-' + e.id.replace(/^jos-/, ''), title: e.title, cal: 'julian', y, m, d, ...(precision !== 'day' ? { precision } : {}),
    type: ['secular', 'scrolls', 'church', 'biblical'].includes(e.type) ? e.type : 'secular', region: e.region || '', note, source: e.source, url: e.url || '', certainty: e.certainty === 'exact' ? 'exact' : 'probable' });
}
// merge doubles
const rank = e => (e.precision === 'year' ? 0 : e.precision === 'month' ? 1 : 2);
for (const [w, a] of SAME) {
  const iw = out.findIndex(e => e.id === 'jos-' + w), ia = out.findIndex(e => e.id === 'jos-' + a);
  if (iw < 0 || ia < 0) { report.push(`merge pair missing: ${w} / ${a}`); continue; }
  const W = out[iw], A = out[ia];
  const keepW = rank(W) > rank(A) || (rank(W) === rank(A) && W.y >= 66);
  const K = keepW ? W : A, O = keepW ? A : W;
  K.source = `${K.source}; ${O.source.replace(/^Josephus, /, '')}`;
  if (O.note && !K.note.includes(O.note.slice(0, 40))) { const extra = O.note.split(/(?<=\.)\s/)[0]; if (extra.length < 220) K.note += ' ' + extra; }
  out.splice(out.indexOf(O), 1);
}
out.sort((a, b) => D.julToJdn(a.y, a.m, a.d) - D.julToJdn(b.y, b.m, b.d));
writeFileSync(new URL('../data/sources/josephus.json', import.meta.url), JSON.stringify(out, null, 1));
console.log(out.length, 'events', JSON.stringify(out.reduce((a, e) => (a[e.precision || 'day'] = (a[e.precision || 'day'] || 0) + 1, a), {})));
if (report.length) console.log(report.join('\n'));
