#!/usr/bin/env node
/* Emberfall's Meshy tool. Every Meshy call goes through here so that:
   - the key never lives in the project (read from MESHY_API_KEY or ~/.config/emberfall/meshy.key),
   - every task is logged in assets/meshy-ledger.jsonl,
   - the limits in assets/meshy-budget.json are enforced before any credits are spent,
   - results are downloaded as soon as a task finishes (Meshy deletes them after a few days).

   node tools/meshy.js balance
   node tools/meshy.js budget
   node tools/meshy.js create <character> <endpoint> <params.json> [--dry]
   node tools/meshy.js wait <taskId>
   node tools/meshy.js get <taskId>
   A string parameter written as "file:path/to/image.png" is sent as that file's contents. */
const fs = require('fs'), path = require('path'), os = require('os');
const ROOT = path.join(__dirname, '..'), ASSETS = path.join(ROOT, 'assets');
const LEDGER = path.join(ASSETS, 'meshy-ledger.jsonl'), BUDGET = path.join(ASSETS, 'meshy-budget.json');
const API = 'https://api.meshy.ai';
const PATHS = { 'text-to-image': '/openapi/v1/text-to-image', 'image-to-image': '/openapi/v1/image-to-image', 'image-to-3d': '/openapi/v1/image-to-3d', 'multi-image-to-3d': '/openapi/v1/multi-image-to-3d', 'text-to-3d': '/openapi/v2/text-to-3d', remesh: '/openapi/v1/remesh', retexture: '/openapi/v1/retexture', rigging: '/openapi/v1/rigging', animations: '/openapi/v1/animations', 'text-to-motion': '/openapi/v1/text-to-motion' };
const MODEL_GEN = ['image-to-3d', 'multi-image-to-3d', 'text-to-3d'];

function die(msg) { console.error('meshy: ' + msg); process.exit(1); }
function key() {
  let k = process.env.MESHY_API_KEY;
  if (!k) { try { k = fs.readFileSync(path.join(os.homedir(), '.config', 'emberfall', 'meshy.key'), 'utf8').trim(); } catch (e) { /* none */ } }
  if (!k) die('no API key. Set MESHY_API_KEY or put the key in ~/.config/emberfall/meshy.key');
  return k;
}
async function call(method, p, body) {
  const res = await fetch(API + p, { method, headers: Object.assign({ Authorization: 'Bearer ' + key() }, body ? { 'Content-Type': 'application/json' } : {}), body: body ? JSON.stringify(body) : undefined });
  const text = await res.text(); let json = null; try { json = text ? JSON.parse(text) : null; } catch (e) { /* not json */ }
  if (!res.ok) die(method + ' ' + p + ' -> ' + res.status + ' ' + (json && json.message ? json.message : text.slice(0, 300)));
  return json;
}

/* Published API prices (docs.meshy.ai/en/api/pricing), used to check a task against the limits before sending it. */
function estimate(endpoint, p) {
  const lite = /lite|meshy-t2/.test(p.ai_model || ''), texRes = String(p.texture_resolution || '2k').toLowerCase();
  switch (endpoint) {
    case 'text-to-image': case 'image-to-image': {
      const m = p.ai_model || '', posePro = p.pose_mode && (m === 'nano-banana' || m === 'nano-banana-pro');
      const base = { 'nano-banana': 3, 'nano-banana-2': 6, 'nano-banana-2-lite': 3, 'nano-banana-2-1': 4, 'nano-banana-pro': 9 }[m];
      return posePro ? 9 : base !== undefined ? base : endpoint === 'image-to-image' ? 12 : 9;
    }
    case 'image-to-3d': case 'multi-image-to-3d': {
      const textured = p.should_texture !== false, mesh = lite ? 5 : 20, tex = !textured ? 0 : texRes === '8k' ? 15 : 10;
      return mesh + tex + (/2k|4k/i.test(String(p.geometry_resolution || '')) ? 5 : 0);
    }
    case 'text-to-3d': return p.mode === 'refine' ? (texRes === '8k' ? 15 : 10) : (lite ? 5 : 20);
    case 'retexture': return texRes === '8k' ? 15 : 10;
    case 'remesh': return 5;
    case 'rigging': return 5;
    case 'animations': return 3 * (p.action_ids ? p.action_ids.length : 1);
    case 'text-to-motion': return p.mode === 'swift' ? 3 : 10;
    default: return 40;
  }
}

