import { BadRequestException, GoneException, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DbService } from '../db/db.service';
import { CreateResultDto } from './dto';

@Injectable()
export class ResultsService {
  constructor(private readonly db: DbService) {}

  create(dto: CreateResultDto) {
    const sess = this.db.raw.prepare('SELECT id, expires_at FROM sessions WHERE id = ?').get(dto.session_id) as any;
    if (!sess) throw new BadRequestException('unknown session');

    // R5: accept in-flight games finishing shortly after expiry, reject stale/forged posts
    const staleMin = (this.db.raw.prepare(
      `SELECT CAST((julianday('now') - julianday(?)) * 24 * 60 AS INTEGER) AS m`
    ).get(sess.expires_at) as any).m;
    if (staleMin > 10) throw new GoneException('session expired too long ago');

    if (!this.db.raw.prepare('SELECT id FROM stations WHERE id = ?').get(dto.station_id))
      throw new BadRequestException(`unknown station: ${dto.station_id}`);

    // Idempotent: gateways send their own UUID so offline retries never duplicate
    const id = dto.id || randomUUID();
    const r = this.db.raw.prepare(`
      INSERT OR IGNORE INTO results (id, session_id, station_id, value, status, duration_ms, meta)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, dto.session_id, dto.station_id, dto.value ?? null, dto.status ?? 'completed',
           dto.duration_ms ?? null, dto.meta ? JSON.stringify(dto.meta) : null);
    return { id, duplicate: r.changes === 0 };
  }

  statsByStation() {
    return this.db.raw.prepare(`
      SELECT station_id,
        COUNT(*) AS attempts,
        SUM(status = 'completed') AS completed,
        SUM(status = 'failed') AS failed,
        SUM(status = 'abandoned') AS abandoned,
        SUM(status = 'timeout') AS timeouts,
        ROUND(COUNT(*) * 1.0 / COUNT(DISTINCT session_id), 2) AS attempts_per_session
      FROM results GROUP BY station_id ORDER BY attempts DESC
    `).all();
  }
}
