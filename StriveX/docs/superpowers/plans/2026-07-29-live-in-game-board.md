# Live "In game now" board Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface, live on the Desk tab, which bracelet is in a game on which attraction — plus how long it has been playing.

**Architecture:** The bracelet↔attraction mapping only exists live inside the gateway (`current.session_id`). The gateway already heartbeats each station every 30s; we extend that heartbeat to carry the active `session_id` + `started_at`, store them on the `stations` row, and join them out to the bracelet/guest in `GET /stations`. The Desk UI renders an "In game now" table under Overdue. No new polling path, no new gateway timer, and the 120s result-based watchdog is untouched.

**Tech Stack:** NestJS + better-sqlite3 (server), plain ESM Node (gateway), vanilla HTML/JS (desk UI), Jest + ts-jest (server tests).

## Global Constraints

- SQLite via better-sqlite3, synchronous prepared statements — match existing `stations.service.ts` style.
- Migrations are idempotent and run on every boot from `DbService.migrate()`.
- The watchdog (`GAME_TIMEOUT_MS`, default 120000) is **result-based** and MUST NOT be changed or made heartbeat-driven.
- Timestamps crossing the wire are ISO-8601 UTC strings (e.g. `2026-07-29T05:00:00.000Z`); stored verbatim as TEXT.
- Auth: `GET /stations` and the heartbeat endpoint keep their existing `@RequireKey` guards; dev runs with `AUTH_DISABLED=1`.

---

### Task 1: Server — store & expose the live mapping (TESTED)

**Files:**
- Modify: `server/src/db/db.service.ts` (add two columns via idempotent guard)
- Modify: `server/src/stations/stations.service.ts` (`heartbeat`, `list`)
- Modify: `server/src/stations/stations.controller.ts` (`HeartbeatDto`, handler)
- Test: `server/src/stations/stations.service.spec.ts` (create)

**Interfaces:**
- Produces: `StationsService.heartbeat(id: string, status?: string, sessionId?: string | null, startedAt?: string | null): { ok: true }`
- Produces: `StationsService.list()` rows now include `current_uid`, `current_label`, `current_username`, `current_started_at` (all nullable) plus existing `id, name, status, last_seen_at, offline`.

- [ ] **Step 1: Write the failing test**

Create `server/src/stations/stations.service.spec.ts`:

```ts
import { DbService } from '../db/db.service';
import { StationsService } from './stations.service';

function seed(db: DbService) {
  db.raw.prepare(`INSERT INTO users (id, username) VALUES ('u1','mikhail')`).run();
  db.raw.prepare(`INSERT INTO bracelets (uid, label) VALUES ('AA1','B-001')`).run();
  db.raw.prepare(`INSERT INTO sessions (id, user_id, bracelet_uid, expires_at)
    VALUES ('sess1','u1','AA1', datetime('now','+60 minutes'))`).run();
  db.raw.prepare(`INSERT INTO stations (id, name) VALUES ('grip','Grip Strength')`).run();
}

describe('StationsService live mapping', () => {
  let db: DbService;
  let svc: StationsService;

  beforeEach(() => {
    process.env.DB_PATH = ':memory:';
    db = new DbService();
    svc = new StationsService(db);
    seed(db);
  });
  afterEach(() => db.onModuleDestroy());

  it('records current bracelet + guest when a session heartbeats', () => {
    svc.heartbeat('grip', 'in_game', 'sess1', '2026-07-29T05:00:00.000Z');
    const row: any = svc.list().find((r: any) => r.id === 'grip');
    expect(row.status).toBe('in_game');
    expect(row.current_uid).toBe('AA1');
    expect(row.current_label).toBe('B-001');
    expect(row.current_username).toBe('mikhail');
    expect(row.current_started_at).toBe('2026-07-29T05:00:00.000Z');
  });

  it('clears the mapping on an idle heartbeat', () => {
    svc.heartbeat('grip', 'in_game', 'sess1', '2026-07-29T05:00:00.000Z');
    svc.heartbeat('grip', 'idle');
    const row: any = svc.list().find((r: any) => r.id === 'grip');
    expect(row.status).toBe('idle');
    expect(row.current_uid).toBeNull();
    expect(row.current_started_at).toBeNull();
  });

  it('throws for an unknown station', () => {
    expect(() => svc.heartbeat('nope', 'idle')).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npm test -- stations.service`
Expected: FAIL — `list()` rows have no `current_uid` (undefined ≠ 'AA1'), because the columns/join don't exist yet.

- [ ] **Step 3: Add the columns (idempotent) in `db.service.ts`**

Add this private helper to `DbService`:

```ts
  private addColumnIfMissing(table: string, column: string, ddl: string) {
    const cols = this.raw.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
    if (!cols.some((c) => c.name === column)) {
      this.raw.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
    }
  }
```

At the end of `migrate()`, after the existing `this.raw.exec(\`...\`);` block:

