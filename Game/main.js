const{app,BrowserWindow,ipcMain,screen}=require('electron');
const path=require('path'),fs=require('fs');const{pathToFileURL}=require('url');
const{SerialBridge}=require('./lib/serial-bridge');const{StriveXProtocol}=require('./lib/strivex-protocol');const{StriveXSerial}=require('./lib/strivex-serial');const{StrivexSession}=require('./lib/strivex-session');const{DemoGateway}=require('./lib/demo-gateway');
const{Technician}=require('./lib/technician');const{SerialPort}=require('serialport');
let controlWindow,playerWindow,bridge,striveXSerial,striveXProtocol,striveXSession,striveXLog=[],runtimeConfig;
let technician,portChange=Promise.resolve(),lastState,stopDesignWatch;
const designMode=!app.isPackaged&&envBool('LIGHTNING_DESIGN_MODE',false);
if(designMode)app.setPath('userData',path.join(app.getPath('appData'),'Lightning-Preview'));
app.commandLine.appendSwitch('autoplay-policy','no-user-gesture-required');
function scanAudioFolder(root,folder){try{return fs.readdirSync(path.resolve(root,folder),{withFileTypes:true}).filter(e=>e.isFile()&&/\.(mp3|wav|ogg|m4a|aac)$/i.test(e.name)).map(e=>path.join(path.resolve(root,folder),e.name)).sort((a,b)=>a.localeCompare(b,undefined,{numeric:true,sensitivity:'base'})).map(file=>pathToFileURL(file).href)}catch{return[]}}
function envBool(name,fallback){if(process.env[name]===undefined)return fallback;return/^(1|true|yes|on)$/i.test(process.env[name])}
function config(){
  const base=JSON.parse(fs.readFileSync(path.join(__dirname,'config.json'),'utf8')),root=app.isPackaged?path.dirname(process.execPath):__dirname,external=path.join(root,'config.json'),custom=app.isPackaged&&fs.existsSync(external)?JSON.parse(fs.readFileSync(external,'utf8')):{},result={...base,...custom,audio:{...(base.audio||{}),...(custom.audio||{})},strivex:{...(base.strivex||{}),...(custom.strivex||{})}};
  result.strivex.enabled=envBool('STRIVEX_ENABLED',!!result.strivex.enabled);result.strivex.transport=process.env.STRIVEX_TRANSPORT||result.strivex.transport||'websocket';result.strivex.wsHost='127.0.0.1';result.strivex.wsPort=Number(process.env.STRIVEX_WS_PORT||result.strivex.wsPort||4200);result.strivex.port=process.env.STRIVEX_SERIAL_PORT||result.strivex.port||'';result.strivex.baudRate=Number(process.env.STRIVEX_SERIAL_BAUD||result.strivex.baudRate||115200);result.strivex.reconnectMs=Number(process.env.STRIVEX_RECONNECT_MS||result.strivex.reconnectMs||3000);
  result.designMode=designMode;result.interfaceTestMode=designMode||envBool('LIGHTNING_INTERFACE_TEST',false);
  if(designMode)result.serial={...result.serial,enabled:false};
  if(result.interfaceTestMode){result.strivex={...result.strivex,enabled:true,transport:'websocket',developmentMode:true,demoLobby:true};result.kiosk=false}
  result.audio.menuPlaylist=scanAudioFolder(root,result.audio.menuPlaylistFolder||'music/menu');result.audio.gamePlaylist=scanAudioFolder(root,result.audio.gamePlaylistFolder||'music/game');if(!result.audio.gamePlaylist.length)for(const ext of['mp3','wav','ogg','m4a','aac']){const legacy=path.join(root,'music',`game.${ext}`);if(fs.existsSync(legacy)){result.audio.gamePlaylist=[pathToFileURL(legacy).href];break}}result.audio.gamePlaylists={};for(const[mode,folder]of Object.entries(result.audio.modePlaylistFolders||{}))result.audio.gamePlaylists[mode]=scanAudioFolder(root,folder);return result;
}
function displays(c){const all=screen.getAllDisplays(),primary=screen.getPrimaryDisplay(),secondary=all.find(d=>d.id!==primary.id)||primary,pick=(v,f)=>Number.isInteger(v)&&all[v]?all[v]:f;return{control:c.controlDisplayIndex==='primary'?primary:pick(c.controlDisplayIndex,primary),player:c.playerDisplayIndex==='secondary'?secondary:pick(c.playerDisplayIndex,secondary)}}
function createWindow(display,page,c){
  const bounds=designMode?require('./lib/design-mode').designBounds(screen.getPrimaryDisplay().workArea,page==='control.html'):display.bounds;
  const w=new BrowserWindow({...bounds,frame:!!c.interfaceTestMode,resizable:true,fullscreen:!!c.kiosk,kiosk:!!c.kiosk,title:`Lightning — ${page==='control.html'?'Control':'Player'}`,autoHideMenuBar:true,backgroundColor:'#030613',webPreferences:{preload:path.join(__dirname,'preload.js'),contextIsolation:true,nodeIntegration:false,backgroundThrottling:false}});
  if(c.interfaceTestMode){let bracelet='';w.webContents.on('before-input-event',(event,input)=>{
    if(input.type!=='keyDown'||input.isAutoRepeat)return;
    if(input.key==='F12'||input.control&&input.shift&&input.key.toLowerCase()==='i'){event.preventDefault();w.webContents.toggleDevTools();return}
    if(input.control||input.alt||input.meta||technician?.staff)return;
    const key=TEST_KEYS[input.key.toUpperCase()];if(key&&!technician.blocked){event.preventDefault();emit('test-hit',{player:key[0],slot:key[1]});return}
    if(/^[0-9]$/.test(input.key))bracelet=(bracelet+input.key).slice(-6);
    else if(input.key==='Enter'&&bracelet){striveXSession?.tap?.(bracelet);bracelet='';event.preventDefault()}
    else if(input.key==='Backspace')bracelet=bracelet.slice(0,-1);else if(input.key==='Escape')bracelet='';
  });if(page==='control.html')w.webContents.on('did-start-loading',()=>{lastState=null;striveXSession?.resetPreview?.()})}
  w.webContents.on('did-finish-load',()=>{if(page==='player.html'&&lastState)w.webContents.send('state-update',lastState);w.webContents.send('tech-state',technician.snapshot())});
  if(designMode)w.on('close',()=>setImmediate(()=>app.quit()));w.loadFile(path.join(__dirname,'public',page));return w;
}
function emit(channel,payload){controlWindow?.webContents.send(channel,payload)}
function log(item){const entry={time:new Date().toISOString(),...item};striveXLog.push(entry);if(striveXLog.length>300)striveXLog.shift();console.log('[StriveX]',JSON.stringify(entry));emit('strivex-log',entry)}
function webSocketSnapshot(){return{...(striveXSession?.snapshot()||{transport:'websocket',connected:false,state:'disconnected'}),enabled:runtimeConfig.strivex.enabled,developmentMode:runtimeConfig.strivex.developmentMode,log:[...striveXLog]}}
function setupWebSocket(c){
  const demo=!!(c.strivex.demoLobby&&c.strivex.developmentMode);
  striveXSession=demo?new DemoGateway({paidSeconds:300}):new StrivexSession({host:'127.0.0.1',port:c.strivex.wsPort,game:'lightning',version:app.getVersion(),protocol:1});
  striveXSession.on('technician',message=>technician.gateway(message));
  if(demo)log({event:'demo_lobby_enabled'});
  striveXSession.on('listening',address=>{log({event:'websocket_listening',...address});emit('strivex-status',webSocketSnapshot())});striveXSession.on('connection',status=>{log({event:status.connected?'gateway_connected':'gateway_disconnected'});emit('strivex-status',webSocketSnapshot())});
  striveXSession.on('unlock',payload=>{log({event:'unlock',sessionId:payload.session_id,user:payload.user});emit('strivex-event',{type:'unlock',...payload});emit('strivex-status',webSocketSnapshot())});striveXSession.on('lock',payload=>{log({event:'lock',reason:payload.reason});emit('strivex-event',{type:'lock',...payload})});striveXSession.on('tick',remainingMs=>emit('strivex-event',{type:'tick',remainingMs}));striveXSession.on('expired',payload=>{log({event:'paid_time_expired',sessionId:payload.session_id});emit('strivex-event',{type:'expired',...payload})});striveXSession.on('lobby',payload=>emit('strivex-event',{type:'lobby',...payload}));striveXSession.on('protocol-error',error=>log({event:'protocol_error',message:error.message}));striveXSession.on('error',error=>{log({event:'websocket_error',message:error.message});emit('strivex-status',{...webSocketSnapshot(),state:'error',error:error.message})});striveXSession.on('scan',payload=>emit('strivex-event',{type:'scan',...payload}));striveXSession.on('start-denied',payload=>{log({event:'start_denied',reason:payload.reason});emit('strivex-event',{type:'start_denied',...payload})});striveXSession.on('profile',payload=>emit('strivex-event',{type:'profile',...payload}));striveXSession.on('avatar-saved',payload=>emit('strivex-event',{type:'avatar_saved',...payload}));striveXSession.start();
}
function setupLegacySerial(c){let transport=null;striveXProtocol=new StriveXProtocol({sendLine:line=>transport?.send(line)||false,log});striveXProtocol.on('start',x=>emit('strivex-event',{type:'start',...x}));striveXProtocol.on('deny',x=>emit('strivex-event',{type:'deny',...x}));striveXProtocol.on('status',x=>emit('strivex-status',x));if(c.strivex.enabled){transport=striveXSerial=new StriveXSerial(c.strivex,striveXProtocol,log);transport.start()}else if(c.strivex.developmentMode)striveXProtocol.setConnected(true)}
function setupStriveX(c){
  if(c.strivex.transport==='websocket')setupWebSocket(c);else setupLegacySerial(c);
  ipcMain.handle('strivex-snapshot',()=>c.strivex.transport==='websocket'?webSocketSnapshot():({...striveXProtocol.snapshot(),enabled:c.strivex.enabled,developmentMode:c.strivex.developmentMode,log:[...striveXLog]}));
  ipcMain.on('strivex-final',(_event,x)=>{try{if(c.strivex.transport==='websocket'){const status=x?.status||(x?.type==='timeout'?'timeout':x?.type==='failed'?'failed':x?.type==='error'?'failed':'completed');const sent=striveXSession.reportResult(Number(x?.number)||0,status,x?.meta||{});log({event:'session_result',status,score:Number(x?.number)||0,sent})}else if(x?.type==='result')striveXProtocol.result(x.number,x.meta);else if(x?.type==='failed')striveXProtocol.failed(x.meta);else if(x?.type==='timeout')striveXProtocol.timeout();else if(x?.type==='error')striveXProtocol.error(x.message)}catch(error){log({event:'result_error',message:error.message})}});
  ipcMain.on('strivex-lobby',(_event,x)=>{if(c.strivex.transport!=='websocket'||!striveXSession)return;if(x?.type==='start')striveXSession.lobbyStart({mode:x.mode,variant:x.variant,difficulty:x.difficulty,durationMinutes:x.durationMinutes});else if(x?.type==='remove')striveXSession.lobbyRemove(String(x.uid||''));else if(x?.type==='reset')striveXSession.lobbyReset();else if(x?.type==='demo-reset'&&c.interfaceTestMode)striveXSession.resetPreview?.();else if(x?.type==='profile'&&typeof striveXSession.requestProfile==='function')striveXSession.requestProfile(String(x.uid||''));else if(x?.type==='avatar_save'&&typeof striveXSession.saveAvatar==='function')striveXSession.saveAvatar(String(x.uid||''),x.avatar);else if(x?.type==='demo-tap'&&typeof striveXSession.tap==='function')striveXSession.tap(String(x.code||''))});
  ipcMain.on('strivex-simulate',(_event,x)=>{if(!c.strivex.developmentMode)return;if(c.strivex.transport==='websocket'){if(x?.type==='start')striveXSession.unlock?.({session_id:x.sessionId||`SIM-${Date.now()}`,user:{uid:'SIM',name:'Test Player'},paid_seconds:x.paid_seconds||300});else if(x?.type==='timeout')emit('strivex-event',{type:'expired',session_id:striveXSession.sessionId})}else if(x?.type==='start')striveXProtocol.feed(`START:${x.sessionId||`SIM-${Date.now()}`}\n`);else if(x?.type==='deny')striveXProtocol.feed(`DENY:${x.reason||'simulated'}\n`);else if(x?.type==='result')striveXProtocol.result(Number(x.number)||0,{simulated:true});else if(x?.type==='failed')striveXProtocol.failed({fail_reason:'simulated'});else if(x?.type==='timeout')striveXProtocol.timeout()});
}
// Interface-test mode: no physical joysticks on hand. Each side gets 6 keys
// mapped to slot indices 0-5, not fixed board positions -- the renderer
// resolves a slot to whichever position is currently active for that player,
// since activeButtonsMax can light any of the 16 positions per round.
const TEST_KEYS={Q:[0,0],W:[0,1],E:[0,2],R:[0,3],T:[0,4],Y:[0,5],B:[1,0],N:[1,1],M:[1,2],',':[1,3],'.':[1,4],'/':[1,5]};
async function refreshPorts(){try{technician.ports=(await SerialPort.list()).map(p=>p.path);technician.publish()}catch(error){technician.error=error.message;technician.publish()}}
async function configurePort(port){
  await bridge?.stop();technician.ledStatus({connected:false,path:port});
  bridge=new SerialBridge({...runtimeConfig.serial,enabled:port!=='off',port},s=>{
    const changed=technician.led.connected!==s.connected;
    technician.ledStatus(s);emit('serial-status',s);
    if(s.connected&&(changed||s.message?.includes('READY')))bridge.send(technician.calibration?`CAL ${technician.calibration.channel+1}`:technician.staff||technician.blocked?'CLEAR':'MODE IDLE');
  });await bridge.start();
}
app.whenReady().then(async()=>{
  runtimeConfig=config();technician=new Technician({file:path.join(app.getPath('userData'),'technician-settings.json'),port:runtimeConfig.serial.enabled===false?'off':runtimeConfig.serial.port||'auto'});
  technician.on('change',s=>{for(const w of[controlWindow,playerWindow])w?.webContents.send('tech-state',s)});
  technician.on('enter',()=>emit('technician-enter',{}));
  technician.on('calibrate',channel=>bridge?.send(channel<0?(technician.staff||technician.blocked?'CLEAR':'MODE IDLE'):`CAL ${channel+1}`));
  technician.on('pulse',slot=>bridge?.send(`CAL ${slot+1}`));
  technician.on('hit',(player,pos)=>emit('mapped-hit',{player,pos}));
  technician.on('ports',refreshPorts);
  technician.on('port',port=>{portChange=portChange.then(()=>configurePort(port)).catch(error=>{technician.error=error.message;technician.publish()})});
  technician.on('gateway-command',action=>{if(!striveXSession?.technicianCommand(action))throw Error('Нет связи с Gateway')});
  const d=displays(runtimeConfig);setupStriveX(runtimeConfig);
  ipcMain.handle('get-config',()=>runtimeConfig);
  ipcMain.on('state-update',(e,s)=>{if(e.sender===controlWindow?.webContents){lastState=s;playerWindow?.webContents.send('state-update',s)}});
  ipcMain.on('serial-command',(e,x)=>{if(e.sender===controlWindow?.webContents&&!technician.staff&&!technician.blocked)bridge?.send(x)});
  ipcMain.handle('tech-snapshot',()=>technician.snapshot());
  ipcMain.handle('tech-command',(e,x)=>{if(e.sender!==controlWindow?.webContents)return technician.snapshot();try{return technician.command(x)}catch(error){technician.error=error.message;technician.publish();return technician.snapshot()}});
  ipcMain.on('gamepad-frame',(e,x)=>{if(e.sender!==controlWindow?.webContents)return;try{technician.input(x)}catch(error){technician.error=error.message;technician.publish()}});
  controlWindow=createWindow(d.control,'control.html',runtimeConfig);playerWindow=createWindow(d.player,'player.html',runtimeConfig);
  controlWindow.webContents.once('did-finish-load',()=>emit('strivex-status',runtimeConfig.strivex.transport==='websocket'?webSocketSnapshot():striveXProtocol.snapshot()));
  if(designMode)stopDesignWatch=require('./lib/design-mode').watchDesign(__dirname,()=>[controlWindow,playerWindow]);await configurePort(technician.settings.ledPort);await refreshPorts();
});
app.on('window-all-closed',()=>app.quit());app.on('before-quit',()=>{stopDesignWatch?.();bridge?.stop();striveXSerial?.stop();striveXSession?.stop()});
