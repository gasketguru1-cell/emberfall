'use strict';
/* ---------- Sound and music ----------
   Everything the game plays goes through here. The game asks for a sound by its event name (sfx('parry') in sim.js); this
   file knows which recordings that name means, how loud, how much the pitch may wander, and what to do when there are too
   many sounds at once. Recordings live in assets/audio (all CC0: see assets/audio/CREDITS.md).

   Three volume groups, each with its own slider and mute on the Sound screen: music, sound effects, menu sounds.
   An event with no recording (or one whose file failed to load) plays a short made-in-code stand-in instead of silence,
   and is listed once in the console and in SND.missing, so nothing goes quietly unheard. */
const SND = (function () {
  const BASE = (typeof window !== 'undefined' && window.SND_BASE) || 'assets/audio/';
  const n = (name, count, ext) => Array.from({ length: count }, (_, i) => 'sfx/' + name + '_' + (i + 1) + '.' + (ext || 'ogg'));

  /* The sound-event map.
     f: recordings (one is picked at random, never the same twice running); all: play every one together (layers)
     v: loudness 0..1     pv: how far the pitch may wander either way     p: pitch (1 = as recorded)
     pr: priority when voices run out (higher wins)     cut: longest it may ring, in seconds     gap: least time between two plays
     bus: 'ui' for menu sounds (everything else is a sound effect)     duck: dips the music for a moment
     syn: made in code. [freq, seconds, wave, loudness, slide] or ['whoosh', seconds, from Hz, to Hz, loudness] or a list of [delay, freq, ...] notes */
  const EV = {
    /* --- combat, every fighter --- */
    jab_hit_light: { f: n('hit_light', 5), v: 0.5, pv: 0.08, pr: 2 },
    tilt_hit_mid: { f: n('hit_mid', 5), v: 0.7, pv: 0.06, pr: 3 },
    smash_hit_heavy: { f: n('hit_heavy', 5), v: 0.95, pv: 0.05, pr: 4, thump: 1 },
    ko_hit: { f: n('ko_low', 1), v: 0.75, pr: 6, cut: 0.7, duck: 1 },   /* under the hit that is going to KO */
    armor_clang: { f: n('armor', 3), v: 0.6, pv: 0.05, pr: 3 },
    clank: { f: n('clank', 3), v: 0.65, pv: 0.05, pr: 3, cut: 0.5 },
    whiff_whoosh: { syn: ['whoosh', 0.14, 900, 2600, 0.1], pv: 0.15, pr: 0, gap: 0.05 },
    shield_hit: { f: n('shield_hit', 3), v: 0.55, pv: 0.06, pr: 3 },
    shield_break: { f: ['sfx/shield_break_1.wav', 'sfx/glass_heavy_1.ogg'], all: 1, v: 0.95, pr: 6, duck: 1 },
    parry: { f: n('parry', 1), v: 0.8, p: 1.6, cut: 0.35, pr: 6 },
    brace: { f: n('armor', 1), v: 0.7, p: 0.8, pr: 4 },
    grab: { f: n('grab', 2), v: 0.7, pv: 0.05, pr: 3 },
    pummel: { f: n('soft', 5), v: 0.5, pv: 0.08, pr: 2 },
    throw: { syn: ['whoosh', 0.22, 500, 1800, 0.16], pr: 2 },
    spike: { f: ['sfx/hit_heavy_1.ogg', 'sfx/ko_low_1.ogg'], all: 1, v: 0.85, cut: 0.5, pr: 5 },
    blastzone_ko: { f: ['sfx/ko_boom_1.ogg', 'sfx/ko_low_1.ogg'], all: 1, v: 0.9, pr: 7, duck: 1 },
    tech: { f: n('tech', 1), v: 0.6, p: 1.3, pr: 3 },
    tech_miss: { f: n('thud', 4), v: 0.6, pv: 0.06, pr: 2 },
    ledge_grab: { f: n('ledge', 2), v: 0.45, pv: 0.06, pr: 2 },
    projectile_cancel: { f: n('soft', 2), v: 0.4, p: 1.5, pr: 1 },
    footstool: { f: n('soft', 5), v: 0.6, p: 1.4, pr: 2 },
    /* --- movement --- */
    footstep: { f: n('step', 5), v: 0.22, pv: 0.1, pr: 0, gap: 0.08 },
    dash_start: { f: n('dash', 3), v: 0.35, pv: 0.08, pr: 1 },
    jump_full: { f: n('cloth', 4), v: 0.4, pv: 0.08, pr: 1 },
    jump_short: { f: n('cloth', 4), v: 0.3, p: 1.25, pv: 0.08, pr: 1 },
    double_jump: { f: n('cloth', 4), v: 0.35, p: 1.5, pv: 0.06, pr: 1, also: [500, 0.05, 'sine', 0.02, 1.4] },
    fastfall: { syn: [1700, 0.035, 'sine', 0.012, 1.4], pr: 0 },
    land_soft: { f: n('soft', 5), v: 0.3, pv: 0.1, pr: 1 },
    land_hard: { f: n('thud', 4), v: 0.45, pv: 0.08, pr: 1 },
    wavedash: { f: n('slide', 2), v: 0.45, pv: 0.08, pr: 1 },
    air_dodge: { syn: ['whoosh', 0.16, 1400, 600, 0.09], pr: 1 },
    roll: { f: n('cloth', 4), v: 0.4, p: 0.8, pv: 0.06, pr: 1 },
    wall_bonk: { f: n('soft', 5), v: 0.5, p: 1.2, pv: 0.06, pr: 1 },
    /* --- menus and the match --- */
    menu_move: { f: n('ui_move', 1), v: 0.5, pv: 0.03, bus: 'ui', gap: 0.02 },
    confirm: { f: n('ui_confirm', 1), v: 0.6, bus: 'ui' },
    cancel: { f: n('ui_cancel', 1), v: 0.6, bus: 'ui' },
    fighter_select: { f: n('ui_select', 1), v: 0.7, bus: 'ui' },
    ready: { f: n('ui_ready', 1), v: 0.7, bus: 'ui' },
    toggle: { f: n('ui_switch', 1), v: 0.55, bus: 'ui' },
    error: { f: n('ui_error', 1), v: 0.55, bus: 'ui' },
    pause: { f: n('ui_pause', 1), v: 0.6, bus: 'ui' },
    resume: { f: n('ui_resume', 1), v: 0.6, bus: 'ui' },
    count_3_2_1: { syn: [440, 0.1, 'square', 0.05], bus: 'ui' },
    go: { syn: [880, 0.3, 'square', 0.06], bus: 'ui' },
    stock_lost: { syn: [[0, 330, 0.12, 'triangle', 0.05, 0.7], [0.12, 220, 0.2, 'triangle', 0.05, 0.6]], bus: 'ui' },
    sudden_death: { syn: [200, 0.6, 'sawtooth', 0.08, 2], bus: 'ui' },
    victory: { syn: [[0, 523, 0.14, 'triangle', 0.07], [0.13, 659, 0.14, 'triangle', 0.07], [0.26, 784, 0.14, 'triangle', 0.07], [0.39, 1047, 0.5, 'triangle', 0.08]], bus: 'ui' },
    /* --- fighters --- */
    fire_shot: { f: n('fire', 2, 'wav'), v: 0.4, p: 1.3, pv: 0.06, cut: 0.4, pr: 2 },
    fire_burst: { f: n('fire', 2, 'wav'), v: 0.7, p: 0.8, cut: 0.7, pr: 4, thump: 1 },
    bolt_shot: { f: n('bolt', 3), v: 0.35, pv: 0.06, cut: 0.3, pr: 2 },
    wind_gust: { f: n('wind', 1, 'wav'), v: 0.5, cut: 0.8, pr: 2 },
    rock_throw: { f: n('rock', 2, 'wav'), v: 0.5, pv: 0.06, cut: 0.5, pr: 2 },
    blast: { f: n('blast', 3), v: 0.75, pv: 0.06, cut: 0.6, pr: 4, thump: 1 },
    tape_roll: { f: n('metal_click', 1), v: 0.6, pv: 0.05, pr: 2 },
    form_swap: { f: n('latch', 1), v: 0.55, p: 1.2, pr: 2, also: [660, 0.12, 'triangle', 0.03, 1.6] },
    bird_launch: { syn: ['whoosh', 0.25, 400, 2400, 0.2], pr: 3 },
    bird_reload: { f: n('latch', 1), v: 0.5, pr: 2 },
    /* Joey: the owner's own voice note over the transformation. badmic: played through a terrible microphone, and on purpose a little louder than is comfortable. */
    joey_transform_voice: { f: ['voice/joey_transform.m4a'], badmic: 1, v: 0.8, gap: 1 }   /* measured: about twice as loud as the hardest hit, just short of clipping the speakers */,
    transformation_start: { syn: ['whoosh', 0.7, 300, 1800, 0.12], pr: 3, also: [110, 0.7, 'sawtooth', 0.04, 2.2] },
    transformation_complete: { f: ['sfx/thud_1.ogg', 'sfx/ko_low_1.ogg'], all: 1, v: 0.7, cut: 0.6, pr: 5, thump: 1 }
  };
  const TRACKS = {
    menu: { f: 'music/menu_dojo.ogg', v: 0.55, name: 'Menu (dojo)' },
    boss: { f: 'music/boss_battle.wav', v: 0.42, name: 'Boss Battle' },
    heartfelt: { f: 'music/heartfelt_battle.ogg', v: 0.5, name: 'Heartfelt Battle' },
    fight: { f: 'music/fast_fight.wav', v: 0.42, name: 'Fast Fight' },
    forest: { f: 'music/forest_ambience.mp3', v: 0.1, name: 'Forest ambience' }
  };
  const BATTLE = ['boss', 'heartfelt', 'fight'];
  const MAX_VOICES = 16;

  /* ---- settings (remembered) ---- */
  const S = { music: 0.6, sfx: 0.8, ui: 0.7, mute: { music: false, sfx: false, ui: false }, track: 'shuffle' };
  try { const o = JSON.parse(localStorage.getItem('emberfall.audio') || 'null'); if (o) { for (const k of ['music', 'sfx', 'ui']) { if (typeof o[k] === 'number') S[k] = Math.min(1, Math.max(0, o[k])); if (o.mute) S.mute[k] = !!o.mute[k]; } if (o.track === 'shuffle' || BATTLE.includes(o.track)) S.track = o.track; } } catch (e) { /* no storage */ }
  function save() { try { localStorage.setItem('emberfall.audio', JSON.stringify(S)); } catch (e) { /* no storage */ } }

  /* ---- the mixer ---- */
  let ctx = null, bus = null, noise = null, dead = false; const meters = {};
  const buffers = new Map(), missing = {}, voices = [], lastAt = {}, lastPick = {};
  let seed = 987654321; const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;   /* its own dice: the game's random numbers are never touched */
  function level(k) { return S.mute[k] ? 0 : S[k] * S[k]; }   /* squared: a slider at half sounds about half as loud */
  function boot() {
    if (ctx || dead) return ctx;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      const g = v => { const x = ctx.createGain(); x.gain.value = v; return x; };
      const lim = ctx.createDynamicsCompressor(); lim.threshold.value = -10; lim.knee.value = 6; lim.ratio.value = 8; lim.attack.value = 0.002; lim.release.value = 0.12;   /* many hits at once never get louder than a controlled mix */
      bus = { master: g(1), music: g(level('music')), duck: g(1), sfx: g(level('sfx')), ui: g(level('ui')), lim };
      bus.duck.connect(bus.music); bus.music.connect(bus.master); lim.connect(bus.sfx); bus.sfx.connect(bus.master); bus.ui.connect(bus.master); bus.master.connect(ctx.destination);
      for (const k of ['master', 'music', 'lim', 'ui']) { const m = ctx.createAnalyser(); m.fftSize = 2048; bus[k].connect(m); meters[k] = m; }   /* for checking levels (SND.level) */
      noise = ctx.createBuffer(1, ctx.sampleRate * 0.5 | 0, ctx.sampleRate); const d = noise.getChannelData(0); for (let k = 0; k < d.length; k++) d[k] = rnd() * 2 - 1;
      for (const id in EV) for (const f of EV[id].f || []) load(f);   /* short sounds are fetched up front, so the first hit is never late */
    } catch (e) { dead = true; ctx = null; }
    return ctx;
  }
  function wake() { if (boot() && ctx.state === 'suspended') ctx.resume().catch(() => {}); }
  function load(path) {
    if (!buffers.has(path)) buffers.set(path, fetch(BASE + path).then(r => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); }).then(a => ctx.decodeAudioData(a)).then(b => { buffers.set(path, b); return b; }).catch(() => { buffers.set(path, null); miss('file ' + path); return null; }));
    return Promise.resolve(buffers.get(path));
  }
  function miss(what) { if (!missing[what]) { missing[what] = true; console.warn('[sound] no recording for ' + what + ': playing a stand-in'); } }
  function out(e) { return e && e.bus === 'ui' ? bus.ui : bus.lim; }
  function panned(node, x, dest) {   /* left and right follow the fighter, but never all the way to one ear */
    if (!x || !ctx.createStereoPanner) { node.connect(dest); return; }
    const p = ctx.createStereoPanner(); p.pan.value = Math.max(-0.45, Math.min(0.45, x / 220)); node.connect(p); p.connect(dest);
  }

  /* ---- sounds made in code ---- */
  function tone(freq, dur, type, vol, slide, dest, x, at) {
    if (!boot()) return; const o = ctx.createOscillator(), a = ctx.createGain(), t = Math.max(ctx.currentTime, at || 0);
    o.type = type || 'square'; o.frequency.setValueAtTime(freq, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), t + dur);
    a.gain.setValueAtTime(vol || 0.05, t); a.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(a); panned(a, x, dest || bus.lim); o.start(t); o.stop(t + dur);
  }
  function whoosh(dur, f0, f1, vol, pitch, dest, x, at) {
    const t = Math.max(ctx.currentTime, at || 0), s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), a = ctx.createGain(); s.buffer = noise; s.loop = true;
    f.type = 'bandpass'; f.Q.value = 1.4; f.frequency.setValueAtTime(f0 * pitch, t); f.frequency.exponentialRampToValueAtTime(f1 * pitch, t + dur);
    a.gain.setValueAtTime(0.0001, t); a.gain.exponentialRampToValueAtTime(vol, t + dur * 0.35); a.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(a); panned(a, x, dest); s.start(t, rnd() * 0.3); s.stop(t + dur + 0.02);
  }
  function thump(k, x, at) {   /* the low body under a heavy hit */
    const t = Math.max(ctx.currentTime, at || 0), dur = 0.16 + k * 0.12, o = ctx.createOscillator(), a = ctx.createGain(); o.type = 'sine';
    o.frequency.setValueAtTime(150 - k * 50, t); o.frequency.exponentialRampToValueAtTime(42, t + dur); a.gain.setValueAtTime(0.16 + k * 0.14, t); a.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(a); panned(a, x, bus.lim); o.start(t); o.stop(t + dur);
  }
  function synth(spec, e, x, vol, pitch, at) {
    const dest = out(e);
    if (spec[0] === 'whoosh') whoosh(spec[1], spec[2], spec[3], spec[4] * vol, pitch, dest, x, at);
    else if (Array.isArray(spec[0])) for (const s of spec) tone(s[1] * pitch, s[2], s[3], s[4] * vol, s[5], dest, x, (at || ctx.currentTime) + s[0]);
    else tone(spec[0] * pitch, spec[1], spec[2], spec[3] * vol, spec[4], dest, x, at);
  }
  function duck(depth, hold) {   /* the music steps back for a heavy hit or a KO, never for a jab */
    if (!ctx) return; const t = ctx.currentTime, g = bus.duck.gain; g.cancelScheduledValues(t); g.setTargetAtTime(depth, t, 0.015); g.setTargetAtTime(1, t + hold, 0.25);
  }

  /* ---- playing an event ---- */
  function voice(buf, e, x, vol, pitch, at) {
    const t = Math.max(ctx.currentTime, at || 0), pr = e.pr === undefined ? 2 : e.pr;
    for (let k = voices.length - 1; k >= 0; k--) if (voices[k].end < ctx.currentTime) voices.splice(k, 1);
    if (voices.length >= MAX_VOICES) {   /* full: the least important, oldest sound makes room, or this one is skipped */
      let w = 0; for (let k = 1; k < voices.length; k++) if (voices[k].pr < voices[w].pr || (voices[k].pr === voices[w].pr && voices[k].t < voices[w].t)) w = k;
      if (voices[w].pr > pr) return; try { voices[w].src.stop(); } catch (err) { /* already over */ } voices.splice(w, 1);
    }
    const s = ctx.createBufferSource(), a = ctx.createGain(); s.buffer = buf; s.playbackRate.value = pitch; let dur = buf.duration / pitch;
    a.gain.setValueAtTime(vol, t); if (e.cut && dur > e.cut) { dur = e.cut; a.gain.setValueAtTime(vol, t + dur * 0.6); a.gain.exponentialRampToValueAtTime(0.0001, t + dur); }
    s.connect(a); panned(a, x, out(e)); s.start(t); s.stop(t + dur + 0.01); voices.push({ src: s, pr, t, end: t + dur });
  }
  /* A recording played as if through a terrible microphone: no bass, no top, a honk in the middle, driven until it clips, with hiss
     behind it. Still easy to understand. It skips the limiter the other sounds share, so it really is louder than everything else;
     the sound effects slider still turns it down. */
  let clip = null;
  function badMic(buf, vol) {
    const t = ctx.currentTime, d = buf.getChannelData(0); let sum = 0; for (let k = 0; k < d.length; k += 4) sum += d[k] * d[k]; const rms = Math.sqrt(sum / (d.length / 4)) || 0.1;
    if (!clip) { clip = new Float32Array(1024); for (let k = 0; k < 1024; k++) { const x = k / 511.5 - 1; clip[k] = Math.max(-1, Math.min(1, Math.tanh(x * 2.6) * 1.15)); } }
    const s = ctx.createBufferSource(), pre = ctx.createGain(), hp = ctx.createBiquadFilter(), honk = ctx.createBiquadFilter(), lp = ctx.createBiquadFilter(), ws = ctx.createWaveShaper(), post = ctx.createGain();
    s.buffer = buf; pre.gain.value = 0.45 / rms;   /* every recording is driven equally hard, however quietly it was spoken */
    hp.type = 'highpass'; hp.frequency.value = 480; hp.Q.value = 0.8; honk.type = 'peaking'; honk.frequency.value = 1900; honk.Q.value = 1.1; honk.gain.value = 11; lp.type = 'lowpass'; lp.frequency.value = 3400; lp.Q.value = 1.2;
    ws.curve = clip; ws.oversample = '2x'; post.gain.value = vol;
    s.connect(hp); hp.connect(honk); honk.connect(pre); pre.connect(ws); ws.connect(lp); lp.connect(post); post.connect(bus.sfx); s.start(t);
    const h = ctx.createBufferSource(), hf = ctx.createBiquadFilter(), hg = ctx.createGain(); h.buffer = noise; h.loop = true; hf.type = 'bandpass'; hf.frequency.value = 2800; hf.Q.value = 0.6;   /* the hiss of a cheap microphone, only while it is open */
    hg.gain.setValueAtTime(0.0001, t); hg.gain.exponentialRampToValueAtTime(0.05 * vol, t + 0.04); hg.gain.setValueAtTime(0.05 * vol, t + buf.duration); hg.gain.exponentialRampToValueAtTime(0.0001, t + buf.duration + 0.15);
    h.connect(hf); hf.connect(hg); hg.connect(bus.sfx); h.start(t); h.stop(t + buf.duration + 0.2);
    duck(0.3, buf.duration);
  }
  /* play('parry', x, { vol, pitch, delay }): x is where on the stage it happens (0 = the middle). */
  function play(id, x, o) {
    if (!boot()) return; if (ctx.state === 'suspended') { ctx.resume().catch(() => {}); return; }   /* nothing queues up behind a browser that has not let sound start yet */
    const e = EV[id]; if (!e) { miss('event "' + id + '"'); tone(600, 0.05, 'triangle', 0.04); return; }
    const now = ctx.currentTime, at = o && o.delay ? now + o.delay : 0; if (!at) { if (lastAt[id] !== undefined && now - lastAt[id] < (e.gap === undefined ? 0.03 : e.gap)) return; lastAt[id] = now; }
    const vol = (e.v === undefined ? 1 : e.v) * (o && o.vol !== undefined ? o.vol : 1), pitch = (e.p || 1) * (o && o.pitch || 1) * (1 + (e.pv ? (rnd() * 2 - 1) * e.pv : 0));
    if (e.duck) duck(0.4, 0.35);
    if (e.thump) thump(Math.min(1, vol), x, at);
    if (e.also) synth(e.also, e, x, 1, 1, at);
    if (!e.f) { synth(e.syn, e, x, o && o.vol !== undefined ? o.vol : 1, pitch, at); return; }
    let list = e.f; if (!e.all) { let k = rnd() * e.f.length | 0; if (e.f.length > 1 && k === lastPick[id]) k = (k + 1) % e.f.length; lastPick[id] = k; list = [e.f[k]]; }
    for (const f of list) { const b = buffers.get(f); if (b && b.duration) { if (e.badmic) badMic(b, vol); else voice(b, e, x, vol, pitch, at); } else if (b === null) { if (e.syn) synth(e.syn, e, x, 1, pitch, at); else tone(300, 0.06, 'triangle', 0.04, 0.7, out(e), x, at); } }
  }
  /* A hit, by how hard it launches: light = a bright short snap; medium = snap and body; heavy = snap, a low thump and a short tail. */
  function hit(kb, x, ko) {
    play(kb < 50 ? 'jab_hit_light' : kb < 100 ? 'tilt_hit_mid' : 'smash_hit_heavy', x, { vol: 0.8 + Math.min(0.2, kb / 600) });
    if (ko) play('ko_hit', x); else if (kb > 130) duck(0.6, 0.15);
  }

  /* ---- music ---- */
  const slots = { music: null, amb: null };
  function setLoop(slot, name) {
    if (!ctx) return; const cur = slots[slot]; if ((cur ? cur.name : null) === name) return;
    const t = ctx.currentTime;
    if (cur) { cur.gain.gain.cancelScheduledValues(t); cur.gain.gain.setTargetAtTime(0, t, 0.2); const src = cur.src; if (src) setTimeout(() => { try { src.stop(); src.disconnect(); } catch (e) { /* already over */ } }, 1200); cur.dropped = true; }
    slots[slot] = null; if (!name) return;
    const tr = TRACKS[name], me = slots[slot] = { name, gain: ctx.createGain(), src: null, dropped: false }; me.gain.gain.value = 0; me.gain.connect(bus.duck);
    if (slot === 'music') for (const k of BATTLE) if (k !== name) buffers.delete(TRACKS[k].f);   /* only the track in use stays in memory */
    load(tr.f).then(buf => {
      if (me.dropped || !buf) return; const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; s.connect(me.gain); s.start(); me.src = s;
      me.gain.gain.setTargetAtTime(tr.v * (slot === 'music' ? hush : 1), ctx.currentTime, 0.25);
    });
  }
  let prevMode = '', battle = null, lastBattle = null, hush = 1, stepAt = [0, 0];
  function nextBattle() { if (S.track !== 'shuffle') return S.track; const pool = BATTLE.filter(k => k !== lastBattle); return pool[rnd() * pool.length | 0]; }
  /* Called once a picture: keeps the music in step with what the game is doing, and makes the footsteps of anyone running. */
  function frame(mode, paused, fighters) {
    if (!boot() || ctx.state !== 'running') return;
    if (mode !== prevMode) {
      if (mode === 'countdown' && prevMode !== 'play') { battle = lastBattle = nextBattle(); }
      if (mode === 'over') play('victory');
      prevMode = mode;
    }
    const inMatch = mode === 'countdown' || mode === 'play';
    setLoop('music', mode === 'select' ? 'menu' : inMatch ? (S.track !== 'shuffle' && S.track !== battle ? (battle = lastBattle = S.track) : battle) : null);
    setLoop('amb', inMatch ? 'forest' : null);
    const want = paused && inMatch ? 0.3 : 1; if (want !== hush) { hush = want; const m = slots.music; if (m && m.src) m.gain.gain.setTargetAtTime(TRACKS[m.name].v * hush, ctx.currentTime, 0.15); }
    if (mode === 'play' && !paused && fighters) for (const f of fighters) {
      if (f.state === 'run' && f.grounded && f.hitlag <= 0) { if (ctx.currentTime - stepAt[f.idx] > 0.21) { stepAt[f.idx] = ctx.currentTime; play('footstep', f.x); } }
    }
  }

  /* ---- the Sound screen ---- */
  function set(k, v) {
    if (k === 'track') S.track = v; else S[k] = Math.min(1, Math.max(0, Math.round(v * 20) / 20));
    apply(); save();
  }
  function mute(k, on) { S.mute[k] = on === undefined ? !S.mute[k] : !!on; apply(); save(); }
  function apply() { if (ctx) for (const k of ['music', 'sfx', 'ui']) bus[k].gain.setTargetAtTime(level(k), ctx.currentTime, 0.03); }
  function cycleTrack(d) { const all = ['shuffle'].concat(BATTLE), k = all.indexOf(S.track); set('track', all[(k + d + all.length) % all.length]); }
  function trackName() { return S.track === 'shuffle' ? 'Shuffle' + (battle ? '  (now: ' + TRACKS[battle].name + ')' : '') : TRACKS[S.track].name; }

  if (typeof addEventListener === 'function') { for (const ev of ['keydown', 'pointerdown', 'touchstart']) addEventListener(ev, wake, true); addEventListener('load', boot); }
  return { play, hit, tone: (f, d, t, v, s) => { if (boot() && ctx.state === 'running') tone(f, d, t, v, s); }, frame, set, mute, cycleTrack, trackName, duck, wake, settings: S, events: EV, tracks: TRACKS, missing,
    /* How loud a group is right now, 0..1 (the largest sample in the last 40 ms): 'master', 'music', 'lim' (sound effects) or 'ui'. */
    level(k) { const m = meters[k || 'master']; if (!m) return 0; const d = new Float32Array(m.fftSize); m.getFloatTimeDomainData(d); let p = 0; for (const v of d) p = Math.max(p, Math.abs(v)); return p; },
    /* For checking by machine: sound still runs and SND.level still reads, but nothing reaches the speakers. */
    silent(on) { if (!boot()) return; try { bus.master.disconnect(ctx.destination); } catch (e) { /* was not connected */ } if (!on) bus.master.connect(ctx.destination); },
    preview(name) { wake(); setLoop('music', name); }, get ctx() { return ctx; } };
})();
