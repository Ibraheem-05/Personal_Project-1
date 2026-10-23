# KARFIVO — Strength in Motion

A responsive, African-inspired, local-first training application built with HTML, CSS, and vanilla JavaScript. It integrates KARFIVO into the existing app without adding packages, a backend, or an account. KARFIVO is free: there are no subscriptions, ads, paywalls, premium features, payment systems, or paid API dependencies.

## Run it

For ordinary use, open `index.html` directly or serve the folder with VS Code Live Server. For offline/PWA behavior, run from `http://localhost` or deploy the static files to HTTPS; service workers are not available from `file://`.

Example local static server from this directory:

```powershell
python -m http.server 8000
```

Then open `http://localhost:8000`. There is no compile/build command or package installation. The static files can be hosted on a standard HTTPS static web host; publishing is not configured or performed by this project.

Run the automated core tests from this folder:

```powershell
node --test .\tests\core.test.js
```

## Project layout

- `index.html` — KARFIVO shell, Home, Workouts, Exercises, Calendar, Progress, Profile views, dialogs, and original inline SVG icons.
- `styles.css` — responsive layout, keyboard focus styles, reduced-motion support, and the dark-first KARFIVO palette with optional light theme.
- `data.js` — structured exercise catalog and the preserved Nigerian-inspired ingredient/meal planner.
- `generator.js` — separate, deterministic workout suggestion rules and editable weekly training/rest schedule.
- `analytics.js` — pure local-date range filtering, statistics, time buckets, personal records, category totals, and supported insights.
- `storage.js` — versioned and validated storage adapter. IndexedDB is the primary browser store, with the existing localStorage key retained as a migration source and fallback.
- `app.js` — UI rendering, session logging, elapsed-time timers, routine and history actions, progress calculations, check-ins, and JSON/CSV backup and restore.
- `manifest.webmanifest`, `service-worker.js`, `icon.svg`, `icon-192.png`, `icon-512.png` — install metadata, original KARFIVO app icons, and same-origin offline app shell for compatible HTTPS/localhost browsers.
- `tests/core.test.js` — Node built-in tests for exercise data, generation, equipment and exclusions, weekly rest planning, storage validation/migration, analytics boundaries, personal records, unit settings, history snapshots, and set validation.

## Included and working

- Editable training interests, experience, equipment, preferred days, session duration, and excluded exercises.
- An exercise catalog with instructions, muscle groups, equipment, difficulty, alternatives, searchable filters, and user-created exercises.
- Workout drafts that save to browser storage, session clock, pause/resume, per-exercise sets, reps, optional load or duration, completion toggles, set rest timer, notes, previous logged set reference, routine saving/loading, completed-session editing/deletion, and history.
- Workout tracker also supports deleting sets, moving exercises up/down, cardio time/distance, confirmed draft cancellation, reusing completed workouts, and detailed per-exercise/set history.
- Saved routines have editable exercise lists and target set counts, can be started, duplicated, or deleted with confirmation.
- A deterministic suggestion engine that considers experience, equipment requirements, session duration, focus, exclusions, and the two most recent completed sessions. The workout can be edited in the logger after loading; dedicated preview replacement controls, fatigue-based adjustments, location preferences, and structured training programs are not implemented.
- A reschedulable week/month calendar with preferred training days, suggested rest days, saved workout/rest plans, and completed sessions.
- Progress summaries for completed sessions, active minutes, unique training days, completed sets, session history, selected-exercise set trends, personal records for load/reps/time/distance, exercise-category distribution, and supported personal insights. Date ranges include 7, 30, 90 days, 12 months, and all time; ranges use exact local calendar-day boundaries.
- Positive, locally persisted milestones for first workout, first routine, five and ten workouts, a first completed set, and a month-long span of recorded training. Achievements do not expire when a user edits or deletes old records. Structured training programs and program-completion milestones are not implemented.
- Optional energy, soreness, and sleep check-ins; earned milestones; JSON and CSV export; validated JSON import; a confirmation-protected local-data deletion action; and dark/light themes.
- Existing Nigerian-inspired pantry matching and meal suggestions remain available on Home. Food ideas still do **not** calculate nutrient totals; the linked FAO/INFOODS West African Food Composition Table is not integrated into a meal calculator.
- Optional daily browser notifications can fire only while this page remains open, after the user opts in and grants permission.

## Research references and limits

