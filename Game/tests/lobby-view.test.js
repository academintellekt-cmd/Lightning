const assert=require('assert');
global.LobbyOptions=require('../lib/lobby-options');
const L=require('../public/lobby');
const t={modes:{classic:['Раунды','d'],replacement:['Бесконечный набор','d'],independent:['Независимая гонка','d'],duel:['Дуэль','d'],colorMatch:['Цветовой код','d'],colorSequence:['Цветовая мелодия','d'],paint:['Покраска','Пять раундов'],catchColor:['Поймай цвет','d'],intersection:['Перекрёсток','d'],pong:['Понг','d']},fillField:'Закрасить всё поле',timeAttack:'На время',difficulties:{easy:'Лёгкий',medium:'Средний',hard:'Сложный',veryHard:'Очень сложный'},minute:'мин',endSession:'Завершить'};
const locks={basic:false,sequenceHard:false,hard:{catchColor:false,pong:false}};
function view(extra){const selection=extra.selection||LobbyOptions.defaultSelection('classic',[1,2,3]);const players=extra.players||[];return{lang:'ru',t,players,max:2,selection,locks,options:LobbyOptions.modeOptions(selection.mode,[1,2,3]),check:LobbyOptions.canStart(selection,players,2,locks),session:false,remainingSec:0,connected:true,overlay:null,starting:false,startDenied:'',languageHtml:'',...extra}}