function ledger() {
  if (!fs.existsSync(LEDGER)) return {};
  const tasks = {};
  for (const line of fs.readFileSync(LEDGER, 'utf8').split('\n')) { if (!line.trim()) continue; const r = JSON.parse(line); tasks[r.id] = Object.assign(tasks[r.id] || {}, r); }
  return tasks;
}
function log(rec) { fs.mkdirSync(ASSETS, { recursive: true }); fs.appendFileSync(LEDGER, JSON.stringify(rec) + '\n'); }
/* Failed and cancelled tasks are refunded by Meshy, so they count as zero. */
const costOf = t => /FAILED|CANCELED/.test(t.status || '') ? 0 : (typeof t.consumed === 'number' ? t.consumed : t.est);
function summary() {
  const b = JSON.parse(fs.readFileSync(BUDGET, 'utf8')), all = Object.values(ledger()), today = new Date().toISOString().slice(0, 10);
  const inPhase = all.filter(t => t.phase === b.phase);
  return { budget: b, tasks: all, spentPhase: inPhase.reduce((s, t) => s + costOf(t), 0), spentToday: all.filter(t => (t.time || '').slice(0, 10) === today).reduce((s, t) => s + costOf(t), 0), spentAll: all.reduce((s, t) => s + costOf(t), 0) };
}

function inlineFiles(v) {
  if (typeof v === 'string' && v.startsWith('file:')) {
    const f = path.resolve(ROOT, v.slice(5)), ext = path.extname(f).toLowerCase(), mime = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.glb': 'model/gltf-binary' }[ext];
    if (!mime) die('unsupported file type for upload: ' + f);
    return 'data:' + mime + ';base64,' + fs.readFileSync(f).toString('base64');
  }
  if (Array.isArray(v)) return v.map(inlineFiles);
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, inlineFiles(x)]));
  return v;
}

async function create(character, endpoint, file, dry) {
  if (!PATHS[endpoint]) die('unknown endpoint "' + endpoint + '". Known: ' + Object.keys(PATHS).join(', '));
  const params = JSON.parse(fs.readFileSync(path.resolve(file), 'utf8')), est = estimate(endpoint, params), s = summary(), b = s.budget;
  const attempts = s.tasks.filter(t => t.character === character && MODEL_GEN.includes(t.endpoint) && !(t.endpoint === 'text-to-3d' && t.params && t.params.mode === 'refine') && !/FAILED|CANCELED/.test(t.status || '')).length;
  const stop = [];
  if (est > b.perTaskMax) stop.push('this task costs about ' + est + ', over the per-task limit of ' + b.perTaskMax);
  if (s.spentPhase + est > b.ceiling) stop.push('phase "' + b.phase + '" would reach ' + (s.spentPhase + est) + ' of ' + b.ceiling);
  if (s.spentToday + est > b.perDayMax) stop.push('today would reach ' + (s.spentToday + est) + ' of ' + b.perDayMax);
  if (MODEL_GEN.includes(endpoint) && params.mode !== 'refine' && attempts >= b.maxModelAttemptsPerCharacter) stop.push(character + ' already has ' + attempts + ' model generations (limit ' + b.maxModelAttemptsPerCharacter + ')');
  if (!stop.length && !dry) { const bal = await call('GET', '/openapi/v1/balance'); if (bal.balance - est < b.keepBalanceAbove) stop.push('balance ' + bal.balance + ' would fall below the reserve of ' + b.keepBalanceAbove); }
  if (stop.length) die('REFUSED, limits in assets/meshy-budget.json:\n  - ' + stop.join('\n  - '));
  console.log('estimate ' + est + ' credits; phase ' + s.spentPhase + ' -> ' + (s.spentPhase + est) + ' of ' + b.ceiling);
  if (dry) return;
  const out = await call('POST', PATHS[endpoint], inlineFiles(params)), id = out.result;
  if (!id) die('no task id in response: ' + JSON.stringify(out).slice(0, 200));
  log({ id, time: new Date().toISOString(), phase: b.phase, character, endpoint, params, est, status: 'PENDING' });
  console.log('task ' + id);
}

