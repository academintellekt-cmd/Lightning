// gateway/src/adapters/mock.js (v2) — simulates completed/failed/abandoned outcomes
import { EventEmitter } from 'node:events';

export class MockAdapter extends EventEmitter {
  startGame(sessionId) {
    console.log(`[mock] game started (session ${sessionId}), finishing in 3s...`);
    setTimeout(() => {
      const roll = Math.random();
      if (roll < 0.7) {
        this.emit('result', Math.round(Math.random() * 1000),
          { level_reached: 1 + Math.floor(Math.random() * 10) });
      } else if (roll < 0.9) {
        this.emit('failed', { fail_reason: 'wrong_answer', level_reached: 1 + Math.floor(Math.random() * 5) });
      } else {
        this.emit('timeout');
      }
    }, 3000);
  }
  deny(reason) { console.log(`[mock] DENIED (${reason})`); }
  warnTimeLeft(seconds) { console.log(`[mock] TIME WARNING: ${seconds}s left (would show on screen)`); }
}
