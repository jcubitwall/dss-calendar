// Places every Scripture event that has a month (and usually a day) into an AM year.
// Input:  data/bible/dated-verses.json   (month/day exactly as Scripture gives them)
// Output: data/sources/bible-dated.json  (events for build-events.mjs)
//
// Source priority (owner's rule): Scripture's dates are fixed; Ken Johnson's
// chronology places them in years; secular dating is only mentioned alongside.
import { readFileSync, writeFileSync } from 'node:fs';

const raw = JSON.parse(readFileSync(new URL('../data/bible/dated-verses.json', import.meta.url)));
const BC = bc => 3926 - bc; // AM year whose Nisan falls in the spring of `bc` BC
const AD = ad => ad + 3925;

// ---- Year frameworks -------------------------------------------------------
// Anchors stated by Ken Johnson (sources in data/bible/README.md):
//   Flood 1656 · Exodus 2448 · Temple foundation 2928 · Shishak 2969 · Samaria 3205
//   Temple destroyed 3338 · Cyrus' decree 536 BC · Darius I 522 BC · Xerxes 486 BC
//   Artaxerxes' 20th year = Nisan 444 BC · Jesus born 2 BC · ministry AD 28 · cross AD 32
const exodusYear = n => 2447 + n;            // "nth year after the Exodus" (year of Exodus = 1)
const solomon = n => 2924 + n;               // 4th year = 2928 (Temple foundation)
const rehoboam = n => 2964 + n;              // 5th year = 2969 (Shishak)
const asa = n => 2984 + n;                   // after Rehoboam 17 + Abijah 3
const hezekiah = n => 3199 + n;              // 6th year = 3205 (Samaria)
const josiah = n => 3285 + n;                // after Hezekiah 29, Manasseh 55, Amon 2
const jehoiakim = n => 3316 + n;             // after Josiah 31
const zedekiah = n => 3327 + n;              // 11th year = 3338 ✓ (matches Temple destroyed)
const captivity = n => 3327 + n;             // Jehoiachin's exile; Ezek 24:1 (9th) = 2 Kgs 25:1 (Zedekiah 9th)
const cyrus = n => BC(537 - n);              // decree 536 BC = year 1
const darius = n => BC(522 - n);             // Darius I accession 522 BC
const xerxes = n => BC(486 - n);             // Ahasuerus = Xerxes I (Ken Johnson's Daniel 11 chart)
const artaxerxes = n => BC(464 - n);         // 20th year = 444 BC (Ken Johnson)

const S = 'Scripture count from Ken Johnson\'s anchor';
const K = 'Ken Johnson\'s stated year';
const D = 'Derived from Ken Johnson\'s reign dates';

