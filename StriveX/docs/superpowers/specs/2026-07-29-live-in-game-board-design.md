# Live "In game now" board — design

**Date:** 2026-07-29
**Status:** approved (design)

## Problem

The desk operator has no live view of which bracelets are currently in a game and
on which attraction. The Stations tab shows a station is `in_game`, but never
*which* bracelet/guest is playing there. Separately, when a game auto-releases
after 120s the operator only sees the gateway log line
`WATCHDOG: no result after 120000ms, releasing station` with no desk-side
context.

## Key constraint

The bracelet↔attraction mapping only exists live inside the gateway
(`current.session_id` in `gateway/src/index.js`). The server never learns it:
the heartbeat sends only `status: in_game | idle`. So the heartbeat is the
natural — and only — place to surface the active session to the server. No new
polling path or gateway timer is introduced.

The 120s game watchdog is intentionally **result-based** and stays unchanged: a
hung MCU keeps the gateway heartbeating `in_game` forever, so a heartbeat-based
keepalive would never release a truly stuck station. `GAME_TIMEOUT_MS` remains
the knob. The live board's elapsed counter doubles as an early warning before
the watchdog fires.

## Changes

### 1. Data model — `server/src/db/db.service.ts`

Add two nullable columns to `stations`:

- `current_session_id TEXT`
- `current_started_at TEXT`

The `stations` table already exists in the running DB, and SQLite has no
`ADD COLUMN IF NOT EXISTS`. Add a small idempotent helper that checks
`pragma table_info(stations)` and `ALTER TABLE ... ADD COLUMN` only when the
column is missing. Call it from `migrate()` after the `CREATE TABLE` block.

### 2. Gateway reports the active game — `gateway/src/api.js` + `gateway/src/index.js`

- `api.heartbeat(stationId, status, session)` — body becomes
  `{ status, session_id, started_at }`, where `session_id`/`started_at` come
  from `session` (or `null` when idle).
- `index.js` heartbeat loop passes `current` so a running game sends its
  `session_id` and `started_at` (ISO from `current.startedAt`); idle sends
  `null` for both.

### 3. Server stores + exposes — `server/src/stations/*`

- `stations.service.heartbeat(id, status, sessionId?, startedAt?)` — the
  `UPDATE` also sets `current_session_id` and `current_started_at` (both `NULL`
  when idle / not provided).
- `stations.service.list()` — add a `LEFT JOIN` from `current_session_id` to
  `sessions` → `bracelets` + `users`, returning `current_uid`, `current_label`,
  `current_username`, `current_started_at` alongside the existing fields.
- `HeartbeatDto` — add optional `session_id` and `started_at` (both
  `@IsOptional() @IsString()`), wire them through the controller into the
  service.

### 4. Desk UI — `server/public/index.html`

- New card **under the Overdue table** on the Desk tab: **"In game now"**.
  Columns: **Attraction** (station name) · **Bracelet** (label + dim uid) ·
  **Guest** (username) · **In game for** (elapsed = now − `current_started_at`,
  rendered mm:ss). Empty state: "No games in progress."
- `loadLive()` calls `GET /stations`, filters rows where
  `status === 'in_game'` and `current_uid` is present, renders the table.
  Added to `refreshAll()` and to a 5s refresh interval so the elapsed counter
  ticks.
- The Stations tab table gains a "Bracelet" column showing `current_label`/
  `current_uid` (or `—`), for free, since `list()` now returns it.

## Testing

Manual, with `ADAPTER=manual` and the gateway sim panel:

1. `/sim/tap` → the bracelet appears under "In game now" on its attraction with
   a ticking elapsed timer; Stations tab shows the same bracelet.
2. `/sim/result` → the row clears (station back to idle, mapping cleared).
3. Wait past 120s without a result → watchdog releases; the next idle heartbeat
   clears the mapping and the row disappears.
4. Idle heartbeat (no game) → no row, `current_*` columns NULL.

## Out of scope

- Changing the watchdog timeout or making it heartbeat-driven.
- Any persistence of the live mapping beyond the current station row (history
  lives in `results`).
