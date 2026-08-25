import { test } from 'node:test';
import assert from 'node:assert';
import { EventEmitter, once } from 'node:events';
import { WebSocketServer } from 'ws';
import { GameServerAdapter } from '../src/adapters/gameserver.js';

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

async function fakeGame() {
  const wss = new WebSocketServer({ host: '127.0.0.1', port: 0 });
  const state = { received: [], sockets: [] };
  wss.on('connection', (ws) => {
    state.sockets.push(ws);
    ws.send(JSON.stringify({ type: 'hello', game: 'test', version: '1', protocol: 1 }));
    ws.send(JSON.stringify({ type: 'ready' }));
    ws.on('message', (d) => state.received.push(JSON.parse(d.toString())));
  });
  await once(wss, 'listening');
  const { port } = wss.address();
  return {
    wss, state, url: `ws://127.0.0.1:${port}`,
    send: (obj) => state.sockets.forEach((s) => s.send(JSON.stringify(obj))),
    close: () => wss.close(),
  };
}

test('startGame sends unlock with user and paid_seconds', async () => {
  const g = await fakeGame();
  const a = new GameServerAdapter(g.url);
  await once(a.ws, 'open');
  await delay(30);
  a.startGame('S1', { session_id: 'S1', username: 'Bob', uid: 'ABC', remaining_seconds: 300 });
  await delay(30);
  const unlock = g.state.received.find((m) => m.type === 'unlock');
  assert.equal(unlock.session_id, 'S1');
  assert.equal(unlock.user.name, 'Bob');
  assert.equal(unlock.user.uid, 'ABC');
  assert.equal(unlock.paid_seconds, 300);
  a.destroy(); g.close();
});

test('startGame before the socket opens still delivers the unlock once connected', async () => {
  const g = await fakeGame();
  const a = new GameServerAdapter(g.url);
  // No wait for 'open': the socket is still CONNECTING here.
  a.startGame('S0', { session_id: 'S0', username: 'Amy', uid: 'XYZ', remaining_seconds: 60 });
  await once(a.ws, 'open');
  await delay(30);
  const unlock = g.state.received.find((m) => m.type === 'unlock');
  assert.ok(unlock, 'unlock message was not delivered after the socket opened');
  assert.equal(unlock.session_id, 'S0');
  assert.equal(unlock.user.name, 'Amy');
  a.destroy(); g.close();
});

test('queued unlock survives a reconnect (socket down, then back up)', async () => {
  const g = await fakeGame();
  const a = new GameServerAdapter(g.url);
  await once(a.ws, 'open');
  await delay(30);

  // Kill the underlying socket without going through destroy(), so the
  // adapter's normal retry/reconnect path kicks in.
  const deadWs = a.ws;
  deadWs.terminate();
  await once(deadWs, 'close');

  a.startGame('S1', { session_id: 'S1', remaining_seconds: 60 });
  assert.equal(a.pendingUnlock.session_id, 'S1');

  // Wait for the adapter's retry timer (3s) to reconnect, then let the
  // queued unlock flush.
  await delay(3300);
  await delay(50);

  const unlock = g.state.received.find((m) => m.type === 'unlock' && m.session_id === 'S1');
  assert.ok(unlock, 'queued unlock was not delivered after reconnect');
  assert.equal(a.pendingUnlock, null);
  a.destroy(); g.close();
});

test('completed session_result emits session {value, status, meta}', async () => {
  const g = await fakeGame();
  const a = new GameServerAdapter(g.url);
  await once(a.ws, 'open');
  await delay(30);
  a.startGame('S1', { session_id: 'S1', remaining_seconds: 300 });
  const p = once(a, 'session');
  g.send({ type: 'session_result', session_id: 'S1', score: 900, status: 'completed', meta: { best: 900 } });
  const [ev] = await p;
  assert.equal(ev.value, 900);
  assert.equal(ev.status, 'completed');
  assert.equal(ev.meta.best, 900);
  a.destroy(); g.close();
});

test('timeout and abandoned statuses both emit session with score+meta preserved', async () => {
  const g = await fakeGame();
  const a = new GameServerAdapter(g.url);
  await once(a.ws, 'open');
  await delay(30);
  a.startGame('S2', { session_id: 'S2', remaining_seconds: 300 });
  const t = once(a, 'session');
  g.send({ type: 'session_result', session_id: 'S2', score: 0, status: 'timeout', meta: {} });
  const [tEv] = await t;
  assert.equal(tEv.status, 'timeout');
  assert.equal(tEv.value, 0);

  a.startGame('S3', { session_id: 'S3', remaining_seconds: 300 });
  const f = once(a, 'session');
  g.send({ type: 'session_result', session_id: 'S3', score: 0, status: 'abandoned', meta: {} });
  const [fEv] = await f;
  assert.equal(fEv.status, 'abandoned');
  a.destroy(); g.close();
});

test('unknown status is coerced to failed with the original preserved in meta', async () => {
  const g = await fakeGame();
  const a = new GameServerAdapter(g.url);
  await once(a.ws, 'open');
  await delay(30);
  a.startGame('S5', { session_id: 'S5', remaining_seconds: 300 });
  const p = once(a, 'session');
  g.send({ type: 'session_result', session_id: 'S5', score: 7, status: 'weird', meta: {} });
  const [ev] = await p;
  assert.equal(ev.status, 'failed');
  assert.equal(ev.value, 7);
  assert.equal(ev.meta.reported_status, 'weird');
  a.destroy(); g.close();
});

test('stale session_result for a finished session is ignored', async () => {
  const g = await fakeGame();
  const a = new GameServerAdapter(g.url);
  await once(a.ws, 'open');
  await delay(30);
  a.startGame('S4', { session_id: 'S4', remaining_seconds: 300 });
  g.send({ type: 'session_result', session_id: 'S4', score: 5, status: 'completed', meta: {} });
  await once(a, 'session');
  let extra = false;
  a.on('session', () => { extra = true; });
  g.send({ type: 'session_result', session_id: 'S4', score: 9, status: 'completed', meta: {} });
  await delay(40);
  assert.equal(extra, false);
  a.destroy(); g.close();
});
