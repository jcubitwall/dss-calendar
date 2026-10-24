// Live lookup of any person, place or event via Wikidata + Wikipedia (free, no key).
// Dates are converted to the DSS calendar using the engine.
import * as D from './engine/dss.js';

const WD = 'https://www.wikidata.org/w/api.php';
const DATE_PROPS = [
  ['P569', 'Born'], ['P570', 'Died'], ['P585', 'Date'], ['P580', 'Began'], ['P582', 'Ended'],
  ['P571', 'Founded / began'], ['P576', 'Dissolved / ended'], ['P577', 'Published'],
  ['P1619', 'Opened'], ['P619', 'Launched'], ['P620', 'Landed'], ['P1191', 'First performed'],
  ['P729', 'In service'], ['P730', 'Out of service'], ['P1249', 'Earliest record'],
];
const JULIAN = 'Q1985786';
const cache = new Map();

async function getJson(url) {
  if (cache.has(url)) return cache.get(url);
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Lookup failed (${r.status})`);
  const j = await r.json();
  cache.set(url, j);
  return j;
}

/** Search Wikidata entities by name. */
export async function search(q, signal) {
  const url = `${WD}?action=wbsearchentities&search=${encodeURIComponent(q)}&language=en&uselang=en&type=item&limit=6&format=json&origin=*`;
  const r = await fetch(url, { signal });
  if (!r.ok) return [];
  const j = await r.json();
  return (j.search || []).map(s => ({ id: s.id, label: s.label || s.id, description: s.description || '' }));
}

/** Parse a Wikidata time value into something the engine understands. */
export function parseTime(v) {
  const m = /^([+-])(\d+)-(\d\d)-(\d\d)/.exec(v.time);
  if (!m) return null;
  let y = parseInt(m[2], 10);
  if (m[1] === '-') y = 1 - y;            // historical "44 BC" (-44) → astronomical -43
  const mo = +m[3], d = +m[4];
  const julian = (v.calendarmodel || '').endsWith(JULIAN);
  const p = v.precision;                   // 11 day, 10 month, 9 year, 8 decade, 7 century
  if (p >= 11 && mo && d) {
    const jdn = julian ? D.julToJdn(y, mo, d) : D.gregToJdn(y, mo, d);
    return { precision: 'day', y, m: mo, d, cal: julian ? 'julian' : 'gregorian', jdn };
  }
  if (p === 10 && mo) {
    const jdn = julian ? D.julToJdn(y, mo, 1) : D.gregToJdn(y, mo, 1);
    return { precision: 'month', y, m: mo, cal: julian ? 'julian' : 'gregorian', jdn };
  }
  if (p === 9) return { precision: 'year', y };
  if (p === 8) return { precision: 'decade', y };
  if (p === 7) return { precision: 'century', y };
  return null;
}

/** Full details for an entity: label, description, summary, image, dates. */
export async function details(id) {
  const url = `${WD}?action=wbgetentities&ids=${id}&props=labels|descriptions|claims|sitelinks&languages=en&sitefilter=enwiki&format=json&origin=*`;
  const j = await getJson(url);
  const e = j.entities?.[id];
  if (!e) throw new Error('Not found');
  const dates = [];
  for (const [p, label] of DATE_PROPS) {
    for (const c of e.claims?.[p] || []) {
      const v = c.mainsnak?.datavalue?.value;
      if (!v || !v.time) continue;
      const t = parseTime(v);
      if (t) dates.push({ label, ...t });
      if (dates.filter(x => x.label === label).length >= 2) break; // keep the list short
    }
  }
  const title = e.sitelinks?.enwiki?.title;
  let summary = '', image = '', wikiUrl = '';
  if (title) {
    wikiUrl = `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`;
    try {
      const s = await getJson(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`);
      summary = s.extract || '';
      image = s.thumbnail?.source || '';
    } catch { /* summary optional */ }
  }
  return {
    id, label: e.labels?.en?.value || id, description: e.descriptions?.en?.value || '',
    summary, image, wikiUrl, wikidataUrl: `https://www.wikidata.org/wiki/${id}`, dates,
  };
}
