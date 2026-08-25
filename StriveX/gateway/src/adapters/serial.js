// gateway/src/adapters/serial.js (v2)
// Gateway -> MCU:  START:<session_id>\n | DENY:<reason>\n
// MCU -> Gateway:  RESULT:<number>[:<json meta>]\n
//                  FAILED[:<json meta>]\n
//                  TIMEOUT\n | ERROR:<msg>\n | READY\n
import { EventEmitter } from 'node:events';
import { SerialPort } from 'serialport';
import { ReadlineParser } from '@serialport/parser-readline';

function parseMeta(str) {
  if (!str) return undefined;
  try { return JSON.parse(str); } catch { return { raw: str }; }
}

export class SerialAdapter extends EventEmitter {
  constructor(path, baudRate) {
    super();
    this.port = new SerialPort({ path, baudRate });
    this.parser = this.port.pipe(new ReadlineParser({ delimiter: '\n' }));
    this.parser.on('data', (line) => this.onLine(line.trim()));
    this.port.on('error', (err) => this.emit('error', err));
  }

  onLine(line) {
    if (line.startsWith('RESULT:')) {
      const rest = line.slice(7);
      const sep = rest.indexOf(':');
      const valueStr = sep === -1 ? rest : rest.slice(0, sep);
      const value = parseFloat(valueStr);
      if (Number.isNaN(value)) return this.emit('error', new Error(`Bad RESULT: ${line}`));
      this.emit('result', value, sep === -1 ? undefined : parseMeta(rest.slice(sep + 1)));
    } else if (line.startsWith('FAILED')) {
      this.emit('failed', parseMeta(line.slice(7)));
    } else if (line === 'TIMEOUT') {
      this.emit('timeout');
    } else if (line.startsWith('ERROR:')) {
      this.emit('error', new Error(line.slice(6)));
    } else if (line === 'READY') {
      console.log('[serial] game MCU ready');
    } else if (line) {
      console.log('[serial] unrecognized line:', line);
    }
  }

  startGame(sessionId) { this.port.write(`START:${sessionId}\n`); }
  deny(reason) { this.port.write(`DENY:${reason || 'na'}\n`); }
}