const stripQuery = u => String(u).split('?')[0];
function urlsIn(o, pre, out) { for (const [k, v] of Object.entries(o || {})) { const n = pre ? pre + '.' + k : k; if (typeof v === 'string' && /^https?:\/\//.test(v)) out.push([n, v]); else if (v && typeof v === 'object') urlsIn(v, n, out); } return out; }
async function download(url, dest) { const r = await fetch(url); if (!r.ok) { console.error('  could not download ' + stripQuery(url) + ' (' + r.status + ')'); return 0; } const buf = Buffer.from(await r.arrayBuffer()); fs.mkdirSync(path.dirname(dest), { recursive: true }); fs.writeFileSync(dest, buf); return buf.length; }

async function wait(id, once) {
  const t = ledger()[id]; if (!t) die('task ' + id + ' is not in the ledger');
  const started = Date.now(); let task;
  for (;;) {
    task = await call('GET', PATHS[t.endpoint] + '/' + id);
    if (once || /SUCCEEDED|FAILED|CANCELED/.test(task.status)) break;
    if (Date.now() - started > 20 * 60 * 1000) die('still ' + task.status + ' after 20 minutes; run wait again later');
    process.stdout.write('  ' + task.status + ' ' + (task.progress || 0) + '%\n'); await new Promise(r => setTimeout(r, 6000));
  }
  console.log(task.status + (task.task_error && task.task_error.message ? ': ' + task.task_error.message : ''));
  if (!/SUCCEEDED|FAILED|CANCELED/.test(task.status)) return;
  const consumed = typeof task.consumed_credits === 'number' ? task.consumed_credits : undefined, files = [];
  if (task.status === 'SUCCEEDED') {
    const dir = path.join(ASSETS, t.character, 'raw', id);
    for (const [name, url] of urlsIn(task, '', [])) {
      const ext = path.extname(stripQuery(url)) || '', dest = path.join(dir, name.replace(/[^\w.-]+/g, '_') + (name.endsWith(ext) ? '' : ext)), size = await download(url, dest);
      if (size) { files.push(path.relative(ROOT, dest).replace(/\\/g, '/')); console.log('  saved ' + files[files.length - 1] + ' (' + Math.round(size / 1024) + ' KB)'); }
    }
  }
  /* The task record is kept without the signed download links. */
  const clean = JSON.parse(JSON.stringify(task, (k, v) => typeof v === 'string' && /^https?:\/\//.test(v) ? stripQuery(v) : v));
  const recDir = path.join(ASSETS, t.character, 'meshy'); fs.mkdirSync(recDir, { recursive: true });
  fs.writeFileSync(path.join(recDir, id + '.json'), JSON.stringify({ character: t.character, endpoint: t.endpoint, params: t.params, estimate: t.est, consumed, files, task: clean }, null, 2));
  log({ id, status: task.status, consumed, finished: new Date().toISOString(), files });
}

(async () => {
  const [cmd, a, b, c, d] = process.argv.slice(2);
  if (cmd === 'balance') { const r = await call('GET', '/openapi/v1/balance'); console.log(JSON.stringify({ balance: r.balance, monthly_credits: r.monthly_credits, permanent_credits: r.permanent_credits, monthly_resets: r.monthly_resets_at ? new Date(r.monthly_resets_at).toISOString().slice(0, 10) : null })); }
  else if (cmd === 'budget') { const s = summary(); console.log(JSON.stringify({ phase: s.budget.phase, spentPhase: s.spentPhase, ceiling: s.budget.ceiling, spentToday: s.spentToday, perDayMax: s.budget.perDayMax, perTaskMax: s.budget.perTaskMax, spentAllTime: s.spentAll, tasks: s.tasks.length })); }
  else if (cmd === 'animations') {   /* free: Meshy's preset animation list, saved for picking action ids */
    const r = await call('GET', '/openapi/v1/animations/library'), list = Array.isArray(r) ? r : (r.result || r.data || r.animations || r.items || []);
    fs.writeFileSync(path.join(ASSETS, 'animation-library.json'), JSON.stringify(r, null, 1));
    const cats = {}; for (const x of list) { const k = x.category || x.category_name || '?'; cats[k] = (cats[k] || 0) + 1; }
    console.log(list.length + ' actions saved to assets/animation-library.json'); console.log(JSON.stringify(cats)); if (list[0]) console.log('fields: ' + Object.keys(list[0]).join(', '));
  }
  else if (cmd === 'create' && a && b && c) await create(a, b, c, d === '--dry');
  else if (cmd === 'wait' && a) await wait(a, false);
  else if (cmd === 'get' && a) await wait(a, true);
  else die('usage: balance | budget | create <character> <endpoint> <params.json> [--dry] | wait <id> | get <id>');
})().catch(e => die(e.message));
