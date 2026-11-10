// Wiring checks for the next-game queue on the control screen: string checks against main.js / app.js / control.html.
const assert=require('assert');const fs=require('fs');const path=require('path');
const root=path.join(__dirname,'..');
const read=(...p)=>fs.readFileSync(path.join(root,...p),'utf8');
const main=read('main.js'),app=read('public','app.js'),control=read('public','control.html'),player=read('public','player.html');
const fn=n=>{const i=app.indexOf('function '+n+'(');return i<0?'':app.slice(i,app.indexOf('\n  function ',i+1)>0?app.indexOf('\n  function ',i+1):undefined)};

assert(main.includes("striveXSession.on('queue',x=>{lastQueue=x;emit('strivex-event',{type:'queue',...x})})"),'main forwards queue events');
assert(main.includes("x?.type==='queue_open'&&typeof striveXSession.queueOpen==='function'")&&main.includes("x?.type==='queue_done'&&typeof striveXSession.queueDone==='function'")&&main.includes("x?.type==='queue_cancel'&&typeof striveXSession.queueCancel==='function'"),'main sends the three queue commands');
assert(main.indexOf("transport!=='websocket'||!striveXSession")<main.indexOf("x?.type==='queue_open'"),'queue commands sit behind the websocket/session guard');
assert(main.includes('queue:lastQueue')&&main.includes('if(!status.connected)lastQueue=null'),'snapshot carries the last queue and drops it on disconnect');
assert(control.includes('../lib/scan-route.js')&&control.indexOf('scan-route.js')<control.indexOf('app.js'),'scan-route is loaded before app.js');
assert(read('eslint.config.mjs').includes("ScanRoute: 'readonly'"),'ESLint knows ScanRoute');
assert(read('package.json').includes('node --test tests/scan-route.test.js')&&read('package.json').includes('node tests/lobby-wiring.test.js'),'both new test files are in the check list');
assert(!/queue|scan-route/i.test(player),'player screen is untouched');
assert(!/queue/i.test(read('preload.js')),'preload is unchanged: commands go through striveXLobby');

assert(app.includes("'queue-open':'queue_open'")&&app.includes("'queue-done':'queue_done'")&&app.includes("'queue-cancel':'queue_cancel'"),'queue buttons map to commands');
assert(fn('queueAction').includes('QUEUE_ACTIONS[a]')&&fn('queueAction').includes('lightning.striveXLobby({type:QUEUE_ACTIONS[a]})'),'queue buttons send their commands');
assert(fn('queueAction').includes('queueShown()'),'no queue command is sent while the strip is hidden');
assert(app.includes("queueHost.addEventListener('click'")&&(app.match(/queueHost\.addEventListener/g)||[]).length===1,'the strip outside the lobby uses one delegated click handler');
assert(app.includes('QUEUE_ACTIONS[qa]'),'the lobby strip sends its commands through the screen click handler');
assert(fn('render').includes("role==='control'")&&fn('render').includes('queueSync()'),'every control render syncs the strip, including the early-return branches');
assert(fn('render').indexOf('queueSync()')<fn('render').indexOf("if(state.phase==='lobby')"),'the strip is synced before any branch can return');
assert(!fn('render').includes('queueBar'),'the strip does not live in the re-rendered screen markup');
assert(fn('queueSync').includes('html!==queueHtml'),'the strip is touched only when its markup changed');
assert(fn('queueSync').includes("state.phase==='lobby'?''"),'the lobby draws its own strip');
assert(fn('queueShown').includes("role==='control'"),'strip is drawn only on the control role');
assert(fn('queueShown').includes('!quitConfirm'),'strip is hidden under the quit-confirm modal');
assert(fn('queueShown').includes('technicianState.staff')&&fn('queueShown').includes('technicianState.blocked')&&fn('queueShown').includes('technicianState.calibration'),'strip is hidden under the technician layer and calibration');
assert(fn('queueShown').includes('gatewaySessionActive')&&fn('queueShown').includes("queue?.state==='reserved'")&&fn('queueShown').includes("state.phase==='lobby'"),'a session shows the strip everywhere; without one only the reserved state on the lobby');
assert(fn('queueView').includes('queueSeen')&&fn('queueView').includes('gatewaySessionActive')&&fn('queueView').includes("==='none'"),'join is offered only after the Gateway announced the queue on this connection');
assert(fn('lobbyView').includes('queue:queueShown()?{...queueView(),note:queueNote}:null'),'the lobby receives the queue view only while the strip is shown');
assert(app.includes("if(!striveX.connected){queueSeen=false;setQueue(null)}"),'queue view is cleared when the Gateway connection drops');
assert(fn('setQueue').includes("role==='control'")&&fn('setQueue').includes('clearInterval(queueTimer)')&&(fn('setQueue').match(/setInterval/g)||[]).length===1,'one countdown interval, cleared on every queue change, control only');
assert(fn('setQueueNote').includes('5000')&&fn('setQueueNote').includes('clearTimeout(queueNoteTimer)'),'the denial line lasts 5 s and is replaced, not stacked');
assert(!fn('queueTick').includes('app.innerHTML')&&!fn('queueTick').includes('render()'),'the countdown does not rewrite the screen');
assert(app.includes("event.type==='queue'){")&&app.includes("queueSeen=true;setQueue(event.state==='none'?null:event)"),'queue events update the view');
assert(app.includes('ScanRoute.scanRoute(event,{session:gatewaySessionActive,queue,overlayType:lobbyOverlay?.type})'),'scan goes through ScanRoute with the session flag');
assert(!/event\.state==='denied'\)setLobbyOverlay/.test(app),'no direct denied overlay is left outside ScanRoute');
assert(app.includes('if(s.queue&&!queueSeen)'),'the snapshot restores the queue once');
assert(app.includes('technicianState=s;')&&app.includes('queueShown()!==queueWasShown'),'the strip follows the technician layer opening and closing');

console.log('lobby wiring tests passed');
