# StriveX — Risk Register & Mitigation Plan

Rule: every item has an owner stage. Nothing ships to production ("doors open")
with a P0 unresolved. Review this file at the start of each stage.

Priorities: P0 = fix before doors open | P1 = fix during current stage | P2 = scheduled later | P3 = accepted risk, revisit on trigger

---

## P0 — before doors open

### R1. No API authentication
Anyone on venue network can forge results, create users, kick guests (return endpoint).
- [x] Shared-secret header (`X-Api-Key`) — server middleware, fail-closed if key unset (AUTH_DISABLED=1 for dev)
- [x] Separate keys per device class (DESK_KEY / STATION_KEY env vars)
- [ ] Server + stations on staff VLAN, isolated from guest WiFi
- Stage: current (Stage 2). Effort: ~half a day.

### R2. Gateway game watchdog missing
Hung MCU / game never responds -> station locked forever ("current" never cleared).
- [x] Gateway watchdog (GAME_TIMEOUT_MS, default 120s) -> logs `timeout` attempt, releases station
- Stage: current. Effort: ~1 hour. This is a bug, will fire with real hardware.

### R3. Result lost on gateway restart mid-game
MCU sends RESULT after gateway reboot -> current==null -> result dropped.
- [x] current.json persisted on start, restored on boot, cleared on finish
- [x] Restored game older than watchdog limit -> logged as `abandoned` (crash_recovery meta)
- Stage: current. Effort: ~1 hour.

### R4. Plaintext credentials on LAN
/login carries reusable email+password unencrypted.
- [ ] Decision first: do we need passwords at all for 1h visits? Alternatives: nickname-only guest flow + optional account claim later via email link
- [ ] If passwords stay: self-signed TLS on the server, gateways/desk pin the cert
- Stage: decision now, implementation current stage.

### R7. Registration desk throughput (operational, not code)
120/hr = 1 guest per 30s sustained; manual account entry takes 2-3 min.
- [ ] Quick Guest Mode as the DEFAULT desk flow (auto nickname, zero typing) — API already supports it
- [ ] Self-serve pre-registration: QR at entrance -> guest signs up on own phone -> desk only taps bracelet
- [ ] Measure: time-per-registration during first live day
- Stage: desk UI work, current stage. This is the real capacity ceiling.

### R8. No backups (single SQLite file = whole day)
- [ ] Cron: sqlite3 .backup to second disk/USB every 5 min, keep last 24
- [ ] Documented restore procedure, tested once (restore drill, ~15 min)
- Stage: current. Effort: ~1 hour.

---

## P1 — current stage hardening

### R5. Results accepted for long-expired sessions
Combined with R1 enables historical forgery; alone enables stale-client bugs.
- [x] /results rejects >10min past expiry (410), in-grace results accepted
- Stage: current. Effort: minutes.

### R6. No payload limits
- [x] express.json limit 16kb
- Stage: current. Effort: minutes.

### R10. Monitoring & alerting (flagged as important)
Right now the server can die silently; you learn from guest complaints.
Minimal viable monitoring for one venue — no Prometheus stack needed yet:
- [x] GET /health (public, checks DB)
- [ ] Watchdog script on a SECOND machine (or desk terminal): curl /health every 30s; on 3 failures -> local alarm (sound/notification) + optionally Telegram/SMS webhook
- [ ] Stations page (/stations offline flag) rendered on a staff screen — heartbeats already exist
- [ ] Daily one-line digest: attempts, unique guests, overdue bracelets, error count (cron + script)
- [ ] Server logs to file with rotation (pino + logrotate), not just stdout
- Stage: current. Effort: ~1 day total.
- Later trigger (Stage 4+, multiple embedded stations): Prometheus + Grafana + MQTT LWT replaces curl watchdog.

### R11. Structured audit logging (flagged as important: logins)
- [ ] Log every auth event: login success/fail (email, IP, timestamp), session bind/return, force-release — append-only audit table or JSONL file
- [x] /login rate-limited: 5 attempts / 15 min per email+IP (in-memory)
- [ ] Never log passwords or hashes
- Stage: current. Effort: ~2 hours.

---

## P2 — scheduled, with named trigger

### R12. Station hogging / repeat cooldown
Trigger: busy-day observation. Fix: cooldown check at /lookup (last result for session+station). Already in PLAN.md.

### R13. Gateway offline authorization
Trigger: first real incident of server downtime during operating hours.
Fix: short local cache of recently-authorized sessions (TTL-aware) on gateway. Outbox already covers the result side.

### R14. Force-release UX for stuck bracelets
Overdue report exists; desk UI needs a one-tap force-release button (calls /bracelets/:uid/return).
Stage: with desk UI build.

### R15. Duel stations break single-guest gateway state machine
Trigger: first duel attraction. Fix: "match" concept (multi-session game), planned Stage 7. Do not promise duel hardware before then.

---

## P3 — accepted risks (revisit on trigger)

### R16. NFC UID cloning
Accepted: 1h entertainment bracelet, no monetary value attached.
HARD TRIGGER to revisit: the moment any payment, paid credits, or personal data access hangs off a bracelet tap -> migrate to NTAG/DESFire challenge-response.

### R17. Single server, no HA
Accepted: Docker restart covers crashes; R8 backups cover disk death; restore drill documented.
Trigger to revisit: second venue, or downtime cost exceeds ~1 lost hour/month.

### R18. One user binding multiple bracelets simultaneously
Currently allowed (unique index is per-bracelet). Probably harmless; decide when desk UI is designed.

---

## Standing rules during implementation

1. New endpoint => requires auth middleware by default; public endpoints are the explicit exception.
2. New failure path => must appear in logs with station_id/session_id context.
3. Every stage kickoff: re-read this file, promote/demote items, check off done ones.
4. Anything guest-visible failing silently is a bug, even if data is safe.
