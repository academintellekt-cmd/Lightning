const{SerialPort}=require('serialport');
const{ReadlineParser}=require('@serialport/parser-readline');

class SerialBridge{
  constructor(config={},onStatus=()=>{}){
    this.config=config;this.onStatus=onStatus;this.queue=[];this.sending=false;this.generation=0;this.stopped=false;
  }
  async start(){this.stopped=false;if(!this.config.enabled){this.onStatus({connected:false,path:'off'});return}await this.connect()}
  async find(){
    if(this.config.port&&this.config.port!=='auto')return this.config.port;
    const ports=await SerialPort.list(),match=ports.find(v=>/arduino|ch340|usb.serial|cp210/i.test(`${v.manufacturer||''} ${v.friendlyName||''}`));
    return(match||ports[0])?.path;
  }
  async connect(){
    if(this.stopped||this.connecting||this.port?.isOpen)return;this.connecting=true;
    try{
      const path=await this.find();if(!path)throw Error('COM not found');
      if(this.stopped)return;
      const port=this.port=new SerialPort({path,baudRate:this.config.baudRate||115200,autoOpen:false});
      port.on('close',()=>{if(!this.stopped){this.onStatus({connected:false,path});this.retry()}});port.on('error',error=>{if(!this.stopped){this.onStatus({connected:false,path,error:error.message});if(port.isOpen)port.close();this.retry()}});
      port.pipe(new ReadlineParser({delimiter:'\n'})).on('data',message=>{if(!this.stopped)this.onStatus({connected:true,path,message:message.trim()})});
      await new Promise((resolve,reject)=>port.open(error=>error?reject(error):resolve()));
      if(this.stopped){port.close();return}
      this.queue.length=0;this.generation++;
      this.onStatus({connected:true,path});this.send('HELLO');
    }catch(error){if(!this.stopped){this.onStatus({connected:false,error:error.message});this.retry()}}finally{this.connecting=false}
  }
  retry(){if(this.stopped||this.timer)return;this.timer=setTimeout(()=>{this.timer=null;this.connect()},3000)}
  send(command){
    const value=String(command).trim();if(!value||this.stopped||!this.config.enabled)return;
    if(/^(?:CAL |CLEAR$|MODE (?:IDLE|READY|GAMEOVER|GAME\b))/.test(value)){this.queue.length=0;this.generation++}
    if(this.queue.length>=256)this.queue.shift();
    this.queue.push({value,generation:this.generation});this.flush();
  }
  flush(){
    if(this.sending||!this.port?.isOpen||!this.queue.length)return;
    const item=this.queue.shift();
    if(item.generation!==this.generation){this.flush();return}
    this.sending=true;
    this.port.write(`${item.value}\n`,()=>{
      this.port.drain(()=>setTimeout(()=>{this.sending=false;this.flush()},this.config.commandIntervalMs||12));
    });
  }
  async stop(){this.stopped=true;clearTimeout(this.timer);this.timer=null;this.queue.length=0;this.generation++;if(this.port?.isOpen)await new Promise(resolve=>this.port.close(()=>resolve()))}
}
module.exports={SerialBridge};
