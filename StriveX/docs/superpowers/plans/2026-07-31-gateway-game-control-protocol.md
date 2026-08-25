# Gateway ⇄ Game Control Protocol Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the Strivex gateway authorize a bracelet, unlock an attraction game for a paid session over a local WebSocket, and record one result summary per session — with the Lightning game as the reference implementation.

**Architecture:** A tiny JSON-over-WebSocket protocol on `127.0.0.1`. The **game hosts** the WS server; the **gateway is the client**. Gateway sends `unlock`/`lock`; game replies `hello`/`ready`/`session_result`. The gateway gets a new `gameserver` adapter that satisfies the existing EventEmitter adapter contract; the game gets an embedded control server, a locked state, and unlock-driven entry.

**Tech Stack:** Node.js. Gateway = ESM (`"type":"module"`), tested with built-in `node:test`. Game = Electron/CommonJS, tested with `node tests/*.test.js` + `assert`. New dependency both sides: [`ws`](https://github.com/websockets/ws).

## Global Constraints

- Protocol messages are one JSON object per WS frame, exact shapes:
  - Gateway→Game: `{type:"unlock", session_id, user:{uid,name}, paid_seconds}`, `{type:"lock", reason}`
  - Game→Gateway: `{type:"hello", game, version, protocol}`, `{type:"ready"}`, `{type:"session_result", session_id, score, status, meta}`
- `session_result.status` ∈ `"completed" | "timeout" | "abandoned"`. `score` = **best score of the session** (the number written to `/results.value`). All detail goes in `meta`.
- WS server binds **`127.0.0.1` only**. Default port **4200**.
- **v1 is single-player.** Game's 2-player/duel modes are out of scope for the Strivex flow.
- **No bracelet, no play:** the game's guest / "skip card" free-play entry is disabled; the locked state opens only on `unlock`.
- Two separate repos:
  - Gateway/spec: `C:\dev\Strivex`, branch **`feat/game-control-protocol`** (already created).
  - Game: `C:\dev\lightning_windows_v2.0.3_color_modes_and_help_fix`, create branch **`feat/strivex-control-protocol`**.
- Reference spec: `docs/superpowers/specs/2026-07-31-gateway-game-control-protocol-design.md`.

---

## File Structure

**Gateway (`C:\dev\Strivex\gateway`):**
- Create: `src/adapters/gameserver.js` — WS-client adapter (EventEmitter contract).
- Create: `test/gameserver.test.js` — adapter unit tests + fake game server.
- Modify: `package.json` — add `ws` dep, `test` script.
- Modify: `src/adapters/index.js` — register `gameserver`.
- Modify: `src/config.js` — add `gameWsUrl`.
- Modify: `src/index.js` — pass session to `startGame`, honor `adapter.managesTimeout`, add `uid` to `current`.
- Modify: `.env.example` — document `GAME_WS_URL`.

**Game (`C:\dev\lightning_windows_v2.0.3_color_modes_and_help_fix`):**
- Create: `lib/control-server.js` — WS-server module (EventEmitter).
- Create: `lib/session-summary.js` — pure summarizer.
- Create: `tests/control-server.test.js`, `tests/session-summary.test.js`.
- Modify: `package.json` — add `ws` dep, extend `check` script.
- Modify: `config.json` — add `control.port`.
- Modify: `main.js` — start control server, bridge unlock/lock/result over IPC.
- Modify: `preload.js` — expose control channels.
- Modify: `public/app.js` — locked phase, unlock-driven entry, disable guest/skip, paid-time budget, round tracking, summary emission.

---

## Task 1: Gateway `gameserver` adapter (WS client)

**Files:**
- Create: `gateway/src/adapters/gameserver.js`
- Create: `gateway/test/gameserver.test.js`
- Modify: `gateway/package.json`

**Interfaces:**
- Produces: `class GameServerAdapter extends EventEmitter`
  - `new GameServerAdapter(url: string)`
  - property `managesTimeout = true`
  - `startGame(sessionId: string, session?: { session_id, username, uid, user_id, remaining_seconds })` → sends `unlock`, arms an internal deadline of `remaining_seconds + grace`.
  - `stop(reason?: string)` → sends `lock`.
  - `deny(reason?: string)` → no-op in v1.
  - emits `'result'(value:number|null, meta:object)`, `'timeout'()`, `'failed'(meta:object)`, `'error'(Error)` — matching the contract in `gateway/src/adapters/index.js`.

- [ ] **Step 1: Add `ws` and a test script to the gateway**

Edit `gateway/package.json` — add to `dependencies` and `scripts`:

```json
{
  "scripts": {
    "start": "node src/index.js",
    "test": "node --test"
  },
  "dependencies": {
    "dotenv": "^16.4.5",
    "nfc-pcsc": "^0.8.1",
    "serialport": "^12.0.0",
    "@serialport/parser-readline": "^12.0.0",
    "ws": "^8.18.0"
  }
}
```

Then install:

```bash
cd /c/dev/Strivex/gateway && npm install
```

- [ ] **Step 2: Write the failing test**

Create `gateway/test/gameserver.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert';
import { EventEmitter, once } from 'node:events';
import { WebSocketServer } from 'ws';
import { GameServerAdapter } from '../src/adapters/gameserver.js';

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

async function fakeGame() {
  const wss = new WebSocketServer({ host: '127.0.0.1', port: 0 });
  const state = { received: [], sockets: [] };
  wss.on('connection', (ws) => {
    state.sockets.push(ws);
    ws.send(JSON.stringify({ type: 'hello', game: 'test', version: '1', protocol: 1 }));
    ws.send(JSON.stringify({ type: 'ready' }));
    ws.on('message', (d) => state.received.push(JSON.parse(d.toString())));
  });
  await once(wss, 'listening');
  const { port } = wss.address();
  return {
    wss, state, url: `ws://127.0.0.1:${port}`,
    send: (obj) => state.sockets.forEach((s) => s.send(JSON.stringify(obj))),
    close: () => wss.close(),
  };
}

