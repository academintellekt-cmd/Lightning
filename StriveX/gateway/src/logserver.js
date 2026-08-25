// gateway/src/logserver.js
// Tiny zero-dependency log UI for the station gateway.
// Wraps console.* to (a) still print to the terminal and (b) fan the same lines
// out to any browser connected to http://localhost:<GATEWAY_UI_PORT>.
//
// Routes (all bound to 127.0.0.1 only — no auth, localhost demo surface):
//   GET /        -> ../public/index.html
//   GET /events  -> Server-Sent Events: replays the ring buffer, then streams live
//   GET /status  -> JSON snapshot from the caller-supplied statusProvider()
//
// Logs live in memory only (last MAX_LINES). The durable audit trail is still
// data/results.jsonl — this UI is an observability window, not a store.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const INDEX_HTML = path.join(__dirname, '..', 'public', 'index.html');
const MAX_LINES = 500;

function safeStringify(v) {
  if (typeof v === 'string') return v;
  try { return JSON.stringify(v); } catch { return String(v); }
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (c) => { raw += c; if (raw.length > 1e6) req.destroy(); });
    req.on('end', () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch (e) { reject(e); } });
    req.on('error', reject);
  });
}

export function startLogServer({
  port = 4100,
  statusProvider = () => ({}),
  simEnabled = false,
  actions = {},
} = {}) {
  const buffer = [];        // ring buffer of { ts, level, msg }
  const clients = new Set(); // open SSE responses
  const startedAt = Date.now();

  // Keep original console methods so the log server never recurses into itself.
  const orig = {};
  for (const level of ['log', 'info', 'warn', 'error']) {
    orig[level] = console[level].bind(console);
    console[level] = (...args) => {
      orig[level](...args);
      const entry = { ts: Date.now(), level, msg: args.map(safeStringify).join(' ') };
      buffer.push(entry);
      if (buffer.length > MAX_LINES) buffer.shift();
      const frame = `data: ${JSON.stringify(entry)}\n\n`;
      for (const res of clients) res.write(frame);
    };
  }

  function sendJson(res, code, obj) {
    res.writeHead(code, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(obj));
  }

  const server = http.createServer(async (req, res) => {
    // --- Simulate panel actions (POST) ---
    if (req.method === 'POST' && (req.url === '/sim/tap' || req.url === '/sim/result')) {
      if (!simEnabled) return sendJson(res, 403, { error: 'simulation disabled (serial adapter)' });
      let body;
      try { body = await readJsonBody(req); } catch { return sendJson(res, 400, { error: 'invalid JSON' }); }
      try {
        if (req.url === '/sim/tap') {
          if (!body.uid) return sendJson(res, 400, { error: 'uid required' });
          await actions.tap?.(String(body.uid));
        } else {
          await actions.result?.({ status: body.status, value: body.value, meta: body.meta });
        }
        return sendJson(res, 200, { ok: true });
      } catch (e) {
        return sendJson(res, 409, { error: e.message });
      }
    }

    if (req.method !== 'GET') { res.writeHead(405); return res.end(); }

    if (req.url === '/' || req.url === '/index.html') {
      return fs.readFile(INDEX_HTML, (err, buf) => {
        if (err) { res.writeHead(500); return res.end('index.html missing'); }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(buf);
      });
    }

    if (req.url === '/status') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ ...statusProvider(), simEnabled, uptime_ms: Date.now() - startedAt }));
    }

    if (req.url === '/events') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      });
      for (const entry of buffer) res.write(`data: ${JSON.stringify(entry)}\n\n`);
      clients.add(res);
      req.on('close', () => clients.delete(res));
      return;
    }

    res.writeHead(404);
    res.end('not found');
  });

  // Never crash the gateway over the observability UI (e.g. port already in use).
  server.on('error', (e) => orig.error(`[logserver] disabled: ${e.message}`));
  server.listen(port, '127.0.0.1', () => {
    orig.log(`[gateway] log UI on http://localhost:${port}`);
  });

  return server;
}
