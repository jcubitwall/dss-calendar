// Builds engine/tekufah-table.json: the Tekufah Nisan date for every AM year.
// Rule (matches every date published on dsscalendar.org, 2024–2027):
//   Tekufah Nisan = the last Tuesday on or before the day of the true spring
//   equinox, reckoned in Jerusalem (UTC+2). Nisan 1 = the next day (Wednesday).
// A year is 371 days (leap week) when the next Tekufah is 371 days later.
import * as Astronomy from 'astronomy-engine';
import { writeFileSync } from 'node:fs';

const EPOCH_OFFSET = 3925;           // AM = astronomical year + 3925  (AM 1 = 3925 BC = year -3924)
const FIRST_AM = 1, LAST_AM = 7001;  // through the end of 7000 AM
const TZ_HOURS = 2;                  // Jerusalem standard time

function equinoxLocal(astroYear) {
  // Search for solar longitude 0° starting March 1 (proleptic Gregorian). Seasons()
  // can't be used: JS Date maps years 0–99 to 1900–1999.
  const startJd = gregToJdn(astroYear, 3, 1) - 0.5;
  const t = Astronomy.SearchSunLongitude(0, Astronomy.MakeTime(startJd - 2451545.0), 40);
  if (!t) throw new Error('no equinox for ' + astroYear);
  const jdLocal = t.ut + 2451545.0 + TZ_HOURS / 24;
  const jdn = Math.floor(jdLocal + 0.5);                   // civil day number in Jerusalem
  const hourOfDay = ((jdLocal + 0.5) - jdn) * 24;          // 0–24 h after local midnight
  return { jdn, hourOfDay };
}
function gregToJdn(y, m, d) {           // proleptic Gregorian, astronomical year
  const a = Math.floor((14 - m) / 12), yy = y + 4800 - a, mm = m + 12 * a - 3;
  return d + Math.floor((153 * mm + 2) / 5) + 365 * yy + Math.floor(yy / 4) - Math.floor(yy / 100) + Math.floor(yy / 400) - 32045;
}
const weekday = jdn => (jdn + 1) % 7;                      // 0 = Sunday … 6 = Saturday

const rows = [];
for (let am = FIRST_AM; am <= LAST_AM + 1; am++) {
  const y = am - EPOCH_OFFSET;
  const { jdn, hourOfDay } = equinoxLocal(y);
  const back = (weekday(jdn) - 2 + 7) % 7;                 // days back to Tuesday
  const tek = jdn - back;
  // "Margin": hours between the equinox and the nearest boundary that would
  // move the Tekufah by a week (Tuesday 00:00 local, i.e. start of the Tekufah day).
  const hoursSinceTueStart = back * 24 + hourOfDay;       // 0 … 168
  const margin = Math.min(hoursSinceTueStart, 168 - hoursSinceTueStart);
  rows.push({ am, tek, eqJdn: jdn, eqHour: +hourOfDay.toFixed(2), margin: +margin.toFixed(1) });
}

// Compact form: first Tekufah JDN + one char per year ('0' = 364 days, '1' = 371)
let bits = '';
const borderline = [];
for (let i = 0; i < rows.length - 1; i++) {
  const len = rows[i + 1].tek - rows[i].tek;
  if (len !== 364 && len !== 371) throw new Error(`Bad year length ${len} at AM ${rows[i].am}`);
  bits += len === 371 ? '1' : '0';
  if (rows[i].margin < 6) borderline.push(rows[i].am);
}
// Tekufah of AM n (the Tuesday right before Nisan 1 of year n) = rows[n-1].tek
const table = {
  rule: 'Tekufah Nisan = last Tuesday on or before the spring-equinox day in Jerusalem (UTC+2); Nisan 1 = next day.',
  epoch: 'AM 1 = 3925 BC (astronomical year -3924)',
  firstAM: FIRST_AM,
  tek0: rows[0].tek,
  leap: bits,                       // leap[n-1] === '1' → AM n has a leap week (371 days)
  borderline,                       // years whose equinox is < 6 h from a week boundary
  equinox: rows.slice(0, -1).map(r => [r.eqJdn - r.tek, r.eqHour]) // days after Tekufah, local hour
};
writeFileSync(new URL('../engine/tekufah-table.json', import.meta.url), JSON.stringify(table));
console.log('years', bits.length, 'leap weeks', [...bits].filter(c => c === '1').length, 'borderline', borderline.length);
console.log('AM1 tekufah JDN', rows[0].tek, 'equinox JDN', rows[0].eqJdn, 'hour', rows[0].eqHour);
