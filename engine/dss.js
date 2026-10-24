// DSS (Zadok / Dead Sea Scroll) calendar engine.
// Pure functions, no dependencies. Works in the browser and in Node.
// Every date is handled as a Julian Day Number (JDN) — one integer per day.

export const MONTHS = [
  { name: 'Nisan', alt: 'Abib', season: 'Spring' },
  { name: 'Iyar', alt: 'Zif', season: 'Spring' },
  { name: 'Sivan', alt: '', season: 'Spring' },
  { name: 'Tammuz', alt: '', season: 'Summer' },
  { name: 'Av', alt: '', season: 'Summer' },
  { name: 'Elul', alt: '', season: 'Summer' },
  { name: 'Tishrei', alt: 'Ethanim', season: 'Fall' },
  { name: 'Heshvan', alt: 'Bul', season: 'Fall' },
  { name: 'Kislev', alt: '', season: 'Fall' },
  { name: 'Tevet', alt: '', season: 'Winter' },
  { name: 'Shevat', alt: '', season: 'Winter' },
  { name: 'Adar', alt: '', season: 'Winter' },
];
export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const TEKUFOT = ['Tammuz (Summer)', 'Tishrei (Fall)', 'Tevet (Winter)', 'Nisan (Spring)'];
export const EPOCH_OFFSET = 3925; // AM = astronomical year + 3925
// 1 Chronicles 24 order. Qumran texts (4Q319–4Q321) start the cycle at Creation with Gamul.
export const COURSES = ['Jehoiarib', 'Jedaiah', 'Harim', 'Seorim', 'Malchijah', 'Mijamin', 'Hakkoz', 'Abijah',
  'Jeshua', 'Shecaniah', 'Eliashib', 'Jakim', 'Huppah', 'Jeshebeab', 'Bilgah', 'Immer', 'Hezir', 'Happizzez',
  'Pethahiah', 'Jehezkel', 'Jachin', 'Gamul', 'Delaiah', 'Maaziah'];

let T = null;          // table
let starts = null;     // starts[n] = JDN of Nisan 1 of AM n (n = 1 … last+1)

export function init(table) {
  T = table;
  const n = table.leap.length;
  starts = new Int32Array(n + 2);
  starts[1] = table.tek0 + 1;
  for (let i = 1; i <= n; i++) starts[i + 1] = starts[i] + (table.leap[i - 1] === '1' ? 371 : 364);
}
export const firstAM = () => 1;
export const lastAM = () => T.leap.length;
export const yearStart = am => starts[am];                 // Nisan 1
export const yearLength = am => (T.leap[am - 1] === '1' ? 371 : 364);
export const isLeapYear = am => T.leap[am - 1] === '1';
export const isBorderline = am => T.borderline.includes(am);
export const minJdn = () => starts[1] - 3;                  // Creation day 1 (Sunday)
export const maxJdn = () => starts[lastAM() + 1] - 1;
export const weekdayOf = jdn => (jdn + 1) % 7;              // 0 = Sunday

/** Equinox for AM year: { jdn, hour } in Jerusalem time (UTC+2). */
export function equinoxOf(am) {
  const [off, hour] = T.equinox[am - 1];
  return { jdn: starts[am] - 1 + off, hour };
}

// ---------- Julian & Gregorian ----------
export function gregToJdn(y, m, d) {
  const a = Math.floor((14 - m) / 12), yy = y + 4800 - a, mm = m + 12 * a - 3;
  return d + Math.floor((153 * mm + 2) / 5) + 365 * yy + Math.floor(yy / 4) - Math.floor(yy / 100) + Math.floor(yy / 400) - 32045;
}
export function julToJdn(y, m, d) {
  const a = Math.floor((14 - m) / 12), yy = y + 4800 - a, mm = m + 12 * a - 3;
  return d + Math.floor((153 * mm + 2) / 5) + 365 * yy + Math.floor(yy / 4) - 32083;
}
export function jdnToGreg(j) {
  const a = j + 32044, b = Math.floor((4 * a + 3) / 146097), c = a - Math.floor(146097 * b / 4);
  const d = Math.floor((4 * c + 3) / 1461), e = c - Math.floor(1461 * d / 4), m = Math.floor((5 * e + 2) / 153);
  return { y: 100 * b + d - 4800 + Math.floor(m / 10), m: m + 3 - 12 * Math.floor(m / 10), d: e - Math.floor((153 * m + 2) / 5) + 1 };
}
export function jdnToJul(j) {
  const c = j + 32082, d = Math.floor((4 * c + 3) / 1461), e = c - Math.floor(1461 * d / 4), m = Math.floor((5 * e + 2) / 153);
  return { y: d - 4800 + Math.floor(m / 10), m: m + 3 - 12 * Math.floor(m / 10), d: e - Math.floor((153 * m + 2) / 5) + 1 };
}
export const GREGORIAN_START = 2299161; // 15 Oct 1582
/** Historians' civil date: Julian before 15 Oct 1582, Gregorian after. */
export function jdnToCivil(j) {
  return j < GREGORIAN_START ? { ...jdnToJul(j), cal: 'julian' } : { ...jdnToGreg(j), cal: 'gregorian' };
}
export const yearLabel = y => (y <= 0 ? `${1 - y} BC` : `AD ${y}`);
export const yearShort = y => (y <= 0 ? `${1 - y} BC` : `${y}`);
/** "BC 44" style input → astronomical year */
export const astroYear = (n, bc) => (bc ? 1 - n : n);