test('startGame sends unlock with user and paid_seconds', async () => {
  const g = await fakeGame();
  const a = new GameServerAdapter(g.url);
  await once(a.ws, 'open');
  await delay(30);
  a.startGame('S1', { session_id: 'S1', username: 'Bob', uid: 'ABC', remaining_seconds: 300 });
  await delay(30);
  const unlock = g.state.received.find((m) => m.type === 'unlock');
  assert.equal(unlock.session_id, 'S1');
  assert.equal(unlock.user.name, 'Bob');
  assert.equal(unlock.user.uid, 'ABC');
  assert.equal(unlock.paid_seconds, 300);
  a.clearTimers(); a.ws.close(); g.close();
});

test('completed session_result emits result(value, meta)', async () => {
  const g = await fakeGame();
  const a = new GameServerAdapter(g.url);
  await once(a.ws, 'open');
  await delay(30);
  a.startGame('S1', { session_id: 'S1', remaining_seconds: 300 });
  const p = once(a, 'result');
  g.send({ type: 'session_result', session_id: 'S1', score: 900, status: 'completed', meta: { best: 900 } });
  const [value, meta] = await p;
  assert.equal(value, 900);
  assert.equal(meta.best, 900);
  a.clearTimers(); a.ws.close(); g.close();
});

test('timeout status emits timeout; abandoned emits failed', async () => {
  const g = await fakeGame();
  const a = new GameServerAdapter(g.url);
  await once(a.ws, 'open');
  await delay(30);
  a.startGame('S2', { session_id: 'S2', remaining_seconds: 300 });
  const t = once(a, 'timeout');
  g.send({ type: 'session_result', session_id: 'S2', score: 0, status: 'timeout', meta: {} });
  await t;

  a.startGame('S3', { session_id: 'S3', remaining_seconds: 300 });
  const f = once(a, 'failed');
  g.send({ type: 'session_result', session_id: 'S3', score: 0, status: 'abandoned', meta: {} });
  await f;
  a.clearTimers(); a.ws.close(); g.close();
});

