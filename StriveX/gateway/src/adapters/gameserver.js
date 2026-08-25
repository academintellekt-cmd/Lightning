// gateway/src/adapters/gameserver.js
// WebSocket client to a Strivex game's local control server.
//   Gateway -> Game: {type:'unlock', session_id, user:{uid,name}, paid_seconds}
//                    {type:'lock', reason}
//   Game -> Gateway: {type:'hello', game, version, protocol}
//                    {type:'ready'}
//                    {type:'session_result', session_id, score, status, meta}
// Emits a unified 'session' {value, status, meta} event for every session end
// (in response to session_result, or a watchdog timeout after a forced lock).
import { EventEmitter } from 'node:events';
import WebSocket from 'ws';

const GRACE_MS = 10000;

export class GameServerAdapter extends EventEmitter {
  constructor(url) {
    super();
    this.url = url;
    this.managesTimeout = true; // gateway skips its fixed watchdog for this adapter
    this.activeSession = null;
    this.deadlineTimer = null;
    this.lockGraceTimer = null;
    this.retryTimer = null;
    this.stopped = false;
    this.pendingUnlock = null;
    this.connect();
  }

  connect() {
    if (this.stopped) return;
    this.ws = new WebSocket(this.url);
    this.ws.on('open', () => {
      console.log(`[gameserver] connected ${this.url}`);
      if (this.pendingUnlock) {
        const msg = this.pendingUnlock;
        this.pendingUnlock = null;
        this.send(msg);
      }
    });
    this.ws.on('message', (data) => this.onMessage(data));
    this.ws.on('close', () => this.retry());
    this.ws.on('error', (e) => console.warn('[gameserver] ws error:', e.message));
  }

  retry() {
    if (this.stopped || this.retryTimer) return;
    this.retryTimer = setTimeout(() => { this.retryTimer = null; this.connect(); }, 3000);
  }

  onMessage(data) {
    let msg;
    try { msg = JSON.parse(data.toString()); } catch { return; }
    if (msg.type === 'hello') console.log(`[gameserver] game=${msg.game} v${msg.version}`);
    else if (msg.type === 'session_result') this.onResult(msg);
  }

  onResult(msg) {
    if (!this.activeSession || msg.session_id !== this.activeSession) return; // stale/dup
    this.clearTimers();
    this.activeSession = null;
    const meta = { ...(msg.meta || {}), score: msg.score };
    // Server accepts only this enum; coerce anything else to 'failed' so a
    // malformed status can never wedge the (strict-FIFO) result outbox.
    let status = msg.status;
    if (!['completed', 'timeout', 'abandoned', 'failed'].includes(status)) {
      meta.reported_status = status;
      status = 'failed';
    }
    this.emit('session', { value: msg.score ?? null, status, meta });
  }

  startGame(sessionId, session = {}) {
    this.clearTimers();
    this.activeSession = sessionId;
    const paid = Number(session.remaining_seconds) || 0;
    this.send({
      type: 'unlock',
      session_id: sessionId,
      user: { uid: session.uid ?? session.user_id ?? null, name: session.username ?? null },
      paid_seconds: paid,
    });
    const ms = paid > 0 ? paid * 1000 + GRACE_MS : 0;
    if (ms) this.deadlineTimer = setTimeout(() => this.forceLock('deadline'), ms);
  }

  forceLock(reason) {
    this.pendingUnlock = null;
    this.send({ type: 'lock', reason });
    this.lockGraceTimer = setTimeout(() => {
      if (!this.activeSession) return;
      this.activeSession = null;
      this.clearTimers();
      this.emit('session', { value: null, status: 'timeout', meta: { watchdog: true } });
    }, GRACE_MS);
  }

  stop(reason = 'operator') { this.forceLock(reason); }

  deny() { /* game stays locked; no protocol message in v1 */ }

  clearTimers() {
    clearTimeout(this.deadlineTimer);
    clearTimeout(this.lockGraceTimer);
  }

  destroy() {
    this.stopped = true;
    clearTimeout(this.retryTimer);
    this.retryTimer = null;
    this.clearTimers();
    if (this.ws) {
      this.ws.removeAllListeners();
      this.ws.close();
    }
  }

  send(obj) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(obj));
    } else if (obj.type === 'unlock') {
      this.pendingUnlock = obj;
    }
  }
}
