import { Injectable } from '@nestjs/common';
import { DbService } from '../db/db.service';

@Injectable()
export class StationsService {
  constructor(private readonly db: DbService) {}

  register(id: string, name?: string) {
    this.db.raw.prepare('INSERT OR IGNORE INTO stations (id, name) VALUES (?, ?)').run(id, name ?? id);
    return { id, name: name ?? id };
  }

  // A gateway coming online self-registers on its first heartbeat (upsert).
  // An existing desk-assigned name is preserved; only status/last_seen_at and the
  // live bracelet->station mapping (current_session_id/current_started_at) update.
  heartbeat(id: string, status?: string, sessionId?: string | null, startedAt?: string | null) {
    this.db.raw.prepare(`
      INSERT INTO stations (id, name, status, last_seen_at, current_session_id, current_started_at)
      VALUES (?, ?, ?, datetime('now'), ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        status = excluded.status,
        last_seen_at = excluded.last_seen_at,
        current_session_id = excluded.current_session_id,
        current_started_at = excluded.current_started_at
    `).run(id, id, status ?? 'idle', sessionId ?? null, startedAt ?? null);
    return { ok: true };
  }

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
}
