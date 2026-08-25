# strivex-game-client Library — Design

**Date:** 2026-07-31
**Status:** ⚠️ **Superseded by the as-built implementation (2026-08-03).** The library
that shipped is a deliberately *simplified* single-file version — see the
**As-Built** section immediately below for the real API and layout, and
`strivex-game-client/README.md` for the integration guide. The design sections
that follow this banner are retained for **rationale and history only**; where
they describe entry points (`attach`/`expose`), methods (`recordRound`/
`endSession`), events (`onEnd`), a `lib/`+`electron/`+`preload/` layout, or a
`ws` dependency, **they do not match what was built** — do not code against them.
**Builds on:** `2026-07-31-gateway-game-control-protocol-design.md` (the wire protocol this library implements the game side of)

---

## As-Built (2026-08-03) — authoritative

The shipped `strivex-game-client/` is a single-file library with **zero installed
dependencies** (the WebSocket handshake and framing are implemented directly on
Node's `http`/`crypto`, since the protocol only carries small JSON frames). The
layered multi-entry-point package below was **not** built.

**Actual layout**
```
strivex-game-client/
  package.json            no dependencies; not published (file:/git install)
  strivex-session.js      StrivexSession — the whole game-side implementation
  preload.js              Electron preload: exposes window.strivex via contextBridge
  README.md               integration guide (current & correct)
  test/session.test.js    node --test coverage
```

**Actual API** — `class StrivexSession extends EventEmitter`
```js
const { StrivexSession } = require('strivex-game-client/strivex-session');
new StrivexSession({ port = 4200, game, version, protocol = 1 });
```
- `.start()` — bind the control server (chainable). `.stop()` — tear down (closes the client).
- `.reportResult(score, status, meta)` — send `session_result`; **throws** on a status
  outside `completed | timeout | abandoned | failed` (fail-loud at the source).

**Events emitted** (not the `unlock`/`end` pair the design proposed):
- `unlock` → `{ session_id, user, paid_seconds }`
- `lock` → `{ reason }`
- `tick` → `remainingMs` (the display-only countdown feed)
- `expired` → paid time hit zero (the main process then calls `reportResult(..., 'timeout')`)
- `error` → `Error` (e.g. control port already in use)

**Not built (vs. the design below):** the `attach()` Electron adapter, the `expose()`
preload helper, `recordRound()`/`endSession()` (the game buffers its own rounds and calls
`reportResult` once), the `onEnd` event, the three-entry-point `exports` map, and the `ws`
dependency. The **three-timer rule**, the status allowlist/fail-loud behaviour, the
single-active-session guard, and the reconnect-replaces-old-socket semantics all shipped as
designed — see `strivex-game-client/README.md`.

---

## Goal

Package the game side of the Strivex Game Control Protocol into a reusable local npm
package, so a new game becomes "Strivex-ready" with a one-line import plus a handful of
game-specific hooks — instead of hand-wiring the control server, IPC, and session lifecycle
each time. Prove it by converting the Lightning game to consume it.

## Non-goals

- No change to the wire protocol or the gateway. This is purely the game-side extraction;
  the gateway branch (`feat/game-control-protocol`) is untouched.
- Not a general game framework — only the Strivex session lifecycle is packaged. How a game
  starts a round, tracks a score, or draws its locked screen stays in the game.
- No npm-registry publishing in v1 (dev uses a `file:`/git install; publishing later needs
  no code change).

## Distribution

- The package lives **in the Strivex repo** at `strivex-game-client/`, so both ends of the
  protocol (gateway adapter + this client) are versioned and visible together — no drift.
- A game depends on it via a **`file:` path** (dev) or git URL (later):
  `npm install file:../Strivex/strivex-game-client` → `require('strivex-game-client')`.
- Publishing to a git URL or npm registry later is a packaging step only, no code change.

## Package layout & entry points

Three entry points via the package.json `exports` map, so a game pulls only what it needs:

```
strivex-game-client/
  package.json          exports: "." , "./electron", "./preload"; dependency: ws
  index.js              core: exports StrivexSession, ControlServer, summarizeSession
  lib/control-server.js moved from the game (with hardening already applied)
  lib/session-summary.js moved from the game
  lib/session.js        StrivexSession — the reusable session orchestrator
  electron/index.js     attach() — Electron main-process wiring (WS + IPC)
  preload/index.js      expose() — adds window.strivex in the renderer
  test/                 node --test suites for the core
  README.md             integration guide
```

- `require('strivex-game-client')` → the framework-agnostic core (any Node game).
- `require('strivex-game-client/electron')` → `attach(...)` for Electron main.
- `require('strivex-game-client/preload')` → `expose(...)` for the preload script.

## Layer 1 — Session core (framework-agnostic, main process)

`class StrivexSession extends EventEmitter` owns the `ControlServer` and the whole session
lifecycle. It is the single reusable brain. Today this logic is split between the game
renderer (`app.js`: paid-timer, round buffer, `summarizeSession`, `strivexEnd`) and the
control server; the library consolidates it here.

**Construction**
```js
new StrivexSession({ port = 4200, game, version, protocol = 1 })
```
`.start()` binds the control server; `.stop()` tears it down (closes clients).

**Events emitted**
- `unlock` → `{ session_id, uid, name, paid_seconds }` — a bracelet was authorized.
- `end` → `{ session_id, status, summary }` — the session ended (any cause).

**Methods**
- `recordRound({ mode, difficulty, score })` — buffer a finished round.
- `endSession(status)` — game-initiated end with an explicit status (e.g. operator end).

**Lifecycle (identical semantics + guards to the current hardened implementation):**
- gateway `unlock` → store `{session_id, uid, name}`, reset the round buffer, start the
  authoritative paid-time timer (`paid_seconds`), emit `unlock`.
- `recordRound(r)` → append to the buffer.
- Session ends — summarize the buffer, send `session_result`, clear the timer, signal
  `ready`, emit `end` — on any of:
  - **paid-time timer expiry → status `timeout`**
  - **gateway `lock` → status `completed`**
  - **game `endSession(status)` → that status** (validated; unknown coerced to `failed`)
  - **re-`unlock` while a session is active → end the old one as `abandoned` (reason
    `reunlock`), then start the new session**
- The end reason is carried in `summary.meta.end_reason`.
- `score` (the recorded `/results.value`) = best score of the buffered rounds; `meta`
  carries `{ rounds, best, total, player:{uid,name}, end_reason }` (via `summarizeSession`).
- Status values are constrained to `completed|timeout|abandoned|failed`; any other value is
  coerced to `failed` so a malformed status can never wedge the gateway's result outbox.

The core depends only on `ws` and `session-summary.js`. No Electron.

## Layer 2 — Electron adapter

`strivex-game-client/electron` exports:
```js
attach({ controlWindow, game, version, port = 4200, protocol = 1 }) -> { session, stop() }
```
It: constructs and starts a `StrivexSession`; forwards the core's `unlock`/`end` events to
`controlWindow.webContents.send('strivex:unlock' | 'strivex:end', payload)`; and registers
`ipcMain` handlers that route renderer messages into the core:
- `strivex:record-round` → `session.recordRound(payload)`
- `strivex:end` → `session.endSession(status)`

`stop()` (called from the app's `before-quit`) stops the session/control server.

## Layer 3 — Preload helper

`strivex-game-client/preload` exports `expose()`, which uses Electron `contextBridge` +
`ipcRenderer` to add `window.strivex`:
```js
window.strivex = {
  onUnlock(cb),                 // cb({ session_id, uid, name, paid_seconds })
  onEnd(cb),                    // cb({ session_id, status, summary })
  recordRound({ mode, difficulty, score }),
  endSession(status),
};
```
It coexists with the game's own preload bridge (e.g. `window.lightning`).

## Game-facing usage (the whole surface)

```js
// main.js
const strivex = require('strivex-game-client/electron')
  .attach({ controlWindow, game: 'lightning', version: app.getVersion(), port: c.control?.port || 4200 });
app.on('before-quit', () => strivex.stop());

// preload.js
require('strivex-game-client/preload').expose();

// renderer (game-specific hooks only)
window.strivex.onUnlock(({ uid, name, paid_seconds }) => { /* set player, show menu */ });
window.strivex.onEnd(({ status }) => { /* return to locked screen */ });
window.strivex.recordRound({ mode, difficulty, score });   // when a round finishes
window.strivex.endSession('abandoned');                    // operator "End session"
```

## Converting Lightning (reference consumer)

- Remove `lib/control-server.js` and `lib/session-summary.js` from the game; add
  `strivex-game-client` as a `file:` dependency.
- `main.js`: replace the `ControlServer` construction + IPC bridge with the single
  `attach(...)` line and the `before-quit` stop.
- `preload.js`: add the one `expose()` line (keep the existing `lightning` bridge).
- `public/app.js`: **remove** the inline session logic (`strivex`, `strivexRounds`,
  `paidTimer`, the inlined `summarizeSession`, `strivexUnlock`, `strivexEnd`, and the
  `onControlUnlock`/`onControlLock`/`controlResult`/`controlReady` wiring). **Keep** the
  game-specific behaviour and rewire it to the four `window.strivex.*` hooks:
  - `onUnlock` → set player 0 name/profile from `uid`/`name`, run controller assignment
    (`autoAssignControllers()` / `assignBlue`), land on `modes`.
  - `onEnd` → return to the `locked` phase.
  - `finish()` → `window.strivex.recordRound({ mode: state.mode, difficulty: state.difficulty, score: Math.max(state.scores[0], state.scores[1]) })`.
  - operator End-session action → `window.strivex.endSession('abandoned')`.
  - The renderer no longer runs the paid-time expiry timer (the core owns it); it may keep a
    display-only countdown from `paid_seconds`.
- Update the game's `tests/` that imported the two moved modules (they now come from the
  package, or those tests move into the package).

Observable behaviour is unchanged from the current hardened Lightning integration — same
protocol, same guards, same result rows — just relocated into the library.

## Error handling

All the robustness already implemented moves into the package and is centralized there:
control-server `error` listener (no host crash on bind failure), `stop()` closes existing
client sockets, session-end status allowlist/coercion, single-flight session guards, and the
re-unlock cleanup. No behaviour regressions relative to the current implementation.

## Testing

- **Core (`test/`, `node --test`)** — the real coverage:
  - Moved `control-server` and `session-summary` tests.
  - New `StrivexSession` lifecycle tests against a fake WS client: `unlock` → `recordRound` ×N
    → paid-timer expiry emits a `session_result` with best score + `status:"timeout"` + meta;
    gateway `lock` → `completed`; `endSession('abandoned')` → `abandoned`; re-`unlock` ends the
    prior session as `abandoned`/`reunlock` then starts fresh; unknown `endSession` status
    coerced to `failed`.
- **Electron adapter + preload** — thin IPC glue, not headlessly unit-testable; verified by the
  Lightning conversion plus the existing fake-gateway GUI E2E.
- **Lightning conversion** — `npm run check` still green after the two modules move to the
  package; then the manual GUI E2E (locked → unlock → play → summary → re-lock) confirms parity.

## Out of scope (v1)

- npm-registry publishing (dev install is `file:`/git URL).
- Any non-Electron reference consumer (the core supports it, but none is built here).
- Two-player / duel sessions and the `scan` protocol message (still out of scope per the
  base protocol design).
