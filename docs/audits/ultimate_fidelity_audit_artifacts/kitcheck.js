const fs=require('fs'),path=require('path'),vm=require('vm');const root=process.argv[2],doc=fs.readFileSync(process.argv[3],'utf8');
const ctx=new Proxy({},{get:(t,k)=>k in t?t[k]:()=>({addColorStop(){}}),set:(t,k,v)=>{t[k]=v;return true}});
global.document={getElementById:()=>({getContext:()=>ctx})};global.window=global;global.addEventListener=()=>{};global.requestAnimationFrame=()=>{};
Object.defineProperty(global,'navigator',{value:{getGamepads:()=>[]},configurable:true});
for(const f of ['hitboxes.js','sim.js'])vm.runInThisContext(fs.readFileSync(path.join(root,f),'utf8'),{filename:f});
const KIT=vm.runInThisContext('KIT');
const map={'Jab':'jab','Dash attack':'dash','Forward tilt':'ftilt','Up tilt':'utilt','Down tilt':'dtilt','Forward smash':'fsmash','Up smash':'usmash','Down smash':'dsmash','Neutral air':'nair','Forward air':'fair','Back air':'bair','Up air':'uair','Down air':'dair'};
let cur=null,ok=0,bad=[],n=0;
for(const line of doc.split('\n')){const h=line.match(/^## (\w+)/);if(h){cur=KIT[h[1]]?h[1]:null;continue}
 if(!cur)continue;const m=line.match(/^\| ([A-Za-z ]+?) \| \*\*.*?\*\* \| f(\d+) \/ ([\d.]+)%/);if(!m||!map[m[1]])continue;
 const k=map[m[1]],q=KIT[cur][k];n++;if(q&&q[0]==+m[2]&&q[1]==+m[3])ok++;else bad.push(`${cur} ${k}: doc f${m[2]}/${m[3]}% kit ${JSON.stringify(q)}`);}
console.log(`${ok}/${n} normals match (first active frame + first damage)`);bad.forEach(b=>console.log(' MISMATCH',b));
