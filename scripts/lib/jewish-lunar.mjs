// Converts a date in the Jewish lunar calendar of the Second Temple period (as Josephus gives it,
// with Macedonian month names equated to Hebrew months) to a Julian calendar day.
// Method (standard for the period, e.g. Parker & Dubberstein's approach for Babylon):
//   • a month begins at the first evening the new crescent can be seen, taken as about 30 hours
//     after the astronomical new moon at Jerusalem; day 1 is the daylight after that evening;
//   • Nisan is the month whose 15th day (the Passover full moon) falls on or after the spring equinox.
// Accuracy: usually right to the day, sometimes one day off (weather and sighting), and in years
// where the leap month is uncertain the whole month can move by one lunation. Callers mark such dates "probable".
import * as Astronomy from 'astronomy-engine';
import { julToJdn, jdnToJul } from '../../engine/dss.js';

const MONTHS = ['Nisan', 'Iyar', 'Sivan', 'Tammuz', 'Av', 'Elul', 'Tishri', 'Marheshvan', 'Kislev', 'Tevet', 'Shevat', 'Adar'];
const ALIAS = { Xanthicus: 'Nisan', Artemisius: 'Iyar', Daesius: 'Sivan', Panemus: 'Tammuz', Lous: 'Av', Loos: 'Av', Ab: 'Av', Gorpiaeus: 'Elul',
  Hyperberetaeus: 'Tishri', Tishrei: 'Tishri', Dius: 'Marheshvan', Heshvan: 'Marheshvan', Cheshvan: 'Marheshvan', Apellaeus: 'Kislev', Chislev: 'Kislev',
  Audynaeus: 'Tevet', Tebeth: 'Tevet', Peritius: 'Shevat', Shebat: 'Shevat', Dystrus: 'Adar' };
const TZ = 2 / 24, CRESCENT = 1.25;           // Jerusalem time; days from conjunction to first visible crescent
const jdOf = t => t.ut + 2451545.0;

function newMoonAfter(jd) { return jdOf(Astronomy.SearchMoonPhase(0, Astronomy.MakeTime(jd - 2451545.0), 40)); }
// Julian day number of the daylight of day 1 of the month that begins after the conjunction at jdConj
function day1(jdConj) { const evening = Math.floor(jdConj + TZ + CRESCENT + 0.5); return evening + 1; }
function equinoxJd(y) { const start = julToJdn(y, 3, 1) - 0.5; return jdOf(Astronomy.SearchSunLongitude(0, Astronomy.MakeTime(start - 2451545.0), 60)); }

/** Day-1 JDNs of the 13 lunar months starting with Nisan of astronomical year y. */
export function monthsOfYear(y) {
  const eq = equinoxJd(y);
  let c = newMoonAfter(eq - 45), out = [];
  for (let i = 0; i < 4; i++) { out.push(c); c = newMoonAfter(c + 20); }
  // Nisan: first month whose 15th day falls on or after the equinox day
  const k = out.findIndex(cj => day1(cj) + 14 >= Math.floor(eq + TZ + 0.5));
  let cj = out[k]; const res = [];
  for (let i = 0; i < 13; i++) { res.push(day1(cj)); cj = newMoonAfter(cj + 20); }
  return res;
}
/** Julian {y,m,d,jdn} for day `day` of Hebrew/Macedonian month `month`, falling in astronomical year y. */
export function jewishToJulian(y, month, day) {
  const name = ALIAS[month] || month; const mi = MONTHS.indexOf(name);
  if (mi < 0) throw new Error('unknown month ' + month);
  for (const base of [y, y - 1]) {
    const jdn = monthsOfYear(base)[mi] + (day - 1);
    const j = jdnToJul(jdn);
    if (j.y === y) return { ...j, jdn };
  }
  const jdn = monthsOfYear(y)[mi] + (day - 1); return { ...jdnToJul(jdn), jdn };
}
