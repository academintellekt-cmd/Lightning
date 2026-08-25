// gateway/src/api.js (v2)
import { config } from './config.js';

async function raw(method, path, body) {
  const res = await fetch(`${config.serverUrl}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', 'X-Api-Key': config.apiKey },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res;
}

export const api = {
  // -> { ok: true, data } | { ok: false, status: 'expired' | 'none' }
  async lookupSession(uid) {
    const res = await raw('GET', `/lookup/${uid}`);
    if (res.status === 403) return { ok: false, status: 'expired' };
    if (res.status === 404) return { ok: false, status: 'none' };
    if (!res.ok) throw new Error(`lookup -> ${res.status}`);
    return { ok: true, data: await res.json() };
  },

  async postResult(result) {
    const res = await raw('POST', '/results', result);
    if (!res.ok) throw new Error(`postResult -> ${res.status}: ${await res.text()}`);
    return res.json();
  },

  async heartbeat(stationId, status, session) {
    const res = await raw('POST', `/stations/${stationId}/heartbeat`, {
      status,
      session_id: session?.session_id ?? null,
      started_at: session ? new Date(session.startedAt).toISOString() : null,
    });
    if (!res.ok) throw new Error(`heartbeat -> ${res.status}`);
    return res.json();
  },
};
