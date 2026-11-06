const fs=require('fs'),path=require('path'),{EventEmitter}=require('events');
const{validKey}=require('./gamepad-input');
class Technician extends EventEmitter{
  constructor({file,port='auto'}={}){
    super();this.file=file;this.settings={ledPort:port,buttons:null};this.staff=null;this.blocked=false;this.calibration=null;this.error='';this.ports=[];this.led={connected:false};this.counters=Array(32).fill(0);this.active=[];this.devices=[];this.initialized=false;
    if(file&&fs.existsSync(file))try{const saved=JSON.parse(fs.readFileSync(file,'utf8'));this.validate(saved);this.settings=saved}catch{this.error='Не удалось прочитать настройки. Выполните калибровку заново.'}
  }
  validate(s){
    if(!/^(off|auto|COM[1-9]\d*)$/i.test(s.ledPort))throw Error('Некорректный COM-порт');
    if(s.buttons!==null&&(!Array.isArray(s.buttons)||s.buttons.length!==32||new Set(s.buttons).size!==32||s.buttons.some(k=>!validKey(k))))throw Error('Некорректные привязки кнопок');
  }
  save(patch){
    const next={...this.settings,...patch};this.validate(next);
    if(this.file){fs.mkdirSync(path.dirname(this.file),{recursive:true});const tmp=this.file+'.tmp';fs.writeFileSync(tmp,JSON.stringify(next,null,2)+'\n');fs.renameSync(tmp,this.file)}
    this.settings=next;
  }
  snapshot(){return{staff:this.staff,blocked:this.blocked,settings:this.settings,calibration:this.calibration,error:this.error,ports:this.ports,led:this.led,counters:[...this.counters],devices:this.devices}}
  publish(){this.emit('change',this.snapshot())}
  cancel(){this.calibration=null;this.emit('calibrate',-1)}
  gateway({staff=null,blocked=false,error=''}){
    const wasActive=!!this.staff,wasBlocked=this.blocked,entered=!this.staff&&staff?.role==='technician';this.staff=staff?.role==='technician'?staff:null;this.blocked=!!blocked;this.error=error;
    if(!this.staff&&(wasActive||this.calibration||wasBlocked!==this.blocked))this.cancel();
    if(entered){this.counters.fill(0);this.emit('enter');this.emit('calibrate',-1)}
    this.publish();
  }
  ledStatus(status){
    this.led=status;
    if(!status.connected&&this.calibration){this.cancel();this.error='Arduino отключена. Калибровка отменена; прежние привязки сохранены.'}
    this.publish();
  }
  input(frame){
    if(!frame||!Array.isArray(frame.active)||!Array.isArray(frame.devices)||frame.active.length>256||frame.devices.length>16||frame.active.some(k=>!validKey(k)))return;
    const active=[...new Set(frame.active)],previous=this.active,devices=frame.devices;
    const disconnected=this.devices.some(d=>!devices.includes(d));
    this.active=active;this.devices=devices;
    if(!this.initialized){this.initialized=true;if(this.calibration&&!active.length)this.calibration.armed=true;this.publish();return}
    const pressed=active.filter(k=>!previous.includes(k));
    if(this.calibration){
      const c=this.calibration;
      if(disconnected){this.cancel();this.error='USB-контроллер отключён. Калибровка отменена; прежние привязки сохранены.'}
      else if(!c.armed){if(!active.length){c.armed=true;c.pending=null}}
      else if(active.length>1){c.armed=false;c.pending=null;this.error='Нажмите только одну кнопку или одно направление. Отпустите всё и повторите.'}
      else if(pressed.length){
        if(c.buttons.includes(pressed[0])){c.armed=false;c.pending=null;this.error='Эта кнопка уже назначена. Отпустите её и нажмите другую.'}
        else{c.pending=pressed[0];this.error=''}
      }else if(c.pending&&!active.length){
        const buttons=[...c.buttons,c.pending];
        if(buttons.length===32){this.save({buttons});this.calibration=null;this.emit('calibrate',-1)}
        else{this.calibration={channel:buttons.length,buttons,armed:true,pending:null};this.emit('calibrate',buttons.length)}
      }
      this.publish();return;
    }
    for(const key of pressed){
      const slot=this.settings.buttons?.indexOf(key)??-1;if(slot<0)continue;
      if(this.staff){this.counters[slot]++;this.emit('pulse',slot)}
      else if(!this.blocked)this.emit('hit',Math.floor(slot/16),slot%16+1);
    }
    if(this.staff||disconnected||devices.length!==this.lastDeviceCount)this.publish();this.lastDeviceCount=devices.length;
  }
  command(x){
    if(!this.staff)throw Error('Требуется браслет техника');this.error='';
    if(x.type==='calibrate'){
      if(!this.led.connected)throw Error('Сначала подключите Arduino и выберите COM-порт');
      this.calibration={channel:0,buttons:[],armed:this.initialized&&!this.active.length,pending:null};this.emit('calibrate',0);
    }else if(x.type==='cancel')this.cancel();
    else if(x.type==='port'){this.save({ledPort:String(x.port).trim().toUpperCase().replace(/^OFF$/,'off').replace(/^AUTO$/,'auto')});this.cancel();this.emit('port',this.settings.ledPort)}
    else if(x.type==='ports')this.emit('ports');
    else if(x.type==='test'){
      if(this.calibration)throw Error('Сначала завершите калибровку');
      if(!Number.isInteger(x.slot)||x.slot<0||x.slot>=32)throw Error('Некорректный диод');this.emit('pulse',x.slot);
    }else if(['close','block','unblock'].includes(x.type))this.emit('gateway-command',x.type);
    else throw Error('Неизвестная команда');
    this.publish();return this.snapshot();
  }
}
module.exports={Technician};
