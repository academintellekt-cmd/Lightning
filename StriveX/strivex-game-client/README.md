# strivex-game-client

The game side of the Strivex Game Control Protocol: a WebSocket control
server plus the authoritative paid-time countdown for a session, packaged so
a new game can be Strivex-ready without hand-wiring the wire protocol.

See `docs/superpowers/specs/2026-07-31-gateway-game-control-protocol-design.md`
for the full protocol this implements the game side of.

## Files

- `strivex-session.js` — `StrivexSession`, an `EventEmitter` that runs the
  control server (`ws://127.0.0.1:4200` by default) and the session timer.
- `preload.js` — Electron preload script exposing `window.strivex` via
  `contextBridge`.
- `test/session.test.js` — `node --test` coverage for `StrivexSession`.

No installed dependencies: the control protocol only ever carries small JSON
text frames, so `strivex-session.js` implements the WebSocket handshake and
framing directly on Node's `http`/`crypto` instead of depending on `ws`.

## The three-timer rule

There are three clocks in play across a session and only one of them is
authoritative:

1. **`StrivexSession` in the game's main process — authoritative.** It starts
   counting down from `paid_seconds` the moment `unlock` arrives, and it is
   the only clock that decides when a session's paid time is actually over
   (`expired`). Everything else is a display or a fallback.
2. **The renderer's countdown — display only.** The renderer subscribes to
   `onTick(remainingMs)` and shows it; it never decides to end a session
   itself. If the renderer is slow, frozen, or reloads, the authoritative
   timer in main is unaffected.
3. **The gateway's lock+grace timer — last-resort fallback.** The gateway
   also arms a deadline (`paid_seconds` + ~10s grace) when it sends `unlock`.
   Under normal operation the game reports `session_result` well before this
   fires. It only matters if the game process hangs or the WebSocket
   connection is lost, in which case the gateway force-locks and records the
   session as `timeout` on its own so a wedged game can never strand a
   station.

Only the main-process `StrivexSession` should ever call `reportResult`; the
renderer's countdown and the gateway's grace timer both exist purely so the
system degrades safely if that authoritative timer's owner (the game
process) stops responding.

## Electron integration

Main process:

```js
const { StrivexSession } = require('strivex-game-client/strivex-session');
const { ipcMain } = require('electron');

const session = new StrivexSession({ port: 4200, game: 'my-game', version: app.getVersion() });
session.start();

session.on('unlock', (payload) => controlWindow.webContents.send('strivex:unlock', payload));
session.on('lock', (payload) => controlWindow.webContents.send('strivex:lock', payload));
session.on('tick', (remainingMs) => controlWindow.webContents.send('strivex:tick', remainingMs));

ipcMain.handle('strivex:report-result', (_event, score, status, meta) =>
  session.reportResult(score, status, meta));

app.on('before-quit', () => session.stop());
```

Preload script:

```js
require('strivex-game-client/preload');
```

Renderer (game-specific hooks only):

```js
window.strivex.onUnlock(({ session_id, user, paid_seconds }) => { /* set player, show menu */ });
window.strivex.onLock(({ reason }) => { /* return to locked screen */ });
window.strivex.onTick((remainingMs) => { /* update the display-only countdown */ });

// when a round/session finishes:
window.strivex.reportResult(score, 'completed', { rounds: [...] });
```

## Allowed status values

`reportResult(score, status, meta)` accepts exactly:

- `completed` — the player finished cleanly.
- `timeout` — paid time ran out.
- `abandoned` — the session was ended before completion (e.g. operator stop).
- `failed` — anything else that isn't a clean outcome.

Any other value throws instead of being sent, so a typo in game code fails
loudly at the source instead of silently reaching the gateway (which would
otherwise coerce an unrecognized status to `failed` on its own).
