// strivex-game-client/strivex-session.js
//
// StrivexSession owns the game side of the Strivex Game Control Protocol:
// it runs the WebSocket control server the gateway connects to, and the
// authoritative paid-time countdown for the session.
//
//   Gateway -> Game: {type:'unlock', session_id, user:{uid,name}, paid_seconds}
//                    {type:'lock', reason}
//   Game -> Gateway: {type:'hello', game, version, protocol}
//                    {type:'ready'}
//                    {type:'session_result', session_id, score, status, meta}
//
// No 'ws' dependency: the control protocol only ever carries small JSON text
// frames, so the WebSocket handshake and framing are implemented directly on
// top of Node's 'http'/'net' so this file has zero installed dependencies.

const http = require('http');
const crypto = require('crypto');
const { EventEmitter } = require('events');

const WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const ALLOWED_STATUSES = ['completed', 'timeout', 'abandoned', 'failed'];

function acceptKeyFor(clientKey) {
  return crypto.createHash('sha1').update(clientKey + WS_GUID).digest('base64');
}

function encodeTextFrame(str) {
  const payload = Buffer.from(str, 'utf8');
  const len = payload.length;
  let header;
  if (len < 126) {
    header = Buffer.from([0x81, len]);
  } else if (len < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 126;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x81;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(len), 2);
  }
  return Buffer.concat([header, payload]);
}

function encodeCloseFrame() {
  return Buffer.from([0x88, 0x00]);
}

// Minimal server-side frame parser: accumulates bytes across TCP chunks and
// yields complete frames. Handles text/close/ping opcodes only — the control
// protocol never sends binary or fragmented messages.
class FrameParser {
  constructor(onFrame) {
    this.buffer = Buffer.alloc(0);
    this.onFrame = onFrame;
  }

  push(chunk) {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    for (;;) {
      if (this.buffer.length < 2) return;
      const b0 = this.buffer[0];
      const b1 = this.buffer[1];
      const opcode = b0 & 0x0f;
      const masked = (b1 & 0x80) !== 0;
      let payloadLen = b1 & 0x7f;
      let offset = 2;
      if (payloadLen === 126) {
        if (this.buffer.length < offset + 2) return;
        payloadLen = this.buffer.readUInt16BE(offset);
        offset += 2;
      } else if (payloadLen === 127) {
        if (this.buffer.length < offset + 8) return;
        payloadLen = Number(this.buffer.readBigUInt64BE(offset));
        offset += 8;
      }
      let maskKey = null;
      if (masked) {
        if (this.buffer.length < offset + 4) return;
        maskKey = this.buffer.subarray(offset, offset + 4);
        offset += 4;
      }
      if (this.buffer.length < offset + payloadLen) return;
      let payload = this.buffer.subarray(offset, offset + payloadLen);
      if (masked) {
        const unmasked = Buffer.alloc(payloadLen);
        for (let i = 0; i < payloadLen; i++) unmasked[i] = payload[i] ^ maskKey[i % 4];
        payload = unmasked;
      }
      this.buffer = this.buffer.subarray(offset + payloadLen);
      if (opcode === 0x1) this.onFrame({ type: 'text', data: payload.toString('utf8') });
      else if (opcode === 0x8) this.onFrame({ type: 'close' });
      // ping/pong/continuation/binary: ignored, not used by this protocol
    }
  }
}

class StrivexSession extends EventEmitter {
  constructor({ port = 4200, game = 'strivex-game', version = '0.0.0', protocol = 1 } = {}) {
    super();
    this.port = port;
    this.game = game;
    this.version = version;
    this.protocol = protocol;

    this.httpServer = null;
    this.socket = null; // the single gateway connection, if any
    this.parser = null;

    this.sessionId = null;
    this.user = null;
    this.timer = null;
    this.remainingMs = 0;
  }

