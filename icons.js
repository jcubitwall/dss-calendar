// Icons for the main events of history, the four ages, and Enoch's ten weeks.
// Shared by the in-app timeline (timeline.js) and the print history map (tools/history-map.js).
// Icons are drawn in a 24 × 24 box from plain strokes and fills, so browsers and svg2pdf render them alike.

const FLAME = '#C4502A', GOLD = '#B7862C';
// Each icon: list of [element, attributes]. "S" = stroke with the icon colour; "F" = fill with it.
const I = {
  sun: [['circle', { cx: 12, cy: 12, r: 4.2, S: 1 }], ['path', { d: 'M12,2.5V5.5 M12,18.5V21.5 M2.5,12H5.5 M18.5,12H21.5 M5.3,5.3L7.4,7.4 M16.6,16.6L18.7,18.7 M5.3,18.7L7.4,16.6 M16.6,7.4L18.7,5.3', S: 1 }]],
  ark: [['path', { d: 'M3,13.5H21L18,18H6Z', S: 1 }], ['path', { d: 'M8,13.5V9.5H16V13.5 M10.5,9.5V7.5H13.5V9.5', S: 1 }], ['path', { d: 'M2,21.2C4,19.7 5.5,19.7 7,21.2C8.5,22.7 10,22.7 12,21.2C14,19.7 15.5,19.7 17,21.2C18.5,22.7 20,22.7 22,21.2', S: 1 }]],
  tent: [['path', { d: 'M3.5,19.5L12,6L20.5,19.5Z M12,6V19.5 M9.5,19.5L12,15L14.5,19.5', S: 1 }], ['circle', { cx: 5, cy: 5, r: 0.9, F: 1 }], ['circle', { cx: 9, cy: 3.2, r: 0.9, F: 1 }], ['circle', { cx: 19, cy: 4.5, r: 0.9, F: 1 }]],
  tablets: [['path', { d: 'M4.5,20.5V9.5A3.6,3.6 0 0 1 11.7,9.5V20.5Z M12.3,20.5V9.5A3.6,3.6 0 0 1 19.5,9.5V20.5Z', S: 1 }], ['path', { d: 'M6.5,11.5H9.7 M6.5,14H9.7 M6.5,16.5H9.7 M14.3,11.5H17.5 M14.3,14H17.5 M14.3,16.5H17.5', S: 1, w: 0.9 }]],
  temple: [['path', { d: 'M2.5,10.5L12,4L21.5,10.5Z', S: 1 }], ['path', { d: 'M5,10.5V19 M9.3,10.5V19 M14.7,10.5V19 M19,10.5V19 M3.5,19H20.5 M2.5,21.5H21.5', S: 1 }]],
  templeFire: [['path', { d: 'M3,13L12,8L21,13Z', S: 1 }], ['path', { d: 'M5.5,13V20 M9.5,13V20 M14.5,13V20 M18.5,13V20 M3.5,20H20.5 M2.5,22H21.5', S: 1 }],
    ['path', { d: 'M8.5,8.5C6.2,7 6.8,4.6 8.2,2.8C8.4,4.6 9.6,5 10,6.4C10.7,5.3 10.3,4 10.1,3.2C12.2,4.8 12.4,7.6 10.4,8.6Z', fill: FLAME }], ['path', { d: 'M14.4,8.3C12.8,6.9 13.4,5 14.6,3.8C14.8,5.2 15.8,5.6 16,6.6C16.5,5.8 16.3,4.9 16.1,4.3C17.7,5.6 17.7,7.6 16.1,8.4Z', fill: FLAME }]],
  wall: [['path', { d: 'M3,21V10H5.5V7.5H8V10H10.5V7.5H13.5V10H16V7.5H18.5V10H21V21Z', S: 1 }], ['path', { d: 'M9.5,21V16.5A2.5,2.5 0 0 1 14.5,16.5V21', S: 1 }]],
  star: [['path', { d: 'M12,2.5L13.7,10.3L21.5,12L13.7,13.7L12,21.5L10.3,13.7L2.5,12L10.3,10.3Z', fill: GOLD, S: 1, w: 0.9 }]],
  cross: [['path', { d: 'M12,2.5V21.5 M6.5,8H17.5', S: 1, w: 2.6 }]],
  tomb: [['path', { d: 'M3,20.5H21 M5,20.5V13A7,7 0 0 1 19,13V20.5', S: 1 }], ['circle', { cx: 17.6, cy: 17.2, r: 3.2, S: 1, fill: '#FFFFFF' }], ['path', { d: 'M9.5,20.5V15A2.5,2.5 0 0 1 14.5,15V20.5', S: 1 }]],
  flame: [['path', { d: 'M12,21.5C7.5,20.5 6,16.8 7.6,13.2C8.6,11 10.6,9.4 10.2,5.5C13.4,7.6 14.6,10.6 13.8,13.4C15,12.6 15.6,11.2 15.6,9.8C18.4,12.6 18.6,17 16.2,19.6C15.2,20.7 13.8,21.3 12,21.5Z', fill: FLAME }]],
  scatter: [['circle', { cx: 12, cy: 12, r: 2, F: 1 }], ['path', { d: 'M12,9V3.5 M10,2.8L12,1.2L14,2.8 M14.6,13.5L19.4,16.3 M18.6,18L21,17.2L20.4,14.7 M9.4,13.5L4.6,16.3 M3.6,14.7L3,17.2L5.4,18', S: 1 }]],
  book: [['path', { d: 'M3,6.5C6,5 9.5,5.2 12,7.2C14.5,5.2 18,5 21,6.5V19C18,17.6 14.5,17.8 12,19.8C9.5,17.8 6,17.6 3,19Z M12,7.2V19.8', S: 1 }]],
  scroll: [['path', { d: 'M6,5H18V19H6Z', S: 1 }], ['path', { d: 'M4.5,4V20 M19.5,4V20', S: 1, w: 2.4 }], ['path', { d: 'M8.5,9H15.5 M8.5,12H15.5 M8.5,15H13.5', S: 1, w: 0.9 }]],
  david: [['path', { d: 'M12,2.8L20,16.6H4Z M12,21.2L4,7.4H20Z', S: 1 }]],
  gate: [['path', { d: 'M3,21.5V8.5H21V21.5 M3,8.5L5,5.5H19L21,8.5', S: 1 }], ['path', { d: 'M8.5,21.5V15.5A3.5,3.5 0 0 1 15.5,15.5V21.5', S: 1 }], ['path', { d: 'M3,12H21', S: 1, w: 0.8 }]],
  crown: [['path', { d: 'M3.5,17.5L2.5,7.5L8,12L12,4.5L16,12L21.5,7.5L20.5,17.5Z M3.5,20.5H20.5', fill: GOLD, S: 1, w: 1.1 }]],
  dove: [['path', { d: 'M3,13C6,13 8,11.5 9.5,9C10.5,12 13,13 16,12.5L21,9.5L19.5,13C18,16.5 14.5,18.5 10.5,18L7,20.5L7.5,17C5,16.5 3.5,15 3,13Z', S: 1 }]],
};