test('stale session_result for a finished session is ignored', async () => {
  const g = await fakeGame();
  const a = new GameServerAdapter(g.url);
  await once(a.ws, 'open');
  await delay(30);
  a.startGame('S4', { session_id: 'S4', remaining_seconds: 300 });
  g.send({ type: 'session_result', session_id: 'S4', score: 5, status: 'completed', meta: {} });
  await once(a, 'result');
  let extra = false;
  a.on('result', () => { extra = true; });
  g.send({ type: 'session_result', session_id: 'S4', score: 9, status: 'completed', meta: {} });
  await delay(40);
  assert.equal(extra, false);
  a.clearTimers(); a.ws.close(); g.close();
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `cd /c/dev/Strivex/gateway && npm test`
Expected: FAIL — `Cannot find module '../src/adapters/gameserver.js'`.

- [ ] **Step 4: Write the adapter**

Create `gateway/src/adapters/gameserver.js`:

```js
// gateway/src/adapters/gameserver.js
// WebSocket client to a Strivex game's local control server.
//   Gateway -> Game: {type:'unlock', session_id, user:{uid,name}, paid_seconds}
//                    {type:'lock', reason}
//   Game -> Gateway: {type:'hello', game, version, protocol}
//                    {type:'ready'}
//                    {type:'session_result', session_id, score, status, meta}
import { EventEmitter } from 'node:events';
import WebSocket from 'ws';

const GRACE_MS = 10000;

export class GameServerAdapter extends EventEmitter {
  constructor(url) {
    super();
    this.url = url;
    this.managesTimeout = true; // gateway skips its fixed watchdog for this adapter
    this.activeSession = null;
    this.deadlineTimer = null;
    this.lockGraceTimer = null;
    this.retryTimer = null;
    this.connect();
  }

  connect() {
    this.ws = new WebSocket(this.url);
    this.ws.on('open', () => console.log(`[gameserver] connected ${this.url}`));
    this.ws.on('message', (data) => this.onMessage(data));
    this.ws.on('close', () => this.retry());
    this.ws.on('error', (e) => console.warn('[gameserver] ws error:', e.message));
  }

  retry() {
    if (this.retryTimer) return;
    this.retryTimer = setTimeout(() => { this.retryTimer = null; this.connect(); }, 3000);
  }

  onMessage(data) {
    let msg;
    try { msg = JSON.parse(data.toString()); } catch { return; }
    if (msg.type === 'hello') console.log(`[gameserver] game=${msg.game} v${msg.version}`);
    else if (msg.type === 'session_result') this.onResult(msg);
  }

  onResult(msg) {
    if (!this.activeSession || msg.session_id !== this.activeSession) return; // stale/dup
    this.clearTimers();
    this.activeSession = null;
    const meta = { ...(msg.meta || {}), score: msg.score };
    if (msg.status === 'completed') this.emit('result', msg.score ?? null, meta);
    else if (msg.status === 'timeout') this.emit('timeout');
    else this.emit('failed', meta); // abandoned / unknown
  }

  startGame(sessionId, session = {}) {
    this.activeSession = sessionId;
    const paid = Number(session.remaining_seconds) || 0;
    this.send({
      type: 'unlock',
      session_id: sessionId,
      user: { uid: session.uid ?? session.user_id ?? null, name: session.username ?? null },
      paid_seconds: paid,
    });
    const ms = paid > 0 ? paid * 1000 + GRACE_MS : 0;
    if (ms) this.deadlineTimer = setTimeout(() => this.forceLock('deadline'), ms);
  }

  forceLock(reason) {
    this.send({ type: 'lock', reason });
    this.lockGraceTimer = setTimeout(() => {
      if (!this.activeSession) return;
      this.activeSession = null;
      this.emit('timeout');
    }, GRACE_MS);
  }

  stop(reason = 'operator') { this.forceLock(reason); }

  deny() { /* game stays locked; no protocol message in v1 */ }

  clearTimers() {
    clearTimeout(this.deadlineTimer);
    clearTimeout(this.lockGraceTimer);
  }

  send(obj) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(obj));
  }
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd /c/dev/Strivex/gateway && npm test`
Expected: PASS — 4 tests.

- [ ] **Step 6: Commit**

```bash
cd /c/dev/Strivex && git add gateway/package.json gateway/package-lock.json gateway/src/adapters/gameserver.js gateway/test/gameserver.test.js && git commit -m "feat(gateway): gameserver WebSocket adapter"
```

---

## Task 2: Wire the `gameserver` adapter into the gateway core

**Files:**
- Modify: `gateway/src/adapters/index.js`
- Modify: `gateway/src/config.js:13-24`
- Modify: `gateway/src/index.js` (`onTap`, watchdog arming, `startGame` call)
- Modify: `gateway/.env.example`

**Interfaces:**
- Consumes: `GameServerAdapter` from Task 1; existing `config` object; existing `current` game object.
- Produces: `ADAPTER=gameserver` selectable; `config.gameWsUrl`; `current` now carries `uid`; the fixed watchdog is skipped when `adapter.managesTimeout` is truthy.

- [ ] **Step 1: Register the adapter**

Edit `gateway/src/adapters/index.js` — add the import and case:

```js
import { GameServerAdapter } from './gameserver.js';
// ...inside createAdapter's switch:
    case 'gameserver':
      return new GameServerAdapter(config.gameWsUrl);
```

- [ ] **Step 2: Add config**

Edit `gateway/src/config.js` — add inside the `config` object:

```js
  gameWsUrl: process.env.GAME_WS_URL || 'ws://127.0.0.1:4200',
```

- [ ] **Step 3: Document env**

Edit `gateway/.env.example` — change the ADAPTER comment line and add the URL:

```
ADAPTER=mock            # mock | manual | serial | gameserver
GAME_WS_URL=ws://127.0.0.1:4200   # gameserver adapter: game's local control server
```

- [ ] **Step 4: Pass the session and skip the fixed watchdog**

Edit `gateway/src/index.js` inside `onTap`. Change the block that stores/arms/starts (currently lines ~101-110):

```js
  setCurrent({ ...auth.data, uid, startedAt: Date.now() });
  if (!adapter.managesTimeout) armWatchdog();
  const minLeft = Math.floor((auth.data.remaining_seconds ?? 0) / 60);
  if (auth.data.remaining_seconds != null && minLeft < 5) {
    console.log(`[gateway] WARNING: ${minLeft}m ${auth.data.remaining_seconds % 60}s left on this bracelet`);
    adapter.warnTimeLeft?.(auth.data.remaining_seconds);
  }
  console.log(`[gateway] authorized ${current.username} (session ${current.session_id}, ${minLeft}m left)`);
  adapter.startGame(current.session_id, current);
  sendHeartbeat();
```

(The two functional edits are: add `uid` to `setCurrent`; guard `armWatchdog()` with `!adapter.managesTimeout`; pass `current` to `startGame`.)

- [ ] **Step 5: Verify existing adapters still start and typecheck**

Run (mock adapter must still boot unchanged):

```bash
cd /c/dev/Strivex/gateway && STATION_ID=test SERVER_URL=http://127.0.0.1:3000 ADAPTER=mock node -e "import('./src/adapters/index.js').then(m=>{const a=m.createAdapter({adapter:'mock'});console.log('mock ok', !!a.startGame); const g=m.createAdapter({adapter:'gameserver',gameWsUrl:'ws://127.0.0.1:4999'});console.log('gameserver ok', g.managesTimeout===true); g.clearTimers?.(); process.exit(0);})"
```

Expected: prints `mock ok true` and `gameserver ok true` (a failed WS connect just logs a warning; the process exits cleanly).

- [ ] **Step 6: Run the adapter test suite again (regression)**

Run: `cd /c/dev/Strivex/gateway && npm test`
Expected: PASS — 4 tests.

- [ ] **Step 7: Commit**

```bash
cd /c/dev/Strivex && git add gateway/src/adapters/index.js gateway/src/config.js gateway/src/index.js gateway/.env.example && git commit -m "feat(gateway): wire gameserver adapter, session-aware watchdog"
```

---

## Task 3: Game control server + session summarizer (pure modules)

**Files (game repo `C:\dev\lightning_windows_v2.0.3_color_modes_and_help_fix`):**
- Create: `lib/control-server.js`
- Create: `lib/session-summary.js`
- Create: `tests/control-server.test.js`
- Create: `tests/session-summary.test.js`
- Modify: `package.json`

**Interfaces:**
- Produces: `class ControlServer extends EventEmitter`
  - `new ControlServer({ port, game, version, protocol })`
  - `.start()` → binds WS server on `127.0.0.1`, returns `this`.
  - emits `'unlock'(payload)`, `'lock'(payload)`.
  - `.ready()` → broadcast `{type:'ready'}`.
  - `.result(payload)` → broadcast `{type:'session_result', ...payload}`.
  - `.stop()`.
  - On each connection sends `{type:'hello',...}` then, if ready, `{type:'ready'}`.
- Produces: `summarizeSession(rounds, { session_id, uid, name, status })` → `{ session_id, score, status, meta }`.

- [ ] **Step 1: Create the game branch and add `ws`**

```bash
cd /c/dev/lightning_windows_v2.0.3_color_modes_and_help_fix && git checkout -b feat/strivex-control-protocol
```

Edit `package.json` — add `"ws":"^8.18.0"` to `dependencies`, and extend `check`:

```json
"check": "node tests/engine.test.js && node tests/color-engine.test.js && node tests/advanced-engine.test.js && node tests/session-summary.test.js && node tests/control-server.test.js",
```

Then:

```bash
cd /c/dev/lightning_windows_v2.0.3_color_modes_and_help_fix && npm install
```

- [ ] **Step 2: Write the failing summarizer test**

Create `tests/session-summary.test.js`:

```js
const assert = require('assert');
const { summarizeSession } = require('../lib/session-summary');

const rounds = [
  { mode: 'classic', difficulty: 'easy', score: 120 },
  { mode: 'colorMatch', difficulty: 'hard', score: 340 },
  { mode: 'pong', difficulty: 'medium', score: 200 },
];
const s = summarizeSession(rounds, { session_id: 'S1', uid: 'ABC', name: 'Bob', status: 'completed' });
assert.strictEqual(s.session_id, 'S1');
assert.strictEqual(s.score, 340);           // best
assert.strictEqual(s.status, 'completed');
assert.strictEqual(s.meta.total, 660);      // sum
assert.strictEqual(s.meta.best, 340);
assert.deepStrictEqual(s.meta.player, { uid: 'ABC', name: 'Bob' });
assert.strictEqual(s.meta.rounds.length, 3);

const empty = summarizeSession([], { session_id: 'S2', uid: null, name: null });
assert.strictEqual(empty.score, 0);
assert.strictEqual(empty.status, 'abandoned'); // no rounds and no explicit status
console.log('session-summary ok');
```

- [ ] **Step 3: Run it to verify it fails**

Run: `cd /c/dev/lightning_windows_v2.0.3_color_modes_and_help_fix && node tests/session-summary.test.js`
Expected: FAIL — `Cannot find module '../lib/session-summary'`.

- [ ] **Step 4: Write the summarizer**

Create `lib/session-summary.js`:

```js
// lib/session-summary.js — reduce played rounds into a Strivex session_result summary.
function summarizeSession(rounds, { session_id, uid, name, status } = {}) {
  const scores = rounds.map((r) => Number(r.score) || 0);
  const best = scores.length ? Math.max(...scores) : 0;
  const total = scores.reduce((a, b) => a + b, 0);
  return {
    session_id,
    score: best,
    status: status || (rounds.length ? 'completed' : 'abandoned'),
    meta: { rounds, best, total, player: { uid: uid ?? null, name: name ?? null } },
  };
}
module.exports = { summarizeSession };
```

- [ ] **Step 5: Run it to verify it passes**

Run: `cd /c/dev/lightning_windows_v2.0.3_color_modes_and_help_fix && node tests/session-summary.test.js`
Expected: prints `session-summary ok`.

- [ ] **Step 6: Write the failing control-server test**

Create `tests/control-server.test.js`:

```js
const assert = require('assert');
const WebSocket = require('ws');
const { ControlServer } = require('../lib/control-server');

function client(port) {
  const ws = new WebSocket(`ws://127.0.0.1:${port}`);
  const got = [];
  ws.on('message', (d) => got.push(JSON.parse(d.toString())));
  return { ws, got, ready: new Promise((r) => ws.on('open', r)) };
}
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const port = 4791;
  const server = new ControlServer({ port, game: 'lightning', version: '2.0.3', protocol: 1 }).start();
  server.ready();

  const c = client(port);
  await c.ready;
  await delay(40);
  assert.ok(c.got.find((m) => m.type === 'hello' && m.game === 'lightning'), 'hello sent');
  assert.ok(c.got.find((m) => m.type === 'ready'), 'ready sent to new client');

  const unlocks = [];
  server.on('unlock', (p) => unlocks.push(p));
  c.ws.send(JSON.stringify({ type: 'unlock', session_id: 'S1', user: { uid: 'A', name: 'Bob' }, paid_seconds: 120 }));
  await delay(40);
  assert.strictEqual(unlocks.length, 1, 'unlock emitted');
  assert.strictEqual(unlocks[0].session_id, 'S1');

  server.result({ session_id: 'S1', score: 500, status: 'completed', meta: { best: 500 } });
  await delay(40);
  const res = c.got.find((m) => m.type === 'session_result');
  assert.ok(res && res.score === 500, 'session_result broadcast');

  c.ws.close();
  server.stop();
  console.log('control-server ok');
  process.exit(0);
})();
```

- [ ] **Step 7: Run it to verify it fails**

Run: `cd /c/dev/lightning_windows_v2.0.3_color_modes_and_help_fix && node tests/control-server.test.js`
Expected: FAIL — `Cannot find module '../lib/control-server'`.

- [ ] **Step 8: Write the control server**

Create `lib/control-server.js`:

```js
// lib/control-server.js — Strivex game control WebSocket server (localhost).
const { WebSocketServer } = require('ws');
const { EventEmitter } = require('events');

