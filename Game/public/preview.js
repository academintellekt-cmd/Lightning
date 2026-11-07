// Separate from #app so game updates preserve the panel's focus and scroll.
class LightningPreview{
  constructor(role,action,modes){
    this.root=document.createElement('aside');this.root.className='preview-tools';this.root.innerHTML='<div class="preview-badge">ПРОСМОТР · LIGHTNING</div>';document.body.append(this.root);
    if(role!=='control')return;
    const button=(id,label,extra='')=>`<button data-preview="${id}" ${extra}>${label}</button>`;
    this.root.insertAdjacentHTML('beforeend',`<button class="preview-toggle" aria-label="Открыть панель просмотра" hidden>🧪</button><section class="preview-panel"><header><b>Просмотр интерфейса</b><button data-collapse aria-label="Свернуть панель">−</button></header><small data-preview-status></small><small data-gamepad-status></small><div class="preview-grid">${button('bracelet:111','Браслет 111','data-demo-code="111"')}${button('bracelet:222','Браслет 222','data-demo-code="222"')}${button('technician','Техник 777','data-demo-code="777"')}${button('lobby','Лобби / сброс')}${button('rules','Правила')}${button('ready','Ожидание')}${button('countdown','Отсчёт')}${button('game','Игра')}${button('gameover','GAME OVER')}${button('results','Результаты')}${button('leaderboard','Лидеры')}</div><label>Игровой режим<select data-preview-mode>${Object.entries(modes).map(([id,text])=>`<option value="${id}">${text[0]}</option>`).join('')}</select></label>${button('run','Полный запуск раунда','class="preview-run"')}<div class="preview-hits">${[0,1].map(p=>`<div><b>Игрок ${p+1}</b><small>${p?'B N M , . /':'Q W E R T Y'} · клавиатура</small><div>${Array.from({length:16},(_,i)=>button(`position:${p}:${i+1}`,String(i+1))).join('')}</div></div>`).join('')}</div><small>111 / 222 / 777 + Enter — в любом окне.<br>USB: сохранённая калибровка 32 кнопок.<br>F12 — инструменты разработчика.</small></section>`);
    const panel=this.root.querySelector('.preview-panel'),toggle=this.root.querySelector('.preview-toggle');
    this.root.querySelector('[data-collapse]').onclick=()=>{panel.hidden=true;toggle.hidden=false};toggle.onclick=()=>{panel.hidden=false;toggle.hidden=true};
    this.root.addEventListener('click',e=>{const value=e.target.closest('[data-preview]')?.dataset.preview;if(value)action(value)});
    this.root.querySelector('select').onchange=e=>action(`mode:${e.target.value}`);
  }
  update(state){
    const label=this.root.querySelector('[data-preview-status]');if(label)label.textContent=`${innerWidth} × ${innerHeight} · ${state.phase}`;
    const select=this.root.querySelector('select');if(select)select.value=state.lobbySelection?.mode||state.mode;
  }
  devices(count,calibrated){const el=this.root.querySelector('[data-gamepad-status]'),text=`USB-контроллеров: ${count} · ${calibrated?'32 привязки сохранены':'требуется калибровка'}`;if(el&&el.textContent!==text)el.textContent=text}
}
