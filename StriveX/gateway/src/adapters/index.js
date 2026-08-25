// gateway/src/adapters/index.js
// Adapter contract (EventEmitter):
//   startGame(sessionId, session)  -- tell the game to unlock/start
//   deny()                         -- optional: signal "not authorized" (buzzer, red LED)
//   emits 'result' (value, meta) / 'failed' (meta) / 'timeout' () on outcome (mock/serial/manual)
//   emits 'session' ({value, status, meta}) on outcome instead (gameserver)
//   emits 'error' (Error) on failure -- gateway resets to idle

import { MockAdapter } from './mock.js';
import { ManualAdapter } from './manual.js';
import { SerialAdapter } from './serial.js';
import { GameServerAdapter } from './gameserver.js';

export function createAdapter(config) {
  switch (config.adapter) {
    case 'mock':
      return new MockAdapter();
    case 'manual':
      return new ManualAdapter();
    case 'serial':
      return new SerialAdapter(config.serialPort, config.serialBaud);
    case 'gameserver':
      return new GameServerAdapter(config.gameWsUrl);
    default:
      throw new Error(`Unknown adapter: ${config.adapter}`);
  }
}
