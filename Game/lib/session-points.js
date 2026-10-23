// Per-player result for the Gateway's session_result: meta.points=[{ic,points}], where ic is the
// bracelet uid from unlock. Without it the Gateway gives both players the session's best value.
// Loaded as a plain <script> (global SessionPoints) and required by tests.
(function(root){
  function bestPoints(uids,rounds){return uids.map((ic,p)=>ic?{ic:String(ic),points:rounds.reduce((best,r)=>Math.max(best,Number(r?.scores?.[p])||0),0)}:null).filter(Boolean)}
  const api={bestPoints};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.SessionPoints=api;
})(typeof window!=='undefined'?window:globalThis);