class ControlServer extends EventEmitter {
  constructor({ port = 4200, game = 'unknown', version = '0', protocol = 1 } = {}) {
    super();
    this.meta = { game, version, protocol };
    this.port = port;
    this.clients = new Set();
    this._ready = false;
  }
  start() {
    this.wss = new WebSocketServer({ host: '127.0.0.1', port: this.port });
    this.wss.on('connection', (ws) => {
      this.clients.add(ws);
      this._send(ws, { type: 'hello', ...this.meta });
      if (this._ready) this._send(ws, { type: 'ready' });
      ws.on('message', (data) => this._onMessage(data));
      ws.on('close', () => this.clients.delete(ws));
      ws.on('error', () => this.clients.delete(ws));
    });
    return this;
  }
  _onMessage(data) {
    let msg;
    try { msg = JSON.parse(data.toString()); } catch { return; }
    if (msg.type === 'unlock') this.emit('unlock', msg);
    else if (msg.type === 'lock') this.emit('lock', msg);
  }
  ready() { this._ready = true; this._broadcast({ type: 'ready' }); }
  result(payload) { this._ready = false; this._broadcast({ type: 'session_result', ...payload }); }
  _broadcast(obj) { for (const ws of this.clients) this._send(ws, obj); }
  _send(ws, obj) { try { ws.send(JSON.stringify(obj)); } catch { /* client gone */ } }
  stop() { this.wss && this.wss.close(); }
}
module.exports = { ControlServer };
```

- [ ] **Step 9: Run both game tests to verify they pass**

Run: `cd /c/dev/lightning_windows_v2.0.3_color_modes_and_help_fix && node tests/session-summary.test.js && node tests/control-server.test.js`
Expected: prints `session-summary ok` then `control-server ok`.

- [ ] **Step 10: Commit (game repo)**

```bash
cd /c/dev/lightning_windows_v2.0.3_color_modes_and_help_fix && git add package.json package-lock.json lib/control-server.js lib/session-summary.js tests/control-server.test.js tests/session-summary.test.js && git commit -m "feat: strivex control server + session summarizer"
```

---

## Task 4: Game main/preload/renderer wiring (lock → unlock → play → summary)

**Files:**
- Modify: `main.js:38-39`
- Modify: `preload.js`
- Modify: `config.json`
- Modify: `public/app.js`

**Interfaces:**
- Consumes: `ControlServer` (Task 3), `summarizeSession` (Task 3).
- Produces: renderer honors `control-unlock`/`control-lock` IPC and emits `control-result`/`control-ready`; game is unplayable without an `unlock`.

> **Note on testing:** the renderer runs inside Electron and has no headless harness here, so this task's verification is a **scripted manual run** (Steps 6–8) driven by a tiny fake gateway. The pure logic it relies on (`summarizeSession`) is already unit-tested in Task 3.

- [ ] **Step 1: Add control port to config**

Edit `config.json` — add a top-level key (near `"serial"`):

```json
  "control": { "port": 4200 },
