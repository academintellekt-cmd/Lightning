// strivex-game-client/test/session.test.js
//
// Exercises StrivexSession as the gateway would see it, using a small
// hand-rolled WebSocket client (the library has no 'ws' dependency, so the
// test fakes the gateway side of the handshake/framing directly).

const test = require('node:test');
const assert = require('node:assert/strict');
const net = require('node:net');
const crypto = require('node:crypto');
const { once } = require('node:events');
const { StrivexSession } = require('../strivex-session');

const WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

function encodeMaskedTextFrame(str) {
  const payload = Buffer.from(str, 'utf8');
  const maskKey = crypto.randomBytes(4);
  const masked = Buffer.alloc(payload.length);
  for (let i = 0; i < payload.length; i++) masked[i] = payload[i] ^ maskKey[i % 4];

  const len = payload.length;
  let header;
  if (len < 126) {
    header = Buffer.from([0x81, 0x80 | len]);
  } else {
    header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 0x80 | 126;
    header.writeUInt16BE(len, 2);
  }
  return Buffer.concat([header, maskKey, masked]);
}

// Parses unmasked frames sent by the server (the only kind a compliant
// server sends).
function parseFrames(buffer) {
  const frames = [];
  let offset = 0;
  while (offset + 2 <= buffer.length) {
    const b1 = buffer[offset + 1];
    let payloadLen = b1 & 0x7f;
    let cursor = offset + 2;
    if (payloadLen === 126) {
      payloadLen = buffer.readUInt16BE(cursor);
      cursor += 2;
    } else if (payloadLen === 127) {
      payloadLen = Number(buffer.readBigUInt64BE(cursor));
      cursor += 8;
    }
    if (cursor + payloadLen > buffer.length) break;
    frames.push(buffer.subarray(cursor, cursor + payloadLen).toString('utf8'));
    offset = cursor + payloadLen;
  }
  return frames;
}

class FakeGateway {
  constructor() {
    this.socket = null;
    this.messages = [];
    this.buffer = Buffer.alloc(0);
    this.waiters = [];
  }

  async connect(port) {
    const key = crypto.randomBytes(16).toString('base64');
    this.socket = net.connect(port, '127.0.0.1');
    await once(this.socket, 'connect');
    this.socket.write(
      `GET / HTTP/1.1\r\nHost: 127.0.0.1:${port}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n` +
      `Sec-WebSocket-Key: ${key}\r\nSec-WebSocket-Version: 13\r\n\r\n`
    );

    await new Promise((resolve, reject) => {
      const onData = (chunk) => {
        this.buffer = Buffer.concat([this.buffer, chunk]);
        const headerEnd = this.buffer.indexOf('\r\n\r\n');
        if (headerEnd === -1) return;
        const head = this.buffer.subarray(0, headerEnd).toString('utf8');
        if (!head.startsWith('HTTP/1.1 101')) {
          reject(new Error(`handshake failed: ${head}`));
          return;
        }
        this.buffer = this.buffer.subarray(headerEnd + 4);
        this.socket.removeListener('data', onData);
        resolve();
      };
      this.socket.on('data', onData);
    });

    this.socket.on('data', (chunk) => this.onData(chunk));
    if (this.buffer.length) this.onData(Buffer.alloc(0)); // handshake response + first frames can share one TCP chunk
  }

  onData(chunk) {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    const frames = parseFrames(this.buffer);
    this.buffer = Buffer.alloc(0); // messages in these tests always arrive whole
    for (const raw of frames) {
      let msg;
      try { msg = JSON.parse(raw); } catch { continue; }
      this.messages.push(msg);
      const waiter = this.waiters.shift();
      if (waiter) waiter(msg);
    }
  }

  async nextMessage() {
    const buffered = this.messages.shift();
    if (buffered) return buffered;
    return new Promise((resolve) => this.waiters.push(resolve));
  }

  async waitFor(type) {
    for (;;) {
      const msg = await this.nextMessage();
      if (msg.type === type) return msg;
    }
  }

  send(obj) {
    this.socket.write(encodeMaskedTextFrame(JSON.stringify(obj)));
  }

  close() {
    this.socket.destroy();
  }
}

function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
    srv.on('error', reject);
  });
}