  start() {
    this.httpServer = http.createServer();
    this.httpServer.on('upgrade', (req, socket) => this.handleUpgrade(req, socket));
    this.httpServer.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        this.emit('error', new Error(`strivex control port ${this.port} already in use`));
        return;
      }
      this.emit('error', err);
    });
    this.httpServer.listen(this.port);
    return this;
  }

  stop() {
    this.clearTimer();
    if (this.socket) {
      try {
        this.socket.write(encodeCloseFrame());
        this.socket.end();
      } catch { /* already closed */ }
      this.socket = null;
    }
    if (this.httpServer) {
      this.httpServer.close();
      this.httpServer = null;
    }
  }

  handleUpgrade(req, socket) {
    const key = req.headers['sec-websocket-key'];
    if (!key) {
      socket.destroy();
      return;
    }

    // Only one gateway connection at a time; a fresh connection (reconnect)
    // replaces whatever was there before.
    if (this.socket) {
      try {
        this.socket.write(encodeCloseFrame());
        this.socket.end();
      } catch { /* already closed */ }
    }

    const accept = acceptKeyFor(key);
    socket.write(
      'HTTP/1.1 101 Switching Protocols\r\n' +
      'Upgrade: websocket\r\n' +
      'Connection: Upgrade\r\n' +
      `Sec-WebSocket-Accept: ${accept}\r\n\r\n`
    );

    this.socket = socket;
    this.parser = new FrameParser((frame) => this.handleFrame(frame));
    socket.on('data', (chunk) => this.parser.push(chunk));
    socket.on('close', () => { if (this.socket === socket) this.socket = null; });
    socket.on('error', () => { if (this.socket === socket) this.socket = null; });

    this.sendRaw({ type: 'hello', game: this.game, version: this.version, protocol: this.protocol });
    this.sendRaw({ type: 'ready' });
  }

  handleFrame(frame) {
    if (frame.type === 'close') {
      if (this.socket) { try { this.socket.end(); } catch { /* noop */ } }
      return;
    }
    if (frame.type !== 'text') return;
    let msg;
    try { msg = JSON.parse(frame.data); } catch { return; }
    if (msg.type === 'unlock') this.handleUnlock(msg);
    else if (msg.type === 'lock') this.handleLock(msg);
  }

  handleUnlock(msg) {
    if (this.sessionId) return; // reject second unlock while a session is active

    this.sessionId = msg.session_id;
    this.user = msg.user || null;
    this.remainingMs = Math.max(0, Number(msg.paid_seconds) || 0) * 1000;

    this.emit('unlock', {
      session_id: this.sessionId,
      user: this.user,
      paid_seconds: msg.paid_seconds,
    });

    this.startTimer();
  }

  handleLock(msg) {
    this.clearTimer();
    this.sessionId = null;
    this.user = null;
    this.remainingMs = 0;
    this.emit('lock', { reason: msg.reason });
  }

  startTimer() {
    this.clearTimer();
    const tickMs = 1000;
    this.timer = setInterval(() => {
      this.remainingMs = Math.max(0, this.remainingMs - tickMs);
      this.emit('tick', this.remainingMs);
      if (this.remainingMs <= 0) {
        this.clearTimer();
        this.emit('expired');
      }
    }, tickMs);
  }

  clearTimer() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  reportResult(score, status, meta) {
    if (!ALLOWED_STATUSES.includes(status)) {
      throw new Error(`StrivexSession.reportResult: unknown status "${status}"`);
    }

    const sessionId = this.sessionId;
    this.clearTimer();
    this.sessionId = null;
    this.user = null;
    this.remainingMs = 0;

    this.sendRaw({
      type: 'session_result',
      session_id: sessionId,
      score,
      status,
      meta,
    });
  }

  sendRaw(obj) {
    if (!this.socket || this.socket.destroyed) return;
    try {
      this.socket.write(encodeTextFrame(JSON.stringify(obj)));
    } catch { /* socket went away mid-write */ }
  }
}

module.exports = { StrivexSession };
