// strivex-game-client/preload.js
//
// Exposes window.strivex in the renderer via contextBridge. The host app's
// main process is responsible for forwarding StrivexSession events over the
// matching IPC channels (see strivex-game-client/README.md) — this file only
// wires the renderer side of that channel contract.

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('strivex', {
  onUnlock: (cb) => ipcRenderer.on('strivex:unlock', (_event, payload) => cb(payload)),
  onLock: (cb) => ipcRenderer.on('strivex:lock', (_event, payload) => cb(payload)),
  onTick: (cb) => ipcRenderer.on('strivex:tick', (_event, remainingMs) => cb(remainingMs)),
  reportResult: (score, status, meta) => ipcRenderer.invoke('strivex:report-result', score, status, meta),
});
