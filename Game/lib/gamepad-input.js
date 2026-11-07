(function(root){
  // Persist the device ID and its occurrence among identical devices, never its
  // transient Gamepad.index. Identical controllers must keep their USB order.
  function readGamepads(pads,config={}){
    const active=[],devices=[],counts=new Map(),q=config.axisThreshold||.55;
    for(const pad of [...pads].filter(Boolean).sort((a,b)=>a.index-b.index)){
      const id=String(pad.id),ordinal=counts.get(id)||0;counts.set(id,ordinal+1);
      const device=JSON.stringify([id,ordinal]);devices.push(device);
      const add=control=>active.push(JSON.stringify([id,ordinal,control]));
      // Many USB encoders report the stick both as D-pad buttons and axes.
      // Prefer its digital representation to avoid capturing one move twice.
      const directions=pad.mapping==='standard'?{up:12,down:13,left:14,right:15}:{up:config.upButton??12,down:config.downButton??15,left:config.leftButton??13,right:config.rightButton??14};
      const x=config.horizontalAxis??0,y=config.verticalAxis??1;
      const hasDigital=Object.values(directions).some(i=>pad.buttons[i]?.pressed);
      pad.buttons.forEach((b,i)=>{if(b.pressed||b.value>.5)add(`button:${i}`)});
      if(!hasDigital){
        if(pad.axes[x]<=-q)add(`axis:${x}:-`);else if(pad.axes[x]>=q)add(`axis:${x}:+`);
        if(pad.axes[y]<=-q)add(`axis:${y}:-`);else if(pad.axes[y]>=q)add(`axis:${y}:+`);
      }
    }
    return{active:active.sort(),devices:devices.sort()};
  }
  function validKey(key){
    try{const x=JSON.parse(key);return Array.isArray(x)&&x.length===3&&typeof x[0]==='string'&&x[0].length<=512&&Number.isInteger(x[1])&&x[1]>=0&&x[1]<16&&typeof x[2]==='string'&&/^(button:\d{1,3}|axis:\d{1,2}:[+-])$/.test(x[2])}catch{return false}
  }
  const api={readGamepads,validKey};
  if(typeof module!=='undefined')module.exports=api;else root.LightningInput=api;
})(typeof window!=='undefined'?window:globalThis);
