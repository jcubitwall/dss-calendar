# DSS Calendar

A modern, phone-first web app for the Dead Sea Scroll (Zadok) calendar, built from Creation (1 AM = 3925 BC) to 7000 AM, with world, biblical and church history matched to the day.

## The rule

- 12 months × 30 days + 4 Tekufah days (always Tuesdays) = 364 days, exactly 52 weeks.
- Nisan 1 is always a Wednesday. Every feast falls on the same weekday every year.
- **Leap week:** Tekufah Nisan is the last Tuesday on or before the day of the true spring equinox in Jerusalem (UTC+2). When that pushes the year to 371 days, the extra week sits after Adar 30.
- This reproduces every date published on dsscalendar.org (2024–2027) and gives 1,243 leap weeks from Creation to 7000 AM.
- Creation: Nisan 1, 1 AM = Wednesday 18 March 3925 BC (proleptic Gregorian) = 19 April 3925 BC (Julian), Creation day 4.

## Project layout

| Path | What it is |
| --- | --- |
| `index.html`, `app.css`, `app.js` | The app (plain HTML/CSS/JS, no build step) |
| `engine/dss.js` | Calendar engine: DSS ↔ Julian ↔ Gregorian, feasts, cycles, priestly courses |
| `engine/tekufah-table.json` | Precomputed Tekufah date for every year (generated) |
| `data/sources/*.json` | Hand-curated events, one file per era |
| `data/events.json` | Merged events with day numbers (generated) |
| `scripts/` | Table and events builders, engine tests |
| `vendor/astronomy.browser.min.js` | Astronomy Engine (MIT), used for moon phases |

## Commands

```bash
npm install                     # once
node scripts/build-table.mjs    # regenerate the Tekufah table (only if the rule changes)
node scripts/build-events.mjs   # after editing data/sources
node scripts/test-engine.mjs    # checks against dsscalendar.org
python3 -m http.server          # preview at http://localhost:8000
```

## Adding events

Add an object to a file in `data/sources/`, then run `build-events`:

```json
{"id":"halifax-explosion","title":"Halifax Explosion","cal":"gregorian","y":1917,"m":12,"d":6,
 "type":"secular","region":"Nova Scotia","note":"…","source":"…","url":"…","certainty":"exact"}
```

- Civil dates: `cal` is `julian` or `gregorian`, `y` is the astronomical year (1 BC = 0, 44 BC = −43).
- Biblical dates: use `am`, `month` (1–12), `day` instead.

## Deploy (Cloudflare Pages)

In Cloudflare, go to **Workers & Pages → Create → Pages → Connect to Git**, pick this repo, then set:

- Framework preset: **None**
- Build command: *(leave empty)*
- Build output directory: `/`

Every push to `main` redeploys.

## Credit

Calendar research by Ken Johnson, [dsscalendar.org](https://dsscalendar.org) and [biblefacts.org](https://biblefacts.org). This is an independent app. Equinoxes and moon phases come from [Astronomy Engine](https://github.com/cosinekitty/astronomy) (MIT).
