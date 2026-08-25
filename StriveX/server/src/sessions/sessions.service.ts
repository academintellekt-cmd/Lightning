import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DbService } from '../db/db.service';

const TTL_MINUTES = () => parseInt(process.env.SESSION_TTL_MINUTES || '60', 10);

@Injectable()
export class SessionsService {
  constructor(private readonly db: DbService) {}

  bind(userId: string, braceletUid: string) {
    const bracelet = this.db.raw.prepare('SELECT uid, active FROM bracelets WHERE uid = ?').get(braceletUid) as any;
    if (!bracelet?.active) throw new BadRequestException('unknown or inactive bracelet');

    const active = this.db.raw.prepare(
      'SELECT id FROM sessions WHERE bracelet_uid = ? AND returned_at IS NULL'
    ).get(braceletUid) as any;
    if (active) throw new ConflictException({ error: 'bracelet already bound to an active session', session_id: active.id });

    const id = randomUUID();
    this.db.raw.prepare(`
      INSERT INTO sessions (id, user_id, bracelet_uid, expires_at)
      VALUES (?, ?, ?, datetime('now', '+' || ? || ' minutes'))
    `).run(id, userId, braceletUid, TTL_MINUTES());
    return this.db.raw.prepare('SELECT * FROM sessions WHERE id = ?').get(id);
  }

  returnById(id: string) {
    const r = this.db.raw.prepare(
      `UPDATE sessions SET returned_at = datetime('now') WHERE id = ? AND returned_at IS NULL`
    ).run(id);
    if (r.changes === 0) throw new NotFoundException('no active session with this id');
    return { ok: true };
  }

  // Station authorization: active + unexpired. TTL gates STARTING games, never saving finished ones.
  lookup(braceletUid: string) {
    const row = this.db.raw.prepare(`
      SELECT s.id AS session_id, s.expires_at, u.id AS user_id, u.username
      FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.bracelet_uid = ? AND s.returned_at IS NULL
    `).get(braceletUid) as any;
    if (!row) throw new NotFoundException('no active session');

    const remaining = (this.db.raw.prepare(
      `SELECT CAST((julianday(?) - julianday('now')) * 86400 AS INTEGER) AS s`
    ).get(row.expires_at) as any).s;
    if (remaining <= 0) throw new ForbiddenException({ error: 'session expired', session_id: row.session_id });

    return { session_id: row.session_id, user_id: row.user_id, username: row.username, remaining_seconds: remaining };
  }
}