// ---------- DSS ----------
function findYear(jdn) {
  let lo = 1, hi = lastAM();
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (starts[mid] <= jdn) lo = mid; else hi = mid - 1; }
  return lo;
}

/**
 * Convert a JDN to a DSS date.
 * kind: 'month' (month 1-12, day 1-30) | 'tekufah' (q 0-3: Tammuz, Tishrei, Tevet, Nisan)
 *     | 'leap' (day 1-7, after Adar 30) | 'creation' (day 1-3, before AM 1)
 */
export function fromJdn(jdn) {
  if (jdn < starts[1]) {
    const cd = jdn - starts[1] + 4; // 1..3
    if (cd < 1) return null;
    return { am: 0, kind: 'creation', creationDay: cd, jdn, weekday: weekdayOf(jdn) };
  }
  if (jdn > maxJdn()) return null;
  const am = findYear(jdn);
  const idx = jdn - starts[am];             // 0-based day of year
  const base = { am, jdn, weekday: weekdayOf(jdn), dayOfYear: idx + 1, leapYear: isLeapYear(am) };
  if (am === 1 && idx <= 3) base.creationDay = idx + 4;   // Nisan 1–4 of year 1 = Creation days 4–7
  if (idx < 364 - 1) {                       // first 363 days: 4 quarters of 91 minus the last Tekufah
    const q = Math.floor(idx / 91), r = idx % 91;
    if (r === 90) return { ...base, kind: 'tekufah', q };
    return { ...base, kind: 'month', month: q * 3 + Math.floor(r / 30) + 1, day: (r % 30) + 1 };
  }
  const len = yearLength(am);
  if (idx === len - 1) return { ...base, kind: 'tekufah', q: 3 };
  return { ...base, kind: 'leap', day: idx - 362 };       // idx 363..369 → leap day 1..7
}

/** DSS date → JDN. month 1–12, day 1–30. */
export function toJdn(am, month, day) {
  const q = Math.floor((month - 1) / 3);
  return starts[am] + q * 91 + ((month - 1) % 3) * 30 + (day - 1);
}
export function tekufahJdn(am, q) { // q: 0 Tammuz, 1 Tishrei, 2 Tevet, 3 Nisan (end of year)
  return q === 3 ? starts[am] + yearLength(am) - 1 : starts[am] + q * 91 + 90;
}

// ---------- Cycles ----------
/** Year / Shemitah / Jubilee / Onah / Age, as on dsscalendar.org */
export function cycles(am) {
  const p = ((am - 1) % 50) + 1;
  const jubileeYear = p === 50;
  return {
    year: jubileeYear ? null : ((p - 1) % 7) + 1,
    shemitah: jubileeYear ? null : Math.floor((p - 1) / 7) + 1,
    jubileeYear,
    sabbathYear: !jubileeYear && (p - 1) % 7 === 6,
    jubilee: Math.floor(((am - 1) % 500) / 50) + 1,
    jubileeTotal: Math.floor((am - 1) / 50) + 1,
    onah: Math.floor((am - 1) / 500) + 1,
    age: Math.min(4, Math.floor((am - 1) / 2000) + 1),
    enochWeek: Math.floor((am - 1) / 700) + 1,
    century: Math.floor((am - 1) / 100) + 1,
    priestlyCycleYear: ((am - 1) % 6) + 1,
  };
}
export const AGES = ['Age of Creation', 'Age of Torah', 'Age of Grace', 'Age of the Kingdom'];

/** Priestly course on duty: continuous weekly rotation, Gamul serving Creation week. */
export function priestlyCourse(jdn) {
  const creationSunday = starts[1] - 3;
  const week = Math.floor((jdn - creationSunday) / 7);
  const i = (((21 + week) % 24) + 24) % 24; // Gamul = index 21
  return COURSES[i];
}