```ts
    this.addColumnIfMissing('stations', 'current_session_id', 'current_session_id TEXT');
    this.addColumnIfMissing('stations', 'current_started_at', 'current_started_at TEXT');
```

- [ ] **Step 4: Update `stations.service.ts`**

Replace `heartbeat`:

```ts
  heartbeat(id: string, status?: string, sessionId?: string | null, startedAt?: string | null) {
    const r = this.db.raw.prepare(
      `UPDATE stations
         SET status = ?, last_seen_at = datetime('now'),
             current_session_id = ?, current_started_at = ?
       WHERE id = ?`
    ).run(status ?? 'idle', sessionId ?? null, startedAt ?? null, id);
    if (r.changes === 0) throw new NotFoundException('station not registered');
    return { ok: true };
  }
```

Replace `list`:

```ts
  list() {
    return this.db.raw.prepare(`
      SELECT st.id, st.name, st.status, st.last_seen_at,
        st.current_started_at,
        b.uid      AS current_uid,
        b.label    AS current_label,
        u.username AS current_username,
        CASE WHEN st.last_seen_at IS NULL OR st.last_seen_at < datetime('now','-90 seconds')
          THEN 1 ELSE 0 END AS offline
      FROM stations st
      LEFT JOIN sessions s  ON s.id = st.current_session_id
      LEFT JOIN bracelets b ON b.uid = s.bracelet_uid
      LEFT JOIN users u     ON u.id = s.user_id
    `).all();
  }
```

- [ ] **Step 5: Update `stations.controller.ts`**

Extend `HeartbeatDto` and the handler:

```ts
class HeartbeatDto {
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() session_id?: string;
  @IsOptional() @IsString() started_at?: string;
}
```

```ts
  @RequireKey('station')
  @Post(':id/heartbeat')
  heartbeat(@Param('id') id: string, @Body() dto: HeartbeatDto) {
    return this.stations.heartbeat(id, dto.status, dto.session_id, dto.started_at);
  }
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd server && npm test -- stations.service`
Expected: PASS (3 tests).

- [ ] **Step 7: Commit**

```bash
git add server/src/db/db.service.ts server/src/stations/stations.service.ts server/src/stations/stations.controller.ts server/src/stations/stations.service.spec.ts
git commit -m "feat(server): store and expose live bracelet-to-station mapping"
```

---

### Task 2: Gateway — report the active game in the heartbeat

**Files:**
- Modify: `gateway/src/api.js` (`heartbeat` body)
- Modify: `gateway/src/index.js` (heartbeat loop + push on game start/finish)

**Interfaces:**
- Consumes: `POST /stations/:id/heartbeat` now accepting `{ status, session_id, started_at }` (Task 1).
- Produces: `api.heartbeat(stationId, status, session?)` where `session` is the gateway's `current` object (`{ session_id, startedAt, ... }`) or falsy when idle.

- [ ] **Step 1: Update `gateway/src/api.js`**

Replace the `heartbeat` method:

```js
  async heartbeat(stationId, status, session) {
    const res = await raw('POST', `/stations/${stationId}/heartbeat`, {
      status,
      session_id: session?.session_id ?? null,
      started_at: session ? new Date(session.startedAt).toISOString() : null,
    });
    if (!res.ok) throw new Error(`heartbeat -> ${res.status}`);
    return res.json();
  },
```

- [ ] **Step 2: Update `gateway/src/index.js` — factor a `sendHeartbeat`, push on transitions**

Replace the existing `setInterval(() => { api.heartbeat(...) }, config.heartbeatIntervalMs);` block with:

```js
function sendHeartbeat() {
  return api.heartbeat(config.stationId, current ? 'in_game' : 'idle', current)
    .catch((e) => console.warn('[gateway] heartbeat failed:', e.message));
}
setInterval(sendHeartbeat, config.heartbeatIntervalMs);
```

In `onTap`, immediately after `adapter.startGame(current.session_id);` add:

```js
  sendHeartbeat(); // push the in-game mapping to the desk without waiting for the interval
```

In `finish`, after `setCurrent(null);` add:

```js
  sendHeartbeat(); // push the cleared mapping to the desk immediately
```

- [ ] **Step 3: Manual integration check**

Start the server and gateway in manual mode (repo root): `npm run dev` (or the documented dev launcher). Then, with a bracelet already bound to a session (Desk steps 1–2), drive a tap from the gateway sim panel and confirm the mapping landed:

Run: `curl -s http://localhost:3000/stations` (add `-H "X-Api-Key: <desk key>"` if `AUTH_DISABLED` is not set)
Expected: the played station shows `"status":"in_game"`, a non-null `"current_uid"`, and a `"current_started_at"` ISO timestamp. After a `/sim/result` (or 120s watchdog), the same call shows `current_uid: null`.

- [ ] **Step 4: Commit**

```bash
git add gateway/src/api.js gateway/src/index.js
git commit -m "feat(gateway): report active session in station heartbeat"
```

---

### Task 3: Desk UI — "In game now" card + Stations bracelet column

