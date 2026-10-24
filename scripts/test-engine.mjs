// Checks the engine against every anchor published on dsscalendar.org.
import { readFileSync } from 'node:fs';
import * as D from '../engine/dss.js';
D.init(JSON.parse(readFileSync(new URL('../engine/tekufah-table.json', import.meta.url))));

let fail = 0;
const eq = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fail++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}: ${JSON.stringify(got)}${ok ? '' : '  expected ' + JSON.stringify(want)}`);
};
const g = (y, m, d) => D.gregToJdn(y, m, d);
const dss = (y, m, d) => { const x = D.fromJdn(g(y, m, d)); return x.kind === 'month' ? [x.am, x.month, x.day] : [x.am, x.kind, x.q ?? x.day]; };

// Published Tekufah / Nisan 1 dates
const site = [
  // [AM, Nisan1, TekTammuz, TekTishrei, TekTevet, closing TekNisan] (Gregorian)
  [5949, [2024, 3, 20], [2024, 6, 18], [2024, 9, 17], [2024, 12, 17], [2025, 3, 18]],
  [5950, [2025, 3, 19], [2025, 6, 17], [2025, 9, 16], [2025, 12, 16], [2026, 3, 17]],
  [5951, [2026, 3, 18], [2026, 6, 16], [2026, 9, 15], [2026, 12, 15], [2027, 3, 16]],
];
for (const [am, n1, tt, ti, tv, tn] of site) {
  eq(`${am} Nisan 1`, D.jdnToGreg(D.yearStart(am)), { y: n1[0], m: n1[1], d: n1[2] });
  [tt, ti, tv, tn].forEach((t, q) => eq(`${am} Tekufah ${D.TEKUFOT[q]}`, D.jdnToGreg(D.tekufahJdn(am, q)), { y: t[0], m: t[1], d: t[2] }));
}
// Spot dates from the 2026 page
eq('Passover 2026 = Mar 31', dss(2026, 3, 31), [5951, 1, 14]);
eq('Pentecost 2026 = May 31', dss(2026, 5, 31), [5951, 3, 15]);
eq('Atonement 2026 = Sep 25', dss(2026, 9, 25), [5951, 7, 10]);
eq('Purim 2027 = Feb 27', dss(2027, 2, 27), [5951, 12, 14]);
eq('Hanukkah 1 2024 = Dec 11', dss(2024, 12, 11), [5949, 9, 25]);
eq('Mid-Winter 2026 = Feb 1', dss(2026, 2, 1), [5950, 11, 17]);
// Weekday rules from the Outer Rings page
for (let am = 1; am <= D.lastAM(); am++) {
  if (D.weekdayOf(D.yearStart(am)) !== 3) { fail++; console.log('FAIL Nisan 1 not Wednesday', am); break; }
  if (D.weekdayOf(D.toJdn(am, 1, 14)) !== 2 || D.weekdayOf(D.toJdn(am, 3, 15)) !== 0 || D.weekdayOf(D.toJdn(am, 7, 10)) !== 5) { fail++; console.log('FAIL feast weekday', am); break; }
}
console.log('ok   weekday rules hold for every year 1 –', D.lastAM());
// Round trips
for (let j = D.yearStart(1); j < D.maxJdn(); j += 997) {
  const x = D.fromJdn(j);
  if (x.kind === 'month' && D.toJdn(x.am, x.month, x.day) !== j) { fail++; console.log('FAIL round trip', j); break; }
}
console.log('ok   round trips');
// Cycle labels vs Onah table (four rows of that table agree with one consistent rule)
const c = am => { const k = D.cycles(am); return `Y${k.year} S${k.shemitah} J${k.jubilee} O${k.onah}`; };
eq('Flood 1656', c(1656), 'Y6 S1 J4 O4');
eq('Covenant 2018', c(2018), 'Y4 S3 J1 O5');
eq('Exodus 2448', c(2448), 'Y6 S7 J9 O5');
eq('1967 = 5892', c(5892), 'Y7 S6 J8 O12');
eq('Year 6001', c(6001), 'Y1 S1 J1 O13');
eq('AD 2026 = 5951 AM', D.fromJdn(g(2026, 10, 24)).am, 5951);
// Creation
const n1 = D.yearStart(1), jul = D.jdnToJul(n1), gr = D.jdnToGreg(n1);
console.log(`\nCreation Nisan 1, 1 AM = ${D.WEEKDAYS[D.weekdayOf(n1)]} ${jul.d}/${jul.m}/${D.yearLabel(jul.y)} Julian = ${gr.d}/${gr.m}/${D.yearLabel(gr.y)} Gregorian`);
const e = D.equinoxOf(1); const eg = D.jdnToGreg(e.jdn);
console.log(`Equinox of 3925 BC: ${D.WEEKDAYS[D.weekdayOf(e.jdn)]} ${eg.d}/${eg.m} Gregorian, ${e.hour.toFixed(1)} h Jerusalem time`);
console.log('Next leap weeks:', Array.from({ length: 40 }, (_, i) => 5945 + i).filter(D.isLeapYear).map(a => `${a} AM (${a - 3925}/${a - 3924})`).join(', '));
console.log(fail ? `\n${fail} FAILURES` : '\nALL CHECKS PASS');
process.exit(fail ? 1 : 0);