let html=L.html(view({}));
assert(html.includes('class="lobby-screen'),'root class');
assert.strictEqual((html.match(/data-lobby-mode="/g)||[]).length,10,'ten modes');
assert.strictEqual((html.match(/class="lobby-slot empty/g)||[]).length,2,'two empty slots');
assert(html.includes('VS'));
assert(/data-lobby-start[^>]*disabled/.test(html),'start disabled with no players');
assert(html.includes('Для дуэли нужны два игрока'));
assert(html.includes('data-lobby-mode="pong" data-locked="1"'),'pong locked');
assert(html.includes('data-lobby-duration="1"')&&html.includes('data-lobby-duration="3"'));
assert(!html.includes('data-lobby-difficulty'),'classic has no difficulty group');

const two=[{uid:'A',name:'Ann',avatar:'X1'},{uid:'B',name:'<b>Bob</b>',avatar:null}];
html=L.html(view({players:two}));
assert(!/data-lobby-start[^>]*disabled/.test(html),'start enabled with two players');
assert(html.includes('data-lobby-remove="A"'));
assert(html.includes('&lt;b&gt;Bob&lt;/b&gt;'),'names are escaped');

const catchSel={mode:'catchColor',variant:'score',difficulty:'medium',durationMinutes:2};
html=L.html(view({players:two,selection:catchSel}));
assert(html.includes('data-lobby-variant="fill"')&&html.includes('data-lobby-variant="score"'));
assert(html.includes('data-lobby-difficulty="veryHard" data-locked="1"'));
assert(html.includes('Поймай цвет · На время · Средний · 2 мин'));
assert(html.includes('Режим закрыт'),'locked mode hint');

html=L.html(view({selection:LobbyOptions.defaultSelection('paint',[1,2,3])}));
assert(html.includes('5 раундов × 30 с'));
assert(!html.includes('data-lobby-duration'));

html=L.html(view({players:two,session:true,remainingSec:125}));
assert(!html.includes('data-lobby-remove'),'no remove in session');
assert(html.includes('data-action="endSession"'));
assert(html.includes('2:05'));

html=L.html(view({overlay:{type:'denied',reason:'lobby_full'}}));
assert(html.includes('Дуэль уже собрана'));
html=L.html(view({overlay:{type:'checking'}}));
assert(html.includes('Проверяем браслет'));
html=L.html(view({overlay:{type:'rules',mode:'paint'}}));
assert(html.includes('Пять раундов')&&html.includes('Понятно'));
html=L.html(view({overlay:{type:'idle'}}));
assert(html.includes('Вы ещё здесь?')&&html.includes('data-lobby-idle="yes"'));
html=L.html(view({players:two,overlay:{type:'confirmRemove',uid:'A'}}));
assert(html.includes('Убрать игрока?')&&html.includes('data-lobby-confirm="yes"'));
html=L.html(view({connected:false}));
assert(html.includes('Нет связи с Gateway'));

for(const lang of['ru','en','de','fr','zh','ja']){const s=L.strings(lang);for(const key of Object.keys(L.strings('en')))assert(s[key],`${lang}.${key}`)}
assert.strictEqual(L.strings('xx').start,L.strings('en').start,'unknown language falls back to en');
assert.strictEqual(L.enterHtml('ru'),'<div class="lobby-enter" data-lobby-enter role="status"><b>Входите</b></div>','enter call markup');
assert(L.enterHtml('en').includes('Come in'),'enter call is localized');
html=L.html(view({overlay:{type:'denied',reason:'unregistered'}}));
assert(html.includes('Данный браслет не найден в системе. Обратитесь к администратору.'),'Lava Jump wording for an unknown wristband');
html=L.html(view({session:true}));
assert(html.includes('data-action="records"')&&html.includes('Рекорды'),'session shows Records next to Finish');
html=L.html(view({overlay:{type:'rules',mode:'duel'}}));
assert(html.includes('<ol><li>Загорается одна общая кнопка.</li>'),'rules window lists numbered steps');
assert(!L.html(view({lang:'de',overlay:{type:'rules',mode:'duel'}})).includes('<ol>'),'languages without steps keep the one-line rules');
{const app=require('fs').readFileSync(require('path').join(__dirname,'..','public','app.js'),'utf8');
assert(app.includes('if(autoAssignControllers())showEnterCall(()=>{if(gatewaySessionActive)afterControllers()})'),'a started session shows the enter call');
assert(app.includes('syncEnterCall();'),'render closes the enter call once the phase moves on');
assert(app.includes('ENTER_CALL_MS=10000')&&app.includes('setTimeout(hideEnterCall,ENTER_CALL_MS)'),'enter call lasts 10 s');
}
{const app=require('fs').readFileSync(require('path').join(__dirname,'..','public','app.js'),'utf8');assert(app.includes("if(role==='control'&&cfg.strivex?.developmentMode){const log="),'StriveX status box only in development mode')}
// Lobby profile window.
{
  const duo=[{uid:'A',name:'Алекс',avatar:'X1'},{uid:'B',name:'Мира',avatar:'X2'}];
  const names={modes:{classic:'Раунды','catchColor:fill':'Поймай свой цвет · Заполнить поле'},difficulties:{veryHard:'Очень сложный'},minute:'мин'};
  let h=L.html(view({players:duo}));
  assert(h.includes('data-lobby-profile="A"')&&h.includes('data-lobby-profile="B"'),'player cards open the profile');
  const data={username:'Алекс',level:4,xp_in_level:90,needed_xp:600,time_started:true,remaining_seconds:61,records:[{mode_id:'catchColor:fill',level_id:'veryHard:3',best_score:31},{mode_id:'classic',level_id:'-:1',best_score:52}],recent:[]};
  h=L.html(view({players:duo,names,overlay:{type:'profile',uid:'A',state:'ready',data}}));
  assert(h.includes('Уровень 4')&&h.includes('1:01'),'level and time');
  assert(h.includes('Поймай свой цвет · Заполнить поле · Очень сложный · 3 мин')&&h.includes('Раунды · 1 мин'),'records name mode, variant, difficulty and time');
  assert(h.includes('data-lobby-profile-remove="A"'),'remove from round');
  const app=require('fs').readFileSync(require('path').join(__dirname,'..','public','app.js'),'utf8');
  const main=require('fs').readFileSync(require('path').join(__dirname,'..','main.js'),'utf8');
  const control=require('fs').readFileSync(require('path').join(__dirname,'..','public','control.html'),'utf8');
  assert(control.includes('../lib/session-records.js'),'control page loads session-records');
  assert(app.includes("records:SessionRecords.bestRecords(gatewayUids,sessionRounds,'lightning',"),'session end reports XP records');
  assert(app.includes('durationMinutes:state.durationMinutes,scores:[...state.scores],'),'each round remembers its time');
  assert(app.includes("setLobbyOverlay({type:'profile',uid:profile,state:'loading'},30000);lightning.striveXLobby({type:'profile',uid:profile})"),'tapping a card asks for the profile');
  assert(app.indexOf('data-lobby-profile-remove')<app.indexOf("if(at('data-lobby-dismiss')&&"),'remove inside the profile window is handled before its backdrop closes it');
  assert(main.includes("striveXSession.on('profile',payload=>emit('strivex-event',{type:'profile',...payload}))")&&main.includes("x?.type==='profile'&&typeof striveXSession.requestProfile==='function'"),'main forwards profile requests and answers');
}
console.log('lobby-view tests passed');
