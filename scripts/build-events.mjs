// Merges data/sources/*.json into data/events.json, computing each event's day
// number (jdn) and its DSS date. Run: node scripts/build-events.mjs
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import * as D from '../engine/dss.js';
D.init(JSON.parse(readFileSync(new URL('../engine/tekufah-table.json', import.meta.url))));

const dir = new URL('../data/sources/', import.meta.url);
const seen = new Set(), out = [], problems = [];
for (const f of readdirSync(dir).filter(f => f.endsWith('.json')).sort()) {
  for (const e of JSON.parse(readFileSync(new URL(f, dir)))) {
    let jdn;
    if (e.creation) jdn = D.yearStart(1) - 4 + e.creation;
    else if (e.am) jdn = D.toJdn(e.am, e.month, e.day);
    else if (e.cal === 'julian') jdn = D.julToJdn(e.y, e.m, e.d);
    else if (e.cal === 'gregorian') jdn = D.gregToJdn(e.y, e.m, e.d);
    else { problems.push(`${f}: ${e.id} has no date`); continue; }
    // reject impossible civil dates (e.g. 31 June)
    if (e.cal) {
      const back = e.cal === 'julian' ? D.jdnToJul(jdn) : D.jdnToGreg(jdn);
      if (back.y !== e.y || back.m !== e.m || back.d !== e.d) { problems.push(`${f}: ${e.id} invalid date`); continue; }
    }
    let id = e.id;
    if (seen.has(id)) { problems.push(`${f}: duplicate id ${id}`); continue; }
    seen.add(id);
    out.push({ id, t: e.title, j: jdn, k: e.type || 'secular', r: e.region || '', n: e.note || '', s: e.source || '', u: e.url || '', c: e.certainty || 'exact', o: e.cal || 'dss' });
  }
}
out.sort((a, b) => a.j - b.j);
writeFileSync(new URL('../data/events.json', import.meta.url), JSON.stringify(out));
console.log(`${out.length} events written`);
if (problems.length) console.log('Problems:\n' + problems.join('\n'));
