// Pure rules for the duel lobby screen: which settings a mode has, defaults,
// progression locks and start readiness. Mirrors the old screen flow in
// public/app.js (modes -> variant -> difficulty -> duration). Loaded as a
// plain <script> in the renderer (global LobbyOptions) and required by tests.
(function(root){
  const LOBBY_MODES=['classic','replacement','independent','duel','colorMatch','colorSequence','paint','catchColor','intersection','pong'];
  const THREE=['easy','medium','hard'],FOUR=['easy','medium','hard','veryHard'];
  const DIFFICULTIES={colorMatch:THREE,intersection:THREE,colorSequence:FOUR,pong:FOUR,catchColor:FOUR};
  const VARIANTS={catchColor:['fill','score']};
  const PAINT={rounds:5,roundSeconds:30};
  function modeOptions(mode,durations){
    if(mode==='paint')return{variants:[],difficulties:[],durations:[],fixed:{...PAINT}};
    return{variants:[...(VARIANTS[mode]||[])],difficulties:[...(DIFFICULTIES[mode]||[])],durations:[...(durations||[])].map(Number).sort((a,b)=>a-b),fixed:null};
  }
  function defaultSelection(mode,durations){
    const o=modeOptions(mode,durations);
    return{mode,variant:o.variants[0]??null,difficulty:o.difficulties[0]??null,durationMinutes:mode==='paint'?PAINT.rounds*PAINT.roundSeconds/60:(o.durations[0]??1)};
  }
  function profileLocks(players,cards){
    const profiles=[0,1].map(i=>{const uid=players&&players[i]&&players[i].uid;return uid&&cards?cards[uid]||null:null});
    const both=test=>profiles.every(p=>!!p&&test(p));
    return{basic:both(p=>!!p.basicCompleted),sequenceHard:both(p=>!!p.sequenceHardCompleted),hard:{catchColor:both(p=>!!(p.hardUnlocks&&p.hardUnlocks.catchColor)),pong:both(p=>!!(p.hardUnlocks&&p.hardUnlocks.pong))}};
  }
  function isModeLocked(mode,locks){return mode!=='classic'&&!locks.basic}
  function isDifficultyLocked(mode,difficulty,locks){
    if(difficulty!=='veryHard')return false;
    if(mode==='colorSequence')return!locks.sequenceHard;
    return!locks.hard[mode];
  }
  function canStart(selection,players,max,locks){
    if((players||[]).length<max)return{ok:false,reason:'needPlayers'};
    if(isModeLocked(selection.mode,locks))return{ok:false,reason:'modeLocked'};
    if(selection.difficulty&&isDifficultyLocked(selection.mode,selection.difficulty,locks))return{ok:false,reason:'difficultyLocked'};
    return{ok:true,reason:null};
  }
  function selectionLabel(selection,t,paintText){
    const parts=[t.modes[selection.mode][0]];
    if(selection.variant)parts.push(selection.variant==='fill'?t.fillField:t.timeAttack);
    if(selection.difficulty)parts.push(t.difficulties[selection.difficulty]);
    parts.push(selection.mode==='paint'?paintText:`${selection.durationMinutes} ${t.minute}`);
    return parts.join(' · ');
  }
  const api={LOBBY_MODES,modeOptions,defaultSelection,profileLocks,isModeLocked,isDifficultyLocked,canStart,selectionLabel};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.LobbyOptions=api;
})(typeof window!=='undefined'?window:globalThis);
