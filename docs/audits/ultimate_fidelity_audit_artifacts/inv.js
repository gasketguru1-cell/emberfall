const fs=require('fs'),path=require('path'),vm=require('vm');const root=process.argv[2];
const ctx=new Proxy({},{get:(t,k)=>k in t?t[k]:()=>({addColorStop(){}}),set:(t,k,v)=>{t[k]=v;return true}});
global.document={getElementById:()=>({getContext:()=>ctx})};global.window=global;global.addEventListener=()=>{};global.requestAnimationFrame=()=>{};
Object.defineProperty(global,'navigator',{value:{getGamepads:()=>[]},configurable:true});
for(const f of ['hitboxes.js','sim.js'])vm.runInThisContext(fs.readFileSync(path.join(root,f),'utf8'),{filename:f});
vm.runInThisContext(`for(const def of ROSTER){for(const fm of def.forms){const mv=fm.moves;const ks=Object.keys(mv).filter(k=>mv[k]&&(Array.isArray(mv[k].h)||k==='throws'));const noHit=ks.filter(k=>k!=='throws'&&mv[k].h.length===0);console.log(def.name+' / '+fm.name+' | w '+fm.st.weight+' | '+ks.length+' moves | '+ks.join(',')+(noHit.length?' | no hitbox: '+noHit.join(','):''))}}`);