**Files:**
- Modify: `server/public/index.html` (Desk markup, `loadLive`, `loadStations`, refresh loop)

**Interfaces:**
- Consumes: `GET /stations` rows with `current_uid`, `current_label`, `current_username`, `current_started_at`, `offline` (Task 1).

- [ ] **Step 1: Add the card markup under Overdue**

In `#tab-desk`, immediately after the closing `</div>` of the "Overdue bracelets" card (currently ends at line ~117), add:

```html
    <div class="card" style="margin-top:16px">
      <h2>In game now · auto-refresh 5s</h2>
      <div id="live"><div class="empty">No games in progress.</div></div>
    </div>
```

- [ ] **Step 2: Add `loadLive()` and an elapsed formatter**

In the `<script>`, next to `loadStations`, add:

```js
// ---- live "in game now" board ----
function fmtElapsed(startedAt) {
  if (!startedAt) return '—';
  const s = Math.max(0, Math.floor((Date.now() - Date.parse(startedAt)) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
async function loadLive() {
  try {
    const rows = (await api('GET', '/stations'))
      .filter((r) => r.status === 'in_game' && r.current_uid && !r.offline);
    $('live').innerHTML = rows.length ? tbl(
      ['Attraction', 'Bracelet', 'Guest', 'In game for'],
      rows.map((r) => [
        r.name,
        `${r.current_label || ''} <span style="color:var(--dim)">${r.current_uid}</span>`,
        r.current_username || '—',
        `<span class="num">${fmtElapsed(r.current_started_at)}</span>`,
      ])
    ) : '<div class="empty">No games in progress.</div>';
  } catch { /* key not set yet */ }
}
```

- [ ] **Step 3: Add a Bracelet column to the Stations tab**

Replace the `loadStations` table render with (adds the `Bracelet` column):

```js
    $('stations').innerHTML = rows.length ? tbl(
      ['', 'Station', 'Bracelet', 'Status', 'Last seen'],
      rows.map((r) => [
        `<span class="light ${r.offline ? 'off' : (r.status === 'in_game' ? 'busy' : 'on')}"></span>`,
        `${r.name} <span style="color:var(--dim)">${r.id}</span>`,
        r.current_uid ? `${r.current_label || ''} <span style="color:var(--dim)">${r.current_uid}</span>` : '—',
        r.offline ? 'OFFLINE' : r.status,
        r.last_seen_at ? r.last_seen_at + ' UTC' : '—',
      ])
    ) : '<div class="empty">No stations registered yet.</div>';
```

- [ ] **Step 4: Wire the refresh loop**

Change `refreshAll` to include the live board, and add a 5s interval:

```js
function refreshAll() { loadOverdue(); loadStations(); loadStats(); loadLive(); }
```

Below the existing `setInterval(...)` calls at the bottom, add:

```js
setInterval(loadLive, 5000);
```

- [ ] **Step 5: Manual end-to-end verification (browser + sim panel)**

Start server + gateway (manual adapter). Open the desk UI (`http://localhost:3000`). With a bracelet bound to a session:
1. Sim panel → tap. Within ~5s the Desk "In game now" card shows a row: attraction · bracelet (label + uid) · guest · a ticking `In game for` timer. Stations tab shows the same bracelet in its new column.
2. Sim panel → result. Within ~5s the row disappears and the station returns to idle.
3. Let a game run past 120s with no result → watchdog releases; the row disappears after the cleared heartbeat.

- [ ] **Step 6: Commit**

```bash
git add server/public/index.html
git commit -m "feat(ui): live 'In game now' board and stations bracelet column"
```

---

## Self-Review

**Spec coverage:**
- Data columns `current_session_id` / `current_started_at` → Task 1 Step 3. ✓
- Gateway heartbeat carries session → Task 2 Steps 1–2. ✓
- Server `heartbeat` writes / `list` joins / DTO → Task 1 Steps 4–5. ✓
- Desk "In game now" card under Overdue with elapsed → Task 3 Steps 1–2, 4. ✓
- Stations tab bracelet column → Task 3 Step 3. ✓
- Watchdog untouched → no task modifies it. ✓
- Testing (manual sim flow) → Task 2 Step 3, Task 3 Step 5; plus automated unit tests Task 1. ✓

**Placeholder scan:** none — every code step has concrete content.

**Type consistency:** `current_uid` / `current_label` / `current_username` / `current_started_at` used identically across Task 1 (SQL aliases), Task 3 (UI reads). `sendHeartbeat` / `api.heartbeat(stationId, status, session)` consistent across Task 2. `heartbeat(id, status, sessionId, startedAt)` consistent across service + controller.

## Notes for the implementer

- Bonus UX in Task 2: pushing a heartbeat on game start/finish means the desk updates within a couple seconds instead of waiting up to 30s for the interval.
- The live board filters out `offline` stations, so a crashed gateway's stale `current_*` row won't linger as a phantom game.
- The elapsed timer refreshing every 5s doubles as an early warning before the 120s watchdog fires — a row climbing toward 2:00 is about to auto-release.
