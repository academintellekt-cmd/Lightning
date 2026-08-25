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

  it('auto-registers an unknown station on first heartbeat (upsert)', () => {
    svc.heartbeat('newbie', 'idle');
    const row: any = svc.list().find((r: any) => r.id === 'newbie');
    expect(row).toBeDefined();
    expect(row.status).toBe('idle');
    expect(row.name).toBe('newbie');
  });

  it('preserves a desk-assigned name across heartbeats', () => {
    svc.register('grip', 'Grip Strength');
    svc.heartbeat('grip', 'in_game', 'sess1', '2026-07-29T05:00:00.000Z');
    const row: any = svc.list().find((r: any) => r.id === 'grip');
    expect(row.name).toBe('Grip Strength');
  });
});