// index in dated-verses.json → [AM year, basis, extra note]   (null = not placed)
const Y = {
  0: [1656, K], 1: [1656, K], 2: [1656, K], 3: [1657, S], 4: [1657, S],
  5: [exodusYear(1), K], 6: [exodusYear(1), K], 7: [exodusYear(1), K], 8: [exodusYear(1), S], 9: [exodusYear(1), S],
  10: [exodusYear(2), S], 11: [exodusYear(2), S], 12: [exodusYear(2), S], 14: [exodusYear(2), S],
  15: [exodusYear(40), D, 'Year not stated in the verse; usually taken as the 40th year.'],
  16: [exodusYear(40), S], 17: [exodusYear(40), S],
  18: [exodusYear(41), S], 19: [exodusYear(41), S], 20: [exodusYear(41), S], 21: [exodusYear(41), S],
  24: [solomon(4), K], 25: [solomon(11), S],
  26: [2935, K, 'Ken Johnson dates the dedication to 2935 AM.'], 27: [2935, K, 'Ken Johnson dates the dedication to 2935 AM.'],
  28: [rehoboam(1), D, 'First year of the divided kingdom.'],
  29: [asa(15), D],
  30: [hezekiah(1), S], 31: [hezekiah(1), S], 32: [hezekiah(1), S], 33: [hezekiah(1), S], 34: [hezekiah(1), S], 35: [hezekiah(1), S],
  36: [josiah(18), S],
  37: [zedekiah(9), S], 38: [zedekiah(11), S], 39: [zedekiah(11), S], 40: [zedekiah(11), S], 41: [zedekiah(11), S],
  42: [captivity(37), S], 43: [captivity(37), S],
  44: [zedekiah(4), S], 45: [zedekiah(4), S], 46: [jehoiakim(5), S], 47: [jehoiakim(5), S],
  48: [cyrus(1), D], 49: [cyrus(1), D], 50: [cyrus(2), D],
  51: [darius(6), D], 52: [darius(7), D],
  53: [artaxerxes(7), D], 54: [artaxerxes(7), D], 55: [artaxerxes(7), D], 56: [artaxerxes(7), D], 57: [artaxerxes(7), D], 58: [artaxerxes(8), D],
  59: [artaxerxes(20) - 1, D, 'Kislev of the 20th year falls before the Nisan of Nehemiah 2:1, so it is placed in the year before.'],
  60: [artaxerxes(20), K], 61: [artaxerxes(20), D], 62: [artaxerxes(20), D], 63: [artaxerxes(20), D], 64: [artaxerxes(20), D], 65: [artaxerxes(20), D], 66: [artaxerxes(20), D],
  67: [xerxes(7), D], 68: [xerxes(12), D], 69: [xerxes(12), D], 70: [xerxes(12), D], 71: [xerxes(12), D], 72: [xerxes(12), D], 73: [xerxes(12), D], 74: [xerxes(12), D], 75: [xerxes(12), D],
  76: [captivity(5), S], 77: [captivity(6), S], 78: [captivity(7), S], 79: [captivity(9), S], 81: [captivity(10), S],
  82: [captivity(27), S], 83: [captivity(11), S], 84: [captivity(11), S], 85: [captivity(12), S],
  87: [captivity(12), S, 'Counted this way the news arrives about 18 months after the fall; some ancient manuscripts read the 11th year.'],
  88: [captivity(25), S],
  89: [cyrus(3), D],
  90: [darius(2), D], 91: [darius(2), D], 92: [darius(2), D], 93: [darius(2), D], 94: [darius(2), D], 95: [darius(2), D], 96: [darius(2), D], 97: [darius(4), D],
  98: [AD(11), D, 'Twelve years after a birth in 2 BC (Ken Johnson).'],
  99: [AD(29), D, 'First Passover after the ministry began in AD 28 (Ken Johnson).'],
  100: [AD(31), D], 101: [AD(31), D], 102: [AD(31), D], 103: [AD(31), D],
  104: [AD(32), K], 105: [AD(32), K],
  108: [AD(32), K, 'Pentecost is always Sivan 15 on this calendar.'],
};
// Not placed: 13 (a law, not an event); 22, 23, 80, 86 (no month or no year); 106, 107 (the crucifixion
// is already on the calendar as Ken Johnson dates it, Nisan 14 3957 AM); 109–112 (no year in Ken Johnson's work).
const DAY_FILL = { 108: 15 }; // Pentecost day from this calendar's fixed feast

const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const out = [], skipped = [];
raw.forEach((v, i) => {
  const y = Y[i];
  if (!y) { skipped.push(`${i} ${v.ref}`); return; }
  const [am, basis, extra] = y;
  const day = v.day ?? DAY_FILL[i] ?? null;
  const notes = [v.note, extra].filter(Boolean).join(' ');
  out.push({
    id: 'bible-' + slug(v.ref + '-' + v.event).slice(0, 60),
    title: v.event,
    am, month: v.month, day: day ?? 1, precision: day ? 'day' : 'month',
    type: 'biblical', region: v.ref,
    note: notes,
    basis,
    source: v.ref + (v.parallel?.length ? ` (see ${v.parallel.join(', ')})` : ''),
    url: `https://www.biblegateway.com/passage/?search=${encodeURIComponent(v.ref)}&version=KJV`,
    certainty: basis === D ? 'derived' : 'chronology',
  });
});
writeFileSync(new URL('../data/sources/bible-dated.json', import.meta.url), JSON.stringify(out, null, 1));
console.log(`${out.length} Bible events placed; not placed: ${skipped.join('; ')}`);
