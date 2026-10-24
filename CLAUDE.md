# DSS Calendar — notes for future sessions

Owner: Johnny Wall. Static web app, deployed on Cloudflare Pages from GitHub (`main`). The owner works from phone/iPad, so keep the UI phone-first.

## Decisions (confirmed by owner, Oct 2026 — "defaults")
1. Leap rule: Tekufah Nisan = last Tuesday on or before the spring-equinox day in Jerusalem (UTC+2). Matches dsscalendar.org 2024–2027 exactly. (The site's own wording, "within 3 days", contradicts its 2027 data.)
2. Leap week sits after Adar 30, before Tekufah Nisan.
3. Nisan 1 of 1 AM = Creation day 4 (Wednesday); days 1–3 shown before it.
4. Year formula wins over typos in the site's tables: AM = AD + 3925; BC n → AM 3926 − n.
5. DSS day starts at sunrise (matched to the civil date's daylight).
6. Toggles: priestly courses, moon phases, Sabbath and Jubilee highlights.
7. Civil dates: Julian before 15 Oct 1582, Gregorian after, both shown for older dates.
8. Events: secular, biblical (DSS chronology), church history; each with a source; certainty `exact` or `probable`.
9. Users can add their own events (localStorage, per device).
10. Public, credited to Ken Johnson / dsscalendar.org, original design.

11. Source priority (owner, Oct 2026): Scripture's own dates are fixed truth; Ken Johnson's studies and chronology place them in years and outrank secular sources; secular dating is shown alongside only where it differs.
12. Live lookup: search box also queries Wikidata/Wikipedia (lookup.js) for any person, place or event; those dates are labelled as standard (secular) dating.

## Where things are
- Engine: `engine/dss.js` (pure). Table: `scripts/build-table.mjs`. Tests: `scripts/test-engine.mjs` (must pass).
- Events: edit `data/sources/*.json`, then `node scripts/build-events.mjs`.
- Design: palette "Dead Sea" (salt, brine teal, ochre sun); fonts Alegreya and Alegreya Sans; the year ring is the signature element.

## Known limits
- Ancient equinox times carry ΔT uncertainty; years within 6 h of a week boundary are flagged (`borderline`).
- Priestly courses rotate continuously; no data on how Qumran handled courses in leap weeks.