/** SVG for one icon centred at (cx, cy), `size` units across, drawn in `color`. */
export function iconSVG(name, cx, cy, size, color = '#1B2427') {
  const parts = I[name]; if (!parts) return '';
  const k = size / 24, f = n => (+n).toFixed(2);
  let s = `<g transform="translate(${f(cx - size / 2)},${f(cy - size / 2)}) scale(${f(k)})">`;
  for (const [tag, a] of parts) {
    const fill = a.fill || (a.F ? color : 'none'), stroke = a.S ? color : 'none';
    const geo = Object.entries(a).filter(([key]) => !['S', 'F', 'fill', 'w'].includes(key)).map(([key, v]) => `${key}="${v}"`).join(' ');
    s += `<${tag} ${geo} fill="${fill}" stroke="${stroke}" stroke-width="${a.w || 1.6}" stroke-linecap="round" stroke-linejoin="round"/>`;
  }
  return s + '</g>';
}

/** Main events, by year (AM). `match` finds the same event in data/events.json for the in-app timeline. */
export const LANDMARKS = [
  { am: 1, name: 'Creation', icon: 'sun', match: /^Creation Day 1\b/ },
  { am: 1656, name: 'The Flood', icon: 'ark', match: /^Flood begins/ },
  { am: 2008, name: 'Abraham', icon: 'tent', match: /^Abraham born$/ },
  { am: 2448, name: 'Exodus & the Law', icon: 'tablets', match: /^Israel departs from Rameses/ },
  { am: 2935, name: "Solomon's Temple", icon: 'temple', match: /^Temple completed$/ },
  { am: 3338, name: 'Temple burned · 588 BC', icon: 'templeFire', match: /^Nebuzaradan enters Jerusalem; Temple burned/ },
  { am: 3389, name: 'Return from exile', icon: 'wall', match: /^Returned exiles resume burnt offerings/ },
  { am: 3924, name: 'Birth of Jesus', icon: 'star' },
  { am: 3957, name: 'The Cross', icon: 'cross', match: /^Crucifixion/ },
  { am: 3957.02, name: 'Resurrection', icon: 'tomb', match: /^Resurrection of Jesus/, appOnly: true },
  { am: 3957.15, name: 'Pentecost', icon: 'flame', match: /^Holy Spirit given on the day of Pentecost/, appOnly: true },
  { am: 3995, name: 'Temple burned · AD 70', icon: 'templeFire', match: /^Second Temple burned/ },
  { am: 4057, name: 'Bar Kokhba · dispersion', icon: 'scatter' },
  { am: 5442, name: 'Reformation', icon: 'book', match: /^Luther's Ninety-five Theses/ },
  { am: 5872, name: 'Dead Sea Scrolls found', icon: 'scroll', match: /^Sukenik buys the first scrolls/ },
  { am: 5873, name: 'Israel reborn · 1948', icon: 'david', match: /^Israel's Declaration of Independence/ },
  { am: 5892, name: 'Jerusalem · 1967', icon: 'gate', match: /^Israeli paratroopers reach the Temple Mount/ },
  { am: 6000, name: '6000 AM · the Kingdom', icon: 'crown' },
];
export const iconForEvent = t => LANDMARKS.find(l => l.match && l.match.test(t));

/** The four ages of 2000, 2000, 2000 and 1000 years. */
export const AGES = [
  { a: 1, b: 2000, name: 'Age of Creation', color: '#DCEBDD' },
  { a: 2001, b: 4000, name: 'Age of Torah', color: '#F3E7CC' },
  { a: 4001, b: 6000, name: 'Age of Grace', color: '#DCE7F2' },
  { a: 6001, b: 7000, name: 'Age of the Kingdom', color: '#F2DDD5' },
];

/** Enoch's ten weeks (Apocalypse of Weeks, 1 Enoch 93:1-10; 91:11-17), 700 years each, as Ken Johnson reads them. */
export const ENOCH_WEEKS = [
  { n: 1, ref: '93:3', theme: 'Enoch born; judgment and righteousness endure' },
  { n: 2, ref: '93:4', theme: 'Great wickedness; a man is saved (Noah)' },
  { n: 3, ref: '93:5', theme: 'A man chosen as the plant of righteousness (Abraham)' },
  { n: 4, ref: '93:6', theme: 'Visions of the holy; a law for all generations (Sinai)' },
  { n: 5, ref: '93:7', theme: 'The house of glory built (Solomon’s Temple)' },
  { n: 6, ref: '93:8', theme: 'A man ascends; the house burned; the chosen root dispersed' },
  { n: 7, ref: '93:9-10', theme: 'An apostate generation; the elect receive sevenfold wisdom' },
  { n: 8, ref: '91:12-13', theme: 'A week of righteousness; a house for the Great King' },
  { n: 9, ref: '91:14', theme: 'Righteous judgment revealed to the whole world' },
  { n: 10, ref: '91:15-17', theme: 'The great eternal judgment; a new heaven' },
].map(w => ({ ...w, a: (w.n - 1) * 700 + 1, b: w.n * 700 }));
export const WEEK_COLORS = ['#F4EEDF', '#EAF0EA', '#F1ECE3', '#E8EEF0', '#F3ECE6', '#EFE8F1', '#E9ECF3', '#F2EDE0', '#EAF0EF', '#F3EBDD'];
