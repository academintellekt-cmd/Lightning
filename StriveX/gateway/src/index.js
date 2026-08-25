// gateway/src/index.js — Station Gateway core (v2: sessions + attempt statuses)
import { NFC } from 'nfc-pcsc';
import { config } from './config.js';
import { createAdapter } from './adapters/index.js';
import { api } from './api.js';
import { Outbox } from './outbox.js';
import { startLogServer } from './logserver.js';
import { randomUUID } from 'node:crypto';

import fs from 'node:fs';
import path from 'node:path';

const adapter = createAdapter(config);
const outbox = new Outbox(config.dataDir, (r) => api.postResult(r));

// Local log/observability UI. Started early so crash-recovery output is captured too.
// `actions` back the Simulate panel (disabled on real hardware stations).
startLogServer({
  port: config.uiPort,
  simEnabled: config.adapter !== 'serial',
  statusProvider: () => ({
    station: config.stationId,
    adapter: config.adapter,
    server: config.serverUrl,
    current: current?.session_id ?? null,
    pending: outbox.pending.length,
  }),
  actions: {
    // Same entry point as a real NFC tap: hits the server /lookup and, if
    // authorized, starts the game via the adapter.
    tap: (uid) => onTap(uid),
    // Drive a game outcome through the exact events the serial adapter emits.
    result: ({ status, value, meta }) => {
      if (!current) throw new Error('no game in progress');
      if (status === 'completed') adapter.emit('result', value ?? null, meta);
      else if (status === 'failed') adapter.emit('failed', meta);
      else if (status === 'timeout') adapter.emit('timeout');
      else throw new Error(`unknown status: ${status}`);
    },
  },
});

// --- R3: crash-safe current game ---
const CURRENT_PATH = path.join(config.dataDir, 'current.json');
let current = null; // { session_id, user_id, username, startedAt }
let watchdogTimer = null;

function setCurrent(c) {
  current = c;
  if (c) fs.writeFileSync(CURRENT_PATH, JSON.stringify(c));
  else fs.rmSync(CURRENT_PATH, { force: true });
}

// --- R2: game watchdog ---
function armWatchdog() {
  clearTimeout(watchdogTimer);
  watchdogTimer = setTimeout(() => {
    if (!current) return;
    console.warn(`[gateway] WATCHDOG: no result after ${config.gameTimeoutMs}ms, releasing station`);
    finish({ value: null, status: 'timeout', meta: { watchdog: true } });
  }, config.gameTimeoutMs);
}

// Restore in-flight game after a crash/restart
if (fs.existsSync(CURRENT_PATH)) {
  try {
    const restored = JSON.parse(fs.readFileSync(CURRENT_PATH, 'utf8'));
    const age = Date.now() - restored.startedAt;
    if (age > config.gameTimeoutMs) {
      // Game is definitely over; we don't know the outcome -> abandoned
      console.warn(`[gateway] restored game too old (${age}ms), logging as abandoned`);
      outbox.enqueue({
        id: randomUUID(), session_id: restored.session_id, station_id: config.stationId,
        value: null, status: 'abandoned', duration_ms: age, meta: { crash_recovery: true },
      });
      fs.rmSync(CURRENT_PATH, { force: true });
    } else {
      console.log(`[gateway] restored in-flight game (session ${restored.session_id}), rearming watchdog`);
      current = restored;
      armWatchdog();
    }
  } catch { fs.rmSync(CURRENT_PATH, { force: true }); }
}

async function onTap(uid) {
  if (current) {
    console.log(`[gateway] tap ignored, game in progress (session ${current.session_id})`);
    return;
  }
  const auth = await api.lookupSession(uid);
  if (auth.status === 'expired') {
    console.log('[gateway] session expired — time is up');
    adapter.deny?.('expired');
    return;
  }
  if (!auth.ok) {
    console.log('[gateway] no active session for this bracelet');
    adapter.deny?.('unregistered');
    return;
  }
  setCurrent({ ...auth.data, uid, startedAt: Date.now() });
  if (!adapter.managesTimeout) armWatchdog();
  const minLeft = Math.floor((auth.data.remaining_seconds ?? 0) / 60);
  if (auth.data.remaining_seconds != null && minLeft < 5) {
    // Surface on the station screen/LED: last chance warning.
    console.log(`[gateway] WARNING: ${minLeft}m ${auth.data.remaining_seconds % 60}s left on this bracelet`);
    adapter.warnTimeLeft?.(auth.data.remaining_seconds);
  }
  console.log(`[gateway] authorized ${current.username} (session ${current.session_id}, ${minLeft}m left)`);
  adapter.startGame(current.session_id, current);
  sendHeartbeat(); // push the in-game mapping to the desk without waiting for the interval
}

function finish(payload) {
  if (!current) return;
  const s = current;
  setCurrent(null);
  clearTimeout(watchdogTimer);
  sendHeartbeat(); // push the cleared mapping to the desk immediately
  // ID generated HERE -> retries are idempotent; local write happens before any network I/O.
  outbox.enqueue({
    id: randomUUID(),
    session_id: s.session_id,
    station_id: config.stationId,
    duration_ms: Date.now() - s.startedAt,
    ...payload,
  });
}

adapter.on('result', (value, meta) => {
  console.log(`[gateway] result value=${value}`);
  finish({ value, status: 'completed', meta });
});
adapter.on('failed', (meta) => finish({ value: null, status: 'failed', meta }));
adapter.on('timeout', () => finish({ value: null, status: 'timeout' }));
adapter.on('session', ({ value, status, meta }) => {
  console.log(`[gateway] session end value=${value} status=${status}`);
  finish({ value, status, meta });
});
adapter.on('error', (err) => {
  console.error('[gateway] adapter error:', err.message);
  finish({ value: null, status: 'abandoned', meta: { error: err.message } });
});

const nfc = new NFC();
nfc.on('reader', (reader) => {
  console.log(`[gateway] NFC reader attached: ${reader.reader.name}`);
  reader.on('card', (card) => onTap(card.uid).catch(console.error));
  reader.on('error', (err) => console.error('[gateway] reader error:', err.message));
});
nfc.on('error', (err) => console.error('[gateway] NFC error:', err.message));

function sendHeartbeat() {
  return api.heartbeat(config.stationId, current ? 'in_game' : 'idle', current)
    .catch((e) => console.warn('[gateway] heartbeat failed:', e.message));
}
setInterval(sendHeartbeat, config.heartbeatIntervalMs);

console.log(`[gateway] station=${config.stationId} adapter=${config.adapter} server=${config.serverUrl}`);