// ---------- Feasts and marks ----------
const FIXED = {
  '1-1': ['Spring Day of Remembrance', 'New Year'], '1-14': ['Passover'],
  '1-26': ['First Fruits of Barley'], '2-14': ['Second Passover'], '2-17': ['Mid-Spring'],
  '3-15': ['Pentecost (Festival of Oaths)'], '4-1': ['Summer Day of Remembrance'],
  '5-3': ['First Fruits of New Wine'], '5-17': ['Mid-Summer'],
  '6-22': ['First Fruits of New Oil'],
  '6-23': ['Wood Offering (Levi & Judah)'], '6-24': ['Wood Offering (Benjamin & Joseph)'],
  '6-25': ['Wood Offering (Reuben & Simeon)'], '6-26': ['Wood Offering (Issachar & Zebulun)'],
  '6-27': ['Wood Offering (Gad & Asher)'], '6-28': ['Wood Offering (Dan & Naphtali)'],
  '7-1': ['Fall Day of Remembrance', 'Trumpets'], '7-2': ['Trumpets (day 2)'], '7-10': ['Day of Atonement'],
  '7-22': ['The Great Day'], '8-17': ['Mid-Fall'], '10-1': ['Winter Day of Remembrance', 'Hanukkah 8'],
  '11-17': ['Mid-Winter'], '12-14': ['Purim'], '12-15': ['Purim (day 2)'],
};
const HIGH = new Set(['1-1', '1-14', '1-26', '3-15', '5-3', '6-22', '7-1', '7-10', '7-22']);

/** Feasts/marks for a DSS date. Returns [{label, major}] */
export function marks(dss) {
  const out = [];
  if (!dss) return out;
  if (dss.kind === 'tekufah') {
    out.push({ label: `Tekufah ${TEKUFOT[dss.q]}`, major: true });
    if (dss.q === 2) out.push({ label: 'Hanukkah 7' });
    return out;
  }
  if (dss.kind === 'leap') { out.push({ label: `Leap week · day ${dss.day}` }); return out; }
  if (dss.kind !== 'month') return out;
  const { month: m, day: d } = dss, key = `${m}-${d}`;
  (FIXED[key] || []).forEach((l, i) => out.push({ label: l, major: i === 0 && HIGH.has(key) }));
  if (m === 1 && d >= 15 && d <= 21) out.push({ label: `Unleavened Bread ${d - 14}`, major: d === 15 || d === 21 });
  if (m === 7 && d >= 3 && d <= 9) out.push({ label: `Yamim Noraim ${d - 2}` });
  if (m === 7 && d >= 15 && d <= 21) out.push({ label: `Tabernacles ${d - 14}`, major: d === 15 });
  if (m === 9 && d >= 25) out.push({ label: `Hanukkah ${d - 24}` });
  // Fifty-day counts, each starting the day after a first-fruits Sunday
  const doy = toDoy(m, d);
  const counts = [['Counting of the Omer', toDoy(1, 26)], ['Count to New Wine', toDoy(3, 15)], ['Count to New Oil', toDoy(5, 3)]];
  for (const [name, start] of counts) {
    const n = doy - start;
    if (n >= 1 && n <= 49 && n % 7 === 0) out.push({ label: `${name} ${n}` });
  }
  return out;
}
// day-of-year (0-based) inside the 364-day frame
function toDoy(m, d) { const q = Math.floor((m - 1) / 3); return q * 91 + ((m - 1) % 3) * 30 + d - 1; }

export const CREATION_DAYS = [
  'Day 1 — Light', 'Day 2 — The expanse (sky)', 'Day 3 — Land, seas and plants',
  'Day 4 — Sun, moon and stars', 'Day 5 — Sea creatures and birds', 'Day 6 — Animals and mankind', 'Day 7 — Sabbath rest',
];

export function formatDss(dss, { long = true } = {}) {
  if (!dss) return '—';
  if (dss.kind === 'creation') return `Creation ${CREATION_DAYS[dss.creationDay - 1]}`;
  const y = `${dss.am} AM`;
  if (dss.kind === 'tekufah') return `Tekufah ${TEKUFOT[dss.q]}, ${y}`;
  if (dss.kind === 'leap') return `Leap week day ${dss.day}, ${y}`;
  const mo = MONTHS[dss.month - 1];
  return long ? `${dss.day} ${mo.name} ${y}` : `${dss.day} ${mo.name}`;
}
