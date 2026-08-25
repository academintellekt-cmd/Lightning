import { Injectable, OnModuleDestroy } from '@nestjs/common';
import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

// Deliberately synchronous (better-sqlite3): correct for single-venue load.
// Swap internals for async pg driver at Stage 4 without touching feature modules.
@Injectable()
export class DbService implements OnModuleDestroy {
  readonly raw: Database.Database;

  constructor() {
    const path = process.env.DB_PATH || './data/strivex.db';
    mkdirSync(dirname(path), { recursive: true });
    this.raw = new Database(path);
    this.raw.pragma('journal_mode = WAL');
    this.migrate();
  }

  private migrate() {
    this.raw.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE,
        name TEXT,
        password_hash TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );
      CREATE TABLE IF NOT EXISTS bracelets (
        uid TEXT PRIMARY KEY,
        label TEXT,
        active INTEGER DEFAULT 1
      );
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id),
        bracelet_uid TEXT NOT NULL REFERENCES bracelets(uid),
        started_at TEXT DEFAULT (datetime('now')),
        expires_at TEXT NOT NULL,
        returned_at TEXT
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_per_bracelet
        ON sessions(bracelet_uid) WHERE returned_at IS NULL;
      CREATE TABLE IF NOT EXISTS stations (
        id TEXT PRIMARY KEY,
        name TEXT,
        status TEXT DEFAULT 'unknown',
        last_seen_at TEXT
      );
      CREATE TABLE IF NOT EXISTS results (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL REFERENCES sessions(id),
        station_id TEXT NOT NULL REFERENCES stations(id),
        value REAL,
        status TEXT NOT NULL DEFAULT 'completed',
        duration_ms INTEGER,
        meta TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_results_station ON results(station_id, status);
      CREATE INDEX IF NOT EXISTS idx_results_session ON results(session_id);
    `);

    // Live bracelet->station mapping (added after stations table shipped; SQLite has no ADD COLUMN IF NOT EXISTS).
    this.addColumnIfMissing('stations', 'current_session_id', 'current_session_id TEXT');
    this.addColumnIfMissing('stations', 'current_started_at', 'current_started_at TEXT');
  }

  private addColumnIfMissing(table: string, column: string, ddl: string) {
    const cols = this.raw.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
    if (!cols.some((c) => c.name === column)) {
      this.raw.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
    }
  }

  onModuleDestroy() { this.raw.close(); }
}
