// Builds the Chomp Chomp Discovery Album (playtest-results/chomp/index.html) from an album description (sections, and per clip:
// file, title, rank, DI, route, facts) and the clips and stills already in playtest-results/chomp/<section>/. A testing tool only.
//   node tools/chomp-album.js album.json
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..', 'playtest-results', 'chomp');
const A = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const stills = c => { const d = path.join(root, c.sec, 'stills'); return fs.existsSync(d) ? fs.readdirSync(d).filter(f => f.startsWith(c.file + '-') && f.endsWith('.png')).sort().map(f => c.sec + '/stills/' + f) : []; };
const have = c => fs.existsSync(path.join(root, c.sec, c.file + '.webm'));
const missing = A.clips.filter(c => !have(c)).map(c => c.sec + '/' + c.file);
const clips = A.clips.filter(have);
const card = (c, big) => {
  const st = stills(c), poster = st[1] || st[0] || '';
  return `<article class="card${big ? ' big' : ''}" data-src="${esc(c.sec + '/' + c.file + '.webm')}" tabindex="0">
  <div class="thumb">${poster ? `<img src="${esc(poster)}" alt="" loading="lazy">` : ''}<span class="play" aria-hidden="true"></span>${c.rank ? `<span class="rank">#${c.rank}</span>` : ''}</div>
  <div class="body"><h3>${esc(c.title)}</h3>${c.di ? `<span class="chip">${esc(c.di)}</span>` : ''}
  ${c.route ? `<code class="route">${esc(c.route)}</code>` : ''}
  <ul>${c.facts.map(f => `<li>${esc(f)}</li>`).join('')}</ul>
  ${st.length ? `<div class="strip">${st.map(s => `<img src="${esc(s)}" alt="" loading="lazy">`).join('')}</div>` : ''}</div></article>`;
};
const top = clips.filter(c => c.rank).sort((a, b) => a.rank - b.rank);
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Chomp Chomp Discovery Album</title>
<style>
:root{--bg:#f6f3ee;--panel:#fff;--ink:#1d1a16;--mute:#6b645a;--line:#e3ddd3;--accent:#c4501b;--accent2:#8a5a00;--code:#f1ece4}
@media (prefers-color-scheme:dark){:root{--bg:#141210;--panel:#1d1a17;--ink:#f1ece4;--mute:#a59d92;--line:#302b26;--accent:#ff8a4c;--accent2:#ffd166;--code:#26221e}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif}
header{padding:40px 20px 24px;max-width:1240px;margin:auto}h1{font-size:34px;margin:0 0 6px;letter-spacing:-.01em}header p{color:var(--mute);margin:4px 0;max-width:820px}
nav{position:sticky;top:0;z-index:5;background:var(--bg);border-bottom:1px solid var(--line)}nav div{max-width:1240px;margin:auto;padding:10px 20px;display:flex;gap:16px;overflow-x:auto;white-space:nowrap}
nav a{color:var(--mute);text-decoration:none;font-size:14px}nav a:hover{color:var(--accent)}
section{max-width:1240px;margin:auto;padding:28px 20px 8px}h2{font-size:22px;margin:0 0 4px}.blurb{color:var(--mute);margin:0 0 16px;max-width:820px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:16px}
.card{background:var(--panel);border:1px solid var(--line);border-radius:10px;overflow:hidden;cursor:pointer;display:flex;flex-direction:column;outline:none}
.card:hover,.card:focus{border-color:var(--accent)}
.thumb{position:relative;aspect-ratio:16/9;background:#000}.thumb img{width:100%;height:100%;object-fit:cover;display:block}
.play{position:absolute;inset:0;margin:auto;width:54px;height:54px;border-radius:50%;background:rgba(0,0,0,.55)}.play:after{content:"";position:absolute;left:21px;top:16px;border-left:18px solid #fff;border-top:11px solid transparent;border-bottom:11px solid transparent}
.rank{position:absolute;left:10px;top:10px;background:var(--accent);color:#fff;font-weight:700;font-size:13px;padding:2px 8px;border-radius:6px}
.body{padding:12px 14px 14px}.body h3{margin:0 0 6px;font-size:16px}
.chip{display:inline-block;font-size:12px;color:var(--accent2);border:1px solid var(--line);border-radius:999px;padding:0 8px;margin-bottom:6px}
.route{display:block;background:var(--code);border-radius:6px;padding:6px 8px;font:12px/1.45 ui-monospace,Consolas,monospace;word-break:break-word;margin:4px 0 8px}
ul{margin:0;padding-left:18px}li{margin:2px 0;font-size:14px}
.strip{display:grid;grid-template-columns:repeat(4,1fr);gap:4px;margin-top:10px}.strip img{width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:4px;display:block}
.modal{position:fixed;inset:0;background:rgba(0,0,0,.85);display:none;align-items:center;justify-content:center;z-index:20;padding:16px}.modal.on{display:flex}
.modal video{max-width:min(1280px,100%);max-height:90vh;width:100%;background:#000;border-radius:8px}
.close{position:absolute;right:18px;top:12px;color:#fff;font-size:30px;background:none;border:0;cursor:pointer}
footer{max-width:1240px;margin:auto;padding:24px 20px 48px;color:var(--mute);font-size:13px}
@media (max-width:420px){.grid{grid-template-columns:1fr}h1{font-size:27px}}
</style></head><body>
<header><h1>Chomp Chomp Discovery Album</h1>
<p>${esc(A.intro || '')}</p><p>${esc(A.note || '')}</p></header>
<nav><div><a href="#top">Top discoveries</a>${A.sections.filter(s => clips.some(c => c.sec === s.id)).map(s => `<a href="#${esc(s.id)}">${esc(s.title)}</a>`).join('')}<a href="README.md">Full report</a></div></nav>
<section id="top"><h2>Top discoveries, ranked</h2><p class="blurb">Ranked by how much each changes how Chomp is played, weighted toward what holds up under DI and human timing.</p>
<div class="grid">${top.map(c => card(c, true)).join('')}</div></section>
${A.sections.filter(s => clips.some(c => c.sec === s.id)).map(s => `<section id="${esc(s.id)}"><h2>${esc(s.title)}</h2><p class="blurb">${esc(s.blurb)}</p><div class="grid">${clips.filter(c => c.sec === s.id).map(c => card(c)).join('')}</div></section>`).join('\n')}
<footer>${esc(A.footer || '')}</footer>
<div class="modal" id="m"><button class="close" aria-label="Close">&times;</button><video id="v" controls playsinline></video></div>
<script>
const m=document.getElementById('m'),v=document.getElementById('v');
const open=s=>{v.src=s;m.classList.add('on');v.play().catch(()=>{});},shut=()=>{v.pause();v.removeAttribute('src');v.load();m.classList.remove('on');};
document.querySelectorAll('.card').forEach(c=>{c.addEventListener('click',()=>open(c.dataset.src));c.addEventListener('keydown',e=>{if(e.key==='Enter')open(c.dataset.src);});});
m.addEventListener('click',e=>{if(e.target===m||e.target.classList.contains('close'))shut();});document.addEventListener('keydown',e=>{if(e.key==='Escape')shut();});
</script></body></html>`;
fs.writeFileSync(path.join(root, 'index.html'), html);
console.log('wrote index.html: ' + clips.length + ' clips, ' + top.length + ' ranked' + (missing.length ? '; not recorded yet: ' + missing.join(', ') : ''));
