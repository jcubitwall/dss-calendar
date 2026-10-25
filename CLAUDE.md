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

13. Category toggles (owner, Oct 2026): Bible / History / Church / Yours on and off everywhere, incl. timelines and prints.
14. Timelines: straight line (elastic scale) and 7000-year wheel; print posters as vector PDF/SVG up to 72 × 24 in.
15. Bible events: every month/day-dated verse; years via Ken Johnson's anchors; basis shown per event. Kings chain check: Samaria 3205 = Hezekiah 6 → Zedekiah 11 = 3338 ✓.

16. Event reader (owner, Oct 2026): tapping an event opens a panel over the view (KJV verse text via bible-api.com for Bible events; Wikipedia summary otherwise) with Wikipedia + Grokipedia (grokipedia.com/page/<Title>) links; closing keeps the scroll position; "Open this day" shows a "Back to my place" button; tabs are sticky.

17. Passion week (owner, Oct 2026): use Ken Johnson's dates — Thursday Nisan 14 crucifixion, Sunday Nisan 17 resurrection, Sunday Sivan 6 Pentecost (lunar reckoning), civil dates counted from his April 6, AD 32 (Nisan 10): anointing Fri 4 Apr, entry Sun 6 Apr, crucifixion Thu 10 Apr, resurrection Sun 13 Apr (= DSS 26 Nisan, First Fruits), Pentecost Sun 1 Jun (= DSS 15 Sivan). Replaces dsscalendar.org's "Nisan 14" on the DSS calendar (a Tuesday).

18. Prophecy category (owner, Oct 2026): arrows from when foretold to when fulfilled (arcs on the line, chords on the wheel). Backbone = Ken Johnson's "Ancient Prophecies Revealed" #1–485, transcribed from the owner's copy into data/prophecy/johnson-table.tsv (fulfilled, with his years) and johnson-future.tsv (future, by section), plus johnson-tisha-bav.tsv. The book's BC years are shifted 1–2 years to Johnson's AM chronology (label shows "book: …"). "Foretold" dates are approximate prophet dates unless a researcher matched a better one. Other teachers / Dead Sea Scrolls items (research/*.json) appear when "Add other teachers & scrolls" is on. Future prophecies hidden unless "Include yet-future".
   Rebuild: node scripts/build-johnson.mjs && node scripts/build-prophecies.mjs

## Where things are
- Engine: `engine/dss.js` (pure). Table: `scripts/build-table.mjs`. Tests: `scripts/test-engine.mjs` (must pass).
- Events: edit `data/sources/*.json`, then `node scripts/build-events.mjs`. Bible: `data/bible/` + `scripts/build-bible.mjs`.
- Timelines/print: `timeline.js`; live lookup: `lookup.js`; PDF libs vendored in `vendor/`.
- Design: palette "Dead Sea" (salt, brine teal, ochre sun); fonts Alegreya and Alegreya Sans; the year ring is the signature element.

## Known limits
- Ancient equinox times carry ΔT uncertainty; years within 6 h of a week boundary are flagged (`borderline`).
- Priestly courses rotate continuously; no data on how Qumran handled courses in leap weeks.
