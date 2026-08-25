# Gateway ⇄ Game Control Protocol — Design

**Date:** 2026-07-31
**Status:** Approved design, pending implementation plan
**Reference game:** `lightning_windows_v2.0.3_color_modes_and_help_fix` (Electron, `Lightning-Attraction-2.0.3.exe`)

## Goal

Let the Strivex gateway drive a real attraction game: authorize a bracelet, **unlock** the
game for a paid session, let the player play, then record a **result summary** to the server
and **re-lock** the game. Define this as a small, reusable protocol so every future game
(most of them portable Electron/Node exes) implements the same contract. Lightning is the
reference implementation.

## Responsibility split

| Concern | Owner | Notes |
|---|---|---|
| Bracelet scan + authorization | **Gateway** | Existing `onTap` → `/lookup` flow. One place, reused by every game. |
| Unlock / lock, paid-time budget, watchdog | **Gateway** | The control layer. |
| Rounds, scoring, modes, Arduino, leaderboard | **Game** (unchanged) | Game-specific logic stays in the game. |
| Recording the session summary | **Server** (unchanged) | Existing `POST /results`, one row per `session_id`. |

## Lifecycle

- The game runs **continuously** in kiosk mode and starts up **locked** (reuse existing `unlock.css`). No free play.
- The **gateway is the client**; it connects to the game's local WebSocket server and auto-reconnects.
- If the game is not reachable, taps are **denied** (can't start what isn't there).

```
┌─────────┐   NFC tap    ┌─────────┐   /lookup    ┌─────────┐
│ Bracelet│ ───────────▶ │ Gateway │ ───────────▶ │ Server  │
└─────────┘              └────┬────┘   authorize  └─────────┘
                              │ unlock(session, user, paid_seconds)
                              ▼  (localhost WebSocket)
                         ┌─────────┐
                         │  Game   │  plays N rounds within paid time
                         └────┬────┘
                              │ session_result(score, meta)
                              ▼
                    Gateway ──▶ /results (one summary row)  ──▶ re-lock game
```

## Registration & scan point (decided)

- **Registration is unchanged:** the bracelet is registered at the reception desk → tied to a
  user + paid time → a **session** is created on the server.
- **Single USB NFC reader is the standard.** The gateway's PC/SC reader (`nfc-pcsc`) is the
  **only** scan point at every station. The game's Arduino RFID is **not** used for scanning.
- **Every player has a bracelet → no bracelet, no play.** The game's guest / "skip card"
  free-play paths are disabled; the locked state opens only on a gateway `unlock`.
- The game keeps its per-player progression by keying off the `uid` passed in `unlock` — it
  never has to read a card itself.

## The Strivex Game Control Protocol (reusable core)

JSON-over-WebSocket on `127.0.0.1:<port>` (default `4200`). The **game is the WS server**; the
**gateway is the client**. One JSON object per frame.

**Gateway → Game**

| Message | Meaning |
|---|---|
| `{type:"unlock", session_id, user:{uid,name}, paid_seconds}` | Authorized — unlock and let this user play for `paid_seconds`. |
| `{type:"lock", reason}` | End now (operator stop / time up / watchdog). Finish current round, report, re-lock. |

**Game → Gateway**

| Message | Meaning |
|---|---|
| `{type:"hello", game, version, protocol}` | Sent on connect — identifies the game. |
| `{type:"ready"}` | Idle & locked, ready to accept an `unlock`. |
| `{type:"session_result", session_id, score, status, meta}` | The one summary when the paid session ends. |

`session_result` fields:
- `status`: `"completed"` \| `"timeout"` \| `"abandoned"`
- `score`: primary number recorded to `/results.value` — **best score of the session**
- `meta`: `{ rounds:[{mode,difficulty,score,...}], best, total, player:{uid,name}, ... }`

**Deferred (not in v1):** a `{type:"scan", uid}` message for games with their own reader. It is a
backward-compatible additive change if ever needed; excluded now because all stations use the
single USB NFC reader.

## Changes inside the Lightning game

1. **Embed a WS control server** in the Electron main process (`main.js`) on `127.0.0.1:<port>`;
   send `hello`/`ready`, receive `unlock`/`lock`, relay to the renderer via existing IPC.
2. **Add a `locked` phase** to the renderer state machine (`public/app.js`), shown at startup and
   after each session (reuse `unlock.css`). `modes` is unreachable without an `unlock`.
3. **Disable local auth paths:** remove the Arduino-RFID `cards()` lookup as the entry point, and
   disable guest / "skip card" free play. Entry happens only via `unlock`; set player name/profile
   from `user`, keep progression keyed on `uid`.
4. **Paid-time budget:** run `paid_seconds` from `unlock` as the session clock across rounds; at 0
   (or on `lock`) finish the current round and emit the summary.
5. **Report summary:** send `session_result`, then return to `locked`.

## Changes in the gateway

1. **New adapter** `gateway/src/adapters/gameserver.js` — a WebSocket **client** implementing the
   existing adapter contract (`startGame`, `deny`, emits `result`/`timeout`/`error`), translating
   to/from the protocol messages above.
2. **Register** it in `gateway/src/adapters/index.js` as `ADAPTER=gameserver`; config
   `GAME_WS_URL=ws://127.0.0.1:4200` (add to `config.js` and `.env.example`).
3. **`startGame` receives the session, not just the id** — small signature change so the adapter
   can send `user` + `paid_seconds` in `unlock`. `onTap` already holds `current` (name,
   `remaining_seconds`).
4. **Watchdog fix (important):** the fixed 120 s `GAME_TIMEOUT_MS` would release the station
   mid-play on a multi-minute session. For this adapter the watchdog is the **paid session length +
   grace**, and the authoritative "session over" signal is the game's `session_result`. See the
   watchdog-vs-healthcheck note.

## Result summary & players

- `value` (server) = best score of the session; all detail (rounds, modes, difficulties) in `meta`.
- **v1 is single-player:** one bracelet = one paid single-player session. The game's 2-player /
  duel modes are out of scope for the Strivex flow in v1. Two-bracelet duel is a future additive
  enhancement. *(Explicit scope boundary — veto at review if wrong.)*

## Error handling

- **Game unreachable / WS down:** gateway denies taps and keeps trying to reconnect; on reconnect
  it expects a fresh `hello`/`ready`.
- **Game crash mid-session:** WS drop → gateway treats the in-flight session as `abandoned` (its
  existing crash-safe `current.json` + outbox path already covers writing an abandoned result).
- **Paid time expires:** gateway sends `lock`; game finishes the current round and reports
  `status:"timeout"` (or `completed` if it ended cleanly first).
- **Duplicate/late `session_result`:** keyed by `session_id`; the gateway ignores a result for a
  session it has already finished (outbox IDs already make retries idempotent).

## Testing

- **Protocol unit tests:** a fake game WS server exercising `unlock` → `session_result`, `lock`
  mid-session, and disconnect → abandoned.
- **Adapter tests:** `gameserver.js` emits the right adapter events for each `session_result.status`.
- **Game unit tests:** locked-state gating (no `modes` without `unlock`), paid-time countdown,
  summary computation (best/total) — extend the game's existing `tests/`.
- **End-to-end (mock):** gateway `ADAPTER=gameserver` against a stub game server, verifying a
  `/results` summary row and the live in-game mapping clearing on lock.

## Out of scope (v1)

- Two-bracelet / duel sessions.
- Games providing their own reader (`scan` message).
- Per-round result rows (we send one summary per session).
