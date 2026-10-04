(async () => {
  const role=document.body.dataset.role, app=document.getElementById('app');
  const cfg=await lightning.getConfig();
  const gatewayMode=!!cfg.strivex?.enabled&&cfg.strivex.transport==='websocket';
  function applyOrientation(){const configured=role==='control'?(cfg.controlOrientation||'auto'):'landscape',orientation=configured==='auto'?(innerHeight>innerWidth?'portrait':'landscape'):configured;document.body.classList.toggle('portrait',orientation==='portrait');document.body.classList.toggle('landscape',orientation!=='portrait')}
  applyOrientation();window.addEventListener('resize',applyOrientation);
  const MODES={
    classic:['Rounds','Clear the shared set. A new set appears after it is empty.'],
    replacement:['Endless set','Every hit creates a new shared button. A green X2 bonus appears every 30 hits.'],
    independent:['Independent race','Each player has independent buttons. Hits do not affect the opponent.'],
    duel:['Duel','One shared button is active. The first player to hit it scores.'],
    colorMatch:['Color code','Each player memorizes a private color pattern, restores it, then confirms with rainbow button 8. Correct patterns score; wrong patterns flash red and are replaced.'],
    colorSequence:['Light melody','Memorize the colored-button order and repeat it before your opponent.'],
    paint:['Color conquest','Five rounds of 30 seconds. Press a position to paint both matching buttons your color. The opponent can repaint it. The larger field wins the round.'],
    catchColor:['Catch your color','Catch the blue or orange phase of your flashing button. Fill the field or score as many catches as possible.'],
    intersection:['Catch intersection','Two lights move from opposite ends. When they meet, the button stays active for 0.5 seconds. Press that exact button.'],
    pong:['2D Ping-Pong','Serve from the lit paddle and return the moving ball while the paddle is green. Fast hits accelerate the ball.']
  };
  const base={play:'Play',records:'Records',back:'↩',ok:'OK',skip:'Without wristband',assignBlue:'Press any blue-player button',assignOrange:'Press any orange-player button',controllerMissing:'Connect two USB controllers',
    scan1:'Scan Player 1 wristband',scan2:'Scan Player 2 wristband',enterName:'Enter player name',chooseMode:'Choose game mode',
    completeBasic:'Complete the basic game first',chooseTime:'Choose duration',chooseDifficulty:'Choose difficulty',
    chooseVariant:'Choose variant',fillField:'Fill the field',timeAttack:'Time attack',press:'Press any button',
    showPattern:'Memorize your pattern',enterPattern:'Restore it and press button 8',confirm:'Button 8 confirms',
    seconds:'sec',difficulties:{easy:'Easy',medium:'Medium',hard:'Hard',veryHard:'Very hard'},over:'Game Over',
    results:'Results',leaders:'Leaderboard',draw:'Draw',winner:'Winner',minute:'min',round:'Round',player:'Player',scoreLabel:'Score',date:'Date',
    adminReset:'Wristband database cleared',endSession:'End session',quitGame:'Finish game',quitQuestion:'Are you sure you want to leave this game?',yes:'Yes',no:'No',repeatSequence:'Repeat the sequence',modes:MODES};
  const local=(values,modes={})=>({...base,...values,difficulties:{...base.difficulties,...(values.difficulties||{})},
    modes:Object.fromEntries(Object.entries(MODES).map(([k,v])=>[k,modes[k]||v]))});
  const T={
    en:local({}),
    ru:local({play:'Играть',records:'Рекорды',skip:'Без браслета',assignBlue:'Нажмите любую кнопку синего игрока',assignOrange:'Нажмите любую кнопку оранжевого игрока',controllerMissing:'Подключите две USB-платы',
      scan1:'Просканируйте браслет игрока 1',scan2:'Просканируйте браслет игрока 2',enterName:'Введите имя игрока',
      chooseMode:'Выберите режим',completeBasic:'Сначала пройдите базовую игру',chooseTime:'Выберите длительность',
      chooseDifficulty:'Выберите сложность',chooseVariant:'Выберите вариант',fillField:'Закрасить всё поле',
      timeAttack:'Игра на время',press:'Нажмите любую кнопку',showPattern:'Запомните свою комбинацию',
      enterPattern:'Восстановите её и нажмите кнопку 8',confirm:'Кнопка 8 подтверждает ответ',seconds:'сек',
      difficulties:{easy:'Легкий',medium:'Средний',hard:'Сложный',veryHard:'Очень сложный'},over:'Игра окончена',
      results:'Результаты',leaders:'Таблица лидеров',draw:'Ничья',winner:'Победитель',minute:'мин',round:'Раунд',player:'Игрок',scoreLabel:'Очки',date:'Дата',
      adminReset:'База браслетов очищена',endSession:'Закончить сессию',quitGame:'Закончить игру',quitQuestion:'Вы точно хотите покинуть игру?',yes:'Да',no:'Нет',repeatSequence:'Повторите последовательность'},{
      classic:['Раунды','Погасите весь общий набор — после этого появится новый.'],
      replacement:['Бесконечный набор','Каждое попадание сразу создаёт новую общую кнопку.'],
      independent:['Независимая гонка','У каждого игрока собственный набор, не зависящий от соперника.'],
      duel:['Дуэль','Горит одна общая кнопка. Очко получает тот, кто нажал первым.'],
      colorMatch:['Цветовой код','У каждого игрока своя комбинация. Восстановите цвета и подтвердите ответ радужной кнопкой 8.'],
      colorSequence:['Световая мелодия','Запомните порядок цветных кнопок и повторите его раньше соперника.'],
      paint:['Захват цвета','Пять раундов по 30 секунд. Нажатие закрашивает парную позицию вашим цветом, соперник может её перекрасить.'],
      catchColor:['Поймай свой цвет','Остановите мигающую кнопку на синем или оранжевом цвете. Заполните поле либо соберите больше попаданий.'],
      intersection:['Поймай пересечение','Два огня движутся навстречу. В точке встречи кнопка задерживается на 0,5 секунды — нажмите именно её.'],
      pong:['2D Пин-понг','Подайте мяч с подсвеченной ракетки и отбивайте его, когда ракетка станет зелёной.']}),
    de:local({play:'Spielen',records:'Rekorde',skip:'Ohne Armband',controllerMissing:'Zwei USB-Controller anschließen',
      scan1:'Armband von Spieler 1 scannen',scan2:'Armband von Spieler 2 scannen',enterName:'Spielernamen eingeben',
      chooseMode:'Spielmodus wählen',completeBasic:'Zuerst das Basisspiel abschließen',chooseTime:'Dauer wählen',
      chooseDifficulty:'Schwierigkeit wählen',chooseVariant:'Variante wählen',fillField:'Feld füllen',timeAttack:'Zeitspiel',
      press:'Beliebige Taste drücken',showPattern:'Eigenes Muster merken',enterPattern:'Muster herstellen und Taste 8 drücken',
      confirm:'Taste 8 bestätigt',seconds:'Sek.',difficulties:{easy:'Leicht',medium:'Mittel',hard:'Schwer',veryHard:'Sehr schwer'},
      results:'Ergebnisse',leaders:'Bestenliste',draw:'Unentschieden',winner:'Sieger',minute:'Min.',round:'Runde',player:'Spieler',scoreLabel:'Punkte',date:'Datum',over:'Spielende',endSession:'Sitzung beenden'},{
      classic:['Runden','Löscht die gemeinsame Tastenmenge. Danach erscheint eine neue.'],replacement:['Endlosfeld','Jeder Treffer erzeugt sofort eine neue gemeinsame Taste.'],
      independent:['Unabhängiges Rennen','Beide Spieler haben voneinander unabhängige Tasten.'],duel:['Duell','Eine gemeinsame Taste leuchtet. Der erste Treffer zählt.'],
      colorMatch:['Farbcode','Jeder Spieler merkt sich ein eigenes Muster und bestätigt es mit der Regenbogentaste 8.'],colorSequence:['Lichtmelodie','Merkt euch die Reihenfolge und wiederholt sie schneller.'],
      paint:['Farberoberung','Fünf Runden zu 30 Sekunden. Jede Position kann in der eigenen Farbe übermalt werden.'],catchColor:['Fange deine Farbe','Stoppt die blinkende Taste bei Blau oder Orange.'],
      intersection:['Schnittpunkt fangen','Drückt die Taste, an der sich zwei Lichter treffen.'],pong:['2D-Pingpong','Aufschlag und Rückschlag erfolgen über die grüne Schlägertaste.']}),
    fr:local({play:'Jouer',records:'Records',skip:'Sans bracelet',controllerMissing:'Connectez deux contrôleurs USB',
      scan1:'Scannez le bracelet du joueur 1',scan2:'Scannez le bracelet du joueur 2',enterName:'Entrez le nom',
      chooseMode:'Choisissez un mode',completeBasic:"Terminez d'abord le jeu de base",chooseTime:'Choisissez la durée',
      chooseDifficulty:'Choisissez la difficulté',chooseVariant:'Choisissez une variante',fillField:'Remplir le terrain',
      timeAttack:'Contre-la-montre',press:'Appuyez sur une touche',showPattern:'Mémorisez votre combinaison',
      enterPattern:'Recréez-la et appuyez sur 8',confirm:'La touche 8 confirme',seconds:'s',
      difficulties:{easy:'Facile',medium:'Moyen',hard:'Difficile',veryHard:'Très difficile'},results:'Résultats',
      leaders:'Classement',draw:'Égalité',winner:'Vainqueur',minute:'min',round:'Manche',player:'Joueur',scoreLabel:'Score',date:'Date',over:'Fin de partie',endSession:'Terminer la session'},{
      classic:['Manches','Éteignez tout le groupe commun pour afficher le suivant.'],replacement:['Groupe infini','Chaque touche réussie crée immédiatement une nouvelle cible.'],
      independent:['Course indépendante','Chaque joueur possède ses propres touches.'],duel:['Duel','Une seule touche commune est active; le premier gagne le point.'],
      colorMatch:['Code couleur','Chaque joueur mémorise son propre motif et valide avec la touche arc-en-ciel 8.'],colorSequence:['Mélodie lumineuse',"Mémorisez l'ordre puis reproduisez-le avant l'adversaire."],
      paint:['Conquête des couleurs','Cinq manches de 30 secondes. Une position peut être repeinte par l’adversaire.'],catchColor:['Attrape ta couleur','Arrêtez la touche clignotante sur le bleu ou l’orange.'],
      intersection:['Attrape l’intersection','Appuyez quand les deux lumières se rencontrent.'],pong:['Ping-pong 2D','Servez et renvoyez la balle avec la raquette verte.']}),
    zh:local({play:'开始游戏',records:'纪录',skip:'无手环',controllerMissing:'请连接两个 USB 控制器',scan1:'扫描玩家1手环',
      scan2:'扫描玩家2手环',enterName:'输入玩家姓名',chooseMode:'选择游戏模式',completeBasic:'请先完成基础游戏',
      chooseTime:'选择时长',chooseDifficulty:'选择难度',chooseVariant:'选择玩法',fillField:'填满场地',timeAttack:'计时挑战',
      press:'按任意按钮',showPattern:'记住自己的组合',enterPattern:'还原组合并按8号按钮',confirm:'8号按钮确认',
      seconds:'秒',difficulties:{easy:'简单',medium:'中等',hard:'困难',veryHard:'极难'},results:'结果',leaders:'排行榜',
      draw:'平局',winner:'获胜者',minute:'分钟',round:'回合',player:'玩家',scoreLabel:'分数',date:'日期',over:'游戏结束',endSession:'结束本次游戏'},{
      classic:['回合模式','清除共同亮起的按钮后生成新组合。'],replacement:['无限组合','每次命中都会立即生成新的共同按钮。'],
      independent:['独立竞速','两名玩家拥有互不影响的按钮。'],duel:['决斗','只有一个共同按钮亮起，先按者得分。'],
      colorMatch:['颜色密码','每位玩家记住自己的组合，并用彩虹8号按钮确认。'],colorSequence:['灯光旋律','记住按钮出现顺序并抢先复现。'],
      paint:['颜色争夺','进行五个30秒回合，按钮可以被对手重新染色。'],catchColor:['捕捉自己的颜色','在蓝色或橙色出现时按下闪烁按钮。'],
      intersection:['捕捉交点','在两个灯光相遇的位置按下按钮。'],pong:['2D乒乓','在球拍变绿时发球或回击。']}),
    ja:local({play:'プレイ',records:'記録',skip:'リストバンドなし',controllerMissing:'USBコントローラーを2台接続してください',
      scan1:'プレイヤー1のバンドをスキャン',scan2:'プレイヤー2のバンドをスキャン',enterName:'プレイヤー名を入力',
      chooseMode:'ゲームモードを選択',completeBasic:'まず基本ゲームをクリアしてください',chooseTime:'時間を選択',
      chooseDifficulty:'難易度を選択',chooseVariant:'ルールを選択',fillField:'フィールドを埋める',timeAttack:'タイムアタック',
      press:'いずれかのボタンを押す',showPattern:'自分の組み合わせを記憶',enterPattern:'再現して8番を押す',
      confirm:'8番で確定',seconds:'秒',difficulties:{easy:'簡単',medium:'普通',hard:'難しい',veryHard:'最高難度'},
      results:'結果',leaders:'ランキング',draw:'引き分け',winner:'勝者',minute:'分',round:'ラウンド',player:'プレイヤー',scoreLabel:'得点',date:'日付',over:'ゲーム終了',endSession:'セッション終了'},{
      classic:['ラウンド','共通の点灯ボタンをすべて消すと次の組み合わせが出ます。'],replacement:['エンドレス','命中するたびに新しい共通ボタンが現れます。'],
      independent:['独立レース','両プレイヤーのボタンは互いに影響しません。'],duel:['デュエル','共通の1ボタンを先に押したプレイヤーが得点。'],
      colorMatch:['カラーコード','各自の組み合わせを記憶し、虹色の8番ボタンで確定します。'],colorSequence:['ライトメロディー','光った順番を覚えて相手より先に再現します。'],
      paint:['カラー征服','30秒を5ラウンド。相手は同じ位置を塗り替えられます。'],catchColor:['自分の色をつかめ','点滅ボタンが青またはオレンジの時に押します。'],
      intersection:['交点をつかめ','2つの光が重なるボタンを押します。'],pong:['2Dピンポン','ラケットが緑になった瞬間にサーブまたはリターンします。']})
  };
  let lang=localStorage.getItem('lightning.lang')||cfg.language||'ru',langOpen=false,quitConfirm=false;
  let striveX={state:'disconnected',connected:false,sessionId:null,outgoing:[]},striveXActive=false,gatewaySessionActive=false,gatewayRemainingMs=0,sessionRounds=[],countdownToken=0,striveXDeny='',sessionExpirePending=false;
  let state={phase:gatewayMode?'lobby':'idle',scores:[0,0],names:[...cfg.offline.playerNames],
    remainingMs:cfg.gameDurationSeconds*1000,mode:cfg.defaultGameMode||'classic',
    durationMinutes:cfg.gameDurationSeconds/60,boost:[false,false],power:[0,0],powerVisible:true,
    playerBasic:[false,false],sequenceHard:[false,false],difficulty:'easy',
    colorStage:'',colorTarget:[],playerColorTarget:[[],[]],playerColorStage:['',''],colorInput:[[],[]],roundRemainingMs:0,
    variant:'fill',advanced:{},unlockHard:{catchColor:[false,false],intersection:[false,false],pong:[false,false]},
    lobbyPlayers:[],lobbyMax:2,sessionPlayers:[],
    lobbySelection:LobbyOptions.defaultSelection(cfg.defaultGameMode||'classic',cfg.durationOptionsMinutes||[1,2,3])};
  let lobbyOverlay=null,lobbyStarting=false,lobbyStartDenied='',lobbyOverlayTimer=null,lobbyIdleTimer=null,demoBuffer='';
  let assigned={blue:null,orange:null},pendingUid='',pendingPlayer=0;
  let sessionCardUids=[null,null],guestBasic=[false,false],guestSequenceHard=[false,false];
  const runtime={hits:[0,0],next:[cfg.modifiers?.everyHits||30,cfg.modifiers?.everyHits||30],
    boostToken:[0,0],queued:false,powerToken:0,lastEndSecond:0};
  const audio=role==='control'?new LightningAudio(cfg.audio||{}):null;
  audio?.crossfade('menu',0);
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const brand=()=>'<div class="brand">LIGHTNING</div>';
  const language=()=>role==='control'?`<div class="language-widget ${langOpen?'open':''}">
    ${langOpen?['ru','en','de','fr','zh','ja'].map(code=>`<button data-language="${code}" class="${code===lang?'selected':''}" aria-label="${code}"><span class="flag flag-${code}"></span></button>`).join(''):''}
    <button class="lang" data-action="lang">🌐</button></div>`:'';
  const exitIcon=()=>`<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M18 5H8v22h10M14 16h15m-5-5 5 5-5 5"/></svg>`;
  const sessionExit=()=>role==='control'?`<button class="btn session-exit" data-action="endSession" title="${T[lang].endSession}" aria-label="${T[lang].endSession}">${exitIcon()}</button>`:'';
  const gameQuit=()=>role==='control'?`<button class="btn game-quit" data-action="quitGame">${exitIcon()}<span>${T[lang].quitGame}</span></button>`:'';
  const quitModal=()=>role==='control'&&quitConfirm?`<div class="confirm-modal"><div class="confirm-box"><h2>${T[lang].quitQuestion}</h2><div><button class="btn" data-action="confirmQuit">${T[lang].yes}</button><button class="btn orange" data-action="cancelQuit">${T[lang].no}</button></div></div></div>`:'';
  function board(){try{return JSON.parse(localStorage.getItem('lightning.board')||'[]')}catch{return[]}}
  function cards(){try{return JSON.parse(localStorage.getItem('lightning.rfid.cards')||'{}')}catch{return{}}}
  function saveCards(value){localStorage.setItem('lightning.rfid.cards',JSON.stringify(value))}
  function ensureCards(users){const db=cards();let changed=false;for(const u of users){const uid=u?.uid?String(u.uid):'';if(uid&&!db[uid]){db[uid]={name:u.name||u.username||'Player',basicCompleted:false,sequenceHardCompleted:false,updatedAt:new Date().toISOString()};changed=true}}if(changed)saveCards(db)}
  function lobbyPlayersNow(){return gatewaySessionActive?state.sessionPlayers:state.lobbyPlayers}
  function lobbyView(){const players=lobbyPlayersNow(),max=gatewaySessionActive?2:(state.lobbyMax||2),locks=LobbyOptions.profileLocks(players,cards()),selection=state.lobbySelection;
    return{lang,t:T[lang],players,max,selection,locks,options:LobbyOptions.modeOptions(selection.mode,cfg.durationOptionsMinutes||[1,2,3]),check:LobbyOptions.canStart(selection,players,max,locks),session:gatewaySessionActive,remainingSec:Math.ceil(gatewayRemainingMs/1000),connected:!!striveX.connected,overlay:lobbyOverlay,starting:lobbyStarting,startDenied:lobbyStartDenied,languageHtml:language()}}
  function setLobbyOverlay(next,autoCloseMs=0){clearTimeout(lobbyOverlayTimer);lobbyOverlay=next;if(next&&autoCloseMs)lobbyOverlayTimer=setTimeout(()=>{lobbyOverlay=null;render()},autoCloseMs);render()}
  function clearLobbyIdle(){clearTimeout(lobbyIdleTimer);lobbyIdleTimer=null}
  function armLobbyIdle(){clearLobbyIdle();if(role!=='control'||state.phase!=='lobby'||gatewaySessionActive||!state.lobbyPlayers.length)return;
    lobbyIdleTimer=setTimeout(()=>{setLobbyOverlay({type:'idle'});lobbyIdleTimer=setTimeout(()=>{lightning.striveXLobby({type:'reset'});setLobbyOverlay(null)},10000)},30000)}
  function onLobbyUpdate(players,max){state.lobbyPlayers=players;state.lobbyMax=max||2;lobbyStartDenied='';if(lobbyOverlay?.type==='checking')lobbyOverlay=null;if(lobbyOverlay?.type==='confirmRemove'&&!players.some(p=>p.uid===lobbyOverlay.uid))lobbyOverlay=null;armLobbyIdle();publish()}
  function applySelection(sel){state.mode=sel.mode;if(sel.variant)state.variant=sel.variant;state.difficulty=sel.difficulty||'easy';state.durationMinutes=sel.durationMinutes;state.remainingMs=sel.durationMinutes*60000}
  function startSelectedRound(){applySelection(state.lobbySelection);quitConfirm=false;countdown()}
  function handleLobbyClick(e){
    const at=name=>e.target.closest(`[${name}]`);
    const idle=at('data-lobby-idle')?.dataset.lobbyIdle;if(idle){clearLobbyIdle();if(idle==='no')lightning.striveXLobby({type:'reset'});setLobbyOverlay(null);armLobbyIdle();return true}
    const confirm=at('data-lobby-confirm')?.dataset.lobbyConfirm;if(confirm){const uid=lobbyOverlay?.uid;if(confirm==='yes'&&uid)lightning.striveXLobby({type:'remove',uid});setLobbyOverlay(null);return true}
    if(at('data-lobby-dismiss')&&(e.target.closest('button')||!e.target.closest('.lobby-modal-box'))){setLobbyOverlay(null);return true}
    if(lobbyOverlay&&lobbyOverlay.type!=='checking')return true;
    const rules=at('data-lobby-rules')?.dataset.lobbyRules;if(rules){setLobbyOverlay({type:'rules',mode:rules},10000);return true}
    const remove=at('data-lobby-remove')?.dataset.lobbyRemove;if(remove){setLobbyOverlay({type:'confirmRemove',uid:remove});return true}
    const mode=at('data-lobby-mode')?.dataset.lobbyMode;if(mode){state.lobbySelection=LobbyOptions.defaultSelection(mode,cfg.durationOptionsMinutes||[1,2,3]);lobbyStartDenied='';publish();return true}
    const variant=at('data-lobby-variant')?.dataset.lobbyVariant;if(variant){state.lobbySelection={...state.lobbySelection,variant};publish();return true}
    const difficulty=at('data-lobby-difficulty')?.dataset.lobbyDifficulty;if(difficulty){state.lobbySelection={...state.lobbySelection,difficulty};publish();return true}
    const duration=Number(at('data-lobby-duration')?.dataset.lobbyDuration);if(duration){state.lobbySelection={...state.lobbySelection,durationMinutes:duration};publish();return true}
    if(at('data-lobby-start')){const v=lobbyView();if(!v.check.ok||lobbyStarting)return true;
      if(gatewaySessionActive){startSelectedRound();return true}
      lobbyStarting=true;lobbyStartDenied='';lightning.striveXLobby({type:'start',...state.lobbySelection});render();return true}
    return false;
  }
  function localDay(now){
    return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
  }
  function dailyReset(){
    const now=new Date(),day=localDay(now),key='lightning.rfid.lastReset';
    if(now.getHours()>=(cfg.rfid?.dailyResetHour??23)&&localStorage.getItem(key)!==day){
      saveCards({});localStorage.setItem(key,day);
    }
  }
  dailyReset();setInterval(dailyReset,60000);
  function leaderboardHtml(back){
    const rows=board().map((r,i)=>`<tr><td>${i+1}</td><td>${esc(r.name)}</td><td>${r.score}</td><td>${esc(r.date)}</td></tr>`).join('');
    const t=T[lang];return`<section class="screen"><h1>${t.leaders}</h1><table><tr><th>#</th><th>${t.player}</th><th>${t.scoreLabel}</th><th>${t.date}</th></tr>${rows}</table>${back?`<button class="btn back" data-action="back">${t.back}</button>`:''}${language()}</section>`;
  }
  function mechanicDemo(mode){
    const infoXs=(count,start=150,end=850)=>Array.from({length:count},(_,i)=>start+(end-start)*i/(count-1));
    const infoRow=(count,y,label)=>`<text x="18" y="${y+6}" class="svg-player">${label}</text>${infoXs(count).map((x,i)=>`<circle cx="${x}" cy="${y}" r="${count>7?18:24}" class="svg-button" data-position="${i+1}"/>`).join('')}`;
    const infoHand=(x,y,begin,cycle='8s')=>`<text x="${x}" y="${y}" class="svg-hand" opacity="0">&#9757;<animate attributeName="opacity" values="0;1;0;0" keyTimes="0;.07;.17;1" begin="${begin}" dur="${cycle}" repeatCount="indefinite"/></text>`;
    const infoShell=(count,body)=>`<svg class="mechanic-svg unified-info" viewBox="0 0 900 250" role="img">${infoRow(count,70,'Player1')}${infoRow(count,180,'Player2')}${body}</svg>`;
    if(['classic','replacement','independent'].includes(mode)){
      const x=infoXs(7),color=['#168cff','#ff781b'];
      const target=(player,pos,values,times)=>`<circle cx="${x[pos-1]}" cy="${player?180:70}" r="24" fill="${color[player]}"><animate attributeName="opacity" values="${values}" keyTimes="${times}" dur="8s" calcMode="discrete" repeatCount="indefinite"/></circle>`;
      let body='';
      if(mode==='classic')for(let p=0;p<2;p++){body+=target(p,1,'1;1;0;0;1','0;.15;.18;.9;1')+target(p,3,'1;1;0;0;1','0;.4;.43;.9;1')+target(p,5,'1;1;0;0;1','0;.65;.68;.9;1')}
      if(mode==='replacement')for(let p=0;p<2;p++){body+=target(p,1,'1;1;0;0;1','0;.18;.2;.9;1')+target(p,2,'0;0;1;1;0','0;.2;.21;.9;1')+target(p,3,'1;1;0;0;1','0;.5;.52;.9;1')+target(p,4,'0;0;1;1;0','0;.52;.53;.9;1')+target(p,5,'1;1','0;1')}
      if(mode==='independent'){body+=target(0,1,'1;1;0;0;1','0;.18;.2;.9;1')+target(0,3,'1;1','0;1')+target(0,5,'1;1','0;1')+target(0,6,'0;0;1;1;0','0;.2;.21;.9;1');body+=target(1,2,'1;1;0;0;1','0;.5;.52;.9;1')+target(1,4,'1;1','0;1')+target(1,5,'1;1','0;1')+target(1,7,'0;0;1;1;0','0;.52;.53;.9;1')}
      body+=infoHand(x[0],54,'1.15s')+infoHand(x[mode==='independent'?1:2],164,'3.7s');if(mode==='classic')body+=infoHand(x[4],54,'5.7s');
      return infoShell(7,body);
    }
    if(mode==='colorMatch'){
      const x=infoXs(8),patterns=[[['#ff334f',1],['#1b9cff',3],['#32e875',5]],[['#ffd43b',2],['#752cff',4],['#ff334f',6]]];let body='';
      patterns.forEach((items,p)=>items.forEach(([color,pos],i)=>{body+=`<circle cx="${x[pos-1]}" cy="${p?180:70}" r="18" fill="${color}" opacity="1"><animate attributeName="opacity" values="1;1;0;0;1;1" keyTimes="0;.28;.38;${.5+i*.1};${.51+i*.1};1" dur="10s" calcMode="discrete" repeatCount="indefinite"/></circle>${infoHand(x[pos-1],p?164:54,`${5+i}s`,'10s')}`;}));
      for(let p=0;p<2;p++)body+=`<circle cx="${x[7]}" cy="${p?180:70}" r="18" fill="#168cff"><animate attributeName="fill" values="#ff334f;#32e875;#168cff;#752cff;#ff334f" dur="1.2s" repeatCount="indefinite"/></circle>${infoHand(x[7],p?164:54,'8s','10s')}`;
      return infoShell(8,body);
    }
    if(mode==='duel'){
      const x=infoXs(7),light=(p,pos,values,times)=>`<circle cx="${x[pos-1]}" cy="${p?180:70}" r="24" fill="${p?'#ff781b':'#168cff'}"><animate attributeName="opacity" values="${values}" keyTimes="${times}" dur="7s" calcMode="discrete" repeatCount="indefinite"/></circle>`;let body='';
      for(let p=0;p<2;p++)body+=light(p,3,'1;1;0;0;1','0;.2;.23;.9;1')+light(p,5,'0;0;1;1;0','0;.25;.26;.58;1');
      return infoShell(7,body+infoHand(x[2],54,'1.35s','7s')+infoHand(x[4],164,'3.5s','7s'));
    }
    if(mode==='colorSequence'){
      const x=infoXs(7),order=[0,3,1,5],colors=['#ff334f','#1b9cff','#32e875','#ffd43b'];let body='';
      for(let p=0;p<2;p++)order.forEach((pos,i)=>{body+=`<circle cx="${x[pos]}" cy="${p?180:70}" r="24" fill="${colors[i]}"><animate attributeName="opacity" values="0;0;1;0;0;1;1;0" keyTimes="0;${.06+i*.07};${.061+i*.07};${.12+i*.07};.42;${.55+i*.07};${.6+i*.07};1" dur="9s" calcMode="discrete" repeatCount="indefinite"/></circle>${infoHand(x[pos],p?164:54,`${5+i*.55+p*.18}s`,'9s')}`});
      return infoShell(7,body);
    }
    if(['paint','catchColor','intersection','pong'].includes(mode)){
      const xs=(count,start=145,end=855)=>Array.from({length:count},(_,i)=>start+(end-start)*i/(count-1));
      const row=(count,y,label)=>`<text x="18" y="${y+6}" class="svg-player">${label}</text>${xs(count).map((x,i)=>`<circle cx="${x}" cy="${y}" r="${count>10?17:25}" class="svg-button" data-position="${i+1}"/>`).join('')}`;
      const hand=(x,y,begin,cycle='6s')=>`<text x="${x}" y="${y}" class="svg-hand" opacity="0">&#9757;<animate attributeName="opacity" values="0;1;0;0" keyTimes="0;.08;.2;1" begin="${begin}" dur="${cycle}" repeatCount="indefinite"/></text>`;
      const shell=body=>`<svg class="mechanic-svg" viewBox="0 0 900 250" role="img">${row(15,70,'Player1')}${row(15,180,'Player2')}${body}</svg>`;
      const x=xs(15);
      if(mode==='paint'){
        const fill=(y)=>`<circle cx="${x[6]}" cy="${y}" r="17" fill="#121b35"><animate attributeName="fill" values="#121b35;#168cff;#168cff;#ff781b;#ff781b;#121b35" keyTimes="0;.15;.48;.55;.9;1" dur="7s" repeatCount="indefinite"/></circle>`;
        return shell(`${fill(70)}${fill(180)}${hand(x[6],54,'1.05s','7s')}${hand(x[6],164,'3.85s','7s')}`);
      }
      if(mode==='catchColor'){
        const cycle=(cx,y,own,next)=>`<circle cx="${cx}" cy="${y}" r="17"><animate attributeName="fill" values="#ff781b;#168cff;#29d66f;#ff4db8;${own};#121b35" keyTimes="0;.16;.32;.48;.64;1" dur="6s" calcMode="discrete" repeatCount="indefinite"/></circle><circle cx="${next}" cy="${y}" r="17" fill="${own}" opacity="0"><animate attributeName="opacity" values="0;0;1;1;0" keyTimes="0;.68;.69;.92;1" dur="6s" calcMode="discrete" repeatCount="indefinite"/></circle>`;
        return shell(`${cycle(x[3],70,'#168cff',x[10])}${cycle(x[10],180,'#ff781b',x[4])}${hand(x[3],54,'3.65s','6s')}${hand(x[10],164,'.65s','6s')}`);
      }
      if(mode==='intersection'){
        const path=[0,2,4,6,7,7,8,10,12,14,12,10,8,7,7,6,4,2,0].map(i=>x[i]).join(';');
        const reverse=[14,12,10,8,7,7,6,4,2,0,2,4,6,7,7,8,10,12,14].map(i=>x[i]).join(';');
        const movers=y=>`<circle cy="${y}" r="17" fill="currentColor"><animate attributeName="cx" values="${path}" dur="7.6s" calcMode="discrete" repeatCount="indefinite"/></circle><circle cy="${y}" r="17" fill="currentColor"><animate attributeName="cx" values="${reverse}" dur="7.6s" calcMode="discrete" repeatCount="indefinite"/></circle>`;
        return shell(`<g color="#168cff">${movers(70)}</g><g color="#ff781b">${movers(180)}</g>${hand(x[7],54,'1.6s','7.6s')}${hand(x[7],164,'1.6s','7.6s')}`);
      }
      const ballX=[x[5],x[8],x[12],x[14],x[11],x[9],x[5],x[2],x[0],x[3],x[5]].join(';');
      const ballY=['70','70','70','70','180','180','180','180','180','70','70'].join(';');
      return shell(`<circle cx="${x[5]}" cy="70" r="19" fill="#32e875"/><circle cx="${x[9]}" cy="180" r="19" fill="#32e875"/><circle r="12" fill="#f5f8ff"><animate attributeName="cx" values="${ballX}" dur="6s" calcMode="discrete" repeatCount="indefinite"/><animate attributeName="cy" values="${ballY}" dur="6s" calcMode="discrete" repeatCount="indefinite"/></circle>${hand(x[5],54,'0s','6s')}${hand(x[9],164,'2.4s','6s')}`);
    }
    const sets={classic:[[1,2,3],[1,2,3]],replacement:[[1,2,4,5],[1,2,4,5]],
      independent:[[1,2,4],[2,3,5]],duel:[[1,3],[1,3]],
      colorMatch:[[1,2,3,4,5],[1,2,3,4,5]],colorSequence:[[1,2,3,4],[1,2,3,4]]};
    const active=sets[mode]||[[1],[1]];
    const colorMode=mode==='colorMatch'||mode==='colorSequence';
    const handTimes=mode==='colorMatch'?[[5.4,6.05,6.7,7.35,8],[9,9.65,10.3,10.95,11.6]]:[[5.2,5.9,6.6,7.3],[8.4,9.1,9.8,10.5]];
    const lane=(player,color,index)=>`<div class="demo-lane ${color}-lane"><div class="lane-name">${player}</div>
      <div class="demo-cells">${[1,2,3,4,5].map(position=>`<i class="m-dot d${position} ${active[index].includes(position)?'on':''} ${colorMode?'demo-color c'+position:''}"></i>`).join('')}</div>
      ${colorMode?handTimes[index].map((at,i)=>`<span class="demo-hand color-hand h${i+1}" style="--at:${at}s">&#128070;</span>`).join(''):`<span class="demo-hand demo-${color}-hand">&#128070;</span>`}
      ${mode==='classic'&&index===0?'<span class="demo-hand demo-third-hand">&#128070;</span>':''}</div>`;
    return`<div class="mechanic-demo demo-${mode}">${lane('Player1','blue',0)}${lane('Player2','orange',1)}</div>`;
  }
  function scoreCard(player){
    const p2=player===1,boost=state.boost[player];
    return`<div class="card ${p2?'p2':''}"><div class="name">${esc(state.names[player])}</div>
      <div class="score-wrap">${p2&&boost?'<span class="x2">X2</span>':''}
      <div class="score ${boost?'boost':''}">${state.scores[player]}</div>
      ${!p2&&boost?'<span class="x2">X2</span>':''}</div></div>`;
  }
  const colorHex={red:'#ff334f',blue:'#1b9cff',green:'#32e875',yellow:'#ffd43b',purple:'#b86cff',off:'#18213c'};
  function colorPattern(){
    if(state.mode==='colorSequence'||!state.colorTarget?.length||state.colorStage==='answer'&&state.mode==='colorMatch')return'';
    return`<div class="color-pattern ${state.colorStage==='fade'?'fade':''}">${state.colorTarget.map(x=>`<i style="--c:${colorHex[x.color]||colorHex.off}"><b>${x.position}</b></i>`).join('')}</div>`;
  }
  function privateColorPatterns(){
    if(state.mode!=='colorMatch')return colorPattern();
    return`<div class="private-patterns">${[0,1].map(player=>`<div class="private-pattern p${player+1}">
      <small>${esc(state.names[player])}</small>
      ${(state.playerColorStage[player]==='show'||state.playerColorStage[player]==='fade')?`<div class="color-pattern ${state.playerColorStage[player]==='fade'?'fade':''}">${(state.playerColorTarget[player]||[]).map(x=>`<i style="--c:${colorHex[x.color]||colorHex.off}"><b>${x.position}</b></i>`).join('')}</div>`:`<strong>${T[lang].confirm}</strong>`}
    </div>`).join('')}</div>`;
  }
  function touchKeyboard(){
    const rows=lang==='ru'?['ЙЦУКЕНГШЩЗХ','ФЫВАПРОЛДЖЭ','ЯЧСМИТЬБЮ']:['QWERTYUIOP','ASDFGHJKL','ZXCVBNM'];
    return`<div class="touch-keyboard">${rows.map(row=>`<div>${[...row].map(k=>`<button data-key="${k}">${k}</button>`).join('')}</div>`).join('')}
      <div><button class="wide" data-key=" ">␠</button><button class="wide" data-key="backspace">⌫</button></div></div>`;
  }
  function render(){
    const t=T[lang],setup=['lobby','menu','assignBlue','assignOrange','scanP1','scanP2','namePlayer','modes','difficulty','variant','duration','records'];
    if(role==='player'&&setup.includes(state.phase)){app.innerHTML=`<section class="screen">${brand()}</section>`;return}
    if(state.phase==='lobby')app.innerHTML=LightningLobby.html(lobbyView());
    else if(state.phase==='idle')app.innerHTML=`<section class="screen touch" data-action="menu">${brand()}</section>`;
    else if(state.phase==='menu')app.innerHTML=`<section class="screen">${brand()}<div class="menu"><button class="btn" data-action="play">${t.play}</button><button class="btn orange" data-action="records">${t.records}</button></div>${language()}</section>`;
    else if(state.phase==='assignBlue'||state.phase==='assignOrange'){const enough=[...navigator.getGamepads()].filter(Boolean).length>=2,text=enough?(state.phase==='assignBlue'?t.assignBlue:t.assignOrange):t.controllerMissing;app.innerHTML=`<section class="screen">${brand()}<div class="subtitle">${text}</div><button class="btn back" data-action="back">${t.back}</button>${language()}</section>`}
    else if(state.phase==='scanP1'||state.phase==='scanP2'){app.innerHTML=`<section class="screen"><div class="rfid-box">${brand()}<h1>${state.phase==='scanP1'?t.scan1:t.scan2}</h1><div class="rfid-actions"><button class="btn orange" data-action="back">${t.back}</button></div></div>${language()}</section>`}
    else if(state.phase==='namePlayer')app.innerHTML=`<section class="screen name-screen"><div class="rfid-box"><h1>${t.enterName} ${pendingPlayer+1}</h1><input id="playerName" maxlength="24" autocomplete="off" inputmode="none">${touchKeyboard()}<button class="btn name-ok" data-action="saveName">${t.ok}</button></div>${language()}</section>`;
    else if(state.phase==='modes'){const unlocked=state.playerBasic.every(Boolean);app.innerHTML=`<section class="screen mode-screen">${brand()}<h1>${t.chooseMode}</h1>${!unlocked?`<div class="unlock-note">${t.completeBasic}</div>`:''}<div class="mode-grid">${Object.entries(t.modes).map(([k,v])=>{const locked=k!=='classic'&&!unlocked;return`<div class="mode-choice ${locked?'locked':''}">${locked?'<span class="lock-icon">🔒</span>':''}<button class="btn mode-btn ${['replacement','duel','colorSequence','catchColor','pong'].includes(k)?'orange':''}" data-mode="${k}" data-locked="${locked?'1':'0'}">${v[0]}</button><button class="help-btn" data-help="${k}">?</button></div>`}).join('')}</div><button class="btn back" data-action="back">${t.back}</button>${language()}${sessionExit()}</section>`}
    else if(state.phase==='help'){const m=t.modes[state.helpMode];app.innerHTML=`<section class="screen help-screen"><div class="help-panel"><h1>${m[0]}</h1><p>${m[1]}</p>${mechanicDemo(state.helpMode)}</div><button class="btn back" data-action="helpBack">${t.back}</button>${language()}${sessionExit()}</section>`}
    else if(state.phase==='difficulty'){const noVery=['colorMatch','intersection'],levels=noVery.includes(state.mode)?['easy','medium','hard']:['easy','medium','hard','veryHard'],profileKey=state.mode==='colorSequence'?'sequenceHard':null,veryUnlocked=profileKey?state.sequenceHard.every(Boolean):(state.unlockHard[state.mode]?.every(Boolean)??true);app.innerHTML=`<section class="screen"><h1>${t.chooseDifficulty}</h1><div class="difficulty-grid">${levels.map((d,i)=>{const locked=d==='veryHard'&&!veryUnlocked;return`<button class="btn ${i%2?'orange':''} ${locked?'locked':''}" data-difficulty="${d}" data-locked="${locked?'1':'0'}">${locked?'🔒 ':''}${t.difficulties[d]}</button>`}).join('')}</div><button class="btn back" data-action="${state.mode==='catchColor'?'variantBack':'modes'}">${t.back}</button>${language()}${sessionExit()}</section>`}
    else if(state.phase==='variant')app.innerHTML=`<section class="screen"><h1>${t.chooseVariant}</h1><div class="difficulty-grid"><button class="btn" data-variant="fill">${t.fillField}</button><button class="btn orange" data-variant="score">${t.timeAttack}</button></div><button class="btn back" data-action="modes">${t.back}</button>${language()}${sessionExit()}</section>`;
    else if(state.phase==='duration')app.innerHTML=`<section class="screen"><h1>${t.chooseTime}</h1><div class="duration-grid">${cfg.durationOptionsMinutes.map(n=>`<button class="btn duration ${n%2===0?'orange':''}" data-duration="${n}">${n}<small>${t.minute}</small></button>`).join('')}</div><button class="btn back" data-action="${['colorMatch','colorSequence','catchColor','intersection','pong'].includes(state.mode)?'difficulty':'modes'}">${t.back}</button>${language()}${sessionExit()}</section>`;
    else if(state.phase==='records'||state.phase==='leaderboard')app.innerHTML=leaderboardHtml(state.phase==='records');
    else if(state.phase==='ready')app.innerHTML=`<section class="screen">${brand()}<div class="subtitle">${t.press}</div>${language()}${sessionExit()}${gameQuit()}${quitModal()}</section>`;
    else if(state.phase==='countdown')app.innerHTML=`<section class="screen">${brand()}<div class="overlay">${state.countdown}</div>${language()}</section>`;
    else if(state.phase==='game'){const gameSec=Math.max(0,Math.ceil(state.remainingMs/1000)),sessionSec=Math.max(0,Math.ceil((gatewaySessionActive?gatewayRemainingMs:state.remainingMs)/1000)),gameClock=`${String(gameSec/60|0).padStart(2,'0')}:${String(gameSec%60).padStart(2,'0')}`,sessionClock=`${String(sessionSec/60|0).padStart(2,'0')}:${String(sessionSec%60).padStart(2,'0')}`,round=Math.max(0,Math.ceil((state.roundRemainingMs||0)/1000)),colorMode=['colorMatch','colorSequence'].includes(state.mode),matchShowing=state.mode==='colorMatch'&&state.playerColorStage.some(x=>x==='show'||x==='fade'),colorText=state.mode==='colorMatch'?(matchShowing?t.showPattern:t.enterPattern):(state.colorStage==='show'?t.showPattern:t.repeatSequence),showRoundTimer=state.mode==='colorSequence'||matchShowing;if(role==='control')app.innerHTML=`<section class="screen control-game">${brand()}<div class="control-game-status"><div class="control-game-timer">${sessionClock}</div><div class="control-game-mode">${t.modes[state.mode][0]}</div></div>${gameQuit()}${quitModal()}</section>`;else app.innerHTML=`<section class="screen">${brand()}<div class="hud">${scoreCard(0)}<div class="center"><div class="timer">${gameClock}</div>${state.mode==='paint'?`<div class="round-timer">${t.round} ${state.advanced.paintRound||1}/5</div>`:''}${colorMode?`<div class="round-timer">${colorText}${showRoundTimer&&round?`: ${round} ${t.seconds}`:''}</div>${state.mode==='colorSequence'?colorPattern():''}`:''}<div class="mode-name">${t.modes[state.mode][0]}</div></div>${scoreCard(1)}</div></section>`}
    else if(state.phase==='gameover')app.innerHTML=`<section class="screen">${brand()}<div class="overlay">${t.over}</div>${language()}</section>`;
    else if(state.phase==='strivexDenied')app.innerHTML=`<section class="screen">${brand()}<div class="overlay">${esc(striveXDeny)}</div>${language()}</section>`;
    else if(state.phase==='results'){const w=state.scores[0]===state.scores[1]?t.draw:`${t.winner}: ${esc(state.names[state.scores[0]>state.scores[1]?0:1])}`;app.innerHTML=`<section class="screen"><h1>${t.results}</h1><div class="results"><div class="result">${esc(state.names[0])}<br><b>${state.scores[0]}</b></div><div class="result p2">${esc(state.names[1])}<br><b>${state.scores[1]}</b></div></div><h1>${w}</h1>${language()}</section>`}
    if(role==='control'&&(cfg.strivex?.enabled||cfg.strivex?.developmentMode)){const log=(striveX.outgoing||[]).slice(-6);app.insertAdjacentHTML('beforeend',`<aside class="strivex-panel ${striveX.connected?'online':'offline'}"><b>StriveX: ${esc(striveX.state)}</b><small>${esc(striveX.sessionId||striveX.lastSessionId||'no session')}</small>${striveXDeny?`<strong>${esc(striveXDeny)}</strong>`:''}${cfg.strivex.developmentMode?`<button data-strivex="start">Simulate START</button><button data-strivex="result">RESULT</button><button data-strivex="failed">FAILED</button><button data-strivex="timeout">TIMEOUT</button><pre>${esc(log.join('\n'))}</pre>`:''}</aside>`)}
  }
  function syncSessionTimeout(){
    clearTimeout(sessionIdleTimer);
    const waiting=['modes','help','difficulty','variant','duration','ready'];
    if(role==='control'&&!gatewaySessionActive&&waiting.includes(state.phase))sessionIdleTimer=setTimeout(endSession,cfg.sessionIdleTimeoutMs||300000);
  }
  function publish(){syncSessionTimeout();render();lightning.publishState({...state,lang})}
  const serial=command=>lightning.serial(command);
  if(role==='player'){lightning.onState(s=>{state=s;lang=s.lang||lang;render()});render();return}
  function mask(set){return set.reduce((v,p)=>v|(1<<(p-1)),0).toString(16).toUpperCase().padStart(4,'0')}
  function sendLeds(){
    if(!engine)return;
    const flags=(state.boost[0]?1:0)|(state.boost[1]?2:0)|(state.powerVisible&&state.power[0]?4:0)|(state.powerVisible&&state.power[1]?8:0);
    serial(`LEDS ${mask([...engine.activeByPlayer[0]])} ${mask([...engine.activeByPlayer[1]])} ${flags} ${state.power[0]||0} ${state.power[1]||0}`);
  }
  const engine=new GameEngine(cfg,{onLights:sendLeds});
  const colorEngine=new ColorGameEngine();
  const advancedEngine=new AdvancedGameEngine();
  let gameRaf,roundTimer,phaseTimer,bonusTimer,sessionIdleTimer,accept=false,colorTimers=[],colorRoundToken=0,colorPlayerToken=[0,0],advancedLastFrame=0;const previous=new Map(),previousStick=new Map();
  function clearColorTimers(){colorRoundToken++;for(const timer of colorTimers)clearTimeout(timer);colorTimers=[]}
  function clearTimers(){countdownToken++;cancelAnimationFrame(gameRaf);clearTimeout(roundTimer);clearTimeout(phaseTimer);clearTimeout(bonusTimer);clearColorTimers()}
  function setPhase(p){state.phase=p;publish();serial(`MODE ${p.toUpperCase()}`)}
  function stick(g){const s=cfg.joystickStick||{},q=s.axisThreshold||.55,x=g.axes[s.horizontalAxis??0]||0,y=g.axes[s.verticalAxis??1]||0;return{left:!!g.buttons[s.leftButton??13]?.pressed||x<=-q,right:!!g.buttons[s.rightButton??14]?.pressed||x>=q,down:!!g.buttons[s.downButton??15]?.pressed||y>=q}}
  function snapshot(){previous.clear();previousStick.clear();for(const g of navigator.getGamepads())if(g){previous.set(g.index,g.buttons.map(b=>b.pressed));previousStick.set(g.index,stick(g))}accept=true}
  function edges(g){const old=previous.get(g.index)||[],s=stick(g),os=previousStick.get(g.index)||{},out=[];for(let i=0;i<12;i++)if(g.buttons[i]?.pressed&&!old[i])out.push(i+1);if(s.left&&!os.left)out.push(13);if(s.right&&!os.right)out.push(14);if(s.down&&!os.down)out.push(15);previous.set(g.index,g.buttons.map(b=>b.pressed));previousStick.set(g.index,s);return out}
  function afterControllers(){
    if(gatewayMode&&gatewaySessionActive){startSelectedRound();return}
    else if(cfg.rfid?.enabled)state.phase='scanP1';
    else{pendingUid='';pendingPlayer=0;state.phase='namePlayer'}
    publish();if(state.phase==='namePlayer')setTimeout(()=>document.getElementById('playerName')?.focus(),50)
  }
  function autoAssignControllers(){
    if(cfg.interfaceTestMode){assigned={blue:'test-blue',orange:'test-orange'};snapshot();return true}
    const pads=[...navigator.getGamepads()].filter(Boolean).sort((a,b)=>a.index-b.index);
    if(pads.length<2)return false;
    let saved;try{saved=JSON.parse(localStorage.getItem('lightning.controllers')||'null')}catch{}
    const byIndex=index=>pads.find(g=>g.index===index);
    let blue=byIndex(saved?.blue),orange=byIndex(saved?.orange);
    if(!blue||!orange||blue.index===orange.index){blue=pads[0];orange=pads[1]}
    const physical={blue:blue.index,orange:orange.index};
    assigned=cfg.joystick?.swapPlayers?{blue:physical.orange,orange:physical.blue}:physical;
    localStorage.setItem('lightning.controllers',JSON.stringify(physical));
    snapshot();return true;
  }
  function reset(){clearTimers();engine.reset();advancedEngine.reset();state={...state,phase:gatewayMode?'lobby':'idle',scores:[0,0],boost:[false,false],power:[0,0],powerVisible:true,colorStage:'',colorTarget:[],playerColorTarget:[[],[]],playerColorStage:['',''],colorInput:[[],[]],roundRemainingMs:0,advanced:{},remainingMs:state.durationMinutes*60000,lobbyPlayers:[],sessionPlayers:[]};publish();serial('MODE IDLE');audio?.setGameDuck(false,0);audio?.crossfade('menu')}
  function returnToModes(){clearTimers();engine.reset();advancedEngine.reset();state={...state,phase:gatewayMode&&gatewaySessionActive?'lobby':'modes',scores:[0,0],boost:[false,false],power:[0,0],powerVisible:true,colorStage:'',colorTarget:[],playerColorTarget:[[],[]],playerColorStage:['',''],colorInput:[[],[]],roundRemainingMs:0,advanced:{},remainingMs:state.durationMinutes*60000};publish();serial('MODE IDLE');audio?.setGameDuck(false,0);audio?.crossfade('menu')}
  function abortGame(){quitConfirm=false;if(gatewaySessionActive){returnToModes();snapshot();return}const external=striveXActive;if(external){lightning.striveXFinal({type:'failed',meta:{fail_reason:'cancelled',mode:state.mode}});striveXActive=false}(external?reset:returnToModes)();snapshot()}
  function sessionScore(){return sessionRounds.reduce((best,round)=>Math.max(best,Number(round.score)||0),0)}
  function addSessionRound(status='completed'){sessionRounds.push({mode:state.mode,difficulty:state.difficulty,variant:state.variant,scores:[...state.scores],score:Math.max(...state.scores),status,finished_at:new Date().toISOString()})}
  function finishGatewaySession(status='completed',reason='session_end'){
    if(!gatewaySessionActive)return;
    if(state.phase==='game'){clearTimers();if(!['colorMatch','colorSequence',...advancedModes].includes(state.mode))state.scores=engine.finish().scores;else if(advancedModes.has(state.mode))state.scores=[...advancedEngine.scores];addSessionRound(status==='timeout'?'timeout':'abandoned');save()}
    const score=sessionScore(),meta={rounds:sessionRounds,best:score,total:sessionRounds.reduce((sum,r)=>sum+(Number(r.score)||0),0),player:{uid:sessionCardUids[0],name:state.names[0]},reason};
    lightning.striveXFinal({type:'result',number:score,status,meta});gatewaySessionActive=false;gatewayRemainingMs=0;sessionRounds=[];sessionCardUids=[null,null];state.names=[...cfg.offline.playerNames];reset();
  }
  function endSession(){if(gatewaySessionActive){finishGatewaySession('completed','player_exit');return}sessionCardUids=[null,null];guestBasic=[false,false];guestSequenceHard=[false,false];pendingUid='';pendingPlayer=0;state.names=[...cfg.offline.playerNames];state.playerBasic=[false,false];state.sequenceHard=[false,false];state.unlockHard={catchColor:[false,false],intersection:[false,false],pong:[false,false]};reset()}
  function startGatewaySession(event){
    const users=Array.isArray(event.users)&&event.users.length?event.users:[event.user];
    if(users.filter(Boolean).length<2){console.warn('startGatewaySession: fewer than 2 players, ignoring unlock',event);return}
    clearTimers();quitConfirm=false;engine.reset();advancedEngine.reset();gatewaySessionActive=true;gatewayRemainingMs=Math.max(0,Number(event.paid_seconds)||0)*1000;sessionRounds=[];striveX.sessionId=event.session_id;state.lobbyPlayers=[];
    clearLobbyIdle();lobbyOverlay=null;lobbyStarting=false;lobbyStartDenied='';
    ensureCards(users);const db=cards();
    state.sessionPlayers=users.slice(0,2).map((u,i)=>({uid:String(u?.uid||`P${i+1}`),name:u?.name||u?.username||cfg.offline.playerNames[i]||`Player${i+1}`,avatar:u?.avatar??null}));
    sessionCardUids=state.sessionPlayers.map(p=>db[p.uid]?p.uid:null);state.names=state.sessionPlayers.map(p=>p.name);
    state.playerBasic=sessionCardUids.map(u=>!!(u&&db[u]?.basicCompleted));state.sequenceHard=sessionCardUids.map(u=>!!(u&&db[u]?.sequenceHardCompleted));
    for(const mode of['catchColor','pong'])state.unlockHard[mode]=sessionCardUids.map(u=>!!(u&&db[u]?.hardUnlocks?.[mode]));
    if(autoAssignControllers())afterControllers();else{assigned={blue:null,orange:null};state.phase='assignBlue';publish();snapshot()}
  }
  function startStriveX(sessionId){
    clearTimers();quitConfirm=false;striveXDeny='';engine.reset();advancedEngine.reset();
    if(!autoAssignControllers()){lightning.striveXFinal({type:'error',message:'two USB controllers not connected'});striveXActive=false;reset();return}
    striveXActive=true;striveX.sessionId=sessionId;state.mode=cfg.strivex.defaultMode||'classic';state.difficulty=cfg.strivex.defaultDifficulty||'easy';state.variant=cfg.strivex.defaultVariant||'score';state.durationMinutes=Number(cfg.strivex.durationMinutes)||1;state.remainingMs=state.durationMinutes*60000;state.names=[...cfg.offline.playerNames];countdown();
  }
  function handleStriveXEvent(event){if(event.type==='unlock')startGatewaySession(event);else if(event.type==='lobby')onLobbyUpdate(event.players||[],event.max);else if(event.type==='scan'){if(event.state==='checking'){if(!lobbyOverlay||lobbyOverlay.type==='checking')setLobbyOverlay({type:'checking'},5000)}else if(event.state==='denied')setLobbyOverlay({type:'denied',reason:event.reason||'unregistered'},5000)}else if(event.type==='start_denied'){lobbyStarting=false;lobbyStartDenied=event.reason||'';render()}else if(event.type==='tick'&&gatewaySessionActive){gatewayRemainingMs=event.remainingMs;publish()}else if(event.type==='expired'){if(state.phase==='game')sessionExpirePending=true;else finishGatewaySession('timeout','paid_time_expired')}else if(event.type==='lock')finishGatewaySession('abandoned',event.reason||'gateway_lock');else if(event.type==='start')startStriveX(event.sessionId);else if(event.type==='deny'){clearTimers();striveXActive=false;striveXDeny=`StriveX: ${event.reason}`;state.phase='strivexDenied';publish();setTimeout(()=>{striveXDeny='';reset()},4000)}}
  lightning.onStriveXEvent(handleStriveXEvent);lightning.onStriveXStatus(s=>{striveX={...striveX,...s};if(!striveX.connected&&!gatewaySessionActive){state.lobbyPlayers=[];lobbyStarting=false;if(lobbyOverlay?.type!=='rules')lobbyOverlay=null;clearLobbyIdle()}render()});lightning.onStriveXLog(item=>{if(item.event==='sent'&&item.line){striveX.outgoing=[...(striveX.outgoing||[]),item.line].slice(-20);render()}});
  lightning.getStriveXSnapshot().then(s=>{striveX={...striveX,...s};if(!gatewayMode&&s.state==='running'&&s.sessionId)startStriveX(s.sessionId);render()});
  const classicEngineModes=new Set(['classic','replacement','independent','duel']);
  lightning.onTestHit?.(({player,slot})=>{
    if(state.phase==='ready'){hit(player,slot);return}
    if(!classicEngineModes.has(state.mode)){hit(player,slot);return}
    const pos=[...engine.activeByPlayer[player]].sort((a,b)=>a-b)[slot];
    if(pos!==undefined)hit(player,pos)
  });
  function continueAfterManualName(player){
    if(player===0&&cfg.rfid?.enabled)state.phase='scanP2';
    else if(player===0){pendingPlayer=1;pendingUid='';state.phase='namePlayer'}
    else state.phase='modes';
    publish();if(state.phase==='namePlayer')setTimeout(()=>document.getElementById('playerName')?.focus(),50)
  }
  function modifierMode(){return cfg.modifiers?.enabled&&cfg.modifiers.modes.includes(state.mode)}
  function spawnPower(){
    if(!modifierMode()||state.power[0]||state.power[1])return;
    if(state.mode==='replacement'){const list=[...engine.activeByPlayer[0]];const p=list[Math.random()*list.length|0]||0;state.power=[p,p]}
    else{state.power=[0,1].map(p=>{const list=[...engine.activeByPlayer[p]];return list[Math.random()*list.length|0]||0})}
    state.powerVisible=true;const token=++runtime.powerToken,started=performance.now();sendLeds();publish();
    const animate=()=>{
      if(token!==runtime.powerToken||!state.power[0]&&!state.power[1])return;
      const elapsed=performance.now()-started,offer=cfg.modifiers.offerMs||7000,blinkAt=cfg.modifiers.blinkAfterMs||4000;
      if(elapsed>=offer){state.power=[0,0];state.powerVisible=true;sendLeds();publish();if(runtime.queued){runtime.queued=false;setTimeout(spawnPower,0)}return}
      if(elapsed<blinkAt)state.powerVisible=true;
      else state.powerVisible=!state.powerVisible;
      sendLeds();publish();
      const progress=Math.max(0,(elapsed-blinkAt)/(offer-blinkAt)),delay=elapsed<blinkAt?Math.max(40,blinkAt-elapsed):Math.max(90,450-progress*350);
      bonusTimer=setTimeout(animate,delay);
    };
    bonusTimer=setTimeout(animate,Math.min(4000,cfg.modifiers.blinkAfterMs||4000));
  }
  function activateBoost(player){
    runtime.powerToken++;clearTimeout(bonusTimer);state.power=[0,0];state.powerVisible=true;state.boost[player]=true;const token=++runtime.boostToken[player];audio?.effect('bonus');
    sendLeds();publish();if(runtime.queued){runtime.queued=false;setTimeout(spawnPower,0)}
    setTimeout(()=>{if(runtime.boostToken[player]!==token)return;state.boost[player]=false;sendLeds();publish()},cfg.modifiers.durationMs);
  }
  async function countdown(){accept=false;const token=++countdownToken;state.phase='countdown';audio?.effect('startCountdown');for(let n=cfg.countdownSeconds;n;n--){if(token!==countdownToken)return;state.countdown=n;publish();serial(`COUNTDOWN ${n}`);await new Promise(r=>setTimeout(r,1000))}if(token===countdownToken)startGame()}
  const colorDigits=array=>(array||Array(15).fill('off')).map(c=>COLOR_CODES[c]||0).join('');
  function sendPlayerColors(player,array){serial(`COLORS ${player===0?'B':'O'} ${colorDigits(array)}`)}
  function sendBothColors(blue,orange){serial(`COLORS2 ${colorDigits(blue)} ${colorDigits(orange)}`)}
  function sendTargetColors(items){const digits=colorEngine.colorDigits(items);serial(`COLORS2 ${digits} ${digits}`)}
  function addColorTimer(fn,ms){const id=setTimeout(fn,ms);colorTimers.push(id);return id}
  function beginMatchPlayer(player){
    if(state.phase!=='game')return;const token=++colorPlayerToken[player],round=colorEngine.startMatch(state.difficulty,player),side=player===0?'B':'O';
    state.playerColorStage[player]='show';state.playerColorTarget[player]=round.target;state.colorInput[player]=Array(15).fill('off');
    state.playerColorDeadline=state.playerColorDeadline||[0,0];state.playerColorDeadline[player]=performance.now()+round.showMs;
    sendPlayerColors(player,(()=>{const a=Array(15).fill('off');for(const x of round.target)a[x.position-1]=x.color;return a})());publish();
    addColorTimer(()=>{if(token!==colorPlayerToken[player]||state.phase!=='game')return;state.playerColorStage[player]='fade';publish();serial(`FADE ${side} 1000`);
      addColorTimer(()=>{if(token!==colorPlayerToken[player]||state.phase!=='game')return;state.playerColorStage[player]='answer';state.playerColorDeadline[player]=performance.now()+round.answerMs;sendPlayerColors(player,state.colorInput[player]);serial(`CONFIRM ${side} 8`);publish();
        addColorTimer(()=>evaluateMatchPlayer(player,token),round.answerMs);
      },1100);
    },round.showMs);
  }
  function beginMatchRound(){clearColorTimers();colorPlayerToken=[0,0];state.playerColorTarget=[[],[]];state.playerColorStage=['show','show'];beginMatchPlayer(0);beginMatchPlayer(1)}
  function evaluateMatchPlayer(player,token=colorPlayerToken[player]){
    if(token!==colorPlayerToken[player]||state.phase!=='game'||state.playerColorStage[player]!=='answer')return;
    const result=colorEngine.evaluateMatch(player),side=player===0?'B':'O';state.scores=result.scores;state.playerColorStage[player]='feedback';
    serial(`FLASH ${side} ${result.correct?'G':'R'}`);publish();
    addColorTimer(()=>{if(token===colorPlayerToken[player]&&state.phase==='game')beginMatchPlayer(player)},900);
  }
  function beginSequenceRound(){
    if(state.phase!=='game')return;clearColorTimers();const token=++colorRoundToken,round=colorEngine.startSequence(state.difficulty,colorEngine.round);
    state.colorStage='show';state.colorTarget=[];state.colorInput=[[],[]];state.roundRemainingMs=round.sequence.length*round.delayMs;state.roundDeadline=performance.now()+state.roundRemainingMs;publish();
    round.sequence.forEach((item,index)=>addColorTimer(()=>{if(token!==colorRoundToken||state.phase!=='game')return;state.colorTarget=round.sequence.slice(0,index+1);sendTargetColors(state.colorTarget);if(round.sound)audio?.color(item.color);publish()},index*round.delayMs));
    addColorTimer(()=>{if(token!==colorRoundToken||state.phase!=='game')return;state.colorStage='answer';state.roundRemainingMs=0;publish()},round.sequence.length*round.delayMs);
  }
  function colorHit(player,pos){
    if(!(state.mode==='colorSequence'&&state.difficulty==='veryHard'))audio?.effect('button');
    if(state.mode==='colorMatch'){
      if(state.playerColorStage[player]!=='answer')return;
      if(pos===8){evaluateMatchPlayer(player);return}
      const color=colorEngine.cycle(player,pos);if(!color)return;state.colorInput[player]=[...colorEngine.entries[player]];sendPlayerColors(player,state.colorInput[player]);serial(`CONFIRM ${player===0?'B':'O'} 8`);publish();return;
    }
    if(state.mode==='colorSequence'){
      if(state.colorStage!=='answer')return;const result=colorEngine.pressSequence(player,pos);if(!result.accepted)return;
      const pressed=colorEngine.sequence.find(x=>x.position===pos);if(state.difficulty!=='veryHard'&&pressed)audio?.color(pressed.color);
      if(!result.complete)return;
      if(!result.correct){serial(`FLASH ${player===0?'B':'O'} R`);addColorTimer(()=>sendTargetColors(colorEngine.sequence),600);return}
      state.colorStage='feedback';state.scores=colorEngine.awardSequence(player);serial(`FEEDBACK ${player===0?'G':'R'} ${player===1?'G':'R'}`);publish();clearColorTimers();addColorTimer(beginSequenceRound,1300)
    }
  }
  const advancedModes=new Set(['paint','catchColor','intersection','pong']);
  function sendPaint(){serial(`OWNERS ${advancedEngine.paintOwners.map(x=>x<0?0:x+1).join('')}`)}
  function sendCatches(){
    const targets=advancedEngine.catchTargets;if(!targets[0]||!targets[1])return;const now=performance.now();
    for(let player=0;player<2;player++){const current=advancedEngine.catchColorAt(player,now);targets[player].phase=CATCH_COLORS.indexOf(current);targets[player].startedAt=now}
    serial(`CATCH2 ${targets[0].position} ${targets[0].phase} ${mask([...advancedEngine.catchFilled[0]])} ${targets[1].position} ${targets[1].phase} ${mask([...advancedEngine.catchFilled[1]])} ${advancedEngine.catchIntervalMs}`);
  }
  function sendCatch(player){
    const target=advancedEngine.catchTargets[player];if(!target)return;const now=performance.now(),current=advancedEngine.catchColorAt(player,now);
    target.phase=CATCH_COLORS.indexOf(current);target.startedAt=now;
    serial(`CATCH ${player===0?'B':'O'} ${target.position} ${advancedEngine.catchIntervalMs} ${target.phase} ${mask([...advancedEngine.catchFilled[player]])}`);
  }
  function sendPong(){
    const p=advancedEngine.pong;if(!p)return;
    const receiver=p.receiver,globalPaddle=receiver===0?p.paddle[0]-1:30-p.paddle[1],active=!p.serving&&Math.abs(p.ball-globalPaddle)<=1.05;
    serial(`PONG ${Math.max(0,Math.min(29,Math.round(p.ball)))} ${p.paddle[0]} ${p.paddle[1]} ${p.server} ${p.serving?1:0} ${active?1:0}`);
  }
  function startAdvanced(now=performance.now()){
    state.advanced={};
    if(state.mode==='paint'){
      advancedEngine.startPaint();state.durationMinutes=2.5;state.remainingMs=30000;state.advanced={paintRound:1,roundDeadline:now+30000,paintPaused:false};sendPaint();
    }else if(state.mode==='catchColor'){
      advancedEngine.startCatch(state.variant,state.difficulty,now);state.advanced={catchLocked:[false,false]};sendCatches();
      setTimeout(()=>{if(state.phase==='game'&&state.mode==='catchColor')sendCatches()},120);
      setTimeout(()=>{if(state.phase==='game'&&state.mode==='catchColor')sendCatches()},350);
    }else if(state.mode==='intersection'){
      advancedEngine.startIntersection(state.difficulty,now);state.advanced={};advancedLastFrame=0;
    }else if(state.mode==='pong'){
      advancedEngine.startPong(state.difficulty,now);state.advanced={};sendPong();advancedLastFrame=0;
    }
  }
  function updateAdvanced(now){
    if(state.mode==='paint'&&!state.advanced.paintPaused&&now>=state.advanced.roundDeadline){
      const result=advancedEngine.finishPaintRound();state.scores=result.scores;state.advanced.paintRound=result.round;
      state.advanced.paintPaused=true;state.remainingMs=0;
      const winner=result.counts[0]===result.counts[1]?'D':(result.counts[0]>result.counts[1]?'B':'O');
      serial(`ROUNDWIN ${winner}`);publish();
      roundTimer=setTimeout(()=>{if(state.phase!=='game')return;if(result.round>=5){finish('completed');return}
        state.advanced.paintPaused=false;state.advanced.paintRound=result.round+1;state.advanced.roundDeadline=performance.now()+30000;state.remainingMs=30000;runtime.lastEndSecond=0;sendPaint();publish();
      },850);
    }else if(state.mode==='intersection'&&now-advancedLastFrame>=60){
      const dots=advancedEngine.updateIntersection(now);serial(`DOTS2 ${Math.round(dots[0][0])+1} ${Math.round(dots[0][1])+1} ${Math.round(dots[1][0])+1} ${Math.round(dots[1][1])+1}`);advancedLastFrame=now;
    }else if(state.mode==='pong'&&now-advancedLastFrame>=35){
      const result=advancedEngine.updatePong(now);state.scores=[...advancedEngine.scores];
      if(result.point){serial(`FLASHPOS ${result.loser===0?'B':'O'} ${result.position} R`);setTimeout(sendPong,350)}else sendPong();
      advancedLastFrame=now;
    }
  }
  function advancedHit(player,pos){
    audio?.effect('button');const side=player===0?'B':'O',now=performance.now();
    if(state.mode==='paint'){
      if(!state.advanced.paintPaused&&advancedEngine.paint(player,pos)){sendPaint();publish()}return;
    }
    if(state.mode==='catchColor'){
      if(state.advanced.catchLocked[player])return;state.advanced.catchLocked[player]=true;
      const result=advancedEngine.pressCatch(player,pos,now);if(!result.accepted)return;state.scores=result.scores;
      serial(`FLASHPOS ${side} ${pos} ${['hit','field'].includes(result.outcome)?'G':'R'}`);
      setTimeout(()=>{if(state.phase==='game'&&state.mode==='catchColor'){state.advanced.catchLocked[player]=false;sendCatch(player);publish()}},480);
      publish();return;
    }
    if(state.mode==='intersection'){
      const result=advancedEngine.pressIntersection(player,pos,now);if(!result.accepted)return;state.scores=result.scores;
      serial(`FLASHPOS ${side} ${pos} ${result.hit?'G':'R'}`);publish();return;
    }
    if(state.mode==='pong'){
      const result=advancedEngine.pressPong(player,pos,now);if(!result.accepted)return;state.scores=[...advancedEngine.scores];
      if(result.point)serial(`FLASHPOS ${side} ${pos} R`);sendPong();publish();
    }
  }
  function startGame(){
    runtime.hits=[0,0];runtime.next=[cfg.modifiers.everyHits,cfg.modifiers.everyHits];runtime.queued=false;runtime.boostToken=[0,0];state.boost=[false,false];state.power=[0,0];
    state.phase='game';state.scores=[0,0];state.remainingMs=state.durationMinutes*60000;runtime.lastEndSecond=0;audio?.setGameDuck(state.mode==='colorSequence',0);audio?.playGame(state.mode);serial(`MODE GAME ${state.mode.toUpperCase()}`);
    if(state.mode==='colorMatch'){colorEngine.scores=[0,0];colorEngine.round=0;beginMatchRound()}
    else if(state.mode==='colorSequence'){colorEngine.scores=[0,0];colorEngine.round=0;beginSequenceRound()}
    else if(advancedModes.has(state.mode))startAdvanced(performance.now());
    else{engine.start(Date.now(),state.mode);sendLeds()}
    publish();snapshot();
    const end=state.mode==='paint'?0:performance.now()+state.remainingMs;const tick=()=>{const now=performance.now();if(state.mode==='paint'){if(!state.advanced.paintPaused)state.remainingMs=Math.max(0,state.advanced.roundDeadline-now)}else state.remainingMs=Math.max(0,end-now);if(state.mode==='colorMatch'&&state.playerColorDeadline)state.roundRemainingMs=Math.max(0,Math.max(...state.playerColorDeadline)-now);else if(state.roundDeadline)state.roundRemainingMs=Math.max(0,state.roundDeadline-now);if(advancedModes.has(state.mode))updateAdvanced(now);const last=Math.ceil(state.remainingMs/1000);if(last===5&&runtime.lastEndSecond!==5){runtime.lastEndSecond=5;audio?.effect('countdown')}if(state.mode!=='paint'&&!state.remainingMs)return finish('timeout');publish();gameRaf=requestAnimationFrame(tick)};gameRaf=requestAnimationFrame(tick);
  }
  function hit(player,pos){
    if(state.phase==='ready'){countdown();return}if(state.phase!=='game')return;
    if(state.mode==='colorMatch'||state.mode==='colorSequence'){colorHit(player,pos);return}
    if(advancedModes.has(state.mode)){advancedHit(player,pos);return}
    audio?.effect('button');
    const pickup=modifierMode()&&state.power[player]===pos;
    const multiplier=state.boost[player]?cfg.modifiers.multiplier:1;
    const result=engine.press(player,pos,Math.random,multiplier);if(!result.accepted)return;
    runtime.hits[player]++;state.scores=result.scores;
    if(pickup)activateBoost(player);
    if(runtime.hits[player]>=runtime.next[player]){runtime.next[player]+=cfg.modifiers.everyHits;if(state.power[0]||state.power[1])runtime.queued=true;else spawnPower()}
    sendLeds();publish();
    if(result.roundComplete)roundTimer=setTimeout(()=>{if(state.phase==='game'){engine.makeRound();sendLeds();publish()}},cfg.roundPauseMs);
  }
  function save(){const b=board(),d=new Date().toLocaleDateString();state.names.forEach((n,i)=>b.push({name:n,score:state.scores[i],date:d}));b.sort((a,z)=>z.score-a.score);localStorage.setItem('lightning.board',JSON.stringify(b.slice(0,cfg.offline.leaderboardSize)))}
  function completeBasicProfiles(){if(state.mode!=='classic')return;const db=cards();for(let p=0;p<2;p++){state.playerBasic[p]=true;if(sessionCardUids[p]&&db[sessionCardUids[p]])db[sessionCardUids[p]]={...db[sessionCardUids[p]],basicCompleted:true,updatedAt:new Date().toISOString()};else guestBasic[p]=true}saveCards(db)}
  function completeSequenceHard(){
    if(state.mode!=='colorSequence'||state.difficulty!=='hard')return;const db=cards();
    for(let p=0;p<2;p++){state.sequenceHard[p]=true;if(sessionCardUids[p]&&db[sessionCardUids[p]])db[sessionCardUids[p]]={...db[sessionCardUids[p]],sequenceHardCompleted:true,updatedAt:new Date().toISOString()};else guestSequenceHard[p]=true}
    saveCards(db);
  }
  function completeAdvancedHard(){
    if(!['catchColor','pong'].includes(state.mode)||state.difficulty!=='hard')return;
    state.unlockHard[state.mode]=[true,true];const db=cards();
    for(let p=0;p<2;p++)if(sessionCardUids[p]&&db[sessionCardUids[p]])db[sessionCardUids[p]].hardUnlocks={...(db[sessionCardUids[p]].hardUnlocks||{}),[state.mode]:true};
    saveCards(db);
  }
  function finish(cause='completed'){if(state.phase!=='game')return;const external=striveXActive,gatewayRound=gatewaySessionActive;clearTimers();runtime.boostToken[0]++;runtime.boostToken[1]++;runtime.powerToken++;state.boost=[false,false];state.power=[0,0];if(!['colorMatch','colorSequence',...advancedModes].includes(state.mode))state.scores=engine.finish().scores;else if(advancedModes.has(state.mode))state.scores=[...advancedEngine.scores];if(external){if(cause==='timeout')lightning.striveXFinal({type:'timeout'});else lightning.striveXFinal({type:'result',number:Math.max(...state.scores),meta:{scores:state.scores,winner:state.scores[0]===state.scores[1]?'draw':state.scores[0]>state.scores[1]?'blue':'orange',mode:state.mode,difficulty:state.difficulty,rounds:state.mode==='paint'?advancedEngine.paintRound:engine.round}});striveXActive=false}if(gatewayRound)addSessionRound('completed');completeBasicProfiles();completeSequenceHard();completeAdvancedHard();save();audio?.crossfade('end');const afterLeaderboard=external?reset:(sessionExpirePending?()=>{sessionExpirePending=false;finishGatewaySession('timeout','paid_time_expired')}:returnToModes);setPhase('gameover');phaseTimer=setTimeout(()=>{setPhase('results');phaseTimer=setTimeout(()=>{setPhase('leaderboard');phaseTimer=setTimeout(afterLeaderboard,cfg.leaderboardSeconds*1000)},cfg.resultSeconds*1000)},cfg.gameOverSeconds*1000)}
  function handleCard(uid){
    uid=uid.trim().toUpperCase();if(!uid)return;
    if((cfg.rfid.adminCardUids||[]).map(String).map(x=>x.toUpperCase()).includes(uid)){saveCards({});localStorage.setItem('lightning.rfid.lastReset',localDay(new Date()));state.phase='menu';publish();return}
    if(!['scanP1','scanP2'].includes(state.phase))return;
    const player=state.phase==='scanP1'?0:1,db=cards();
    if(db[uid]){sessionCardUids[player]=uid;state.names[player]=db[uid].name;state.playerBasic[player]=!!db[uid].basicCompleted;state.sequenceHard[player]=!!db[uid].sequenceHardCompleted;for(const mode of ['catchColor','pong'])state.unlockHard[mode][player]=!!db[uid].hardUnlocks?.[mode];state.phase=player===0?'scanP2':'modes';publish()}
    else{pendingUid=uid;pendingPlayer=player;state.phase='namePlayer';publish();setTimeout(()=>document.getElementById('playerName')?.focus(),50)}
  }
  let scanBuffer='',lastScan=0;
  window.addEventListener('keydown',e=>{
    if(!['scanP1','scanP2'].includes(state.phase))return;
    const now=performance.now();if(now-lastScan>(cfg.rfid.scanTimeoutMs||80))scanBuffer='';lastScan=now;
    if(e.key==='Enter'){handleCard(scanBuffer);scanBuffer='';e.preventDefault()}else if(e.key.length===1){scanBuffer+=e.key;e.preventDefault()}
  });
  function poll(){if(cfg.joystick?.autoAssign&&['assignBlue','assignOrange'].includes(state.phase)&&autoAssignControllers()){afterControllers();requestAnimationFrame(poll);return}for(const g of [...navigator.getGamepads()].filter(Boolean)){const pressed=edges(g);if(!accept||!pressed.length)continue;if(state.phase==='assignBlue'){assigned.blue=g.index;state.phase='assignOrange';publish();snapshot();break}if(state.phase==='assignOrange'&&g.index!==assigned.blue){assigned.orange=g.index;afterControllers();snapshot();break}const player=g.index===assigned.blue?0:g.index===assigned.orange?1:-1;if(player>=0)for(const pos of pressed)hit(player,pos)}requestAnimationFrame(poll)}
  app.addEventListener('click',e=>{
    if(state.phase==='lobby'&&role==='control'&&handleLobbyClick(e))return;
    const action=e.target.closest('[data-action]')?.dataset.action,mode=e.target.closest('[data-mode]')?.dataset.mode,help=e.target.closest('[data-help]')?.dataset.help,difficulty=e.target.closest('[data-difficulty]')?.dataset.difficulty,variant=e.target.closest('[data-variant]')?.dataset.variant,languageCode=e.target.closest('[data-language]')?.dataset.language,key=e.target.closest('[data-key]')?.dataset.key,duration=Number(e.target.closest('[data-duration]')?.dataset.duration),sx=e.target.closest('[data-strivex]')?.dataset.strivex;
    if(sx){if(sx==='start')lightning.simulateStriveX({type:'start'});else if(gatewaySessionActive)finishGatewaySession(sx==='timeout'?'timeout':sx==='failed'?'failed':'completed',`simulated_${sx}`);else{if(sx==='result')lightning.simulateStriveX({type:'result',number:Math.max(...state.scores)});else lightning.simulateStriveX({type:sx});striveXActive=false;reset()}return}
    if(action==='menu'){state.phase='menu';audio?.crossfade('menu');publish()}if(action==='play'){sessionCardUids=[null,null];state.playerBasic=[...guestBasic];state.sequenceHard=[...guestSequenceHard];if(autoAssignControllers())afterControllers();else{assigned={blue:null,orange:null};state.phase='assignBlue';publish();snapshot()}}
    if(action==='records'){state.phase='records';publish()}if(action==='back'){state.phase=gatewaySessionActive?'lobby':'menu';publish()}if(action==='modes'||action==='helpBack'){state.phase='modes';publish()}if(action==='variantBack'){state.phase='variant';publish()}if(action==='difficulty'){state.phase='difficulty';publish()}if(action==='lang'){langOpen=!langOpen;render()}if(languageCode&&T[languageCode]){lang=languageCode;langOpen=false;localStorage.setItem('lightning.lang',lang);publish()}
    if(key!==undefined&&state.phase==='namePlayer'){const input=document.getElementById('playerName');if(input){if(key==='backspace')input.value=input.value.slice(0,-1);else if(input.value.length<24)input.value+=key;input.focus()}return}
    if(action==='saveName'){const input=document.getElementById('playerName'),name=input?.value.trim();if(name){const p=pendingPlayer;state.names[p]=name;if(pendingUid){const db=cards();db[pendingUid]={name,basicCompleted:false,sequenceHardCompleted:false,updatedAt:new Date().toISOString()};saveCards(db);sessionCardUids[p]=pendingUid;state.playerBasic[p]=false;state.sequenceHard[p]=false}else{sessionCardUids[p]=null;state.playerBasic[p]=guestBasic[p];state.sequenceHard[p]=guestSequenceHard[p]}continueAfterManualName(p)}}
    if(action==='endSession'){endSession();return}
    if(action==='quitGame'){quitConfirm=true;render();return}
    if(action==='cancelQuit'){quitConfirm=false;render();return}
    if(action==='confirmQuit'){abortGame();return}
    if(help){state.helpMode=help;state.phase='help';publish()}
    if(mode){const locked=e.target.closest('[data-mode]')?.dataset.locked==='1';if(!locked){state.mode=mode;if(mode==='paint'){state.durationMinutes=2.5;state.remainingMs=150000;setPhase('ready');accept=false;setTimeout(snapshot,150)}else state.phase=mode==='catchColor'?'variant':(['colorMatch','colorSequence','intersection','pong'].includes(mode)?'difficulty':'duration');publish()}}
    if(variant){state.variant=variant;state.phase='difficulty';publish()}
    if(difficulty){const locked=e.target.closest('[data-difficulty]')?.dataset.locked==='1';if(!locked){state.difficulty=difficulty;state.phase='duration';publish()}}if(duration){state.durationMinutes=duration;state.remainingMs=duration*60000;setPhase('ready');accept=false;setTimeout(snapshot,150)}
  });
  app.addEventListener('pointerdown',()=>{if(state.phase==='lobby'&&lobbyIdleTimer&&lobbyOverlay?.type!=='idle')armLobbyIdle()});
  if(cfg.strivex?.demoLobby&&cfg.strivex?.developmentMode)window.addEventListener('keydown',e=>{if(/^[0-9]$/.test(e.key))demoBuffer=(demoBuffer+e.key).slice(-6);else if(e.key==='Enter'&&demoBuffer){lightning.striveXLobby({type:'demo-tap',code:demoBuffer});demoBuffer=''}});
  let ledWasConnected=false;lightning.onSerialStatus(s=>{const connected=!!s?.connected;if((striveXActive||gatewaySessionActive)&&ledWasConnected&&!connected){if(gatewaySessionActive)finishGatewaySession('failed','LED controller disconnected');else{lightning.striveXFinal({type:'error',message:'LED controller disconnected'});striveXActive=false;reset()}}ledWasConnected=connected});
  window.addEventListener('gamepaddisconnected',e=>{if((striveXActive||gatewaySessionActive)&&(e.gamepad.index===assigned.blue||e.gamepad.index===assigned.orange)){if(gatewaySessionActive)finishGatewaySession('failed','USB controller disconnected');else{lightning.striveXFinal({type:'error',message:'USB controller disconnected'});striveXActive=false;reset()}}});
  window.addEventListener('error',e=>{if(gatewaySessionActive)finishGatewaySession('failed',String(e.message||'application error').slice(0,120));else if(striveXActive){lightning.striveXFinal({type:'error',message:String(e.message||'application error').slice(0,120)});striveXActive=false;reset()}});
  window.addEventListener('gamepadconnected',snapshot);requestAnimationFrame(poll);render();publish();
})();
