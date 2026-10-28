# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev`: Vite dev server on http://localhost:5173
- `npm run build`: production build to `dist/`
- `npm run lint`: ESLint over the whole repo. Every file in `api/` reports `'process' is not defined` because the config only sets browser globals. That error was already there, so a new one in `api/` is not a regression.

There is no test suite. The app sits behind Google OAuth (Supabase), so UI changes are usually verified by the user on localhost or on the deployed Vercel app.

## Stack & deployment

React 19 + Vite, plain JSX (no TypeScript, no router, no state library). Supabase holds auth and data. The client and its publishable key are hardcoded in `src/supabase.js`. Vercel deploys automatically on every push to `main`.

`api/*.js` are Vercel serverless functions that call Gemini (`gemini-flash-latest`, needs `GEMINI_API_KEY`):
- `api/braindump.js`: free text → structured task suggestions (used by `BrainDump.jsx`)
- `api/tidy.js`: punctuation/grammar fix for journal entries, sent and returned as an array of text fragments

`vite dev` does not serve these routes, so any AI-backed feature works only on the deployed Vercel app.

## Architecture

There are two tabs, Tasks and Journal, toggled by `activeTab` in `App.jsx`. Brain dump opens as a bottom tray from the task list; it is not a tab.

**Tasks (`App.jsx`)**: all task state lives in `App` as `tasksByDay`, a map from a `YYYY-MM-DD` date key to an ordered array of rows from the Supabase `tasks` table. Every mutation updates local state optimistically first, then writes to Supabase. Children (`TaskCard`, `TaskDetailSheet`, `MonthView`, `BrainDump`) are presentational and get callbacks. Drag-reorder uses dnd-kit and saves to `position`.

**Journal (`Journal.jsx`)**: self-contained. It loads and owns `journal_entries` (one per `date_key`, holding `content` HTML, `mood`, `rating`). `RichEditor` is a hand-rolled `contentEditable` with a toolbar, Web Speech dictation (en-US/id-ID), and the tidy feature. Tidy rewrites DOM text nodes in place so formatting survives, and it can be undone.

### Dates are pinned to GMT+7 (WIB)

All "today" and date-key logic uses a fixed +7h offset (`TZ_OFFSET_MS`), whatever the device timezone. Date keys are built from UTC fields of a shifted Date, and display formatting passes `timeZone: 'UTC'`. Never call `toISOString()` on a plain local Date to get a key, because it rolls the date back across midnight. The helpers are duplicated per file (`getDateKey`/`dateFromKey` in App, `gmt7Today` in Journal/MonthView, `offsetFromToday` in TaskDetailSheet), so keep them consistent.

### Recurring tasks are materialized series

There is no series table and no `series_id` column. Occurrence ids are `${root}__${YYYY-MM-DD}`, and the first row uses the bare root id. `seriesRoot(task)` maps any row back to its root.
- `generateOccurrences(byDay, uptoKey)` forward-fills from each series' latest existing row, up to `HORIZON_DAYS` (60) ahead or further when the user navigates past it. It then upserts with `ignoreDuplicates`. Because it fills forward from the latest row, deleting one occurrence never brings it back.
- Editing the name or time applies to the whole series. Moving the date moves only that occurrence. Delete asks whether to remove this occurrence or the whole series.
- Adding a recurring task, manually or from brain dump, materializes the series right away.

### Auth

`Auth.jsx` uses Google OAuth via Supabase and redirects to `window.location.origin`. Both the Vercel URL and `http://localhost:5173` are on the Supabase redirect allow-list.
