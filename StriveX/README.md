# StriveX Stage 2 (v2) — Accounts, TTL Sessions, Attempt Analytics

See PLAN.md for the full staged roadmap.

## Model
users (permanent, guest-mode supported) <- sessions (bracelet binding, 1h TTL) -> bracelets (inventory)
results reference session_id -> every attempt logged (completed|failed|abandoned|timeout) + duration + meta JSON.
One bracelet serves many people per day; return desk frees it instantly.

## Endpoints
POST /users            {username,email,name,password} or {username,guest:true}
POST /login            {email,password}
POST /bracelets        {uid,label}            — inventory
POST /sessions         {user_id,bracelet_uid} — registration desk, TTL starts (SESSION_TTL_MINUTES, default 60)
POST /sessions/:id/return | POST /bracelets/:uid/return — return desk
GET  /lookup/:uid      — station auth: 200 {session_id,user_id,username} | 403 expired | 404 none
POST /results          {session_id,station_id,value?,status?,duration_ms?,meta?}
POST /stations {id,name} | POST /stations/:id/heartbeat {status?,session_id?,started_at?} — self-registers, reports live game | GET /stations — board + current bracelet/guest per station
GET  /stats/stations   — attempts, completion/failure/abandon counts, retry rate

## Staff UI
Open http://localhost:3000/ in a browser — single-page desk terminal:
- Desk tab: create guest (or quick auto-name), start 1h session by bracelet tap/UID, return / force-release, live overdue list, and "In game now" board — which bracelet is playing on which attraction + elapsed timer, 5s refresh
- Stations tab: board with online/busy/offline lights (heartbeats) + current bracelet per station, 15s refresh
- Stats tab: attempts / completed / failed / abandoned / timeout / retry-rate per station
- Setup tab: paste DESK_KEY once per browser session; add bracelets & stations
Works with a USB NFC reader in keyboard-emulation mode (focus the UID field, tap). With AUTH_DISABLED=1 no key needed.

## Auth
All endpoints except GET /health require X-Api-Key header:
  DESK_KEY    — desk terminals: /users /login /sessions /bracelets* /stations (admin) /stats
  STATION_KEY — gateways: /lookup /results /stations/:id/heartbeat
Set both as server env vars. Unset key = endpoints disabled (fail closed). AUTH_DISABLED=1 for local dev.
Gateway sends its key from STATION_KEY in .env. /login is rate-limited (5/15min).

## Run
cp server/.env.example .env   # set DESK_KEY / STATION_KEY
docker compose up -d          # server (SQLite in ./data volume)
# dev without docker: cd server && npm i && AUTH_DISABLED=1 npm run start:dev
cd gateway && cp .env.example .env && npm install && npm start   # per-station, native

## Offline resilience (gateway outbox)
Every result is written to gateway/data/ BEFORE the first send attempt:
- results.jsonl  — append-only local audit copy of everything this station produced
- pending.jsonl  — not-yet-confirmed queue, auto-flushed every 5s with retries
Gateway generates the result UUID -> server INSERT OR IGNORE -> retries never duplicate.
Server down = games keep finishing, results queue locally, sync on reconnect. Survives gateway restarts.

## Station health vs game watchdog
Two independent mechanisms, easy to confuse:
- Heartbeat / health (every HEARTBEAT_MS, default 30s): gateway reports idle|in_game plus the active session_id/started_at -> stations.last_seen_at (+ live desk mapping). Station shows OFFLINE after 90s unseen. Health only.
- Game watchdog (GAME_TIMEOUT_MS, default 120s): if a started game returns no RESULT within the window, the gateway force-releases the station as `timeout` (log: `WATCHDOG: no result after 120000ms, releasing station`). Result-based by design — a hung MCU keeps heartbeating in_game, so health can never keep a stuck game alive. Raise GAME_TIMEOUT_MS for longer demos; the desk "In game now" elapsed timer warns before it fires.

