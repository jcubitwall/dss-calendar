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
const out = [], report = [], seen = new Set();
const parseJ = s => { const m = /^(-?\d+)-(\d{2})-(\d{2})$/.exec(s || ''); return m ? { y: +m[1], m: +m[2], d: +m[3] } : null; };
for (const f of files) for (const e of JSON.parse(readFileSync(f, 'utf8'))) {
  if (!e.id || seen.has(e.id)) { report.push(`skip duplicate ${e.id}`); continue; }
  seen.add(e.id);
  let y, m, d, precision = e.precision, how = '';
  const r = parseJ(e.julian);
  if (precision === 'day' && e.jmonth && e.jday) {
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
out.sort((a, b) => D.julToJdn(a.y, a.m, a.d) - D.julToJdn(b.y, b.m, b.d));
writeFileSync(new URL('../data/sources/josephus.json', import.meta.url), JSON.stringify(out, null, 1));
console.log(out.length, 'events', JSON.stringify(out.reduce((a, e) => (a[e.precision || 'day'] = (a[e.precision || 'day'] || 0) + 1, a), {})));
if (report.length) console.log(report.join('\n'));