```

- [ ] **Step 2: Expose control channels in preload**

Edit `preload.js` — add these to the `exposeInMainWorld('lightning', { ... })` object:

```js
  onControlUnlock: cb => ipcRenderer.on('control-unlock', (_e, p) => cb(p)),
  onControlLock: cb => ipcRenderer.on('control-lock', (_e, p) => cb(p)),
  controlResult: p => ipcRenderer.send('control-result', p),
  controlReady: () => ipcRenderer.send('control-ready'),
```

- [ ] **Step 3: Start the control server in main and bridge IPC**

Edit `main.js`. At the top with the other requires add:

```js
const { ControlServer } = require('./lib/control-server');
let control;
```

Inside `app.whenReady().then(async () => { ... })`, after `playerWindow` is created, add:

```js
  control = new ControlServer({ port: c.control?.port || 4200, game: 'lightning', version: app.getVersion(), protocol: 1 }).start();
  control.on('unlock', p => controlWindow?.webContents.send('control-unlock', p));
  control.on('lock', p => controlWindow?.webContents.send('control-lock', p));
  ipcMain.on('control-result', (_e, p) => control.result(p));
  ipcMain.on('control-ready', () => control.ready());
```

Update the quit handler to also stop control:

```js
app.on('before-quit', () => { bridge?.stop(); control?.stop(); });
```

- [ ] **Step 4: Renderer — locked state, unlock entry, disable guest/skip, round tracking, summary**

Edit `public/app.js`. Make these changes (control role only):

1. **Session context + rounds buffer.** Near the other `let` declarations (e.g. after `let sessionCardUids=...` on line ~104) add:

```js
let strivex = null;        // { session_id, uid, name } current paid session
let strivexRounds = [];    // [{mode,difficulty,score}] played this session
let paidTimer = null;      // paid-time budget timer
```

2. **Initial locked phase (control only).** Where initial `state` is created (line ~97), leave the object but immediately after the `state` assignment for the control role, force locked instead of idle:

```js
if (role === 'control') state.phase = 'locked';
```

3. **Locked render branch.** In the big `render()` phase chain (the `if/else if` on `state.phase` starting ~line 203), add a branch:

```js
    else if (state.phase === 'locked') app.innerHTML = `<section class="screen locked-screen">${brand()}<div class="lock-note">${T[lang].scan1 || 'Scan your bracelet'}</div>${language()}</section>`;
