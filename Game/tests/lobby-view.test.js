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
assert(!html.includes('lobby-choice'),'no duplicate selection summary');
assert(html.includes('data-lobby-duration="2"'),'selected duration remains available');
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
  assert(app.includes("setLobbyOverlay({type:'profile',uid:profile,state:'loading'},CABINET_IDLE_MS);lightning.striveXLobby({type:'profile',uid:profile})"),'tapping a card asks for the profile');
  assert(app.indexOf('data-lobby-profile-remove')<app.indexOf("if(at('data-lobby-dismiss')&&"),'remove inside the profile window is handled before its backdrop closes it');
  assert(main.includes("striveXSession.on('profile',payload=>emit('strivex-event',{type:'profile',...payload}))")&&main.includes("x?.type==='profile'&&typeof striveXSession.requestProfile==='function'"),'main forwards profile requests and answers');
  assert(main.includes("striveXSession.on('avatar-saved',payload=>emit('strivex-event',{type:'avatar_saved',...payload}))")&&main.includes("x?.type==='avatar_save'&&typeof striveXSession.saveAvatar==='function'"),'main forwards avatar saves and answers');
  assert(app.indexOf('StrivexCabinet.click(e.target,lobbyOverlay)')<app.indexOf("const idle=at('data-lobby-idle')")&&app.includes("lightning.striveXLobby({type:'avatar_save',uid:r.save.uid,avatar:r.save.avatar})"),'cabinet taps are handled first and saves go to the Gateway');
}
assert(!L.html(view({players:two})).includes('class="lobby-tap"'),'bracelet prompt hides once the pair is complete');
assert(L.html(view({players:two.slice(0,1)})).includes('class="lobby-tap"'),'bracelet prompt returns after player removal');
assert(L.html(view({})).includes('Уровни'),'right column uses Levels');
// Queue for the next game.
{
  const q=o=>({lang:'ru',state:'none',players:[],max:2,remainingSec:null,canOpen:true,note:'',...o});
  const kim={uid:'K',name:'kim',avatar:'X1'},lee={uid:'L',name:'lee',avatar:'X2'};
  let h=L.queue(q({}));
  assert(h.includes('data-action="queue-open"')&&h.includes('Встать в очередь')&&!h.includes('queue-cancel'),'none + canOpen -> join button only');
  assert.strictEqual(L.queue(q({canOpen:false})),'','none + !canOpen -> empty');
  assert.strictEqual(L.queue(null),'','no queue -> empty');
  h=L.queue(q({state:'collecting',players:[kim],remainingSec:25}));
  assert(h.includes('Приложите браслеты')&&h.includes('kim')&&h.includes('1 / 2')&&h.includes('0:25')&&h.includes('lobby-queue-slot empty')&&h.includes('data-action="queue-done"')&&h.includes('data-action="queue-cancel"'),'collecting: slots, countdown, Done');
  h=L.queue(q({state:'collecting',players:[]}));
  assert(!h.includes('queue-done')&&h.includes('queue-cancel')&&h.includes('0 / 2'),'no Done without a bracelet');
  h=L.queue(q({state:'waiting',players:[kim,lee]}));
  assert(h.includes('Следующие: kim и lee')&&h.includes('data-action="queue-cancel"')&&h.includes('Выйти из очереди')&&!h.includes('lobby-queue-slot')&&!h.includes('queue-done'),'waiting');
  h=L.queue(q({state:'reserved',players:[kim,lee],remainingSec:42}));
  assert(h.includes('Следующие: kim и lee — приложите браслет')&&h.includes('42'),'reserved');
  assert(L.queue(q({lang:'en',state:'waiting',players:[kim,lee]})).includes('Up next: kim and lee'),'en names joined with and');
  for(const state of['none','collecting','waiting','reserved'])assert(L.queue(q({state,players:[kim],note:'reserved'})).includes('Место занято следующими'),'note is shown in '+state);
  h=L.queue(q({state:'waiting',players:[{uid:'X',name:'<img src=x>'}]}));
  assert(!h.includes('<img')&&h.includes('&lt;img src=x&gt;'),'names are escaped');
  // Malformed input: no throw, no "undefined" / "NaN" / "0 / " debris.
  assert.doesNotThrow(()=>{L.queue({lang:'ru',state:'waiting'});L.queue({lang:'ru',state:'collecting',players:[null,'x',[],7,kim]});L.queue({state:'bogus',players:[kim]});L.queue({state:'collecting',players:'kim'});L.queue({state:'reserved',players:[null],remainingSec:'abc'})},'odd input does not throw');
  assert.strictEqual(L.queue(q({state:'bogus',players:[kim]})),'','unknown state -> empty');
  h=L.queue(q({state:'collecting',max:undefined,players:[kim]}));
  assert(!h.includes('undefined')&&!h.includes('NaN')&&h.includes('1 / 1'),'missing max falls back to the entries count');
  h=L.queue(q({state:'collecting',players:[null,'x',[],kim,undefined],max:2}));
  assert(h.includes('1 / 2')&&h.includes('kim')&&!h.includes('null')&&(h.match(/class="lobby-queue-slot[ "]/g)||[]).length===2,'garbage entries in players[] are dropped');
  for(const bad of[undefined,null,'',NaN,Infinity,'abc',{},[]])assert(!/lobby-queue-clock/.test(L.queue(q({state:'reserved',players:[kim],remainingSec:bad}))),'no clock for remainingSec='+String(bad));
  h=L.queue(q({state:'reserved',players:[kim],remainingSec:25.7}));
  assert(h.includes('>0:25<'),'fractional seconds are floored');
  assert(L.queue(q({state:'reserved',players:[kim],remainingSec:-5})).includes('>0:00<'),'negative seconds clamp to 0:00');
  assert(!L.queue(q({state:'waiting',players:[null]})).includes('undefined'),'waiting with only garbage players has no debris');
  const keys=['queueJoin','queueTap','queueDone','queueLeave','queueNext','queueConfirm','queueAnd','busy','reserved'];
  for(const lang of['ru','en','de','fr','zh','ja'])for(const k of keys)assert(typeof L.strings(lang)[k]==='string'&&L.strings(lang)[k].trim()!=='' ,`${lang}.${k}`);
  for(const lang of['de','fr','zh','ja'])assert.notStrictEqual(L.strings(lang).queueJoin,L.strings('en').queueJoin,lang+' queueJoin is translated');
  assert(L.html(view({overlay:{type:'denied',reason:'busy'}})).includes('Аттракцион занят — нажмите «Встать в очередь»'),'denied busy');
  assert(L.html(view({overlay:{type:'denied',reason:'reserved'}})).includes('Место занято следующими'),'denied reserved');
  html=L.html(view({queue:q({state:'waiting',players:[kim]})}));
  assert(html.includes('Следующие')&&html.indexOf('lobby-queue')<html.indexOf('lobby-launch'),'lobby html embeds the queue bar above the launch block');
  assert(html.indexOf('lobby-duel')<html.indexOf('lobby-queue'),'queue bar sits below the slots');
  assert(!L.html(view({})).includes('lobby-queue'),'no queue, no bar');
  html=L.html(view({queue:q({state:'reserved',players:[kim]})}));
  assert(html.includes('Приложите браслеты')&&!html.includes(L.strings('ru').tapHere),'reserved + empty lobby -> queueTap call to action');
  html=L.html(view({queue:q({state:'waiting',players:[kim]})}));
  assert(html.includes(L.strings('ru').tapHere),'waiting keeps the usual call');
  html=L.html(view({queue:q({state:'reserved',players:[kim]}),players:two.slice(0,1)}));
  assert(html.includes(L.strings('ru').tapHere),'reserved with a player in the lobby keeps the usual call');
}
{
  const css=require('fs').readFileSync(require('path').join(__dirname,'../public/lobby.css'),'utf8');
  assert(css.includes(':where(.control-queue button){')&&!css.includes('.control-queue :where(button)'),'strip button reset has zero specificity');
  assert(/\.lobby-screen,\.control-queue\{--lb-bg:/.test(css),'lobby variables are in scope for the strip mounted outside the lobby');
  assert(/@media[^{]*orientation:\s*landscape[^{]*\{[^@]*\.control-queue/.test(css),'landscape rule for the strip');
}
console.log('lobby-view tests passed');
