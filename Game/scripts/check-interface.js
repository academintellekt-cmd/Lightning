// Real main/preload/renderers, with an in-process Gateway and simulated hardware.
const{app,BrowserWindow,ipcMain}=require('electron');
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const designCheck=process.argv.includes('--design');
const out=path.join(__dirname,'..','.tmp','interface-ui');fs.mkdirSync(out,{recursive:true});
const localProfile=fs.mkdtempSync(path.join(out,'profile-'));app.setPath('userData',localProfile);
const requestedProfiles=[],setPath=app.setPath.bind(app);app.setPath=(name,value)=>{if(name==='userData'){requestedProfiles.push(value);return setPath(name,localProfile)}return setPath(name,value)};app.disableHardwareAcceleration();app.commandLine.appendSwitch('in-process-gpu');app.commandLine.appendSwitch('no-sandbox');
process.env.LIGHTNING_INTERFACE_TEST='1';if(designCheck)process.env.LIGHTNING_DESIGN_MODE='1';else delete process.env.LIGHTNING_DESIGN_MODE;
let control,player,latest,preview=false;const errors=[],states=[],finals=[];
class TestSerial{constructor(config,status){this.status=status}async start(){this.status({connected:false,path:'off'})}async stop(){}send(){}}
require('../lib/serial-bridge');require.cache[require.resolve('../lib/serial-bridge')].exports={SerialBridge:TestSerial};require('serialport').SerialPort.list=async()=>[];
const handle=ipcMain.handle.bind(ipcMain);ipcMain.handle=(channel,fn)=>handle(channel,async(...args)=>{const value=await fn(...args);return channel==='get-config'?{...value,interfaceTestMode:preview,durationOptionsMinutes:[.06],countdownSeconds:1,gameOverSeconds:.2,resultSeconds:.3,leaderboardSeconds:.3,audio:{...value.audio,enabled:false}}:value});
ipcMain.on('state-update',(_e,s)=>{latest=s;states.push(s)});ipcMain.on('strivex-final',(_e,s)=>finals.push(s));
app.on('browser-window-created',(_e,w)=>w.hide());app.on('web-contents-created',(_e,wc)=>wc.on('console-message',e=>{if(e.level==='error'&&!e.message.includes('ERR_FILE_NOT_FOUND'))errors.push(e.message)}));
require('../main');
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,label){for(let i=0;i<1000;i++){if(await fn())return;await pause(15)}throw Error('Timed out: '+label)}
const run=(code,w=control)=>w.webContents.executeJavaScript(code);
const click=selector=>run(`document.querySelector(${JSON.stringify(selector)}).click();true`);
const tap=code=>run(`lightning.striveXLobby({type:'demo-tap',code:${JSON.stringify(code)}});true`);
async function capture(name,w=control){await pause(80);fs.writeFileSync(path.join(out,name+'.png'),(await w.webContents.capturePage()).toPNG())}
async function panel(value){await run(`if(document.querySelector('.preview-panel').hidden)document.querySelector('.preview-toggle').click();true`);await click(`[data-preview="${value}"]`)}
const timeout=setTimeout(()=>{console.error('Interface test timeout',errors);app.exit(1)},60000);
app.whenReady().then(async()=>{try{
  await until(()=>latest&&BrowserWindow.getAllWindows().length===2,'windows loaded');control=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('control.html'));player=BrowserWindow.getAllWindows().find(w=>w!==control);
  if(designCheck){const c=control.getBounds(),p=player.getBounds();assert(c.x+c.width<=p.x,'design windows sit side by side');assert(requestedProfiles.some(p=>p.endsWith('Lightning-Preview')),'design profile is isolated')}
  control.setContentSize(540,960);player.setContentSize(1280,720);
  await run(`Object.defineProperty(navigator,'getGamepads',{value:()=>[0,1].map(index=>({index,id:'Test Encoder '+index,buttons:Array.from({length:12},()=>({pressed:false,value:0})),axes:[0,0]}))});true`);
  assert.equal(await run(`!!document.querySelector('.preview-tools')`),false,'normal renderer has no test panel');
  const startTop=await run(`document.querySelector('[data-lobby-start]').getBoundingClientRect().top`);
  assert(await run(`!!document.querySelector('.lobby-tap')`));await tap('111');await tap('222');await until(()=>latest.lobbyPlayers.length===2,'two bracelets');
  if(designCheck){const css=path.join(__dirname,'..','public','interface.css');fs.writeFileSync(css,fs.readFileSync(css));await until(()=>run(`!!document.querySelector('link[href*=designRefresh]')`),'live CSS refresh');assert.equal(latest.lobbyPlayers.length,2,'CSS refresh preserves the pair')}
  assert.equal(await run(`!!document.querySelector('.lobby-tap,.lobby-choice')`),false);
  assert(Math.abs(startTop-await run(`document.querySelector('[data-lobby-start]').getBoundingClientRect().top`))<2,'START stays still');
  await click('[data-lobby-remove="DEMO-222"]');await click('[data-lobby-confirm="yes"]');await until(()=>latest.lobbyPlayers.length===1,'remove player');assert(await run(`!!document.querySelector('.lobby-tap')`));await tap('222');await until(()=>latest.lobbyPlayers.length===2,'rescan');
  await click('[data-lobby-start]');await until(()=>latest.phase==='countdown','direct countdown');assert(!states.some(s=>s.phase==='ready'),'no additional button-wait stage');assert.equal(await run(`!!document.querySelector('[data-lobby-enter],[data-action="quitGame"]')`),false);
  await until(()=>latest.phase==='game','game');control.webContents.send('strivex-event',{type:'tick',remainingMs:75000});await pause(60);
  const clocks=await Promise.all([run(`document.querySelector('.control-game-timer').textContent`),run(`document.querySelector('.timer').textContent`,player)]);assert.equal(clocks[0],clocks[1]);assert(!clocks[0].startsWith('01:'),'round time instead of paid balance');
  await capture('game-control');await capture('game-player',player);await until(()=>latest.phase==='lobby','complete cycle');assert.equal(finals.length,1);assert.equal(finals[0].status,'completed');assert.equal(latest.lobbyPlayers.length,0);assert.equal(latest.sessionPlayers.length,0);assert(await run(`document.querySelector('[data-lobby-start]').disabled`));
  const productionBoard=await run(`localStorage.getItem('lightning.board')`);
  preview=true;await player.webContents.reloadIgnoringCache();await pause(100);control.webContents.reloadIgnoringCache();await until(()=>run(`!!document.querySelector('.preview-tools')`),'preview loaded');await click('[data-collapse]');
  for(const[width,height]of[[440,850],[540,960],[1080,1920],[1280,800]]){
    control.setContentSize(width,height);await pause(80);
    let reference;
    for(const mode of['classic','colorMatch','catchColor','paint']){
      await click(`[data-lobby-mode="${mode}"]`);const geometry=await run(`(()=>{const list=document.querySelector('.lobby-col>.lobby-list'),row=list.querySelector('.lobby-row'),start=document.querySelector('[data-lobby-start]').getBoundingClientRect(),duel=document.querySelector('.lobby-duel').getBoundingClientRect();return{top:start.top,bottom:start.bottom,duelTop:duel.top,duelBottom:duel.bottom,left:start.left,right:start.right,height:innerHeight,width:innerWidth,listHeight:list.clientHeight,rowHeight:row.getBoundingClientRect().height,gap:parseFloat(getComputedStyle(list).gap)}})()`);
      assert(geometry.bottom<=geometry.height+1&&geometry.left>=0&&geometry.right<=geometry.width+1,`START fits ${width}x${height} ${mode}`);assert(geometry.duelBottom<=geometry.top+1,'duel never overlaps START');
      assert(Math.abs(geometry.listHeight-(geometry.rowHeight*5+geometry.gap*4))<2,'list reserves five rows');
      if(reference===undefined)reference=geometry.top;else assert(Math.abs(reference-geometry.top)<2,'START does not move across modes');
    }
    await capture(`lobby-${width}x${height}`);
  }
  control.setContentSize(540,960);
  for(const mode of ['classic','replacement','independent','duel','colorMatch','colorSequence','paint','catchColor','intersection','pong']){await panel('game');await run(`(()=>{const select=document.querySelector('[data-preview-mode]');select.value=${JSON.stringify(mode)};select.dispatchEvent(new Event('change',{bubbles:true}))})();true`);assert.equal(latest.mode,mode);assert.equal(latest.phase,'game')}
  for(const phase of ['ready','gameover','countdown']){await panel(phase);assert.equal(latest.phase,phase)}
  await panel('results');await click('[data-collapse]');await capture('results-control');await capture('results-player',player);
  await panel('leaderboard');await click('[data-collapse]');assert.equal(await run(`!!document.querySelector('.language-widget,[data-action="back"]')`),false);await capture('leaders-control');await capture('leaders-player',player);
  await panel('rules');assert(await run(`!!document.querySelector('.lobby-modal')`));await panel('lobby');await click('[data-collapse]');
  await click('[data-lobby-mode="classic"]');await tap('111');await tap('222');await until(()=>latest.lobbyPlayers.length===2,'preview pair');await click('[data-lobby-start]');await until(()=>latest.phase==='game','preview game');
  await until(()=>latest.phase==='lobby','preview complete');assert.equal(latest.lobbyPlayers.length,0);assert.equal(await run(`localStorage.getItem('lightning.board')`),productionBoard,'preview leaves real records unchanged');
  assert.equal(errors.length,0,errors.join('\n'));console.log('PASS: direct normal start, two round clocks, one result, fresh bracelets, fixed START, five rows, 4 viewport sizes, preview screens and isolated records. Screenshots: '+out);clearTimeout(timeout);control.destroy();player.destroy();app.exit(0);
}catch(error){console.error(error,errors);clearTimeout(timeout);app.exit(1)}});