```

4. **Wire control IPC (control only).** After `render()`/init runs once (near the bottom where the app boots), add:

```js
if (role === 'control') {
  lightning.onControlUnlock(p => strivexUnlock(p));
  lightning.onControlLock(() => strivexEnd('completed', 'lock'));
  lightning.controlReady();
}

function strivexUnlock(p) {
  strivex = { session_id: p.session_id, uid: p.user?.uid || null, name: p.user?.name || null };
  strivexRounds = [];
  if (strivex.name) state.names[0] = strivex.name;
  // Load this bracelet's progression (keyed on uid) if present
  const db = cards();
  if (strivex.uid && db[strivex.uid]) {
    state.playerBasic[0] = !!db[strivex.uid].basicCompleted;
    state.sequenceHard[0] = !!db[strivex.uid].sequenceHardCompleted;
  }
  sessionCardUids[0] = strivex.uid;
  clearTimeout(paidTimer);
  if (p.paid_seconds > 0) paidTimer = setTimeout(() => strivexEnd('timeout', 'paid_time'), p.paid_seconds * 1000);
  state.phase = 'modes';
  publish();
}

function strivexEnd(status, reason) {
  if (!strivex) return;
  clearTimeout(paidTimer);
  const summary = summarizeSession(strivexRounds, { session_id: strivex.session_id, uid: strivex.uid, name: strivex.name, status });
  lightning.controlResult(summary);
  strivex = null; strivexRounds = [];
  endSession();                 // existing: clears profiles + returns to idle/menu
  state.phase = 'locked';
  publish();
  lightning.controlReady();
}
```

Add the require at the very top of `app.js` (it runs under Node integration off, but preload exposes nothing for this — so instead compute inline). **Because the renderer has no `require`, inline the summarizer**: copy the tiny `summarizeSession` body as a local function at the top of `app.js` rather than importing it (the canonical tested copy stays in `lib/session-summary.js`):

```js
function summarizeSession(rounds, { session_id, uid, name, status } = {}) {
  const scores = rounds.map(r => Number(r.score) || 0);
  const best = scores.length ? Math.max(...scores) : 0;
  const total = scores.reduce((a, b) => a + b, 0);
  return { session_id, score: best, status: status || (rounds.length ? 'completed' : 'abandoned'),
    meta: { rounds, best, total, player: { uid: uid ?? null, name: name ?? null } } };
}
```

5. **Record each round.** In `finish()` (line ~436), right after `save();`, push the round:

```js
    if (strivex) strivexRounds.push({ mode: state.mode, difficulty: state.difficulty || null, score: Math.max(state.scores[0], state.scores[1]) });
