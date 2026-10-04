const assert=require('assert');
const O=require('../lib/lobby-options');
const D=[3,1,2];

assert.deepStrictEqual(O.LOBBY_MODES,['classic','replacement','independent','duel','colorMatch','colorSequence','paint','catchColor','intersection','pong']);

for(const mode of['classic','replacement','independent','duel'])
  assert.deepStrictEqual(O.modeOptions(mode,D),{variants:[],difficulties:[],durations:[1,2,3],fixed:null},mode);
for(const mode of['colorMatch','intersection'])
  assert.deepStrictEqual(O.modeOptions(mode,D).difficulties,['easy','medium','hard'],mode);
for(const mode of['colorSequence','pong','catchColor'])
  assert.deepStrictEqual(O.modeOptions(mode,D).difficulties,['easy','medium','hard','veryHard'],mode);
assert.deepStrictEqual(O.modeOptions('catchColor',D).variants,['fill','score']);
assert.deepStrictEqual(O.modeOptions('paint',D),{variants:[],difficulties:[],durations:[],fixed:{rounds:5,roundSeconds:30}});

assert.deepStrictEqual(O.defaultSelection('catchColor',D),{mode:'catchColor',variant:'fill',difficulty:'easy',durationMinutes:1});
assert.deepStrictEqual(O.defaultSelection('classic',D),{mode:'classic',variant:null,difficulty:null,durationMinutes:1});
assert.deepStrictEqual(O.defaultSelection('paint',D),{mode:'paint',variant:null,difficulty:null,durationMinutes:2.5});

const none=O.profileLocks([],{});
assert.deepStrictEqual(none,{basic:false,sequenceHard:false,hard:{catchColor:false,pong:false}});
const cards={A:{basicCompleted:true,sequenceHardCompleted:true,hardUnlocks:{pong:true}},B:{basicCompleted:true,sequenceHardCompleted:false,hardUnlocks:{pong:true,catchColor:true}}};
const both=O.profileLocks([{uid:'A'},{uid:'B'}],cards);
assert.deepStrictEqual(both,{basic:true,sequenceHard:false,hard:{catchColor:false,pong:true}});
assert.strictEqual(O.profileLocks([{uid:'A'}],cards).basic,false,'one player is not enough to unlock');
assert.strictEqual(O.profileLocks([{uid:'A'},{uid:'Z'}],cards).basic,false,'unknown card stays locked');

assert.strictEqual(O.isModeLocked('classic',none),false);
assert.strictEqual(O.isModeLocked('pong',none),true);
assert.strictEqual(O.isModeLocked('pong',both),false);
assert.strictEqual(O.isDifficultyLocked('pong','hard',none),false);
assert.strictEqual(O.isDifficultyLocked('pong','veryHard',both),false);
assert.strictEqual(O.isDifficultyLocked('catchColor','veryHard',both),true);
assert.strictEqual(O.isDifficultyLocked('colorSequence','veryHard',both),true);

const two=[{uid:'A'},{uid:'B'}];
assert.deepStrictEqual(O.canStart(O.defaultSelection('classic',D),[{uid:'A'}],2,both),{ok:false,reason:'needPlayers'});
assert.deepStrictEqual(O.canStart(O.defaultSelection('pong',D),two,2,none),{ok:false,reason:'modeLocked'});
assert.deepStrictEqual(O.canStart({mode:'catchColor',variant:'fill',difficulty:'veryHard',durationMinutes:1},two,2,both),{ok:false,reason:'difficultyLocked'});
assert.deepStrictEqual(O.canStart(O.defaultSelection('classic',D),two,2,none),{ok:true,reason:null});

const t={modes:{catchColor:['Поймай цвет'],paint:['Покраска'],classic:['Раунды']},fillField:'Закрасить всё поле',timeAttack:'На время',difficulties:{medium:'Средний'},minute:'мин'};
assert.strictEqual(O.selectionLabel({mode:'catchColor',variant:'score',difficulty:'medium',durationMinutes:2},t,'5 × 30 с'),'Поймай цвет · На время · Средний · 2 мин');
assert.strictEqual(O.selectionLabel(O.defaultSelection('paint',D),t,'5 раундов × 30 с'),'Покраска · 5 раундов × 30 с');
assert.strictEqual(O.selectionLabel(O.defaultSelection('classic',D),t,''),'Раунды · 1 мин');

console.log('lobby-options tests passed');
