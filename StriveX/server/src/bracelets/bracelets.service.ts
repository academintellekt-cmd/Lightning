import { Injectable, NotFoundException } from '@nestjs/common';
import { DbService } from '../db/db.service';

@Injectable()
export class BraceletsService {
  constructor(private readonly db: DbService) {}

  register(uid: string, label?: string) {
    this.db.raw.prepare('INSERT OR IGNORE INTO bracelets (uid, label) VALUES (?, ?)').run(uid, label ?? null);
    return { uid, label: label ?? null };
  }

  // Full inventory with live binding status (which bracelet is currently in an active session).
  list() {
    return this.db.raw.prepare(`
      SELECT b.uid, b.label, b.active,
             CASE WHEN s.id IS NOT NULL THEN 1 ELSE 0 END AS in_use,
             u.username
      FROM bracelets b
      LEFT JOIN sessions s ON s.bracelet_uid = b.uid AND s.returned_at IS NULL
      LEFT JOIN users u ON u.id = s.user_id
      ORDER BY b.uid
    `).all();
  }

  returnByUid(uid: string) {
    const r = this.db.raw.prepare(
      `UPDATE sessions SET returned_at = datetime('now') WHERE bracelet_uid = ? AND returned_at IS NULL`
    ).run(uid);
    if (r.changes === 0) throw new NotFoundException('no active session for this bracelet');
    return { ok: true };
  }

  overdue() {
    return this.db.raw.prepare(`
      SELECT b.uid, b.label, u.username, u.name, s.id AS session_id, s.expires_at,
             CAST((julianday('now') - julianday(s.expires_at)) * 24 * 60 AS INTEGER) AS overdue_minutes
      FROM sessions s
      JOIN bracelets b ON b.uid = s.bracelet_uid
      JOIN users u ON u.id = s.user_id
      WHERE s.returned_at IS NULL AND s.expires_at < datetime('now')
      ORDER BY s.expires_at ASC
    `).all();
  }
}
