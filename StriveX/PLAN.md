# StriveX — Implementation Plan (v2)

Updated with: bracelet-as-rotating-key model (sessions + TTL), user accounts,
attempt-level analytics, station gateway architecture.

---

## Core data model (defined now, stable through all stages)

```
users        — permanent account: id, username, email, name, password_hash, created_at
               (Quick Guest Mode = auto-generated username, no email/password — same table)

bracelets    — physical inventory: uid (NFC UID), label ("B-042"), active flag
               One bracelet serves many people per day.

sessions     — temporary binding user <-> bracelet with TTL:
               id, user_id FK, bracelet_uid FK, started_at, expires_at (start + 1h), returned_at
               UNIQUE(bracelet_uid) WHERE returned_at IS NULL  -- one active session per bracelet
               TTL enforcement = "expires_at > now" check at lookup. No cron.

stations     — registry + liveness: id, name, status, last_seen_at
               Identity/status in DB; connection config stays in gateway .env.

results      — attempt log (NOT success log): id, session_id FK, station_id FK,
               value (nullable), status (completed|failed|abandoned|timeout),
               duration_ms, meta JSON (per-game: level_reached, errors, fail_reason),
               created_at
               References session, not user -> results tied to the visit;
               history stays correct after bracelet rebinding.
```

Key rules:
- Log every attempt, including abandoned ones (drop-off is invisible otherwise).
- `meta` JSON is optional per game — level games fill it, grip strength leaves it empty.
- All future features (leaderboards, Arena Score, Team Mode) hang off sessions/results.

## Guest flow

1. **Registration desk**: create account or login -> tap bracelet ->
   POST /sessions -> expires_at = now + 1h.
2. **Station**: gateway taps -> GET /lookup/:uid -> active, unexpired session?
   -> { session_id, user_id, username } | 403 expired | 404 no session.
3. **Play**: gateway starts game via adapter, posts result with session_id + status + meta.
4. **Return desk**: tap -> POST /sessions/:id/return -> bracelet reusable immediately.

## Architecture (current stage)

```
[registration terminal] --HTTP--> [server: Node + SQLite (Docker)] <--HTTP-- [station gateway(s)]
                                                                                  |
                                                                        [game adapter: mock|serial|gpio]
                                                                                  |
                                                                            [game / MCU]
```

- Server: NestJS (TypeScript) + SQLite (WAL). Docker Compose, restart: unless-stopped.
  Global ApiKeyGuard (fail-closed: routes without @RequireKey/@Public are rejected);
  DTO validation via class-validator; modules: users/bracelets/sessions/stations/results.
  Nest chosen for: guards enforce auth-by-default rule, built-in WS (St.3) + gRPC (St.7) transports.
- Gateway: one codebase per station box (Pi/mini-PC), native (USB NFC + pcscd),
  configured via .env. Heartbeats every 30s -> stations.last_seen_at, and carry the
  active session_id/started_at so the desk shows live bracelet<->attraction mapping.
- Serial protocol MCU<->gateway: START:<id> / DENY out; RESULT / ERROR / READY in.
  Extend RESULT to carry status + optional JSON meta.
- Firmware stays dumb: sensors + UART protocol. No WiFi/HTTP/NFC on MCU.

## Analytics available immediately (plain SQL on results)

- Popularity: attempts per station
- Failure/drop-off: status breakdown per station; level_reached distribution from meta
- Engagement: attempts per session per station (retry rate)
- Utilization: heartbeat status history (in_game vs idle)

No ClickHouse/dashboards yet — single-venue volume is milliseconds in SQLite/Postgres.

---

## Staged roadmap (add tech only when its trigger appears)

**Stage 1 — DONE (concept): bracelet-as-key registration + lookup**

**Stage 2 — CURRENT: accounts, sessions/TTL, first station via gateway**
- users/bracelets/sessions/results schema above
- bcrypt/argon2 password hashing; return-desk flow
- Gateway + mock/serial adapters; attempt logging with status/meta
- Stack: Node + SQLite in Docker, native gateways. Nothing else.

**Deferred (known, not built): per-station repeat cooldown.**
TTL limits duration, not usage — one guest can hog a station all hour. Acceptable for now.
If busy days show hogging: add cooldown check at lookup (last result timestamp for session+station).

**Stage 3 — Leaderboard screens**
- Trigger: a display must update on every new result.
- Add: WebSockets push from server. Leaderboard = SQL ORDER BY. Still no Redis.

**Stage 4 — Multiple sensor stations (embedded)**
- Trigger: MCUs on WiFi instead of USB-tethered boxes; concurrent writers grow.
- Add: MQTT broker (LWT replaces heartbeat polling, QoS1, retained messages).
  Switch SQLite -> Postgres. Gateways swap HTTP->MQTT internally; adapters/firmware unchanged.

**Stage 5 — Many stations, rankings everywhere**
- Trigger: leaderboard reads + attempt-balance checks on every tap start to cost.
- Add: Redis (Sorted Sets, session cache) + internal event bus
  (attempt.completed -> leaderboard writer / logger / score calculator).
- Add pass model here: pass_type + attempts_remaining on sessions
  (Quick 5 / Standard 15 / Full 25 / Team / Event-day), decrement per tap.

**Stage 6 — Analytics & Arena Score at scale**
- Trigger: raw telemetry streams (RPM ticks, keystrokes) + seasonal min/max normalization.
- Add: ClickHouse + CDC (ClickPipes/PeerDB). results table streams in unchanged.
- Arena Score: minmax normalization per discipline, weighted sum, M/N multiplier
  (watch low-M edge cases), category leaderboards (8 categories), 6 time scopes
  via materialized views, titles/badges rules engine at photo-zone scan.

**Stage 7 — Terminal fleet & duels**
- Trigger: typed contracts across Electron+Unity clients; duel coordination streaming.
- Add: gRPC. Introduce "match" concept for duel stations (2-4 players, shared hardware)
  — distinct from single-player attempt.

**Stage 8 — Team Mode, event-day mode, photo wall, cloud**
- team_id on sessions; aggregate team score views
- Event-day config flag: shortened packages, auto-nickname fast registration
- Photo pipeline: Node + Sharp/libvips compositing, QR delivery
- Cloud: outbox pattern in Postgres, central profiles, cross-location sync

## Risk management

See RISKS.md — living risk register with priorities (P0 fix-before-doors-open ... P3 accepted).
Re-read at every stage kickoff. Current P0 set: API auth (shared-secret + VLAN), gateway game
watchdog, crash-safe current-game persistence, credentials decision (passwords vs nickname-only),
desk throughput (Quick Guest default + QR pre-registration), 5-min SQLite backups.
Monitoring (health endpoint + external watchdog + staff stations screen + login audit log
+ rate limiting) is P1 in the current stage.

## Durability (server box, all stages)

- Docker Compose + restart policies + healthchecks; systemd wraps compose
- SQLite: WAL + file backups -> later Postgres: WAL archiving + nightly basebackup
- Redis (when added): AOF everysec, treated as rebuildable cache
- Cloud outage: outbox table, flush on reconnect

## Non-goals for now

Kubernetes, remote device config management, digital queueing,
NDEF writes to bracelets (UID-only confirmed), gRPC before Unity terminals exist.