- World Health Organization. *WHO guidelines on physical activity and sedentary behaviour*. 2020. [Publication page](https://www.who.int/publications/i/item/9789240015128). The app's activity reminder reflects adult public-health guidance; individual starter sessions are not a substitute for a personalized exercise prescription.
- Morton RW, Murphy KT, McKellar SR, et al. Protein supplementation and resistance training in healthy adults: systematic review, meta-analysis and meta-regression. *British Journal of Sports Medicine*. 2018;52(6):376–384. [doi:10.1136/bjsports-2017-097608](https://doi.org/10.1136/bjsports-2017-097608).
- FAO/INFOODS. *West African Food Composition Table*. 2019. [Table (PDF)](https://www.fao.org/3/i8835en/I8835EN.pdf).

Exercise instructions are original text, without third-party media. Suggestions and check-ins are for general wellness, do not diagnose or predict recovery, and should be adapted or skipped when appropriate. Stop activity if you feel pain, dizzy, or unwell; seek qualified guidance when you have clinical needs.

## Data, privacy, and production readiness

`storage.js` stores a versioned state object in IndexedDB (`karfivo-local`) and mirrors it to the existing `localStorage` key (`fitnaija-training-v2`) for compatibility and fallback. Existing ingredient selections and the previous goal preference are migrated from `fitnaija-prototype-v1`; workout records already in localStorage are retained when IndexedDB is first initialized. Legacy movement check-ins remain zero-minute sessions because the old model did not record duration or exercise sets. IndexedDB write failures are logged and surfaced in the app; export a JSON backup regularly.

Workout data stays on this device and in this browser profile. There is no account, server, encryption, or synchronization between devices. Clearing browser data can erase local records; use JSON export/import to back them up or move them manually. Import replaces the current local profile and training data after confirmation.

This is a responsive static web app, not an Expo/React Native project; no native iOS/Android builds are included or claimed. PWA metadata and a same-origin service worker are configured for compatible browsers on localhost or HTTPS. The integrated browser run could not confirm service-worker activation/offline navigation, so treat PWA installation as unverified until checked in the target browser. Install UI and notification behavior vary by browser and platform. The service worker caches only the static app shell; it does not sync or back up personal workout records. Browser storage remains local and may be cleared by the user, browser, OS, or uninstall process. Export a JSON backup before clearing site data, changing browsers, or changing devices.

This workspace has no authentication system or backend. Therefore, server-side ownership enforcement, protected accounts, cross-device sync, encryption, and cross-device deletion cannot be implemented here. Social features and wearable sync are not implemented; their experimental flags remain off. Native mobile notifications, background scheduling, remote reminders, guided video sessions, and structured training programs are also not included.

## Verification

- `node --test .\tests\core.test.js` — core tests cover exercise data, generation, rest planning, storage migration/validation, unit settings, set distance, statistics, and input validation.
- `node --check` passed for all application and test JavaScript files.
- `node --check` passed for `app.js`, `analytics.js`, `data.js`, `generator.js`, `storage.js`, `service-worker.js`, and the core test file.
- Integrated-browser checks previously exercised preference saving, equipment-filtered exercise search, tailored session generation, custom exercises, workout-draft reload, set/repetition/load logging, pause/resume, session completion and editing, schedule/rest overrides and workout start, check-in save, JSON/CSV export triggers, data deletion, 7-day/30-day/all-time charts, week/month calendar, light/dark theme, and a 375 px mobile layout.
- Analytics unit tests exercise exact date boundaries, buckets, draft exclusion, completed-set totals, edited records, current-unit values, categories, empty states, and insights.
- Browser smoke tests verified a real metrics/records/insights render from seeded local sessions and that scheduled plans can be moved to another date and removed. Viewports at 320, 375, 768, 1024, and 1440 px reported no horizontal overflow.
- A localhost browser registration entry was created, but no active worker/cache appeared in the integrated browser, and an offline navigation was not verified. Test install/offline behavior in a supported browser before release.
- Current release checks do not include native builds, paid APIs, a hosted HTTPS deployment, platform store submission, formal accessibility certification, or external security review.
- Legacy workout check-ins migrate as zero-minute sessions because the old model did not record duration or exercise sets; the import does not invent those values.
- This is a client-only web app; it is not a native iOS/Android application or multi-user production service. Do not use it for medical decisions. Production accounts, sync, security/privacy review, and qualified review of exercise and nutrition guidance are not included.
