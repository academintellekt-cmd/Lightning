const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),os=require('os'),path=require('path');
const{Technician}=require('../lib/technician');
const{readGamepads}=require('../lib/gamepad-input');
const staff={role:'technician',name:'Техник'},device=n=>JSON.stringify(['Encoder',n]);
const button=(n,i)=>JSON.stringify(['Encoder',n,`button:${i}`]);
const keys=Array.from({length:32},(_,i)=>button(i%2,Math.floor(i/2)));
const frame=(active=[])=>({active,devices:[device(0),device(1)]});
function technician(file){const t=new Technician({file});t.gateway({staff});t.ledStatus({connected:true});t.input(frame());return t}
function tap(t,key){t.input(frame([key]));t.input(frame())}
test('32 bindings commit after release, accept either controller, persist and drive both players',t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'lightning-tech-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const file=path.join(dir,'settings.json'),tech=technician(file),channels=[];tech.on('calibrate',n=>channels.push(n));
  tech.command({type:'port',port:'COM17'});tech.command({type:'calibrate'});
  for(let i=0;i<32;i++){
    tech.input(frame([keys[i]]));assert.equal(tech.calibration.channel,i);assert.equal(tech.settings.buttons,null);
    tech.input(frame([keys[i]]));assert.equal(tech.calibration.channel,i,'held button must not advance');
    tech.input(frame());
  }
  assert.deepEqual(tech.settings.buttons,keys);assert.equal(tech.calibration,null);assert.deepEqual(channels.slice(-33),[...Array.from({length:32},(_,i)=>i),-1]);
  const restored=new Technician({file});assert.deepEqual(restored.settings,{ledPort:'COM17',buttons:keys});
  const hits=[];restored.on('hit',(...hit)=>hits.push(hit));restored.input(frame());
  restored.input(frame([keys[0],keys[31]]));restored.input(frame([keys[0],keys[31]]));
  assert.deepEqual(hits,[[0,1],[1,16]],'same numbered buttons on two encoders are distinct');
  restored.gateway({staff});restored.input(frame());tap(restored,keys[31]);assert.equal(restored.counters[31],1);
  restored.gateway({staff:null,blocked:true});tap(restored,keys[31]);assert.equal(hits.length,2);
});
test('calibration ignores held inputs, duplicate buttons and chords; cancellation preserves old mapping',()=>{
  const t=technician();t.save({buttons:keys});t.input(frame([keys[0]]));t.command({type:'calibrate'});
  t.input(frame());assert.equal(t.calibration.channel,0,'release of an already held button must not bind');
  tap(t,keys[0]);assert.equal(t.calibration.channel,1);
  tap(t,keys[0]);assert.equal(t.calibration.channel,1);assert.match(t.error,/уже назначена/);
  t.input(frame([keys[2],keys[3]]));t.input(frame([keys[2]]));t.input(frame());assert.equal(t.calibration.channel,1);
  tap(t,keys[1]);assert.equal(t.calibration.channel,2);
  t.command({type:'cancel'});assert.deepEqual(t.settings.buttons,keys);assert.equal(t.calibration,null);
});
test('disconnects cancel drafts instead of treating disappearing buttons as releases',()=>{
  const t=technician();t.command({type:'calibrate'});t.input(frame([keys[0]]));t.input({active:[],devices:[device(1)]});
  assert.equal(t.calibration,null);assert.equal(t.settings.buttons,null);assert.match(t.error,/USB/);
  t.input(frame());t.command({type:'calibrate'});t.ledStatus({connected:false});assert.equal(t.calibration,null);assert.match(t.error,/Arduino/);
  assert.throws(()=>t.command({type:'calibrate'}),/Arduino/);
});
test('settings require staff, validate ports, and normal gateway heartbeats do not reset LEDs',()=>{
  const t=new Technician(),led=[];t.on('calibrate',n=>led.push(n));
  assert.throws(()=>t.command({type:'port',port:'COM5'}),/браслет/);t.gateway({});t.gateway({});assert.deepEqual(led,[]);
  t.gateway({staff});assert.throws(()=>t.command({type:'port',port:'../wrong'}));
  t.command({type:'port',port:'off'});assert.equal(t.settings.ledPort,'off');
});
function pad(id,index){return{id,index,mapping:'',buttons:Array.from({length:16},()=>({pressed:false,value:0})),axes:[0,0]}}
test('all four axis directions and digital buttons have distinct keys; index changes preserve device identity',()=>{
  const a=pad('A',1),b=pad('B',3);a.buttons[0].pressed=b.buttons[0].pressed=true;
  const before=readGamepads([a,b]);a.index=5;b.index=0;assert.deepEqual(readGamepads([b,a]),before);
  a.buttons[0].pressed=false;const directions=[];
  for(const[x,y]of[[0,-1],[0,1],[-1,0],[1,0]]){a.axes=[x,y];directions.push(readGamepads([a]).active[0])}
  assert.equal(new Set(directions).size,4);
  a.axes=[0,-1];a.buttons[12].pressed=true;assert.equal(readGamepads([a]).active.length,1,'digital and axis D-pad reports must not duplicate a move');
  const same=pad('A',8);same.buttons[12].pressed=true;assert.equal(new Set(readGamepads([a,same]).active).size,2);
  const tech=technician();tech.command({type:'calibrate'});for(const key of directions)tap(tech,key);assert.equal(tech.calibration.channel,4);
});
test('all game engines support the sixteenth position and 32-position ping-pong',()=>{
  const{GameEngine}=require('../lib/game-engine'),{ColorGameEngine}=require('../lib/color-engine'),{AdvancedGameEngine}=require('../lib/advanced-engine');
  const classic=new GameEngine({activeButtonsMin:16,activeButtonsMax:16});classic.start();assert(classic.press(0,16).accepted);
  const colors=new ColorGameEngine();colors.startMatch();assert.equal(colors.entries[0].length,16);assert.equal(colors.cycle(0,16),'red');assert.equal(colors.colorDigits([{position:16,color:'blue'}]),'0000000000000002');
  const advanced=new AdvancedGameEngine();advanced.startPaint();assert(advanced.paint(1,16));assert.equal(advanced.paintOwners[15],1);
  advanced.startPong();assert.equal(advanced.globalPaddle(1,1),31);assert.equal(advanced.globalPaddle(1,16),16);
});
