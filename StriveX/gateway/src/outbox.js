// gateway/src/outbox.js
// Store-and-forward result queue.
// Every result is appended to a local JSONL file BEFORE the first send attempt,
// then flushed to the server with retries. The file doubles as a local audit copy.
//
// results.jsonl   — append-only log of every result this station produced (never trimmed)
// pending.jsonl   — results not yet confirmed by the server (rewritten on each flush)

import fs from 'node:fs';
import path from 'node:path';

export class Outbox {
  constructor(dir, sendFn, { flushIntervalMs = 5000 } = {}) {
    this.dir = dir;
    this.sendFn = sendFn; // async (result) => void, throws on failure
    fs.mkdirSync(dir, { recursive: true });
    this.auditPath = path.join(dir, 'results.jsonl');
    this.pendingPath = path.join(dir, 'pending.jsonl');
    this.pending = this.loadPending();
    this.flushing = false;
    setInterval(() => this.flush().catch(() => {}), flushIntervalMs);
    if (this.pending.length) {
      console.log(`[outbox] ${this.pending.length} unsent result(s) from previous run, will retry`);
    }
  }

  loadPending() {
    if (!fs.existsSync(this.pendingPath)) return [];
    return fs.readFileSync(this.pendingPath, 'utf8')
      .split('\n').filter(Boolean).map((l) => JSON.parse(l));
  }

  persistPending() {
    fs.writeFileSync(this.pendingPath, this.pending.map((r) => JSON.stringify(r)).join('\n') + (this.pending.length ? '\n' : ''));
  }

  // Called by the gateway on every finished game. Durable before any network I/O.
  enqueue(result) {
    fs.appendFileSync(this.auditPath, JSON.stringify(result) + '\n'); // audit copy
    this.pending.push(result);
    this.persistPending();
    this.flush().catch(() => {}); // try immediately, but durability is already guaranteed
  }

  async flush() {
    if (this.flushing || this.pending.length === 0) return;
    this.flushing = true;
    try {
      while (this.pending.length > 0) {
        const result = this.pending[0];
        await this.sendFn(result); // throws -> stop, retry on next interval
        this.pending.shift();
        this.persistPending();
        console.log(`[outbox] delivered result ${result.id} (${this.pending.length} pending)`);
      }
    } catch (e) {
      console.warn(`[outbox] server unreachable, ${this.pending.length} pending (${e.message})`);
    } finally {
      this.flushing = false;
    }
  }
}
