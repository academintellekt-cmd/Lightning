// Runs the real two-window application with simulated USB/Arduino hardware.
const{app,BrowserWindow,ipcMain}=require('electron');
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const out=path.join(__dirname,'..','.tmp','technician-ui');fs.mkdirSync(out,{recursive:true});
app.setPath('userData',fs.mkdtempSync(path.join(out,'profile-')));app.disableHardwareAcceleration();app.commandLine.appendSwitch('in-process-gpu');app.commandLine.appendSwitch('no-sandbox');process.env.LIGHTNING_INTERFACE_TEST='1';
let control,player,latest;const commands=[],errors=[];
class TestSerial{
  constructor(config,onStatus){this.config=config;this.onStatus=onStatus}
  async start(){this.onStatus({connected:this.config.enabled,path:this.config.port})}
  async stop(){}
  send(command){commands.push(command)}
}
require('../lib/serial-bridge');require.cache[require.resolve('../lib/serial-bridge')].exports={SerialBridge:TestSerial};
require('serialport').SerialPort.list=async()=>[{path:'COM99'}];
const handle=ipcMain.handle.bind(ipcMain);ipcMain.handle=(channel,fn)=>handle(channel,async(...args)=>{const result=await fn(...args);return channel==='get-config'?{...result,countdownSeconds:1,audio:{...result.audio,enabled:false}}:result});
ipcMain.on('state-update',(_e,s)=>{latest=s});
app.on('browser-window-created',(_e,w)=>w.hide());
app.on('web-contents-created',(_e,wc)=>wc.on('console-message',e=>{if(e.level==='error'&&!e.message.includes('ERR_FILE_NOT_FOUND'))errors.push(e.message)}));
require('../main');
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,label){for(let i=0;i<1000;i++){if(await fn())return;await pause(20)}throw Error('Timed out: '+label)}
const run=(code,w=control)=>w.webContents.executeJavaScript(code);
const click=selector=>run(`document.querySelector(${JSON.stringify(selector)}).click();true`);
const snapshot=()=>run('lightning.getTechnician()');
async function scan(code,w=control){for(const keyCode of [...code,'Return']){w.webContents.sendInputEvent({type:'keyDown',keyCode});w.webContents.sendInputEvent({type:'keyUp',keyCode});await pause(20)}}
async function input(slot,down){
  const pad=slot%2,position=Math.floor(slot/2);
  await run(`(()=>{const p=testPads[${pad}];p.buttons.forEach(b=>b.pressed=false);p.axes=[0,0];${down?(position<12?`p.buttons[${position}].pressed=true;`:`p.axes=${JSON.stringify([[0,-1],[0,1],[-1,0],[1,0]][position-12])};`):''}})();true`);
  await pause(55);
}
async function capture(name,w){fs.writeFileSync(path.join(out,name+'.png'),(await w.webContents.capturePage()).toPNG())}
const timeout=setTimeout(()=>{console.error('UI test timed out',errors);app.exit(1)},55000);
app.whenReady().then(async()=>{try{
  await until(()=>latest&&BrowserWindow.getAllWindows().length===2,'windows loaded');
  control=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('control.html'));player=BrowserWindow.getAllWindows().find(w=>w!==control);
  control.setContentSize(480,1000);player.setContentSize(1280,800);
  await run(`window.testPads=[0,1].map(index=>({index,id:'USB Encoder',mapping:'',buttons:Array.from({length:12},()=>({pressed:false,value:0})),axes:[0,0]}));Object.defineProperty(navigator,'getGamepads',{value:()=>testPads});true`);
  await pause(100);await click('[data-demo-code="111"]');await scan('222',player);
  await until(()=>latest.lobbyPlayers.length===2,'two test bracelets');await click('[data-lobby-start]');
  await until(()=>latest.phase==='game','test game');await scan('777',player);
  await until(async()=>(await snapshot()).staff&&latest.phase==='lobby','technician interrupts game');
  assert.equal(await run('document.querySelectorAll(".tech-slot").length'),32);
  await run(`document.querySelector('[data-port]').value='COM99';true`);await click('[data-tech="port"]');
  await until(async()=>(await snapshot()).led.path==='COM99'&&(await snapshot()).led.connected,'COM port');
  await capture('settings-portrait',control);await capture('settings-landscape',player);
  await click('[data-tech="calibrate"]');assert.equal(commands.at(-1),'CAL 1');
  for(let i=0;i<32;i++){
    await input(i,true);assert.equal((await snapshot()).calibration.channel,i,'must wait for release');
    if(i===0){await pause(150);assert.equal((await snapshot()).calibration.channel,0);await capture('calibration',control)}
    await input(i,false);
    assert.equal((await snapshot()).calibration?.channel??32,i+1);
    if(i<31)assert.equal(commands.at(-1),`CAL ${i+2}`);
  }
  assert.equal((await snapshot()).settings.buttons.length,32);
  await input(31,true);await input(31,false);assert.equal((await snapshot()).counters[31],1);
  await click('[data-tech="test"][data-slot="31"]');assert.equal(commands.at(-1),'CAL 32');
  await click('[data-tech="close"]');await until(()=>run('document.querySelector(".technician-root").hidden'),'closed');
  await scan('777');await until(()=>run('!!document.querySelector(".tech-screen")'),'reopened');
  await click('[data-tech="block"]');await click('[data-tech="close"]');await until(()=>run('!!document.querySelector(".tech-blocked")'),'blocked screen');
  await scan('777');await until(()=>run('!!document.querySelector(".tech-screen")'),'reopened while blocked');await click('[data-tech="unblock"]');await click('[data-tech="close"]');
  await until(()=>run('document.querySelector(".technician-root").hidden'),'unblocked');
  await click('[data-demo-code="111"]');await click('[data-demo-code="222"]');await click('[data-lobby-start]');await until(()=>latest.phase==='game','game after calibration');
  for(const p of[0,1]){
    const lights=commands.filter(c=>c.startsWith('LEDS ')).at(-1).split(' '),mask=parseInt(lights[p+1],16),position=Array.from({length:16},(_,i)=>i).find(i=>mask&(1<<i)),before=latest.scores[p];
    assert.notEqual(position,undefined);const slot=p*16+position;await input(slot,true);await input(slot,false);assert.equal(latest.scores[p],before+1,'calibrated input must score for its LED player');
  }
  assert.equal(errors.length,0,errors.join('\n'));console.log('Electron UI passed: bracelets, technician entry, COM, 32 press/release bindings, counters, block/unblock and game restart. Screenshots: '+out);clearTimeout(timeout);control.destroy();player.destroy();app.exit(0);
}catch(error){console.error(error,errors);clearTimeout(timeout);app.exit(1)}});
