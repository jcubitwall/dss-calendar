import * as D from './engine/dss.js';
import * as L from './lookup.js';
import * as TL from './timeline.js';

const DATA_V = '2026-10-24b';   // bump when data files change, so phones fetch the new copy
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// ---------- Storage (per-viewer conveniences only) ----------
const store = {
  get(k, d) { try { const v = localStorage.getItem('dss:' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('dss:' + k, JSON.stringify(v)); } catch { /* storage unavailable */ } },
};
const settings = Object.assign({ courses: true, moon: true, cycles: true, civil: 'historian' }, store.get('settings', {}));
settings.show = Object.assign({ biblical: true, scrolls: true, secular: true, church: true, mine: true, prophecy: false }, settings.show || {});
const shown = e => settings.show[e.k] !== false;
const allEvents = () => [...EVENTS, ...mine.map(e => ({ ...e, k: 'mine' }))].filter(shown).sort((a, b) => a.j - b.j);
function catBar() {
  return `<div class="filters" role="group" aria-label="Show events">${Object.entries(TL.TYPES).map(([k, t]) =>
    `<button class="chip cat" data-cat="${k}" aria-pressed="${settings.show[k] !== false}"><i style="background:${t.color}"></i>${t.label}</button>`).join('')}</div>`;
}
let mine = store.get('mine', []);

// ---------- State ----------
let EVENTS = [];
let PROPHECIES = [];
const propOn = () => settings.show.prophecy === true;
if (settings.propAll == null) settings.propAll = false;
if (settings.propFuture == null) settings.propFuture = false;
const isJ = p => p.kj || p.n || /^(apr|age)-/.test(p.id);
const propList = () => (!propOn() ? [] : PROPHECIES.filter(p => (settings.propAll || isJ(p)) && (settings.propFuture || p.f)));
function propBar() {
  if (!propOn()) return '';
  const nJ = PROPHECIES.filter(p => isJ(p) && (settings.propFuture || p.f)).length;
  return `<div class="filters prop-bar" role="group" aria-label="Prophecy options">
    <button class="chip" data-pset="j" aria-pressed="${!settings.propAll}">Johnson's list${PROPHECIES.length ? ` (${nJ})` : ''}</button>
    <button class="chip" data-pset="all" aria-pressed="${settings.propAll}">Add other teachers &amp; scrolls</button>
    <button class="chip" data-pfut="1" aria-pressed="${settings.propFuture}">Include yet-future</button></div>`;
}
const propById = id => PROPHECIES.find(p => p.id === id);
let propLoad = null;
function ensureProphecies() {   // 600 KB, so only fetched when the Prophecy category or a search needs it
  if (!propLoad) propLoad = fetch('data/prophecies.json?v=' + DATA_V).then(r => { if (!r.ok) throw 0; return r.json(); }).then(j => { PROPHECIES = j; }).catch(() => { propLoad = null; });
  return propLoad;
}
let byJdn = new Map();
const today = (() => { const n = new Date(); return D.gregToJdn(n.getFullYear(), n.getMonth() + 1, n.getDate()); })();
let sel = today;                // selected JDN
let view = 'day';
const wide = () => matchMedia('(min-width: 900px)').matches;
let histFilter = 'all';
let histQuery = '';

// ---------- Helpers ----------
function civil(jdn, mode = settings.civil) {
  const c = mode === 'gregorian' ? { ...D.jdnToGreg(jdn), cal: 'gregorian' } : mode === 'julian' ? { ...D.jdnToJul(jdn), cal: 'julian' } : D.jdnToCivil(jdn);
  return c;
}
const fmtCivil = (c, long) => `${c.d} ${long ? MONTH_FULL[c.m - 1] : MON[c.m - 1]} ${D.yearShort(c.y)}`;
const short = c => `${MON[c.m - 1]} ${c.d}`;
const calName = cal => (cal === 'julian' ? 'Julian' : 'Gregorian');

function dssShort(x) {
  if (!x) return '';
  if (x.kind === 'creation') return `Creation day ${x.creationDay}`;
  if (x.kind === 'tekufah') return `Tekufah ${D.TEKUFOT[x.q].split(' ')[0]} ${x.am} AM`;
  if (x.kind === 'leap') return `Leap day ${x.day}, ${x.am} AM`;
  return `${x.day} ${D.MONTHS[x.month - 1].name} ${x.am} AM`;
}
function monthOf(x) {               // which month page a day belongs to
  if (x.kind === 'month') return x.month;
  if (x.kind === 'leap') return 12;
  if (x.kind === 'tekufah') return x.q === 3 ? 12 : x.q * 3 + 4;
  return 1;
}
function eventsOn(jdn) {
  const pf = propOn() ? propList().filter(p => p.f && p.f.j === jdn).map(p => ({ id: 'p:' + p.id, t: 'Prophecy fulfilled: ' + p.t, k: 'prophecy', n: p.s, j: jdn, s: p.ref, u: '' })) : [];
  return [...pf, ...(byJdn.get(jdn) || []), ...mine.filter(e => e.j === jdn).map(e => ({ ...e, k: 'mine' }))].filter(shown);
}

// Moon (astronomy-engine, loaded with defer)
function moonAt(jdn) {
  const A = window.Astronomy; if (!A) return null;
  const ut = j => A.MakeTime(j - 0.5 - 2 / 24 - 2451545.0); // local midnight, Jerusalem
  const a0 = A.MoonPhase(ut(jdn)), a1 = A.MoonPhase(ut(jdn + 1));
  const crosses = t => { const d = (a1 - a0 + 360) % 360; return ((t - a0 + 360) % 360) < d; };
  const mid = A.MoonPhase(A.MakeTime(jdn - 2 / 24 - 2451545.0));
  const illum = Math.round((1 - Math.cos(mid * Math.PI / 180)) / 2 * 100);
  let name = mid < 22.5 || mid >= 337.5 ? 'New moon' : mid < 67.5 ? 'Waxing crescent' : mid < 112.5 ? 'First quarter' : mid < 157.5 ? 'Waxing gibbous'
    : mid < 202.5 ? 'Full moon' : mid < 247.5 ? 'Waning gibbous' : mid < 292.5 ? 'Last quarter' : 'Waning crescent';
  return { newMoon: crosses(0), fullMoon: crosses(180), illum, name };
}

// ---------- Day ----------
const SEASON_COL = ['#7FB89B', '#D9AE57', '#C9845A', '#7FA3C9'];
function miniRing(x) {
  // A small year ring: four seasons, a marker at this day. The app's signature, in miniature.
  if (!x.am) return '';
  const len = D.yearLength(x.am), i = x.dayOfYear - 1, R = 26, C = 32;
  const P = (a, r = R) => `${(C + r * Math.cos(a)).toFixed(2)},${(C + r * Math.sin(a)).toFixed(2)}`;
  const A = k => (k / len) * 2 * Math.PI - Math.PI / 2;
  let arcs = '';
  for (let q = 0; q < 4; q++) { const a0 = A(q * 91 + 0.6), a1 = A(q * 91 + 90.4); arcs += `<path d="M${P(a0)} A${R},${R} 0 0 1 ${P(a1)}" stroke="${SEASON_COL[q]}" stroke-width="6" fill="none" stroke-linecap="round"/>`; }
  const a = A(i + 0.5);
  return `<svg class="mini-ring" viewBox="0 0 64 64" aria-hidden="true">${arcs}<circle cx="${P(a).split(',')[0]}" cy="${P(a).split(',')[1]}" r="5.5" fill="var(--brine)" stroke="var(--card)" stroke-width="2"/></svg>`;
}
function upcoming(from, n = 4) {
  const out = [], seen = new Set();
  for (let j = from + 1; j <= from + 200 && out.length < n; j++) {
    const y = D.fromJdn(j); if (!y) break;
    for (const m of D.marks(y)) {
      if (!m.major && !/^(Hanukkah 1|Purim)$/.test(m.label)) continue;
      const base = m.label.replace(/ \d+$/, '').replace(/ \(.*\)$/, '');
      if (seen.has(base)) continue; seen.add(base);
      out.push({ j, label: m.label, y }); break;
    }
  }
  return out;
}
function weekStrip(jdn) {
  const start = jdn - D.weekdayOf(jdn);
  let h = '';
  for (let k = 0; k < 7; k++) {
    const j = start + k, y = D.fromJdn(j); if (!y) { h += '<span class="wk-day"></span>'; continue; }
    const cv = civil(j), feast = D.marks(y).some(m => m.major);
    const num = y.kind === 'tekufah' ? '☉' : y.kind === 'leap' ? 'L' + y.day : y.kind === 'creation' ? 'C' + y.creationDay : y.day;
    h += `<button class="wk-day${j === jdn ? ' on' : ''}${j === today ? ' today' : ''}${k === 6 ? ' sab' : ''}${feast ? ' feast' : ''}" data-wk="${j}" aria-label="${esc(dssShort(y))}, ${esc(fmtCivil(cv, true))}">
      <span class="wk-w">${D.WEEKDAYS[k].slice(0, k === 6 ? 3 : 1)}</span><span class="wk-n">${num}</span><span class="wk-g">${cv.d}</span></button>`;
  }
  return `<div class="week"><button class="wk-nav" data-wkstep="-7" aria-label="Previous week">‹</button><div class="wk-days">${h}</div><button class="wk-nav" data-wkstep="7" aria-label="Next week">›</button></div>`;
}
/** Day details. mode: 'page' (the Today tab) or 'panel' (sheet / side panel). */
function dayHtml(jdn, mode = 'page') {
  const x = D.fromJdn(jdn);
  if (!x) return '<p>Outside the calendar range.</p>';
  const c = D.jdnToCivil(jdn), g = D.jdnToGreg(jdn), j = D.jdnToJul(jdn);
  const wd = D.WEEKDAYS[x.weekday] + (x.weekday === 6 ? ' · Sabbath' : '');
  let title, yr = x.am ? `${x.am} AM` : '';
  if (x.kind === 'creation') { title = esc(D.CREATION_DAYS[x.creationDay - 1]); yr = ''; }
  else if (x.kind === 'tekufah') title = `Tekufah ${esc(D.TEKUFOT[x.q].split(' ')[0])}`;
  else if (x.kind === 'leap') title = `Leap week, day ${x.day}`;
  else title = `${x.day} ${D.MONTHS[x.month - 1].name}`;
  const creationLine = x.creationDay && x.kind !== 'creation' ? `<p class="muted">${esc(D.CREATION_DAYS[x.creationDay - 1])}</p>` : '';
  const other = c.cal === 'julian' ? g : j, otherCal = c.cal === 'julian' ? 'Gregorian' : 'Julian';
  const am = x.am || 1, cy = D.cycles(am);
  let facts = `<dt>Year</dt><dd>${cy.jubileeYear ? 'Jubilee year' : `Year ${cy.year} of Shemitah ${cy.shemitah}`} · Jubilee ${cy.jubilee} · Onah ${cy.onah}</dd><dt>Age</dt><dd>${D.AGES[cy.age - 1]}</dd>`;
  if (settings.cycles) {
    const b = [];
    if (cy.sabbathYear) b.push('<span class="badge">Sabbath year</span>');
    if (cy.jubileeYear) b.push('<span class="badge">Jubilee year</span>');
    if (D.isLeapYear(am)) b.push('<span class="badge teal">Leap-week year</span>');
    if (b.length) facts += `<dt></dt><dd>${b.join('')}</dd>`;
  }
  facts += `<dt>Enoch</dt><dd>Week ${cy.enochWeek} of 10 · century ${cy.century}</dd>`;
  if (settings.courses) facts += `<dt>Priests</dt><dd>Course of ${D.priestlyCourse(jdn)}</dd>`;
  if (settings.moon) { const m = moonAt(jdn); if (m) facts += `<dt>Moon</dt><dd>${m.newMoon ? 'New moon' : m.fullMoon ? 'Full moon' : m.name}, ${m.illum}% lit</dd>`; }
  const eq = x.am ? D.equinoxOf(x.am) : null;
  if (eq) { const e = civil(eq.jdn); facts += `<dt>Equinox</dt><dd>${fmtCivil(e)}, ${Math.floor(eq.hour)}:${String(Math.round((eq.hour % 1) * 60)).padStart(2, '0')} Jerusalem</dd>`; }
  const borderline = x.am && D.isBorderline(x.am) && x.am < 5000
    ? `<p class="note-borderline">This year's equinox falls within six hours of a week boundary, so ancient clock uncertainty (ΔT) means it could start one week later.</p>` : '';
  const mk = D.marks(x);
  const marks = mk.length ? `<div class="marks">${mk.map(m => `<span class="mark${m.major ? ' major' : ''}">${esc(m.label)}</span>`).join('')}</div>` : '';
  const hist = historySections(x, jdn, mode);
  let coming = '';
  if (mode === 'page') {
    const up = upcoming(jdn);
    if (up.length) coming = `<h3 class="sec">Coming up</h3><div class="coming" role="list">${up.map(u => {
      const d = u.j - jdn, cv = civil(u.j);
      return `<button class="coming-item" data-wk="${u.j}"><span class="ci-when">${d === 1 ? 'Tomorrow' : `In ${d} days`}</span><span class="ci-t">${esc(u.label)}</span><span class="ci-d">${D.WEEKDAYS[u.y.weekday]}${u.y.kind === 'month' ? ' · ' + esc(dssShort(u.y).replace(/ \d+ AM$/, '')) : ''} · ${MON[cv.m - 1]} ${cv.d}</span></button>`;
    }).join('')}</div>`;
  }
  const open = store.get('detailsOpen', false);
  return `
    <div class="hero" data-swipe="day">
      <div class="hero-text">
        <div class="weekday">${wd}${jdn === today ? ' · <b>Today</b>' : ''}</div>
        <h1>${title}${yr ? `<span class="yr">${yr}</span>` : ''}</h1>
        <div class="civil">${fmtCivil(c, true)}${c.y < 1700 ? ` <em>${calName(c.cal)}</em> · ${fmtCivil(other)} <em>${otherCal}</em>` : ''}</div>
      </div>
      ${miniRing(x)}
    </div>
    ${creationLine}
    ${mode === 'page' ? weekStrip(jdn) : ''}
    ${marks}
    ${coming}
    ${hist}
    <details class="more"${open ? ' open' : ''}><summary>Calendar details</summary><dl class="facts">${facts}</dl>${borderline}</details>
    <div class="day-actions">
      ${jdn !== today ? '<button class="pill" data-act="today">Today</button>' : ''}
      <button class="pill" data-act="add">Add event</button>
      <button class="pill" data-act="share">Share day</button>
    </div>`;
}
function renderDay() { $('#view-day').innerHTML = dayHtml(sel, 'page'); }
function renderSide() {
  if (!wide()) return;
  const html = dayHtml(sel, 'panel');
  if (view === 'month') $('#monthSide').innerHTML = html;
  if (view === 'ring') $('#ringSide').innerHTML = html;
}
function openDaySheet() {
  $('#daySheetBody').innerHTML = dayHtml(sel, 'panel');
  const d = $('#daySheet'); if (!d.open) d.showModal(); d.querySelector('.sheet').scrollTop = 0;
}
const KIND_LABEL = { biblical: 'Bible', scrolls: 'Dead Sea Scrolls & Essenes', church: 'Church history', secular: 'World history', mine: 'Your event', prophecy: 'Prophecy' };
// ---------- History by date ----------
// Every DSS date falls on the same weekday each year, so "this week" is the same seven dates every year.
const SECTIONS = [
  ['biblical', 'Bible history', 'What Scripture records on this date'],
  ['scrolls', 'Dead Sea Scrolls & Essenes', 'The scrolls, Qumran and the Essenes'],
  ['church', 'Church history', ''],
  ['secular', 'World history', ''],
  ['mine', 'Your events', ''],
];
const slotOf = e => (e._s ??= (D.fromJdn(e.j)?.dayOfYear ?? -1));
function historySections(x, jdn, mode) {
  if (!x.am) return '';
  const here = x.dayOfYear;
  const week = new Map();                              // slot -> offset in the week (0 = Sunday)
  const sun = jdn - x.weekday;
  for (let k = 0; k < 7; k++) { const y = D.fromJdn(sun + k); if (y?.am) week.set(y.dayOfYear, k); }
  const all = [...EVENTS, ...mine.map(e => ({ ...e, k: 'mine' }))].filter(e => shown(e) && e.p !== 'm');
  const cap = mode === 'page' ? 6 : 3;
  let out = '';
  for (const [k, title, sub] of SECTIONS) {
    if (settings.show[k] === false) continue;
    const list = all.filter(e => e.k === k);
    if (!list.length) continue;
    const today = [], wk = [];
    for (const e of list) { const s = slotOf(e); if (s === here) today.push(e); else if (week.has(s)) wk.push(e); }
    const byYear = (a, b) => a.j - b.j;
    today.sort(byYear); wk.sort((a, b) => week.get(slotOf(a)) - week.get(slotOf(b)) || a.j - b.j);
    let body = '', i = 0;
    const item = (e, ex) => histItem(e, ex, i++ >= cap);
    if (today.length) body += `<li class="sub-h">On ${esc(dssShort(x).replace(/ \d+ AM$/, ''))}</li>` + today.map(e => item(e, true)).join('');
    if (wk.length) body += `<li class="sub-h${i >= cap ? ' x' : ''}">${today.length ? 'Also this week' : 'This week'}</li>` + wk.map(e => item(e, false)).join('');
    if (!today.length && !wk.length) {
      // nothing this week: show the next one coming up on this calendar
      let best = null, bd = 1e9;
      for (const e of list) { const s = slotOf(e); const d = (s - here + 364) % 364; if (s > 0 && s <= 364 && d > 0 && d < bd) { bd = d; best = e; } }
      if (best) body = `<li class="sub-h">Next on this calendar, in ${bd} day${bd === 1 ? '' : 's'}</li>` + histItem(best, false);
    }
    if (!body) continue;
    const n = today.length + wk.length;
    const id = 'hs-' + k;
    out += `<section class="hsec hsec-${k}" id="${id}">
      <h2 class="hsec-h"><i style="background:${TL.TYPES[k]?.color}"></i>${title}${n ? `<span class="hsec-n">${n}</span>` : ''}</h2>
      ${sub && mode === 'page' ? `<p class="hsec-sub">${sub}</p>` : ''}
      <ul class="hlist${n > cap ? ' capped' : ''}">${body}</ul>
      ${n > cap ? `<button class="linkbtn more-btn" data-more="${id}">Show all ${n}</button>` : ''}
    </section>`;
  }
  return out;
}
function histItem(e, exact, extra) {
  const x = D.fromJdn(e.j), c = D.jdnToCivil(e.j);
  const when = `${exact ? '' : esc(D.WEEKDAYS[x.weekday].slice(0, 3)) + ' · '}${esc(dssShort(x))} · ${esc(D.yearLabel(c.y))}`;
  const note = e.n ? (e.n.length > 140 ? e.n.slice(0, 132).replace(/\s+\S*$/, '') + '…' : e.n) : '';
  return `<li${extra ? ' class="x"' : ''}><button class="hitem" data-ev="${esc(e.id)}"><span class="h-when">${when}${e.c === 'probable' ? ' · day probable' : ''}</span><span class="h-title">${esc(e.t)}</span>${note ? `<span class="h-note">${esc(note)}</span>` : ''}</button></li>`;
}
function evItem(e, withDate) {
  e = { ...e };
  const kind = KIND_LABEL[e.k] || 'History';
  const when = withDate ? `<div class="kind">${esc(TL.whenText(e))}</div>` : (e.p === 'm' ? `<div class="kind">Scripture gives the month only; shown on the 1st</div>` : '');
  const basis = e.b ? `<div class="basis">Year: ${esc(e.b)}${e.c === 'derived' ? ' (derived)' : ''}</div>` : '';
  const del = e.k === 'mine' ? ` <button class="linkbtn" data-del="${esc(e.id)}">Delete</button>` : '';
  const go = (withDate ? ` <button class="linkbtn" data-go="${e.j}">Go to day</button>` : '') + ` <button class="linkbtn" data-ev="${esc(e.id)}">Read more</button>`;
  if (!withDate && e.n && e.n.length > 160) e = { ...e, n: e.n.slice(0, 150).replace(/\s+\S*$/, '') + '…' };
  const src = e.u ? ` <a href="${esc(e.u)}" target="_blank" rel="noopener">${esc(e.s || 'Source')}</a>` : e.s ? ` <span class="kind">${esc(e.s)}</span>` : '';
  const cert = e.c === 'probable' ? ' · day probable' : '';
  return `<li><div class="kind ${e.k}">${kind}${cert}</div><div class="t">${esc(e.t)}</div>${when}${e.n ? `<div class="n">${esc(e.n)}</div>` : ''}${basis}<div>${src}${go}${del}</div></li>`;
}

// ---------- Month view ----------
let viewAm = null, viewMonth = null;
function renderMonth() {
  const x = D.fromJdn(sel);
  if (viewAm == null) { viewAm = x.am || 1; viewMonth = x.am ? monthOf(x) : 1; }
  const am = viewAm, m = viewMonth;
  const first = D.toJdn(am, m, 1);
  const cells = [];
  if ((m - 1) % 3 === 0) cells.push(m === 1 ? D.yearStart(am) - 1 : D.tekufahJdn(am, (m - 1) / 3 - 1));
  for (let d = 0; d < 30; d++) cells.push(first + d);
  if (m === 12) { const end = D.yearStart(am) + D.yearLength(am) - 1; for (let k = first + 30; k <= end; k++) cells.push(k); }
  const lead = D.weekdayOf(cells[0]);
  const mo = D.MONTHS[m - 1];
  const g0 = civil(first), g1 = civil(first + 29);
  const sub = `${MON[g0.m - 1]} ${g0.d}${g0.y !== g1.y ? ' ' + D.yearShort(g0.y) : ''} – ${MON[g1.m - 1]} ${g1.d}, ${D.yearShort(g1.y)} ${settings.civil === 'historian' ? '' : '(' + calName(g1.cal) + ')'}`;
  let h = `<div class="month-head">
    <button class="nav" data-mnav="-1" aria-label="Previous month">‹</button>
    <h2>${mo.name}${mo.alt ? ' / ' + mo.alt : ''} ${am} AM<small>${sub}</small></h2>
    <button class="nav" data-mnav="1" aria-label="Next month">›</button></div>
    <div class="grid" role="grid" data-swipe="month">${D.WEEKDAYS.map((w, i) => `<div class="wd${i === 6 ? ' sab' : ''}">${w.slice(0, 3)}</div>`).join('')}`;
  for (let i = 0; i < lead; i++) h += '<div class="blank"></div>';
  for (const j of cells) {
    const y = D.fromJdn(j); if (!y) { h += '<div class="blank"></div>'; continue; }
    const cv = civil(j);
    const mk = D.marks(y);
    const evs = eventsOn(j);
    let cls = 'cell', num;
    if (y.kind === 'tekufah') { cls += ' tek'; num = '☉'; }
    else if (y.kind === 'leap') { cls += ' leap'; num = 'L' + y.day; }
    else if (y.kind === 'creation') { num = 'C' + y.creationDay; }
    else num = y.day;
    if (y.weekday === 6) cls += ' sab';
    if (mk.some(k => k.major)) cls += ' feast';
    if (j === sel) cls += ' sel';
    if (j === today) cls += ' today';
    const lab = y.kind === 'tekufah' ? `Tekufah ${D.TEKUFOT[y.q].split(' ')[0]}` : mk[0]?.label || (evs[0]?.t ?? '');
    let dots = '';
    if (settings.moon) { const mm = moonAt(j); if (mm?.newMoon) dots += '<span title="New moon">●</span>'; else if (mm?.fullMoon) dots += '<span title="Full moon">○</span>'; }
    if (evs.some(e => e.k !== 'mine')) dots += '<span class="dot"></span>';
    if (evs.some(e => e.k === 'mine')) dots += '<span class="dot mine"></span>';
    h += `<button class="${cls}" data-j="${j}" aria-label="${esc(dssShort(y))}, ${esc(fmtCivil(cv, true))}">
      <span class="n">${num}</span><span class="g">${short(cv)}</span>${lab ? `<span class="lab">${esc(lab)}</span>` : ''}${dots ? `<span class="dots">${dots}</span>` : ''}</button>`;
  }
  h += `</div><div class="legend"><span><i style="background:var(--sun-soft);border:1px solid var(--sun)"></i>Tekufah</span><span><i style="background:var(--sabbath);border:1px solid var(--line)"></i>Sabbath</span><span><span class="dot" style="display:inline-block;margin-right:5px"></span>History</span>${settings.moon ? '<span>● New moon ○ Full moon</span>' : ''}</div>`;
  $('#monthMain').innerHTML = h;
}
function stepMonth(dir) {
  viewMonth += dir;
  if (viewMonth > 12) { if (viewAm >= D.lastAM()) { viewMonth = 12; return; } viewMonth = 1; viewAm++; }
  if (viewMonth < 1) { if (viewAm <= 1) { viewMonth = 1; return; } viewMonth = 12; viewAm--; }
  renderMonth();
}

// ---------- Year ring ----------
let ringAm = null;
function renderRing() {
  const x = D.fromJdn(sel);
  if (ringAm == null) ringAm = x.am || 1;
  const am = ringAm, len = D.yearLength(am), start = D.yearStart(am);
  const S = 600, C = S / 2, R1 = 250, R0 = 205;
  const ang = i => (i / len) * 2 * Math.PI - Math.PI / 2;
  const pt = (r, a) => `${(C + r * Math.cos(a)).toFixed(2)},${(C + r * Math.sin(a)).toFixed(2)}`;
  const seasonCol = ['#9FCFB8', '#E6C27A', '#D9A07A', '#9DB9D6'];
  let segs = '';
  for (let i = 0; i < len; i++) {
    const y = D.fromJdn(start + i);
    const a0 = ang(i), a1 = ang(i + 1);
    let fill;
    if (y.kind === 'tekufah') fill = 'var(--sun)';
    else if (y.kind === 'leap') fill = 'var(--mineral)';
    else fill = seasonCol[Math.floor((y.month - 1) / 3)];
    const sabbath = y.weekday === 6;
    const r0 = sabbath ? R0 - 8 : R0;
    segs += `<path data-j="${start + i}" d="M${pt(r0, a0)} L${pt(R1, a0)} A${R1},${R1} 0 0 1 ${pt(R1, a1)} L${pt(r0, a1)} A${r0},${r0} 0 0 0 ${pt(r0, a0)}Z" fill="${fill}" opacity="${sabbath ? 1 : .72}" stroke="var(--bg)" stroke-width=".4"/>`;
    const mk = D.marks(y).filter(m => m.major);
    if (mk.length && y.kind === 'month') segs += `<circle cx="${pt(R1 + 10, (a0 + a1) / 2).split(',')[0]}" cy="${pt(R1 + 10, (a0 + a1) / 2).split(',')[1]}" r="3.2" fill="var(--sun)"><title>${esc(mk[0].label)}</title></circle>`;
  }
  let labels = '';
  for (let m = 1; m <= 12; m++) {
    const i = D.toJdn(am, m, 15) - start;
    const a = ang(i + .5);
    const [lx, ly] = pt(R0 - 26, a).split(',');
    labels += `<text x="${lx}" y="${ly}" text-anchor="middle" dominant-baseline="middle" font-family="var(--serif)" font-size="15" fill="var(--ink)">${D.MONTHS[m - 1].name}</text>`;
  }
  let selMark = '';
  if (x.am === am) {
    const i = sel - start, a = ang(i + .5);
    const [sx, sy] = pt(R1 + 24, a).split(',');
    selMark = `<line x1="${pt(R0 - 6, a).split(',')[0]}" y1="${pt(R0 - 6, a).split(',')[1]}" x2="${sx}" y2="${sy}" stroke="var(--brine)" stroke-width="3" stroke-linecap="round"/><circle cx="${sx}" cy="${sy}" r="7" fill="var(--brine)"/>`;
  }
  let todayMark = '';
  const tx = D.fromJdn(today);
  if (tx && tx.am === am && today !== sel) {
    const a = ang(today - start + .5); const [qx, qy] = pt(R1 + 22, a).split(',');
    todayMark = `<circle cx="${qx}" cy="${qy}" r="5" fill="none" stroke="var(--brine)" stroke-width="2"><title>Today</title></circle>`;
  }
  const g0 = civil(start), g1 = civil(start + len - 1);
  const cy = D.cycles(am);
  const centre = `<text x="${C}" y="${C - 26}" text-anchor="middle" font-family="var(--serif)" font-size="46" font-weight="500" fill="var(--brine)">${am} AM</text>
    <text x="${C}" y="${C + 8}" text-anchor="middle" font-size="17" fill="var(--ink-2)">${fmtCivil(g0)} – ${fmtCivil(g1)}</text>
    <text x="${C}" y="${C + 34}" text-anchor="middle" font-size="16" fill="var(--ink)">${len} days${len === 371 ? ' · leap week' : ''}</text>
    <text x="${C}" y="${C + 58}" text-anchor="middle" font-size="15" fill="var(--ink-2)">${cy.jubileeYear ? 'Jubilee year' : `Year ${cy.year} · Shemitah ${cy.shemitah}`}${cy.sabbathYear ? ' · Sabbath year' : ''}</text>`;
  $('#ringMain').innerHTML = `<div class="ring-wrap">
    <div class="ring-head"><button class="nav" data-ynav="-1" aria-label="Previous year">‹</button><h2>${am} AM</h2><button class="nav" data-ynav="1" aria-label="Next year">›</button></div>
    <svg viewBox="0 0 ${S} ${S}" role="img" aria-label="Year ${am} AM as a ring of ${len} days; tap a day to open it">${segs}${labels}${todayMark}${selMark}${centre}</svg>
    <div class="ring-cycles"><table>
      <tr><td>Age</td><td>${D.AGES[cy.age - 1]}</td></tr>
      <tr><td>Onah (500 years)</td><td>${cy.onah} of 14</td></tr>
      <tr><td>Jubilee (50 years)</td><td>${cy.jubilee} of 10 in this Onah · ${cy.jubileeTotal} since Creation</td></tr>
      <tr><td>Enoch's weeks (700 years)</td><td>${cy.enochWeek} of 10</td></tr>
      <tr><td>Priestly 6-year cycle</td><td>Year ${cy.priestlyCycleYear}</td></tr>
    </table>
    <p class="muted">Each wedge is one day; the four gold wedges are the Tekufah Tuesdays, longer wedges are Sabbaths, and gold dots mark feasts. Tap a day to open it.</p></div></div>`;
}

// ---------- History ----------
// The list can hold 1,300+ rows, so it is built in chunks as you scroll.
let histRows = [], histShown = 0, histObs = null;
function renderHistory() {
  const all = allEvents();
  $('#view-history').innerHTML = `${catBar()}${propBar()}
    <div class="field"><input id="hq" type="search" enterkeyhint="search" placeholder="Filter ${all.length} events" value="${esc(histQuery)}" aria-label="Filter events"></div>
    <ul class="hist" id="histList"></ul><div id="histMore" class="hist-more"></div>`;
  let tmr = 0;
  $('#hq').addEventListener('input', e => { clearTimeout(tmr); tmr = setTimeout(() => { histQuery = e.target.value; fillHistory(); }, 120); });
  fillHistory();
}
function fillHistory() {
  const q = histQuery.trim().toLowerCase();
  const props = propList().map(p => ({ pr: p, am: p.g.am }));
  histRows = [...allEvents().map(e => ({ e, am: TL.amPos(e.j) })), ...props]
    .filter(o => !q || (o.e ? o.e.t + ' ' + o.e.n + ' ' + o.e.r : o.pr.t + ' ' + o.pr.ref + ' ' + o.pr.fr + ' ' + o.pr.s).toLowerCase().includes(q))
    .sort((a, b) => a.am - b.am);
  histShown = 0; histLastEra = '';
  $('#histList').innerHTML = histRows.length ? '' : `<li class="muted" style="padding:12px 0">No events match. Try a shorter word, or switch on more categories above.</li>`;
  moreHistory();
  histObs?.disconnect();
  histObs = new IntersectionObserver(es => { if (es[0].isIntersecting) moreHistory(); }, { rootMargin: '800px' });
  histObs.observe($('#histMore'));
}
let histLastEra = '';
function moreHistory() {
  const end = Math.min(histRows.length, histShown + 150);
  let h = '';
  for (let i = histShown; i < end; i++) {
    const o = histRows[i], am = Math.floor(o.am);
    const era = am >= 1 ? `Onah ${D.cycles(am).onah} · ${D.AGES[D.cycles(am).age - 1]}` : 'Creation';
    if (era !== histLastEra) { h += `<li class="era">${era}</li>`; histLastEra = era; }
    if (o.pr) {
      const p = o.pr;
      h += `<li><button data-pr="${esc(p.id)}" class="hist-p${p.id === tl.last ? ' seen' : ''}"><span class="d1">Foretold ${esc(p.g.label)} · ${esc(p.ref)}</span><span class="t">${p.n ? '#' + p.n + ' ' : ''}${esc(p.t)}</span><span class="d2">${p.f ? 'Fulfilled ' + esc(p.f.label) + (p.fr ? ' · ' + esc(p.fr) : '') : 'Yet to be fulfilled'}</span></button></li>`;
      continue;
    }
    const e = o.e, c = D.jdnToCivil(e.j);
    h += `<li><button data-ev="${esc(e.id)}"${e.id === tl.last ? ' class="seen"' : ''}><span class="d1">${esc(TL.whenText(e).split(' · ')[0])}</span><span class="t">${esc(e.t)}</span><span class="d2">${D.WEEKDAYS[D.weekdayOf(e.j)]}, ${fmtCivil(c, true)} ${calName(c.cal)}</span></button></li>`;
  }
  histShown = end;
  $('#histList').insertAdjacentHTML('beforeend', h);
  $('#histMore').textContent = histShown < histRows.length ? `Showing ${histShown} of ${histRows.length}` : '';
}

// ---------- Search ----------
const MONTH_WORDS = {};
MONTH_FULL.forEach((m, i) => { MONTH_WORDS[m.toLowerCase()] = i + 1; MONTH_WORDS[m.slice(0, 3).toLowerCase()] = i + 1; });
MONTH_WORDS.sept = 9;
const DSS_WORDS = {};
D.MONTHS.forEach((m, i) => { DSS_WORDS[m.name.toLowerCase()] = i + 1; if (m.alt) DSS_WORDS[m.alt.toLowerCase()] = i + 1; });
Object.assign(DSS_WORDS, { tishri: 7, cheshvan: 8, marcheshvan: 8, chislev: 9, tebeth: 10, tevet: 10, shebat: 11, sh: 0 });
delete DSS_WORDS.sh;

function parseQuery(raw) {
  const s = raw.trim().toLowerCase().replace(/,/g, ' ').replace(/\s+/g, ' ');
  const out = [];
  if (!s) return out;
  if (s === 'today' || s === 'now') out.push({ label: 'Today', j: today });
  if (s === 'creation') out.push({ label: 'Creation week', sub: 'Day 1, the Sunday before Nisan 1, 1 AM', j: D.yearStart(1) - 3 });
  let era = null, t = s;
  const eraRe = /\b(bc|bce|b\.c\.|ad|ce|a\.d\.|am|a\.m\.)\b/;
  const em = t.match(eraRe);
  if (em) { era = em[1].replace(/\./g, ''); if (era === 'bce') era = 'bc'; if (era === 'ce') era = 'ad'; t = t.replace(eraRe, ' ').replace(/\s+/g, ' ').trim(); }
  // ISO 1945-05-08
  let m = t.match(/^(-?\d{1,4})-(\d{1,2})-(\d{1,2})$/);
  if (m) pushCivil(out, +m[1], +m[2], +m[3]);
  // 8 may 1945 / may 8 1945 / 15 march 44 (bc)
  const parts = t.split(' ');
  if (parts.length === 3) {
    let d, mo, y, dssMo;
    for (const order of [[0, 1, 2], [1, 0, 2]]) {
      const [di, mi, yi] = order;
      if (/^\d{1,2}$/.test(parts[di]) && /^\d{1,5}$/.test(parts[yi])) {
        if (MONTH_WORDS[parts[mi]]) { d = +parts[di]; mo = MONTH_WORDS[parts[mi]]; y = +parts[yi]; }
        if (DSS_WORDS[parts[mi]]) { d = +parts[di]; dssMo = DSS_WORDS[parts[mi]]; y = +parts[yi]; }
      }
    }
    if (dssMo && y >= 1 && y <= D.lastAM() && d >= 1 && d <= 30 && era !== 'bc' && era !== 'ad') {
      out.push({ label: `${d} ${D.MONTHS[dssMo - 1].name} ${y} AM`, sub: 'DSS date', j: D.toJdn(y, dssMo, d) });
    }
    if (mo && d >= 1 && d <= 31) {
      const ay = era === 'bc' ? 1 - y : y;
      if (era !== 'am') pushCivil(out, ay, mo, d);
    }
  }
  // two parts: "may 1945" or "iyar 1656"
  if (parts.length === 2 && /^\d{1,5}$/.test(parts[1])) {
    const y = +parts[1];
    if (DSS_WORDS[parts[0]] && y >= 1 && y <= D.lastAM()) out.push({ label: `${D.MONTHS[DSS_WORDS[parts[0]] - 1].name} ${y} AM`, sub: 'Start of the month', j: D.toJdn(y, DSS_WORDS[parts[0]], 1) });
    if (MONTH_WORDS[parts[0]]) pushCivil(out, era === 'bc' ? 1 - y : y, MONTH_WORDS[parts[0]], 1);
  }
  // bare year
  if (/^\d{1,5}$/.test(t)) {
    const n = +t;
    if (era === 'am' || !era) if (n >= 1 && n <= D.lastAM()) out.push({ label: `${n} AM`, sub: `Nisan 1 — ${fmtCivil(D.jdnToCivil(D.yearStart(n)), true)}`, j: D.yearStart(n), am: n });
    if (era === 'bc' && n >= 1 && n <= 3925) yearOut(out, 1 - n);
    if ((era === 'ad' || !era) && n >= 1 && n <= 3075) yearOut(out, n);
    if (!era) out.sort((a, b) => (b.adFirst ? 1 : 0) - (a.adFirst ? 1 : 0));
  }
  // events
  if (s.length >= 2 && !/^\d+$/.test(s)) {
    const words = s.split(' ');
    const all = allEvents();
    const hits = all.filter(e => { const hay = (e.t + ' ' + e.r + ' ' + e.n).toLowerCase(); return words.every(w => hay.includes(w)); })
      .sort((a, b) => (a.t.toLowerCase().includes(s) ? 0 : 1) - (b.t.toLowerCase().includes(s) ? 0 : 1));
    for (const e of hits.slice(0, 12)) out.push({ label: e.t, sub: TL.whenText(e), j: e.j });
    const ph = PROPHECIES.filter(p => { const hay = (p.t + ' ' + p.ref + ' ' + p.fr + ' ' + p.who).toLowerCase(); return words.every(w => hay.includes(w)); });
    for (const p of ph.slice(0, 8)) out.push({ label: (p.n ? `Prophecy #${p.n}: ` : 'Prophecy: ') + p.t, sub: `${p.ref} · foretold ${p.g.label} → ${p.f ? p.f.label : 'yet future'}`, pr: p.id });
  }
  return out;
}
function yearOut(out, ay) {
  // Find the AM year that contains 1 Jan… simplest: show the DSS year beginning in this civil year
  const am = ay + D.EPOCH_OFFSET;
  if (am < 1 || am > D.lastAM()) return;
  out.push({ label: D.yearLabel(ay), sub: `${am} AM begins ${fmtCivil(D.jdnToCivil(D.yearStart(am)), true)}`, j: D.yearStart(am), adFirst: ay > 0 && ay > 1000 });
}
function pushCivil(out, y, m, d) {
  const useJulian = y < 1582 || (y === 1582 && (m < 10 || (m === 10 && d < 15)));
  const j = useJulian ? D.julToJdn(y, m, d) : D.gregToJdn(y, m, d);
  if (j < D.minJdn() || j > D.maxJdn()) return;
  const x = D.fromJdn(j);
  out.push({ label: `${d} ${MONTH_FULL[m - 1]} ${D.yearShort(y)}`, sub: `${useJulian ? 'Julian' : 'Gregorian'} → ${dssShort(x)}`, j });
  if (useJulian && y > -3000) {
    const g = D.gregToJdn(y, m, d);
    if (g !== j && g >= D.minJdn()) out.push({ label: `${d} ${MONTH_FULL[m - 1]} ${D.yearShort(y)} (proleptic Gregorian)`, sub: `→ ${dssShort(D.fromJdn(g))}`, j: g });
  }
}

let results = [], active = -1;
function showResults() {
  const box = $('#results');
  if (!results.length) { box.hidden = true; return; }
  let h = '', wikiHead = false;
  results.forEach((r, i) => {
    if (r.wd && !wikiHead) { h += '<div class="res-head">People, places and events from Wikipedia</div>'; wikiHead = true; }
    if (r.loading) { h += `<div class="res-head">${esc(r.label)}</div>`; return; }
    h += `<button role="option" data-ri="${i}" class="${i === active ? 'active' : ''}">${esc(r.label)}${r.sub ? `<small>${esc(r.sub)}</small>` : ''}</button>`;
  });
  box.innerHTML = h;
  box.hidden = false;
}
function pick(r) {
  if (!r || r.loading) return;
  $('#results').hidden = true; $('#q').value = ''; $('#q').blur();
  if (r.wd) { openLookup(r.wd); return; }
  if (r.pr) { openProphecy(r.pr); return; }
  if (r.am && view === 'ring') { ringAm = r.am; select(r.j, true); return; }
  select(r.j, true); if (view !== 'month' && view !== 'ring') { scrollMemo.day = 0; setView('day'); } else if (!wide()) openDaySheet();
}

// ---------- Selection, routing ----------
function select(j, jumpViews) {
  sel = Math.max(D.minJdn(), Math.min(D.maxJdn(), j));
  const x = D.fromJdn(sel);
  if (jumpViews) { viewAm = x.am || 1; viewMonth = x.am ? monthOf(x) : 1; ringAm = x.am || 1; }
  try { history.replaceState(null, '', sel === today ? location.pathname : `#d=${sel}`); } catch { /* sandboxed */ }
  render();
}
function render() {
  if (view === 'day') renderDay();
  if (view === 'month') { renderMonth(); renderSide(); }
  if (view === 'ring') { renderRing(); renderSide(); }
  if (view === 'history') renderHistory();
  if (view === 'timeline') renderTimeline();
  if ($('#daySheet').open) $('#daySheetBody').innerHTML = dayHtml(sel, 'panel');
}
const scrollMemo = {};
let backPlace = null;
function showBack() {
  let el = $('#backPlace');
  if (!backPlace) { el?.remove(); return; }
  if (!el) { el = document.createElement('button'); el.id = 'backPlace'; el.className = 'back-place'; document.body.appendChild(el); }
  el.textContent = backPlace.view === 'history' ? 'Back to my place in History' : 'Back to my place in the timeline';
}
function setView(v) {
  scrollMemo[view] = window.scrollY;
  if (v !== 'timeline') { lineApi?.detach(); }
  view = v;
  document.querySelectorAll('.tabs button').forEach(b => b.setAttribute('aria-selected', b.dataset.view === v));
  ['day', 'month', 'ring', 'timeline', 'history'].forEach(k => { $('#view-' + k).hidden = k !== v; });
  render();
  requestAnimationFrame(() => window.scrollTo({ top: scrollMemo[v] || 0 }));
}

// ---------- About ----------
function renderAbout() {
  const n1 = D.yearStart(1), eq = D.equinoxOf(1);
  $('#about').innerHTML = `
    <h3>How this calendar works</h3>
    <p>Twelve months of 30 days, plus four Tekufah days at the solstices and equinoxes, make a 364-day year of exactly 52 weeks. Every date falls on the same weekday every year: Nisan 1 is always a Wednesday and every Tekufah is a Tuesday.</p>
    <p>To stay with the sun, a leap week is added after Adar 30 every five or six years. The rule used here: <b>Tekufah Nisan is the last Tuesday on or before the day of the true spring equinox in Jerusalem</b>. It reproduces every date published on dsscalendar.org and gives ${[...Array(D.lastAM()).keys()].filter(i => D.isLeapYear(i + 1)).length} leap weeks from Creation to 7000 AM.</p>
    <h3>Creation</h3>
    <p>1 AM = 3925 BC (AM = AD + 3925). Run back with the equinox computed for each year, Nisan 1 of 1 AM falls on <b>Wednesday ${fmtCivil(D.jdnToGreg(n1), true)} (Gregorian) = ${fmtCivil(D.jdnToJul(n1), true)} (Julian)</b>, Creation day 4. That year's equinox was ${D.WEEKDAYS[D.weekdayOf(eq.jdn)]} ${fmtCivil(D.jdnToGreg(eq.jdn))} (Gregorian).</p>
    <h3>Days and dates</h3>
    <p>A DSS day runs from sunrise, so each DSS day matches the daylight of the civil date shown; the night before sunrise belongs to the previous day. Civil dates follow historians: Julian before 15 October 1582, Gregorian after (change this above).</p>
    <p>Ancient equinox times carry clock uncertainty (ΔT) of hours. Years whose equinox is within six hours of a week boundary are flagged on their day card.</p>
    <h3>Cycles</h3>
    <p>Year and Shemitah (7 years), Jubilee (50), Onah (500), Age (2000) and Enoch's weeks (700) follow dsscalendar.org. A few rows of that site's own table disagree with each other by one year; this app uses the single rule that matches most of them. Priestly courses rotate weekly without a break from Creation week, starting with Gamul as in the Qumran texts.</p>
    <h3>Events</h3>
    <p>Historical events are matched by their documented civil date. Biblical events are placed by the DSS chronology (Genesis, Exodus and dsscalendar.org), not by independent historical dating.</p>
    <h3>Credit</h3>
    <p>Based on the Dead Sea Scroll calendar research of Ken Johnson at <a href="https://dsscalendar.org" target="_blank" rel="noopener">dsscalendar.org</a> and <a href="https://biblefacts.org" target="_blank" rel="noopener">biblefacts.org</a>. Independent app; equinoxes from the open-source Astronomy Engine.</p>`;
}

// ---------- Timeline ----------
const ZOOMS = [[0, 'Compact'], [0.3, 'Normal'], [2, 'Wide'], [10, 'Detail']];
const tl = Object.assign({ mode: 'line', zoom: 0.3, from: 1, to: 7000 }, store.get('tl', {}));
if (![0, 0.3, 2, 10].includes(tl.zoom)) tl.zoom = 0.3;
let lineApi = null;
function renderTimeline() {
  store.set('tl', tl);
  const evs = allEvents();
  const props = propList();
  const range = `<label class="tl-range">From <input type="number" inputmode="numeric" id="tlFrom" min="1" max="7000" value="${tl.from}"> to <input type="number" inputmode="numeric" id="tlTo" min="1" max="7000" value="${tl.to}"> AM</label>`;
  const zi = ZOOMS.findIndex(z => z[0] === tl.zoom);
  let h = `${catBar()}${propBar()}
    <div class="tl-bar">
      <div class="seg" role="group" aria-label="Timeline style">
        <button data-tlmode="line" aria-pressed="${tl.mode === 'line'}">Line</button>
        <button data-tlmode="wheel" aria-pressed="${tl.mode === 'wheel'}">Wheel</button>
      </div>
      ${tl.mode === 'line' ? `<div class="seg zoom" role="group" aria-label="Zoom">
        <button data-tlzoom="${ZOOMS[Math.max(0, zi - 1)][0]}" aria-label="Zoom out"${zi <= 0 ? ' disabled' : ''}>−</button>
        <span class="zoom-l">${ZOOMS[zi][1]}</span>
        <button data-tlzoom="${ZOOMS[Math.min(ZOOMS.length - 1, zi + 1)][0]}" aria-label="Zoom in"${zi >= ZOOMS.length - 1 ? ' disabled' : ''}>+</button></div>` : ''}
      <button class="icon-btn print-btn" data-act="print" aria-label="Print or save"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 9V3h10v6M7 17H4v-6a2 2 0 012-2h12a2 2 0 012 2v6h-3" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><rect x="7" y="14" width="10" height="7" rx="1" fill="none" stroke="currentColor" stroke-width="2"/></svg></button>
    </div>
    <div class="tl-sub">${range}<span class="muted">${evs.length} events${props.length ? ` · ${props.length} prophecies` : ''}</span></div>
    ${propOn() && !PROPHECIES.length ? '<p class="empty">Loading prophecies…</p>' : !evs.length && !props.length ? `<p class="empty">Nothing to show. Switch on Bible, History, Church or Prophecy above.</p>` : '<div id="tlBody"></div>'}`;
  $('#view-timeline').innerHTML = h;
  const body = $('#tlBody');
  const upd = () => { tl.from = +$('#tlFrom').value || 1; tl.to = +$('#tlTo').value || 7000; renderTimeline(); };
  $('#tlFrom').addEventListener('change', upd); $('#tlTo').addEventListener('change', upd);
  if (!body) { lineApi?.detach(); lineApi = null; return; }
  const from = Math.max(1, Math.min(tl.from, tl.to)), to = Math.min(7000, Math.max(tl.from, tl.to));
  if (tl.mode === 'line') lineApi = TL.renderLine(body, evs, { ppy: tl.zoom, from, to, lastId: tl.last, prophecies: props });
  else {
    lineApi?.detach(); lineApi = null;
    const size = 1000;
    const w = TL.wheelSVG(evs, size, { from, to, prophecies: props, lastId: tl.last });
    body.innerHTML = `<div class="wheel-wrap"><svg viewBox="0 0 ${size} ${size}" role="img" aria-label="Wheel of ${w.count} events from ${from} to ${to} AM">${w.svg}</svg></div>
      <p class="muted">Creation is at the top; time runs clockwise. Tap a label or a prophecy arrow to read it. Pinch to zoom, or print it large for full detail.</p>`;
  }
}

// ---------- Event reader ----------
// Opens over the current view, so closing it returns to the same scroll position.
const evById = id => EVENTS.find(e => e.id === id) || mine.map(e => ({ ...e, k: 'mine' })).find(e => e.id === id);
const wikiTitle = u => { const m = /wikipedia\.org\/wiki\/([^?#]+)/.exec(u || ''); return m ? decodeURIComponent(m[1]) : ''; };
const bibleRef = e => (e.k === 'biblical' && /^[1-3]?\s?[A-Za-z]+ \d+:\d+/.test(e.r) ? e.r : '');
async function openEvent(id) {
  const e = evById(id); if (!e) return;
  tl.last = id; store.set('tl', tl);
  markSeen(id);
  const x = D.fromJdn(e.j), c = D.jdnToCivil(e.j);
  const other = c.cal === 'julian' ? { ...D.jdnToGreg(e.j), cal: 'gregorian' } : { ...D.jdnToJul(e.j), cal: 'julian' };
  const kind = KIND_LABEL[e.k] || 'History';
  const wt = wikiTitle(e.u), ref = bibleRef(e);
  const links = [];
  if (e.u) links.push(`<a href="${esc(e.u)}" target="_blank" rel="noopener">${esc(e.s && !/wikipedia/i.test(e.s) ? e.s : (wt ? 'Wikipedia' : 'Source'))}</a>`);
  if (wt && e.u !== `https://en.wikipedia.org/wiki/${wt}`) links.push(`<a href="https://en.wikipedia.org/wiki/${encodeURIComponent(wt)}" target="_blank" rel="noopener">Wikipedia</a>`);
  if (wt) links.push(`<a href="https://grokipedia.com/page/${encodeURIComponent(wt.replace(/ /g, '_'))}" target="_blank" rel="noopener">Grokipedia</a>`);
  const when = e.p === 'm' && x?.kind === 'month'
    ? `${D.MONTHS[x.month - 1].name} ${x.am} AM <span class="muted">(Scripture gives the month only)</span>`
    : `${D.WEEKDAYS[x.weekday]}, ${esc(dssShort(x))}`;
  $('#eventBody').innerHTML = `
    <div class="kind ${e.k}">${kind}${e.c === 'probable' ? ' · day probable' : ''}${e.c === 'derived' ? ' · year derived' : ''}</div>
    <h2 class="lk-title">${esc(e.t)}</h2>
    <p class="ev-when">${when}</p>
    <p class="muted">${fmtCivil(c, true)} ${calName(c.cal)}${c.y < 1700 ? ` · ${fmtCivil(other, true)} ${calName(other.cal)}` : ''}${e.r && !ref ? ` · ${esc(e.r)}` : ''}</p>
    ${e.n ? `<p>${esc(e.n)}</p>` : ''}
    ${e.b ? `<p class="basis">Year: ${esc(e.b)}</p>` : ''}
    <div id="evRead" class="ev-read"></div>
    <p class="lk-links">${links.join(' ')}</p>
    <div class="pr-actions">
      <button type="button" class="btn" data-openday="${e.j}">Open this day</button>
      <button type="button" class="btn ghost" value="close" onclick="this.closest('dialog').close()">Back to where I was</button>
    </div>`;
  $('#eventDlg').showModal();
  $('#eventDlg').scrollTop = 0;
  const read = $('#evRead');
  if (ref) {
    read.innerHTML = `<p class="muted">Loading ${esc(ref)} (KJV)…</p>`;
    try {
      const r = await fetch(`https://bible-api.com/${encodeURIComponent(ref)}?translation=kjv`);
      if (!r.ok) throw new Error(r.status);
      const j = await r.json();
      read.innerHTML = `<blockquote class="verse">${esc((j.text || '').trim())}<cite>${esc(j.reference || ref)}, King James Version</cite></blockquote>`;
    } catch { read.innerHTML = `<p class="muted">Couldn't load the verse text. Use the link below to read ${esc(ref)}.</p>`; }
  } else if (wt) {
    read.innerHTML = '<p class="muted">Loading summary…</p>';
    try {
      const r = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(wt)}`);
      if (!r.ok) throw new Error(r.status);
      const j = await r.json();
      read.innerHTML = `${j.thumbnail?.source ? `<img class="lk-img" src="${esc(j.thumbnail.source)}" alt="">` : ''}<p>${esc(j.extract || '')}</p><p class="muted small">Summary from Wikipedia. Dates there follow standard (secular) dating.</p>`;
    } catch { read.innerHTML = '<p class="muted">Couldn\'t load the summary. Use the links below to read more.</p>'; }
  } else read.innerHTML = '';
}

// ---------- Prophecy reader ----------
async function verse(ref, el) {
  if (!/^[1-3]?\s?[A-Za-z]+\.? \d+:\d+/.test(ref)) { el.innerHTML = ''; return; }
  el.innerHTML = `<p class="muted small">Loading ${esc(ref)}…</p>`;
  try {
    const r = await fetch(`https://bible-api.com/${encodeURIComponent(ref)}?translation=kjv`);
    if (!r.ok) throw new Error(r.status);
    const j = await r.json();
    el.innerHTML = `<blockquote class="verse">${esc((j.text || '').trim())}<cite>${esc(j.reference || ref)}, KJV</cite></blockquote>`;
  } catch { el.innerHTML = `<p class="muted small"><a href="https://www.biblegateway.com/passage/?search=${encodeURIComponent(ref)}&version=KJV" target="_blank" rel="noopener">Read ${esc(ref)}</a></p>`; }
}
function markSeen(id) {
  document.querySelectorAll('.seen').forEach(n => n.classList.remove('seen'));
  document.querySelectorAll(`#view-history [data-ev="${CSS.escape(id)}"], #view-history [data-pr="${CSS.escape(id)}"]`).forEach(n => n.classList.add('seen'));
  if (view === 'timeline') lineApi?.setLast(id);
}
function openProphecy(id) {
  const p = propById(id); if (!p) return;
  tl.last = id; store.set('tl', tl); markSeen(id);
  const amTxt = t => `${Math.floor(t.am)} AM`;
  const by = { johnson: "Ken Johnson's date", evangelical: 'standard evangelical dating', secular: 'secular dating' };
  const basis = [...new Set(p.ys)].map(k => by[k] || k).join(' / ');
  $('#eventBody').innerHTML = `
    <div class="kind prophecy">${p.n ? `Ancient Prophecies Revealed #${p.n}${p.sec ? ' · ' + esc(p.sec) : ''} · ` : p.nj ? "Not in Johnson's list · " : ''}Prophecy${p.st === 'future' ? ' · yet to be fulfilled' : p.st === 'partial' ? ' · partly fulfilled' : ''}</div>
    <h2 class="lk-title">${esc(p.t)}</h2>
    <div class="p-span">
      <div><span class="muted small">Foretold</span><b>${esc(p.g.label)}</b><span class="muted small">${amTxt(p.g)} · ${esc(p.who ? p.who + ', ' : '')}${esc(p.ref)}</span></div>
      <div class="p-arrow" aria-hidden="true">→</div>
      <div><span class="muted small">${p.f ? 'Fulfilled' : p.x ? 'Expected' : 'Fulfilment'}</span><b>${p.f ? esc(p.f.label) : p.x ? esc(p.x.label) : 'Yet future'}</b><span class="muted small">${p.f ? amTxt(p.f) + (p.fr ? ' · ' + esc(p.fr) : '') : p.x ? amTxt(p.x) + " · Ken Johnson's projection" : ''}</span></div>
    </div>
    ${p.f ? `<p class="muted small">${Math.round(p.f.am - p.g.am)} years from prediction to fulfilment${p.g.approx || p.f.approx ? ' (approximate)' : ''}.</p>` : ''}
    ${p.s ? `<p>${esc(p.s)}</p>` : ''}
    ${p.dss ? `<p class="basis">Dead Sea Scrolls: ${esc(p.dss)}</p>` : ''}
    ${p.a.length ? `<p class="small">Taught by: ${p.a.map(a => `<span class="badge teal">${esc(a)}</span>`).join(' ')}</p>` : ''}
    ${basis ? `<p class="basis">Years: ${esc(basis)}</p>` : ''}
    <h3 class="lk-h">The prophecy</h3><div id="pv1"></div>
    ${p.fr && /\d+:\d+/.test(p.fr) ? '<h3 class="lk-h">The fulfilment</h3><div id="pv2"></div>' : ''}
    ${p.src.length ? `<p class="lk-links">${p.src.map(x => x.u ? `<a href="${esc(x.u)}" target="_blank" rel="noopener">${esc(x.n)}</a>` : `<span class="muted small">${esc(x.n)}</span>`).join(' ')}</p>` : ''}
    <div class="pr-actions">
      <button type="button" class="btn" data-pjump="${esc(p.id)}" data-end="g">Show where it was foretold</button>
      ${p.f || p.x ? `<button type="button" class="btn" data-pjump="${esc(p.id)}" data-end="f">${p.f ? 'Show its fulfilment' : 'Show the expected time'}</button>` : ''}
      <button type="button" class="btn ghost" onclick="this.closest('dialog').close()">Back to where I was</button>
    </div>`;
  $('#eventDlg').showModal(); $('#eventDlg').scrollTop = 0;
  verse(p.ref, $('#pv1'));
  if ($('#pv2')) verse(p.fr, $('#pv2'));
}
function jumpToProphecy(id, end) {
  $('#eventDlg').close();
  backPlace = { view, y: window.scrollY }; scrollMemo[view] = window.scrollY;
  if (view !== 'timeline' || tl.mode !== 'line') { tl.mode = 'line'; if (view !== 'timeline') setView('timeline'); else renderTimeline(); }
  let y = lineApi?.posOf(`p${end}-${id}`);
  if (y == null) { tl.from = 1; tl.to = 7000; renderTimeline(); y = lineApi?.posOf(`p${end}-${id}`); }
  if (y != null) {
    window.scrollTo({ top: y - window.innerHeight / 3 });
    requestAnimationFrame(() => { lineApi.paint(); const el = document.getElementById(`tl-p${end}-${id}`); if (el) { el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 1600); } });
  }
  showBack();
}

// ---------- Print and export ----------
const PAPERS = [
  ['letter', 'Letter 11 × 8.5 in', 11, 8.5], ['tabloid', 'Tabloid 17 × 11 in', 17, 11],
  ['a3', 'A3 16.5 × 11.7 in', 16.54, 11.69], ['p2436', 'Poster 36 × 24 in', 36, 24],
  ['p3648', 'Poster 48 × 36 in', 48, 36], ['p4872', 'Banner 72 × 24 in', 72, 24],
];
const pr = Object.assign({ kind: 'line', paper: 'p2436' }, store.get('print', {}));
function posterNow() {
  const [, , wi, hi] = PAPERS.find(p => p[0] === pr.paper) || PAPERS[3];
  const W = wi * 72, H = hi * 72;
  const cats = Object.keys(TL.TYPES).filter(k => settings.show[k] !== false);
  const from = Math.max(1, Math.min(tl.from, tl.to)), to = Math.min(7000, Math.max(tl.from, tl.to));
  const doc = TL.posterDoc(pr.kind === 'wheel' ? 'wheel' : 'line', allEvents(), W, H, { from, to, cats, prophecies: propList() });
  return { ...doc, W, H, wi, hi };
}
function openPrint() {
  const dlg = $('#printDlg');
  const draw = () => {
    store.set('print', pr);
    const p = posterNow();
    const pt = p.fontSize, mm = pt * 0.3528;
    const ok = pt >= 7;
    $('#prPreview').innerHTML = p.svg.replace(/width="[\d.]+pt" height="[\d.]+pt"/, 'width="100%"');
    $('#prInfo').innerHTML = `${allEvents().length} events · smallest event text <b>${pt.toFixed(1)} pt</b> (${mm.toFixed(1)} mm tall)` +
      (ok ? '' : ' — too small to read comfortably. Pick a larger paper, a shorter span, or fewer categories.');
    $('#prInfo').classList.toggle('warn', !ok);
  };
  $('#prKind').value = pr.kind; $('#prPaper').value = pr.paper;
  $('#prKind').onchange = e => { pr.kind = e.target.value; draw(); };
  $('#prPaper').onchange = e => { pr.paper = e.target.value; draw(); };
  dlg.showModal(); draw();
}
function doPrint() {
  const p = posterNow();
  const area = $('#printArea');
  area.innerHTML = p.svg.replace(/width="[\d.]+pt" height="[\d.]+pt"/, `width="${p.wi}in" height="${p.hi}in"`);
  let st = $('#pageSize'); if (!st) { st = document.createElement('style'); st.id = 'pageSize'; document.head.appendChild(st); }
  st.textContent = `@page { size: ${p.wi}in ${p.hi}in; margin: 0; }`;
  $('#printDlg').close();
  document.body.classList.add('printing');
  setTimeout(() => { window.print(); }, 50);
}
window.addEventListener('afterprint', () => { document.body.classList.remove('printing'); $('#printArea').innerHTML = ''; });
function download(name, blob) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
const fileBase = () => `dss-timeline-${pr.kind}-${tl.from}-${tl.to}AM-${pr.paper}`;
function loadScript(src) { return new Promise((ok, bad) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => bad(new Error('Could not load ' + src)); document.head.appendChild(s); }); }
async function doPdf(btn) {
  const label = btn.textContent; btn.textContent = 'Building PDF…'; btn.disabled = true;
  try {
    if (!window.jspdf) await loadScript('vendor/jspdf.umd.min.js');
    if (!window.svg2pdf) await loadScript('vendor/svg2pdf.umd.min.js');
    const p = posterNow();
    const holder = document.createElement('div'); holder.style.cssText = 'position:fixed;left:-99999px;top:0';
    holder.innerHTML = p.svg; document.body.appendChild(holder);
    const doc = new window.jspdf.jsPDF({ orientation: p.W > p.H ? 'landscape' : 'portrait', unit: 'pt', format: [p.W, p.H] });
    await doc.svg(holder.firstElementChild, { x: 0, y: 0, width: p.W, height: p.H });
    holder.remove();
    download(fileBase() + '.pdf', doc.output('blob'));
  } catch (e) { alert('PDF export failed: ' + e.message + '. Use Download SVG instead; print shops accept it.'); }
  btn.textContent = label; btn.disabled = false;
}

// ---------- Events wiring ----------
document.addEventListener('click', e => {
  const t = e.target.closest('button, [data-j], [data-go], [data-ev], [data-pr]'); if (!t) return;
  if (t.dataset.ev && t.dataset.ev.startsWith('p:')) { openProphecy(t.dataset.ev.slice(2)); return; }
  if (t.dataset.ev) { openEvent(t.dataset.ev); return; }
  if (t.dataset.pr) { openProphecy(t.dataset.pr); return; }
  if (t.dataset.pjump) { jumpToProphecy(t.dataset.pjump, t.dataset.end); return; }
  if (t.dataset.openday) {
    const j = +t.dataset.openday; $('#eventDlg').close();
    backPlace = { view, y: window.scrollY }; scrollMemo[view] = window.scrollY;
    select(j, true); scrollMemo.day = 0; setView('day'); showBack(); return;
  }
  if (t.id === 'backPlace') { const b = backPlace; backPlace = null; showBack(); if (b) { if (view !== b.view) setView(b.view); requestAnimationFrame(() => window.scrollTo({ top: b.y })); } return; }
  if (t.dataset.j) { const j = +t.dataset.j; if (wide()) select(j); else { select(j); openDaySheet(); } return; }
  if (t.dataset.wk) { select(+t.dataset.wk); return; }
  if (t.dataset.more) { const sec = document.getElementById(t.dataset.more); sec?.querySelector('.hlist')?.classList.remove('capped'); t.remove(); return; }
  if (t.dataset.wkstep) { select(sel + +t.dataset.wkstep, true); return; }
  if (t.dataset.close) { $('#' + t.dataset.close).close(); return; }
  if (t.dataset.closelookup) $('#lookup').close();
  if (t.dataset.savelookup && lookupCurrent) {
    const d = lookupCurrent.dates[+t.dataset.savelookup];
    mine.push({ id: 'm' + Date.now(), t: `${lookupCurrent.label}: ${d.label.toLowerCase()}`, n: lookupCurrent.description || '', j: d.jdn, r: '', u: lookupCurrent.wikiUrl, s: 'Wikipedia' });
    store.set('mine', mine); t.textContent = 'Saved'; t.disabled = true; render(); return;
  }
  if (t.dataset.go) { $('#daySheet').close(); $('#lookup').close(); select(+t.dataset.go, true); scrollMemo.day = 0; setView('day'); return; }
  if (t.dataset.mnav) { stepMonth(+t.dataset.mnav); return; }
  if (t.dataset.ynav) { ringAm = Math.max(1, Math.min(D.lastAM(), ringAm + +t.dataset.ynav)); renderRing(); return; }
  if (t.dataset.view) { setView(t.dataset.view); return; }
  if (t.dataset.pset) { settings.propAll = t.dataset.pset === 'all'; store.set('settings', settings); render(); return; }
  if (t.dataset.pfut) { settings.propFuture = !settings.propFuture; store.set('settings', settings); render(); return; }
  if (t.dataset.cat) {
    settings.show[t.dataset.cat] = !(settings.show[t.dataset.cat] !== false); store.set('settings', settings);
    if (t.dataset.cat === 'prophecy' && propOn() && !PROPHECIES.length) { t.classList.add('loading'); ensureProphecies().then(render); return; }
    render(); return;
  }
  if (t.dataset.tlmode) { tl.mode = t.dataset.tlmode; renderTimeline(); return; }
  if (t.dataset.tlzoom) { tl.zoom = +t.dataset.tlzoom; renderTimeline(); return; }
  if (t.dataset.act === 'print') { openPrint(); return; }
  if (t.dataset.ri) { pick(results[+t.dataset.ri]); return; }
  if (t.dataset.del) { mine = mine.filter(m => m.id !== t.dataset.del); store.set('mine', mine); render(); return; }
  if (t.dataset.act === 'today') { select(today, true); return; }

  if (t.dataset.act === 'add') { $('#addWhen').textContent = `${dssShort(D.fromJdn(sel))} · ${fmtCivil(D.jdnToCivil(sel), true)}`; $('#addForm').reset(); $('#addEvent').showModal(); return; }
  if (t.dataset.act === 'share') {
    const url = `${location.origin}${location.pathname}#d=${sel}`;
    (navigator.clipboard?.writeText(url) || Promise.reject()).then(() => { t.textContent = 'Link copied'; }, () => { prompt('Copy this link', url); });
    return;
  }
});
$('#goToday').addEventListener('click', () => { $('#daySheet').close(); select(today, true); scrollMemo.day = 0; setView('day'); });
$('#prPrint').addEventListener('click', e => { e.preventDefault(); doPrint(); });
$('#prPdf').addEventListener('click', e => { e.preventDefault(); doPdf(e.currentTarget); });
$('#prSvg').addEventListener('click', e => { e.preventDefault(); download(fileBase() + '.svg', new Blob([posterNow().svg], { type: 'image/svg+xml' })); });
$('#openSettings').addEventListener('click', () => $('#settings').showModal());
$('#addEvent').addEventListener('close', () => {
  if ($('#addEvent').returnValue !== 'save') return;
  const f = new FormData($('#addForm'));
  const title = String(f.get('title') || '').trim(); if (!title) return;
  mine.push({ id: 'm' + Date.now(), t: title, n: String(f.get('note') || '').trim(), j: sel, r: '' });
  store.set('mine', mine); render();
});
document.querySelectorAll('[data-set]').forEach(inp => {
  const k = inp.dataset.set;
  if (inp.type === 'checkbox') inp.checked = !!settings[k]; else inp.value = settings[k];
  inp.addEventListener('change', () => { settings[k] = inp.type === 'checkbox' ? inp.checked : inp.value; store.set('settings', settings); render(); });
});
document.addEventListener('toggle', e => { if (e.target.matches?.('details.more')) store.set('detailsOpen', e.target.open); }, true);
// Tap outside a sheet closes it
document.querySelectorAll('dialog').forEach(d => d.addEventListener('click', e => { if (e.target === d) d.close(); }));
// Swipes: day hero = previous/next day, month grid = previous/next month
let sx = 0, sy = 0, sEl = null;
document.addEventListener('touchstart', e => { const el = e.target.closest('[data-swipe]'); sEl = el; if (el) { sx = e.touches[0].clientX; sy = e.touches[0].clientY; } }, { passive: true });
document.addEventListener('touchend', e => {
  if (!sEl) return;
  const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
  if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
    const dir = dx < 0 ? 1 : -1;
    if (sEl.dataset.swipe === 'day') select(sel + dir, true);
    if (sEl.dataset.swipe === 'month') stepMonth(dir);
  }
  sEl = null;
}, { passive: true });
const q = $('#q');
let wikiTimer = 0, wikiCtl = null;
q.addEventListener('input', () => {
  const text = q.value.trim();
  results = parseQuery(q.value); active = results.length ? 0 : -1;
  if (text.length >= 3 && !PROPHECIES.length) ensureProphecies().then(() => { if (q.value.trim() === text) { const keep = results.filter(r => r.wd); results = parseQuery(q.value).concat(keep); showResults(); } });
  clearTimeout(wikiTimer); wikiCtl?.abort();
  // Names and events (not bare numbers or dates) also go to Wikipedia
  if (text.length >= 3 && /[a-z]/i.test(text) && !/^\d/.test(text)) {
    results.push({ loading: true, label: 'Searching Wikipedia…', wd: 'x' });
    wikiTimer = setTimeout(async () => {
      wikiCtl = new AbortController();
      try {
        const hits = await L.search(text, wikiCtl.signal);
        if (q.value.trim() !== text) return;
        results = results.filter(r => !r.loading).concat(hits.map(h => ({ label: h.label, sub: h.description || 'Wikipedia', wd: h.id })));
        if (active < 0 && results.length) active = 0;
        showResults();
      } catch (e) {
        if (e.name === 'AbortError') return;
        results = results.filter(r => !r.loading).concat([{ loading: true, label: 'Wikipedia search is unavailable right now. Check your connection and try again.' }]);
        showResults();
      }
    }, 350);
  }
  showResults();
});

// ---------- Lookup panel ----------
async function openLookup(id) {
  const dlg = $('#lookup'), body = $('#lookupBody');
  body.innerHTML = '<p class="muted">Loading…</p>';
  dlg.showModal();
  try {
    const x = await L.details(id);
    const rows = x.dates.map(dateRow).join('') || '<p class="muted">Wikipedia lists no dates for this entry. Try searching for a specific event connected to it.</p>';
    body.innerHTML = `
      ${x.image ? `<img class="lk-img" src="${esc(x.image)}" alt="">` : ''}
      <h2 class="lk-title">${esc(x.label)}</h2>
      ${x.description ? `<p class="muted lk-desc">${esc(x.description)}</p>` : ''}
      ${x.summary ? `<p class="lk-sum">${esc(x.summary)}</p>` : ''}
      <h3 class="lk-h">Dates on the DSS calendar</h3>
      <ul class="lk-dates">${rows}</ul>
      <p class="lk-note">Dates come from Wikidata and follow standard (secular) dating. For people and events in Scripture, the app's biblical timeline follows the Bible's own dates and Ken Johnson's chronology.</p>
      <p class="lk-links">${x.wikiUrl ? `<a href="${esc(x.wikiUrl)}" target="_blank" rel="noopener">Wikipedia</a> <a href="https://grokipedia.com/page/${encodeURIComponent(wikiTitle(x.wikiUrl).replace(/ /g, '_'))}" target="_blank" rel="noopener">Grokipedia</a>` : ''} <a href="${esc(x.wikidataUrl)}" target="_blank" rel="noopener">Wikidata</a></p>`;
    lookupCurrent = x;
  } catch (e) {
    body.innerHTML = `<p>Couldn't load this entry: ${esc(e.message)}. Check your connection and try again.</p>`;
  }
}
let lookupCurrent = null;
function dateRow(t, i) {
  const cal = t.cal === 'julian' ? 'Julian' : 'Gregorian';
  if (t.precision === 'day') {
    const x = D.fromJdn(t.jdn);
    if (!x) return `<li><b>${esc(t.label)}</b> ${t.d} ${MONTH_FULL[t.m - 1]} ${D.yearShort(t.y)} — outside the calendar range</li>`;
    return `<li><b>${esc(t.label)}</b><span class="lk-dss">${esc(D.WEEKDAYS[x.weekday])}, ${esc(dssShort(x))}</span>
      <span class="muted">${t.d} ${MONTH_FULL[t.m - 1]} ${D.yearShort(t.y)} (${cal})</span>
      <span><button class="linkbtn" data-go="${t.jdn}" data-closelookup="1">Go to day</button> <button type="button" class="linkbtn" data-savelookup="${i}">Save to my events</button></span></li>`;
  }
  if (t.precision === 'month') {
    const a = D.fromJdn(t.jdn);
    return `<li><b>${esc(t.label)}</b><span class="lk-dss">${MONTH_FULL[t.m - 1]} ${D.yearShort(t.y)} — month only</span>
      <span class="muted">Begins around ${esc(dssShort(a))}</span><span><button class="linkbtn" data-go="${t.jdn}" data-closelookup="1">Go to month</button></span></li>`;
  }
  const am = t.y + D.EPOCH_OFFSET;
  const span = t.precision === 'year' ? `${am - 1}–${am} AM` : t.precision === 'decade' ? `around ${am} AM (decade)` : `around ${am} AM (century)`;
  return `<li><b>${esc(t.label)}</b><span class="lk-dss">${esc(span)}</span><span class="muted">${D.yearLabel(t.y)} — ${t.precision} only, no day recorded</span></li>`;
}
q.addEventListener('keydown', e => {
  if (e.key === 'ArrowDown') { active = Math.min(results.length - 1, active + 1); showResults(); e.preventDefault(); }
  if (e.key === 'ArrowUp') { active = Math.max(0, active - 1); showResults(); e.preventDefault(); }
  if (e.key === 'Enter' && results[active]) pick(results[active]);
  if (e.key === 'Escape') { $('#results').hidden = true; }
});
document.addEventListener('click', e => { if (!e.target.closest('.search')) $('#results').hidden = true; });
window.addEventListener('hashchange', () => { const m = location.hash.match(/d=(-?\d+)/); if (m) select(+m[1], true); });

// ---------- Boot ----------
const [table, events] = await Promise.all([
  fetch('engine/tekufah-table.json?v=' + DATA_V).then(r => r.json()),
  fetch('data/events.json?v=' + DATA_V).then(r => r.json()).catch(() => []),
]);
D.init(table);
EVENTS = events;
if (propOn()) ensureProphecies().then(render);
addEventListener('online', () => { if (propOn() && !PROPHECIES.length) ensureProphecies().then(render); });
for (const e of EVENTS) { if (!byJdn.has(e.j)) byJdn.set(e.j, []); byJdn.get(e.j).push(e); }
const setHdr = () => document.documentElement.style.setProperty('--hdr', $('.top').offsetHeight + 'px');
setHdr(); window.addEventListener('resize', setHdr);
const hm = location.hash.match(/d=(-?\d+)/);
renderAbout();
select(hm ? +hm[1] : today, true);
// Moon phases need Astronomy Engine (114 KB); load it after the first paint.
const idle = window.requestIdleCallback || (f => setTimeout(f, 600));
idle(() => loadScript('vendor/astronomy.browser.min.js').then(() => { if (view === 'day' || view === 'month' || view === 'ring') render(); }).catch(() => {}));
// Offline + instant start from the Home Screen
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