test('unlock -> tick -> reportResult flow', async () => {
  const port = await freePort();
  const session = new StrivexSession({ port, game: 'test-game' });
  session.start();
  const gw = new FakeGateway();
  await gw.connect(port);
  await gw.waitFor('hello');
  await gw.waitFor('ready');

  const unlockEvent = once(session, 'unlock');
  gw.send({ type: 'unlock', session_id: 's1', user: { uid: 'u1', name: 'Ann' }, paid_seconds: 1 });
  const [payload] = await unlockEvent;
  assert.equal(payload.session_id, 's1');
  assert.equal(payload.user.uid, 'u1');
  assert.equal(payload.paid_seconds, 1);

  const [remainingMs] = await once(session, 'tick');
  assert.equal(remainingMs, 0);

  session.reportResult(42, 'completed', { rounds: 1 });
  const result = await gw.waitFor('session_result');
  assert.equal(result.session_id, 's1');
  assert.equal(result.score, 42);
  assert.equal(result.status, 'completed');
  assert.deepEqual(result.meta, { rounds: 1 });

  gw.close();
  session.stop();
});

test('second unlock is rejected while a session is active', async () => {
  const port = await freePort();
  const session = new StrivexSession({ port });
  session.start();
  const gw = new FakeGateway();
  await gw.connect(port);
  await gw.waitFor('ready');

  const unlocks = [];
  session.on('unlock', (p) => unlocks.push(p));

  gw.send({ type: 'unlock', session_id: 's1', user: { uid: 'u1' }, paid_seconds: 30 });
  await once(session, 'unlock');
  gw.send({ type: 'unlock', session_id: 's2', user: { uid: 'u2' }, paid_seconds: 30 });

  // Give the second (rejected) unlock a moment to be processed, if it were
  // going to be.
  await new Promise((resolve) => setTimeout(resolve, 100));

  assert.equal(unlocks.length, 1);
  assert.equal(session.sessionId, 's1');

  gw.close();
  session.stop();
});

test('lock cancels the running timer', async () => {
  const port = await freePort();
  const session = new StrivexSession({ port });
  session.start();
  const gw = new FakeGateway();
  await gw.connect(port);
  await gw.waitFor('ready');

  gw.send({ type: 'unlock', session_id: 's1', user: { uid: 'u1' }, paid_seconds: 30 });
  await once(session, 'unlock');
  assert.ok(session.timer);

  const lockEvent = once(session, 'lock');
  gw.send({ type: 'lock', reason: 'operator' });
  const [payload] = await lockEvent;
  assert.equal(payload.reason, 'operator');
  assert.equal(session.timer, null);

  gw.close();
  session.stop();
});

test('unlock is accepted again after a lock (not just after reportResult)', async () => {
  const port = await freePort();
  const session = new StrivexSession({ port });
  session.start();
  const gw = new FakeGateway();
  await gw.connect(port);
  await gw.waitFor('ready');

  gw.send({ type: 'unlock', session_id: 's1', user: { uid: 'u1' }, paid_seconds: 30 });
  await once(session, 'unlock');
  assert.equal(session.sessionId, 's1');

  gw.send({ type: 'lock', reason: 'operator' });
  await once(session, 'lock');
  assert.equal(session.sessionId, null);
  assert.equal(session.user, null);
  assert.equal(session.remainingMs, 0);

  const unlockEvent = once(session, 'unlock');
  gw.send({ type: 'unlock', session_id: 's2', user: { uid: 'u2' }, paid_seconds: 30 });
  const [payload] = await unlockEvent;
  assert.equal(payload.session_id, 's2');
  assert.equal(session.sessionId, 's2');

  gw.close();
  session.stop();
});

test('reportResult throws on an unknown status', async () => {
  const port = await freePort();
  const session = new StrivexSession({ port });
  session.start();
  const gw = new FakeGateway();
  await gw.connect(port);
  await gw.waitFor('ready');

  gw.send({ type: 'unlock', session_id: 's1', user: { uid: 'u1' }, paid_seconds: 30 });
  await once(session, 'unlock');

  assert.throws(() => session.reportResult(0, 'bogus', {}), /unknown status/);

  gw.close();
  session.stop();
});

test('gateway reconnect: new connection replaces the old one and can unlock again', async () => {
  const port = await freePort();
  const session = new StrivexSession({ port });
  session.start();

  const gw1 = new FakeGateway();
  await gw1.connect(port);
  await gw1.waitFor('ready');
  gw1.close();

  // Give the server a moment to notice the closed socket.
  await new Promise((resolve) => setTimeout(resolve, 100));

  const gw2 = new FakeGateway();
  await gw2.connect(port);
  await gw2.waitFor('hello');
  await gw2.waitFor('ready');

  const unlockEvent = once(session, 'unlock');
  gw2.send({ type: 'unlock', session_id: 's2', user: { uid: 'u2' }, paid_seconds: 30 });
  const [payload] = await unlockEvent;
  assert.equal(payload.session_id, 's2');

  gw2.close();
  session.stop();
});
