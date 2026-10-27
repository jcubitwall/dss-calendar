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

19. UI (owner, Oct 2026, "speed up, minimal, great on iPhone/iPad"): Today tab is the home page (hero date + mini year ring, swipeable week strip, events on this day, Coming up feasts, same date in other years, calendar details collapsed). iPhone: bottom tab bar, bottom sheets, tapping a day in Month/Year opens a day sheet. iPad/desktop ≥900px: top pill tabs, Month/Year show the day in a side panel. Timeline line view is virtualized (only rows near the screen are in the DOM); History builds in chunks of 150. prophecies.json (600 KB) and Astronomy Engine load lazily. sw.js caches the app for offline / Home Screen use (bump CACHE name when core files change).

20. Today history + reader (owner, Oct 2026): scrolling Today shows Bible history → Dead Sea Scrolls & Essenes (type `scrolls`, data/sources/scrolls.json) → Church → World → Yours, each "On this date", then "Also this week" (same DSS-week slots), else "Next on this calendar". Below World, a live "More on <date>" feed from Wikipedia's On this day (each item converted to its DSS date). Every title is a link: reader.js opens the full Wikipedia article or whole KJV chapter in-app; links inside open in the same reader with ‹ Back; Done returns to the exact scroll position. Not hand-adding "everything" — the live feed + reader cover breadth; curated sources stay for DSS-relevant items.

21. Prophecy map poster (owner, Oct 2026): vector PDFs in print/ at 48×12, 48×18, 60×20 (recommended), 72×24 in (+ .svg). Owner: references and sentences must never be cut — entries wrap; bigger paper = bigger list text. Johnson's #1–485 + church ages + other items with a Dead Sea Scroll witness (539). Elastic 7000-year axis as seven "days"; arcs foretold → fulfilled; index columns (ref, DSS manuscript, prophecy, Johnson #, foretold → fulfilled) fan up to their span. Yet-future items placed by Johnson's section after Today. Source: tools/prophecy-poster.html; rebuild: node scripts/render-prophecy-poster.mjs print --size 48x12,48x18,60x20,72x24 (Playwright; fonts in tools/fonts).

22. Prophecy audit (owner asked for "zero errors", Oct 2026): transcription checked against all 68 book photos; every reference parsed and checked against KJV text; every scroll citation checked against the editions (Ulrich DJD XVI via dssenglishbible.com). Rules: the book's years and references are shown unless they contradict Scripture's own text or the historical record — then corrected and listed in data/prophecy/book-corrections.tsv (shown in the entry's note). Where secular dating differs, a "Secular dating:" note is added (build-johnson.mjs SECULAR). Wrongly attached research notes are blocked (NOMATCH/NOSUM; the research item is still consumed so it can't drift to a neighbour). One foretold date per prophet section (canonGiven: Isa 7 = 735, Isa 8–9 = 734, Zech 1–8 = 518, Zech 9–14 = 480, Dan 9 = 536, Dan 10–12 = 535, Joel = 835 BC). Scroll citation and date fixes for non-Johnson items: data/prophecy/audit/fixes.json (applied last in build-prophecies.mjs).

23. History map (owner chose layout A, Oct 2026): tools/history-map.js buildMap() draws seven equal "days" (millennia; inside a day, busier centuries get more room), one band per toggled category (Bible, Scrolls above the spine; Church, World, Yours below; labels packed in rows, unlabelled = dot), prophecy as bundled ribbons (source book → fulfilment era; width = count; numbered badges for groups of 2+), magnified boxes for AD 32 (3 BC–AD 35) and Israel reborn (1941–2006), and an index of every prophecy grouped by ribbon with a waiting bar and foretold → fulfilled dates. SVG avoids markers/patterns/halos/letter-spacing so svg2pdf renders it; arrows and circles are shapes (fonts lack → ○ ●). Prebuilt: print/history-map-60x20/72x24/72x36 (node scripts/render-history-map.mjs print --size 60x20,72x24,72x36). In the app's print dialog "History map" follows the category toggles and prophecy settings; PDF embeds vendor/fonts/*.ttf (converted from tools/fonts). Index text: 5 pt at 60×20, 6 pt at 72×24, 10 pt at 72×36.
24. Icons, ages, Enoch's weeks (owner, Oct 2026): icons.js holds vector icons for the main events (LANDMARKS: Creation sun, Flood ark, Abraham tent, Exodus tablets, Temple, Temple burned 588 BC / AD 70 with flames, Return wall, Birth star, Cross, Resurrection tomb, Pentecost flame, Bar Kokhba dispersion, Reformation book, Scrolls found, Israel 1948 star, Jerusalem 1967 gate, 6000 AM crown), the four ages, and Enoch's ten weeks (700 years each, 1 Enoch 93; 91; themes from the text). The history map spine has three rows (7 days, 4 ages, 10 weeks) with an icon row above; the in-app line timeline shows icons on the matching events, Enoch week headings, and a weeks strip beside the ages strip. Added event: Second Temple burned, 4 Aug AD 70 (Johnson's Ninth-of-Av date; Josephus noted).

## Where things are
- Engine: `engine/dss.js` (pure). Table: `scripts/build-table.mjs`. Tests: `scripts/test-engine.mjs` (must pass).
- Events: edit `data/sources/*.json`, then `node scripts/build-events.mjs`. Bible: `data/bible/` + `scripts/build-bible.mjs`.
- Timelines/print: `timeline.js`; live lookup: `lookup.js`; PDF libs vendored in `vendor/`.
- Design: palette "Dead Sea" (salt, brine teal, ochre sun); fonts Alegreya and Alegreya Sans; the year ring is the signature element.

## Known limits
- Ancient equinox times carry ΔT uncertainty; years within 6 h of a week boundary are flagged (`borderline`).
- Priestly courses rotate continuously; no data on how Qumran handled courses in leap weeks.