```

6. **Disable guest / skip-card entry.** In the click handler (~line 454-457):
   - The `action==='play'` guest branch: guard it so it only runs when `!strivex` is false — i.e., do nothing when running under Strivex control (entry is via unlock). Simplest: at the top of the handler add `if (role==='control' && !strivex && ['play','skipCard'].includes(action)) return;`
   - Leave `endSession` button working (operator can end early → but under Strivex, prefer the gateway's lock; keep as-is for now).

- [ ] **Step 5: Static sanity — the game still boots and existing tests pass**

Run: `cd /c/dev/lightning_windows_v2.0.3_color_modes_and_help_fix && npm run check`
Expected: all test lines print OK (engine, color, advanced, session-summary, control-server).

- [ ] **Step 6: Manual E2E — start the game and a fake gateway**

Start the game:

```bash
cd /c/dev/lightning_windows_v2.0.3_color_modes_and_help_fix && npm start
```

Expected: the control window shows the **locked** screen (no menu reachable).

- [ ] **Step 7: Drive it with a fake gateway client**

In a second terminal, create and run `scripts/fake-gateway.js` in the game repo:

```js
// scripts/fake-gateway.js — pretend to be the Strivex gateway for manual testing
const WebSocket = require('ws');
const ws = new WebSocket('ws://127.0.0.1:4200');
ws.on('open', () => {
  console.log('connected; unlocking…');
  ws.send(JSON.stringify({ type: 'unlock', session_id: 'TEST1', user: { uid: 'DEMO-UID', name: 'Demo' }, paid_seconds: 60 }));
});
ws.on('message', (d) => {
  const m = JSON.parse(d.toString());
  console.log('from game:', m);
  if (m.type === 'session_result') { console.log('GOT SUMMARY:', JSON.stringify(m)); process.exit(0); }
});
```

Run: `cd /c/dev/lightning_windows_v2.0.3_color_modes_and_help_fix && node scripts/fake-gateway.js`

Expected: the game leaves the locked screen and shows the mode menu with player name "Demo". Play a round to the end (or wait 60 s for the paid-time expiry). The fake gateway prints a `session_result` summary with `score`, `status`, and `meta.rounds`.

- [ ] **Step 8: Commit (game repo)**

```bash
cd /c/dev/lightning_windows_v2.0.3_color_modes_and_help_fix && git add main.js preload.js config.json public/app.js scripts/fake-gateway.js && git commit -m "feat: lock/unlock control flow + paid-time session + result summary"
```

---

## Task 5: End-to-end against the real gateway + docs

**Files:**
- Modify: `gateway/.env` (local only — not committed)
- Modify: `server/README.md` (document the gameserver adapter + protocol) — optional but recommended.

**Interfaces:**
- Consumes: everything from Tasks 1–4.

- [ ] **Step 1: Point the gateway at the running game**

In `gateway/.env` set:

```
STATION_ID=lightning
SERVER_URL=http://127.0.0.1:3000
ADAPTER=gameserver
GAME_WS_URL=ws://127.0.0.1:4200
STATION_KEY=change-me-station-secret
```

- [ ] **Step 2: Run the full stack**

1. Start the Strivex server (`cd /c/dev/Strivex/server && npm run start`).
2. Start the game (`npm start` in the game repo) — locked screen.
3. Start the gateway (`cd /c/dev/Strivex/gateway && npm start`). Expect `[gameserver] connected` and `[gameserver] game=lightning`.
4. Register a bracelet at the desk UI so a session exists, then use the gateway's local Simulate/tap path (or a real NFC tap) with that bracelet's UID.

Expected: the game unlocks for the registered user; after a round (or paid-time expiry) the gateway logs a result and `POST /results` records **one** summary row for the session; the live "In game now" board shows the mapping during play and clears on lock.

- [ ] **Step 3: Verify the recorded result**

Check the server records (desk UI history or the DB) — one row for the session, `value` = best score, detail in `meta`.

- [ ] **Step 4: Document the adapter (Strivex repo)**

Add a short "gameserver adapter + Game Control Protocol" section to `server/README.md` (or the gateway docs), linking the spec. Then:

```bash
cd /c/dev/Strivex && git add server/README.md && git commit -m "docs: gameserver adapter and game control protocol"
```

- [ ] **Step 5: Push both branches**

```bash
cd /c/dev/Strivex && git push -u origin feat/game-control-protocol
cd /c/dev/lightning_windows_v2.0.3_color_modes_and_help_fix && git push -u origin feat/strivex-control-protocol
```

(Confirm remotes/PRs with the user before pushing.)

---

## Self-Review notes

- **Spec coverage:** responsibility split (Tasks 2,4), lock/unlock lifecycle (Tasks 3,4), protocol messages (Tasks 1,3), single USB reader / no `scan` (design decision, nothing to build), no-bracelet-no-play (Task 4 Step 4.6), watchdog fix (Task 2 Step 4), one summary per session (Tasks 3,4), single-player v1 (Task 4 uses player 0 only), error handling — unreachable/crash/dup (Task 1 tests + reconnect), testing (Tasks 1,3 automated; 4,5 manual E2E). All covered.
- **Two-repo commits:** gateway on `feat/game-control-protocol`, game on `feat/strivex-control-protocol`.
- **Renderer caveat:** `summarizeSession` is intentionally duplicated inline in `app.js` (no `require` in the sandboxed renderer); the canonical tested copy lives in `lib/session-summary.js`. Keep them in sync.
