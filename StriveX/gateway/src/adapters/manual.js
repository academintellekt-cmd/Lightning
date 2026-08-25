// gateway/src/adapters/manual.js
// Human-driven adapter for demos: startGame does NOT auto-finish. The game
// outcome is emitted on demand from the gateway log UI's Simulate panel
// (POST /sim/result), which fires the same 'result' / 'failed' / 'timeout'
// events the real serial adapter would.
import { EventEmitter } from 'node:events';

export class ManualAdapter extends EventEmitter {
  startGame(sessionId) {
    console.log(`[manual] game started (session ${sessionId}) — waiting for a result from the UI`);
  }
  deny(reason) { console.log(`[manual] DENIED (${reason})`); }
  warnTimeLeft(seconds) { console.log(`[manual] TIME WARNING: ${seconds}s left`); }
}
