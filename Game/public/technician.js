(function(root){
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function binding(key){
    if(!key)return'Не назначена';
    try{const[id,ordinal,control]=JSON.parse(key);return`${id} · USB ${ordinal+1} · ${control.replace('button:','Кнопка ').replace('axis:','Ось ')}`}catch{return'Не назначена'}
  }
  class TechnicianView{
    constructor(api,role){
      this.api=api;this.role=role;this.element=document.createElement('div');this.element.className='technician-root';this.element.hidden=true;document.body.append(this.element);
      this.element.addEventListener('click',async e=>{
        const button=e.target.closest('[data-tech]');if(!button||button.disabled||role!=='control')return;
        const command={type:button.dataset.tech};if(button.dataset.slot!==undefined)command.slot=Number(button.dataset.slot);
        if(command.type==='port')command.port=this.element.querySelector('[data-port]').value;
        try{this.update(await api.technicianCommand(command))}catch(error){this.element.querySelector('[data-tech-error]').textContent=error.message}
      });
    }
    update(state){
      this.state=state;const{staff,blocked,settings,calibration:c}=state;
      this.element.hidden=!staff&&!blocked;
      if(this.element.hidden){this.key='';this.element.innerHTML='';return}
      if(!staff){this.key='';this.element.innerHTML='<section class="tech-blocked"><small>LIGHTNING</small><h1>Станция заблокирована</h1><p>Приложите браслет техника</p></section>';return}
      const key=JSON.stringify([staff,blocked,settings,c,state.error,state.led.connected,state.led.path,state.ports,state.devices]);
      if(key===this.key){this.element.querySelectorAll('[data-count]').forEach(el=>{el.textContent=state.counters[Number(el.dataset.count)]});return}
      this.key=key;
      const disabled=this.role==='control'?'':'disabled',status=state.led.connected?'Arduino подключена':'Arduino не подключена';
      const cards=player=>Array.from({length:16},(_,i)=>{
        const slot=player*16+i,done=c&&slot<c.buttons.length,current=c?.channel===slot;
        return`<button class="tech-slot ${current?'current':''} ${done?'mapped':''}" data-tech="test" data-slot="${slot}" ${c?'disabled':disabled} title="${esc(binding(settings.buttons?.[slot]))}"><b>LED ${slot+1} ${done?'✓':''}</b><span>Кнопка ${i+1}</span><small>${esc(binding(c?.buttons[slot]||settings.buttons?.[slot]))}</small><em>Нажатий: <strong data-count="${slot}">${state.counters[slot]}</strong></em></button>`;
      }).join('');
      this.element.innerHTML=`<section class="tech-screen"><header class="tech-header"><div><small>LIGHTNING / SERVICE</small><h1>Режим техника</h1><p>${esc(staff.name)}</p></div><button data-tech="close" ${disabled}>Закрыть настройки ×</button></header>
        <div class="tech-toolbar"><label>Подсветка · COM-порт<div class="tech-port"><input data-port list="tech-ports" value="${esc(settings.ledPort)}" aria-label="COM-порт Arduino" ${disabled}><datalist id="tech-ports"><option value="auto">Автоматически</option><option value="off">Отключена</option>${state.ports.map(p=>`<option value="${esc(p)}">`).join('')}</datalist><button data-tech="port" ${disabled}>Применить</button><button data-tech="ports" ${disabled}>Обновить</button></div></label><button data-tech="${blocked?'unblock':'block'}" ${disabled}>${blocked?'Снять блокировку':'Заблокировать станцию'}</button></div>
        <div class="tech-status"><span class="${state.led.connected?'connected':''}">● ${status} · ${esc(state.led.path||settings.ledPort)}</span><span>USB-контроллеров: ${state.devices.length}</span><span>${settings.buttons?'✓ 32 привязки сохранены':'Требуется калибровка'}</span></div>
        ${c?`<div class="tech-wizard" role="status"><div><b>Диод ${c.channel+1} / 32 · Игрок ${Math.floor(c.channel/16)+1}</b><p>${!c.armed?'Отпустите все кнопки и верните направления в нейтраль.':c.pending?'Отпустите нажатую кнопку или верните направление в нейтраль.':'Нажмите и отпустите кнопку у горящего диода. Можно использовать любой USB-контроллер.'}</p><progress value="${c.channel}" max="32"></progress></div><button data-tech="cancel" ${disabled}>Отменить</button></div>`:`<div class="tech-intro"><p>Одна лента: диоды 1–16 — игрок 1, 17–32 — игрок 2. Направления вверх, вниз, влево и вправо считаются кнопками. Нажмите карточку для проверки диода.</p><button data-tech="calibrate" ${disabled} ${state.led.connected?'':'disabled'}>Калибровать 32 кнопки</button></div>`}
        <div class="tech-players">${[0,1].map(p=>`<section class="tech-player player-${p}"><h2>Игрок ${p+1}<small>LED ${p*16+1}–${p*16+16}</small></h2><div class="tech-grid">${cards(p)}</div></section>`).join('')}</div>
        <footer><span>Привязки сохраняются после полного прохода 32 диодов. Отмена сохраняет прежнюю калибровку.</span><strong data-tech-error role="alert">${esc(state.error||state.led.error||'')}</strong></footer></section>`;
    }
  }
  root.LightningTechnician=TechnicianView;
})(window);
