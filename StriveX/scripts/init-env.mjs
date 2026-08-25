// scripts/init-env.mjs
// One-time dev bootstrap: create gateway/.env from the example if it's missing,
// pointed at the local server so `npm run dev` works end-to-end on one machine.
// The server needs no .env in dev (AUTH_DISABLED=1 is passed by the dev script).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const example = path.join(root, 'gateway', '.env.example');
const target = path.join(root, 'gateway', '.env');

if (fs.existsSync(target)) {
  console.log('[setup] gateway/.env already exists — leaving it untouched');
} else if (!fs.existsSync(example)) {
  console.warn('[setup] gateway/.env.example not found — skipping');
} else {
  // Default example points SERVER_URL at a station LAN address and uses the auto
  // 'mock' adapter; for a single-machine dev demo we want localhost + the 'manual'
  // adapter so the whole flow is driven from the gateway UI's Simulate panel.
  const contents = fs.readFileSync(example, 'utf8')
    .replace(/^SERVER_URL=.*$/m, 'SERVER_URL=http://localhost:3000')
    .replace(/^ADAPTER=.*$/m, 'ADAPTER=manual          # mock | manual | serial');
  fs.writeFileSync(target, contents);
  console.log('[setup] created gateway/.env (SERVER_URL=http://localhost:3000, ADAPTER=manual)');
}
