// gateway/src/config.js
import 'dotenv/config';

function required(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing required env var: ${name}`);
    process.exit(1);
  }
  return v;
}

export const config = {
  stationId: required('STATION_ID'),
  serverUrl: required('SERVER_URL'),
  adapter: process.env.ADAPTER || 'mock', // mock | manual | serial | gameserver
  serialPort: process.env.SERIAL_PORT || '/dev/ttyUSB0',
  serialBaud: parseInt(process.env.SERIAL_BAUD || '115200', 10),
  heartbeatIntervalMs: parseInt(process.env.HEARTBEAT_MS || '30000', 10),
  dataDir: process.env.DATA_DIR || './data',
  gameTimeoutMs: parseInt(process.env.GAME_TIMEOUT_MS || '120000', 10),
  gameWsUrl: process.env.GAME_WS_URL || 'ws://127.0.0.1:4200',
  apiKey: process.env.STATION_KEY || '',
  uiPort: parseInt(process.env.GATEWAY_UI_PORT || '4100', 10),
};