## Serial protocol v2 (gateway <-> game MCU)
Gateway -> MCU:  START:<session_id>\n | DENY:<reason>\n
MCU -> Gateway:  RESULT:<number>[:<json meta>]\n | FAILED[:<json meta>]\n | TIMEOUT\n | ERROR:<msg>\n | READY\n

## gameserver adapter + Game Control Protocol (gateway <-> game, WebSocket)
`ADAPTER=gameserver` drives a real attraction game (e.g. the Lightning attraction) instead of a
serial MCU. Configure with `GAME_WS_URL` (default `ws://127.0.0.1:4200`). The **gateway is the WS
client**; it connects to the game's local control server and auto-reconnects on drop. This adapter
manages its own paid-time deadline, so the gateway's fixed station watchdog (`GAME_TIMEOUT_MS`) is
skipped for it — the authoritative "session over" signal is the game's `session_result`.

JSON-over-WebSocket, one object per frame:

Gateway -> Game:  `{type:"unlock", session_id, user:{uid,name}, paid_seconds}` | `{type:"lock", reason}`
Game -> Gateway:  `{type:"hello", game, version, protocol}` | `{type:"ready"}` | `{type:"session_result", session_id, score, status, meta}`

`session_result.status` is `completed` | `timeout` | `abandoned` | `failed`; `score` is the best score of the
session (recorded as `/results.value`), with round-by-round detail in `meta`.

Full design and rationale: `docs/superpowers/specs/2026-07-31-gateway-game-control-protocol-design.md`.

## Adding a new game

Two paths, depending on how the game talks to the gateway.

### A. WebSocket game (the common case — reuse the `gameserver` adapter)

If the new game can run a local control server, it needs **no gateway changes** — only
config. On the game side, build on the shipped client library
(`strivex-game-client/`, zero deps) so you don't hand-wire the wire protocol:

1. `npm install file:../Strivex/strivex-game-client` in the game.
2. In the main process, run a `StrivexSession` (see `strivex-game-client/README.md` for the
   Electron wiring): it opens the control server, owns the authoritative paid-time timer,
   and emits `unlock` / `lock` / `tick` / `expired`.
3. On session end, call `session.reportResult(score, status, meta)` exactly once — `status`
   must be one of `completed | timeout | abandoned | failed` (anything else throws).
4. Point the gateway at it: `ADAPTER=gameserver` and `GAME_WS_URL=ws://127.0.0.1:<port>`
   (default `ws://127.0.0.1:4200`) in the gateway `.env`. Done.

The three game→gateway messages the game must produce (`hello`, `ready`, `session_result`)
and the two it consumes (`unlock`, `lock`) are the protocol above.

### B. New adapter type (different transport/hardware)

For a game that isn't WebSocket (new serial dialect, HTTP, GPIO, etc.), add an adapter:

1. Create `gateway/src/adapters/<name>.js` — an `EventEmitter` implementing the **adapter
   contract** documented at the top of `gateway/src/adapters/index.js`:
   - `startGame(sessionId, session)` — tell the game to unlock/start.
   - `deny()` — optional "not authorized" signal.
   - Emit an outcome: either the legacy `result`/`failed`/`timeout` events (like
     `serial.js`) **or** the unified `session` `{ value, status, meta }` event (like
     `gameserver.js`). Emit `error` on failure so the gateway resets to idle.
   - Set `this.managesTimeout = true` if the adapter owns its own paid-time deadline;
     otherwise the gateway arms its fixed `GAME_TIMEOUT_MS` watchdog for you.
2. Register it in `createAdapter()` in `gateway/src/adapters/index.js` (add a `case`).
3. Add its config knobs to `gateway/src/config.js` and document them in `.env.example`.
4. Add a `node --test` suite under `gateway/test/` (see `gameserver.test.js` as a template).

Use `serial.js` (legacy events, gateway-managed watchdog) or `gameserver.js`
(unified `session` event, self-managed deadline) as the reference to copy from.
