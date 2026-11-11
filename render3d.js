/* Emberfall 3D renderer (Three.js). It only reads the simulation: fighters, projectiles, camera. It never writes to it.
   A fighter with an entry in assets/manifest.json is drawn as its rigged model, posed every frame from the simulation's
   own frame counters (see anim.js). Fighters without a model yet are grey-box capsules. */
/* global W, H, TAU, clamp, MAIN, EDGE, PLATS, BODY_H, RIM, DEPTH, SHOULDER, SHOULDER_IN, F, PROJ, cam, SHK, frame, tick, mode, cv, animState */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const glc = document.getElementById('gl');
const R3 = window.R3 = { ready: false, gpu: '', three: THREE.REVISION, show() {}, render() {}, info: null, models: {} };
const MODELS = R3.models;
let renderer = null;
try { renderer = new THREE.WebGLRenderer({ canvas: glc, antialias: true, powerPreference: 'high-performance' }); }
catch (e) { console.warn('3D renderer unavailable; staying in 2D.', e); }
if (renderer) build();

function build() {
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1; renderer.outputColorSpace = THREE.SRGBColorSpace;
  const gl = renderer.getContext(), ext = gl.getExtension('WEBGL_debug_renderer_info');
  R3.gpu = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : 'unknown';

  const FOV = 28, LIFT = 0.13;   /* camera sits above the action and looks straight ahead through a shifted lens, so the play plane stays undistorted */
  const scene = new THREE.Scene(); scene.fog = new THREE.Fog(0xb7bedb, 900, 3600); scene.background = new THREE.Color(0xb4bcdc);   /* dawn mist */
  const camera = new THREE.PerspectiveCamera(FOV, 16 / 9, 5, 6000);
  /* Soft all-round reflections, so the models' metal and cloth materials have something to reflect (without it they render near-black). */
  const pmrem = new THREE.PMREMGenerator(renderer); scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.55; pmrem.dispose();

  /* ---- backdrop ---- */
  const tex = (w, h, paint) => { const c = document.createElement('canvas'); c.width = w; c.height = h; paint(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; };
  /* The painted dawn gorge, far behind everything. It keeps filling the view as the camera moves and zooms, and drifts a
     little against the camera so the distance reads. Shown as painted: no fog, no tone mapping. */
  const backdrop = new THREE.Mesh(new THREE.PlaneGeometry(16, 9), new THREE.MeshBasicMaterial({ color: 0xb4bcdc, fog: false, depthWrite: false, toneMapped: false }));
  backdrop.position.z = -2600; backdrop.renderOrder = -10; backdrop.frustumCulled = false; scene.add(backdrop);
  new THREE.TextureLoader().load('assets/stage/export/backdrop.jpg', t => { t.colorSpace = THREE.SRGBColorSpace; backdrop.material.map = t; backdrop.material.color.set(0xffffff); backdrop.material.needsUpdate = true; });

  /* ---- stage ---- */
  const stone = new THREE.MeshStandardMaterial({ color: 0x5b5560, roughness: 0.95, flatShading: true }), plain = new THREE.Group(); scene.add(plain);   /* plain: the stand-in stage shown until the island model has loaded */
  const bodyShape = new THREE.Shape([[-EDGE, 0], [EDGE, 0], [EDGE, -RIM], [EDGE - SHOULDER_IN, -SHOULDER], [0, -DEPTH], [-(EDGE - SHOULDER_IN), -SHOULDER], [-EDGE, -RIM]].map(p => new THREE.Vector2(p[0], p[1])));   /* the island's outline, the same as its collision in sim.js */
  const body = new THREE.Mesh(new THREE.ExtrudeGeometry(bodyShape, { depth: 44, bevelEnabled: false }), stone); body.position.z = -22; body.castShadow = body.receiveShadow = true; plain.add(body);
  const planks = tex(1024, 256, (g, w, h) => { g.fillStyle = '#b7a087'; g.fillRect(0, 0, w, h); for (let x = 0; x < w; x += 64) { g.fillStyle = (x / 64) % 2 ? 'rgba(0,0,0,.05)' : 'rgba(255,255,255,.04)'; g.fillRect(x, 0, 64, h); g.fillStyle = 'rgba(40,28,30,.55)'; g.fillRect(x, 0, 3, h); } for (let k = 0; k < 500; k++) { g.fillStyle = 'rgba(60,40,30,' + (Math.random() * 0.12).toFixed(3) + ')'; g.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 26, 1); } });
  planks.wrapS = planks.wrapT = THREE.RepeatWrapping; planks.repeat.set(2, 1);
  const deck = new THREE.Mesh(new THREE.BoxGeometry(EDGE * 2 + 4, 3, 48), new THREE.MeshStandardMaterial({ color: 0xffffff, map: planks, roughness: 0.82 })); deck.position.set(0, -1.5, 0); deck.castShadow = deck.receiveShadow = true; plain.add(deck);
  /* floating slabs: weathered stone with a copper band and a glowing ember line along the top edge */
  const slab = new THREE.MeshStandardMaterial({ color: 0x8a8079, roughness: 0.9, flatShading: true }), copper = new THREE.MeshStandardMaterial({ color: 0xa8623a, roughness: 0.45, metalness: 0.7 }), emberLine = new THREE.MeshStandardMaterial({ color: 0xffb060, emissive: 0xff8a30, emissiveIntensity: 2.4, roughness: 0.5 });
  for (const p of PLATS) if (p.soft) {
    const w = p.x1 - p.x0, cx = (p.x0 + p.x1) / 2, g = new THREE.Group(); g.position.set(cx, p.y, 0); scene.add(g);
    const top = new THREE.Mesh(new THREE.BoxGeometry(w, 1.4, 15), slab); top.position.y = -0.7; top.castShadow = top.receiveShadow = true; g.add(top);
    const sh = new THREE.Shape([[-w / 2 + 1, 0], [w / 2 - 1, 0], [w / 2 - 4, -2.6], [-w / 2 + 4, -2.6]].map(q => new THREE.Vector2(q[0], q[1])));   /* the chamfered underside */
    const under = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 13, bevelEnabled: false }), slab); under.position.set(0, -1.4, -6.5); under.castShadow = true; g.add(under);
    const band = new THREE.Mesh(new THREE.BoxGeometry(w + 0.5, 0.7, 15.5), copper); band.position.y = -1.05; g.add(band);
    for (const z of [7.6, -7.6]) { const l = new THREE.Mesh(new THREE.BoxGeometry(w - 1, 0.28, 0.28), emberLine); l.position.set(0, -0.12, z); g.add(l); }
    for (const ex of [-w / 2, w / 2]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.28, 15), emberLine); l.position.set(ex, -0.12, 0); g.add(l); }
  }
  const iron = new THREE.MeshStandardMaterial({ color: 0x3d3548, roughness: 0.6, metalness: 0.4 }), lampGlass = new THREE.MeshStandardMaterial({ color: 0xffe2a0, emissive: 0xffb85a, emissiveIntensity: 2.2, roughness: 0.4 });
  /* two warm lights: on lamp posts while the stand-in stage shows, moved to the forge mouth and the lantern once the island has loaded */
  const lamps = [];
  for (const lx of [-(EDGE - 10), EDGE - 10]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.6, 19, 10), iron); pole.position.set(lx, 9.5, -17); pole.castShadow = true; plain.add(pole);
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.8, 1.2, 12), iron); foot.position.set(lx, 0.6, -17); plain.add(foot);
    const glass = new THREE.Mesh(new THREE.BoxGeometry(2.8, 3.6, 2.8), lampGlass); glass.position.set(lx, 21, -17); plain.add(glass);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(2.6, 2, 4), iron); cap.position.set(lx, 23.8, -17); cap.rotation.y = Math.PI / 4; plain.add(cap);
    const light = new THREE.PointLight(0xffb866, 2200, 150, 2); light.position.set(lx, 21, -9); light.userData.i = 2200; scene.add(light); lamps.push(light);
  }

  /* ---- the island: a generated model, placed by assets/stage/export/stage.json so its flat top is the floor and its rim the ledges ---- */
  fetch('assets/stage/export/stage.json').then(r => r.ok ? r.json() : null).then(cfg => {
    if (!cfg) return;
    new GLTFLoader().load(cfg.file, g => {
      const m = g.scene; m.scale.set(cfg.scale[0], cfg.scale[1], cfg.scale[2]); m.position.set(cfg.offset[0], cfg.offset[1], cfg.offset[2]); m.rotation.y = (cfg.yaw || 0) * Math.PI / 180;
      m.traverse(o => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = true; o.frustumCulled = false; if (o.material) o.material.envMapIntensity = 0.25; } });   /* takes the fighters' shadows; casts none itself, to keep the frame cheap */
      scene.add(m); plain.visible = false; R3.stage = m;
      /* the two warm lights move to the forge mouth and the lantern */
      (cfg.lights || []).forEach((q, k) => { const l = lamps[k]; if (!l) return; l.position.set(q.at[0], q.at[1], q.at[2]); l.color.set(q.color); l.userData.i = q.power; l.distance = q.reach; });
    }, undefined, e => console.warn('stage model failed to load; the plain stage stays', e));
  }).catch(() => {});

  /* ---- lights ---- */
  scene.add(new THREE.HemisphereLight(0xcdd6ff, 0x6b5a58, 0.8));   /* dawn: cool sky above, warm rock below */
  const key = new THREE.DirectionalLight(0xffd9b0, 2.3); key.position.set(-120, 130, 120);   /* low sun from the left */ key.target.position.set(0, 10, 0); scene.add(key, key.target);
  key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.6;
  Object.assign(key.shadow.camera, { left: -150, right: 150, top: 150, bottom: -70, near: 10, far: 520 }); key.shadow.camera.updateProjectionMatrix();
  const rim = new THREE.DirectionalLight(0xffb7c8, 1.5); rim.position.set(110, 80, -140); scene.add(rim);   /* pink edge light from the clouds behind */
  const fill = new THREE.DirectionalLight(0xffd9b0, 0.7); fill.position.set(30, 40, 200); scene.add(fill);   /* from the camera side, no shadow: keeps faces readable */

  /* ---- models ---- */
  fetch('assets/manifest.json').then(r => r.ok ? r.json() : {}).then(man => {
    for (const [name, cfg] of Object.entries(man)) {
      const M = MODELS[name] = { cfg, ready: false, error: null };
      new GLTFLoader().load(cfg.file, g => {
        M.scene = g.scene; M.clips = Object.fromEntries(g.animations.map(c => [c.name, c]));
        const box = new THREE.Box3().setFromObject(g.scene); M.height = box.max.y - box.min.y; M.ready = true;
      }, undefined, e => { M.error = String((e && e.message) || e); console.warn('model failed to load: ' + name, e); });
    }
  }).catch(e => console.warn('no model manifest', e));

  /* ---- fighters ---- */
  const PCOL = [0xff7b6c, 0x6cb4ff];
  const fighters = [0, 1].map(idx => {
    const root = new THREE.Group(), pivot = new THREE.Group(); root.add(pivot); scene.add(root);
    const shield = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 18), new THREE.MeshStandardMaterial({ color: PCOL[idx], emissive: PCOL[idx], emissiveIntensity: 0.5, transparent: true, opacity: 0.42, roughness: 0.2, depthWrite: false })); shield.visible = false; scene.add(shield);
    const pad = new THREE.Mesh(new THREE.BoxGeometry(18, 1.4, 10), new THREE.MeshStandardMaterial({ color: 0xffe6a0, emissive: 0xffc860, emissiveIntensity: 1.2 })); pad.visible = false; scene.add(pad);
    return { root, pivot, shield, pad, key: '', yaw: idx ? Math.PI : 0, mats: [], obj: null, unit: 1, flip: 1, springs: [], springTick: -1, model: null, mixer: null, actions: {}, cur: null, prev: null, prop: null, hand: null };
  });
  /* Flint's lantern: hangs from his hand and stays upright, so swinging the arm swings the light. */
  function makeLantern() {
    const g = new THREE.Group(), brass = new THREE.MeshStandardMaterial({ color: 0xc9a24a, roughness: 0.35, metalness: 0.8 });
    const add = (geo, mat, y) => { const m = new THREE.Mesh(geo, mat); m.position.y = y; m.castShadow = true; g.add(m); return m; };
    add(new THREE.TorusGeometry(0.5, 0.07, 6, 16), brass, -0.45);
    add(new THREE.CylinderGeometry(0.72, 0.5, 0.28, 6), brass, -1.0);
    add(new THREE.CylinderGeometry(0.58, 0.66, 1.5, 6), new THREE.MeshStandardMaterial({ color: 0xffe2a0, emissive: 0xffa540, emissiveIntensity: 2.6, roughness: 0.3 }), -1.9).castShadow = false;
    add(new THREE.CylinderGeometry(0.72, 0.72, 0.22, 6), brass, -2.75);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, map: tex(128, 128, (c, w) => { const q = c.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); q.addColorStop(0, 'rgba(255,200,110,.75)'); q.addColorStop(0.35, 'rgba(255,170,70,.22)'); q.addColorStop(1, 'rgba(255,170,70,0)'); c.fillStyle = q; c.fillRect(0, 0, w, w); }) }));
    glow.scale.set(9, 9, 1); glow.position.y = -1.9; g.add(glow); g.userData.glow = glow;
    return g;
  }
  function dress(v, f) {
    const fm = f.form, col = f.alt ? fm.alt : fm.col, st = fm.st, M = MODELS[fm.name], useModel = !!(M && M.ready), k = fm.name + (f.alt ? '*' : '') + (useModel ? '#model' : '');
    if (v.key === k) return; const prevKey = v.key; v.key = k;
    while (v.pivot.children.length) { const c = v.pivot.children.pop(); if (c.geometry) c.geometry.dispose(); }
    if (v.mixer) v.mixer.stopAllAction();
    v.mixer = null; v.model = null; v.actions = {}; v.cur = null; v.prev = null; v.hand = null; v.springs = []; v.springTick = -1;
    if (v.prop) { scene.remove(v.prop); v.prop = null; }
    if (useModel) {
      /* A copy of the loaded model with its own skeleton, scaled to the fighter's height and turned so its front is +x. */
      const obj = cloneSkinned(M.scene); obj.scale.setScalar(M.cfg.height / M.height); obj.rotation.y = M.cfg.faceCamera ? 0 : Math.PI / 2; v.mats = [];
      v.obj = obj; v.unit = M.cfg.height / M.height; v.flip = f.face;
      obj.traverse(o => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; o.frustumCulled = false; o.material = o.material.clone(); if (f.alt) o.material.color.setRGB(0.78, 0.9, 1.25); v.mats.push(o.material); } });
      v.pivot.add(obj); v.model = M; v.mixer = new THREE.AnimationMixer(obj); setupSprings(v, M);
      if (M.cfg.lift) obj.position.y = M.cfg.lift;   /* a rider: the model sits this high above the fighter's feet */
      if (M.cfg.prop && M.cfg.prop.type === 'sling') { v.prop = makeSling(); v.hand = null; scene.add(v.prop); if (/ alone/.test(prevKey)) v.prop.userData.rig.k = { py: -2.2, sq: -0.14, bend: 0.15 }; }   /* the bird drops back into the pouch: the bands take its weight */
      if (M.cfg.prop && M.cfg.prop.type === 'lantern') { v.hand = obj.getObjectByName(M.cfg.prop.bone) || null; if (v.hand) { v.prop = makeLantern(); scene.add(v.prop); } }
      return;
    }
    const r = st.w * 0.45, len = Math.max(0.1, st.h - 2 * r);
    const mk = (geo, hex, x, y, z) => { const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(hex), roughness: 0.55 }); const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; v.pivot.add(m); v.mats.push(mat); return m; };
    v.mats = [];
    mk(new THREE.CapsuleGeometry(r, len, 8, 20), col[0], 0, st.h / 2, 0);
    mk(new THREE.BoxGeometry(r * 0.7, st.h * 0.16, r * 1.5), col[2], r * 0.72, st.h * 0.72, 0);          /* visor: shows which way it faces */
    mk(new THREE.TorusGeometry(r * 1.02, r * 0.14, 8, 24), col[1], 0, st.h * 0.42, 0).rotation.x = Math.PI / 2;   /* belt in the accent colour */
  }

  /* ---- projectiles ---- */
  /* The living slingshot (Furious Fowls): a forked branch on two small feet, with two bands and a leather pouch. Built here, not generated. Faces +x. */
  const emptySlings = [];
  /* Built as a small puppet: feet, a trunk that bends from its base, the fork bending again above it, two bands drawn fresh
     each frame from the fork tips to a pouch that hangs on a spring. Poses come from slingWant, which only reads the game. */
  const makeSling = () => {
    const grp = new THREE.Group(), wood = new THREE.MeshStandardMaterial({ color: 0xb8742f, roughness: 0.75 }), dark = new THREE.MeshStandardMaterial({ color: 0x7a3a26, roughness: 0.8 }), bandM = new THREE.MeshStandardMaterial({ color: 0xc8562c, roughness: 0.6 });
    const stick = (parent, x0, y0, z0, x1, y1, z1, r0, r1, mat) => { const a = new THREE.Vector3(x0, y0, z0), b = new THREE.Vector3(x1, y1, z1), m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, a.distanceTo(b), 10), mat); m.position.copy(a).add(b).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()); m.castShadow = true; parent.add(m); return m; };
    const trunk = new THREE.Group(); trunk.position.y = 0.6; grp.add(trunk);                     /* bends at its base */
    stick(trunk, 0, 0, 0, 0, 5.8, 0, 0.75, 0.65, wood);
    const fork = new THREE.Group(); fork.position.y = 5.4; trunk.add(fork);                    /* bends again where it forks */
    stick(fork, 0, 0, 0, 0, 8.2, 4.2, 0.6, 0.48, wood); stick(fork, 0, 0, 0, 0, 8.2, -4.2, 0.6, 0.48, wood);
    const tips = [];
    for (const z of [4.4, -4.4]) { const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.9, 10), dark); cap.position.set(0, 7.4, z * 0.93); fork.add(cap); const tip = new THREE.Object3D(); tip.position.set(0, 7.2, z * 0.9); fork.add(tip); tips.push(tip); }
    const pouch = new THREE.Mesh(new THREE.SphereGeometry(2.7, 14, 10, 0, Math.PI * 2, Math.PI * 0.5, Math.PI * 0.5), dark); pouch.scale.set(1, 0.8, 1.1); grp.add(pouch);
    const seat = new THREE.Object3D(); seat.position.set(0.2, 4.6, 0); fork.add(seat);       /* where the pouch hangs when nothing pulls it */
    const unitY = new THREE.Vector3(0, 1, 0), bands = [0, 1].map(() => { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 1, 8), bandM); m.castShadow = true; grp.add(m); return m; });
    const feet = [1.2, -1.2].map(z => { const foot = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), wood); foot.scale.set(1.0, 0.45, 0.7); foot.position.set(0.5, 0.5, z); foot.castShadow = true; grp.add(foot); return foot; });
    const eye = new THREE.MeshBasicMaterial({ color: 0x2a1a12 }); for (const z of [0.5, -0.5]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), eye); e.position.set(1.42, 3.0, z); trunk.add(e); }
    const out = new THREE.Group(); grp.rotation.y = 0.95; out.add(grp); out.visible = false;   /* turned so the fork shows from the side */
    const rig = { grp, trunk, fork, tips, pouch, seat, bands, feet, bend: 0, bendV: 0, sq: 1, sqV: 0, px: 0, py: 0, pvx: 0, pvy: 0, tick: -1, lastVy: 0, lastState: '', lastKey: '', k: null, seatRest: null };
    /* Each game step every part chases the pose it is asked for on a spring, so it overshoots and settles (follow-through).
       Returns how far the pouch sits from its resting place, in the slingshot's own space, so a rider can move with it. */
    rig.drive = (want, step) => {
      const kick = rig.k; rig.k = null;
      if (step) {
        rig.bendV = (rig.bendV + (want.bend - rig.bend) * 0.22) * 0.74 + (kick && kick.bend || 0); rig.bend += rig.bendV;
        rig.sqV = (rig.sqV + (want.sq - rig.sq) * 0.3) * 0.7 + (kick && kick.sq || 0); rig.sq += rig.sqV;
        rig.pvx = (rig.pvx + (want.px - rig.px) * 0.2) * 0.78 + (kick && kick.px || 0); rig.px += rig.pvx;
        rig.pvy = (rig.pvy + (want.py - rig.py) * 0.2) * 0.78 + (kick && kick.py || 0); rig.py += rig.pvy;
        rig.bend = clamp(rig.bend, -0.9, 0.9); rig.sq = clamp(rig.sq, 0.6, 1.35);
      }
      rig.trunk.rotation.z = -rig.bend * 0.55; rig.fork.rotation.z = -rig.bend * 0.45; const thin = 1 / Math.sqrt(rig.sq); rig.trunk.scale.set(thin, rig.sq, thin);
      for (let i = 0; i < 2; i++) { const ft = rig.feet[i]; ft.position.y = 0.5 + (want.feet ? Math.max(0, want.feet[i]) : 0); ft.position.x = 0.5 + (want.footX || 0); }
      rig.grp.updateMatrixWorld(true);
      const c = rig.seat.getWorldPosition(new THREE.Vector3()); rig.grp.worldToLocal(c);
      if (!rig.seatRest) rig.seatRest = new THREE.Vector3(0.2, 10.6, 0);
      /* pulls are along the stage (the slingshot's own frame before its turn to show the fork), so turn them into the fork's frame */
      const off = c.clone().sub(rig.seatRest), ca = Math.cos(0.95), sa = Math.sin(0.95); c.x += rig.px * ca; c.z += rig.px * sa; c.y += rig.py; off.x += rig.px * ca; off.z += rig.px * sa; off.y += rig.py;
      rig.pouch.position.copy(c); rig.pouch.rotation.z = clamp(rig.pvx * -0.3, -0.6, 0.6);
      const thinB = 1 / (1 + Math.hypot(rig.px, rig.py) * 0.08);   /* stretched bands get thinner */
      rig.tips.forEach((tp, i) => { const a = tp.getWorldPosition(new THREE.Vector3()); rig.grp.worldToLocal(a); const b = c.clone().add(new THREE.Vector3(0.1, -0.6, i ? -1.4 : 1.4)), m = rig.bands[i];
        m.position.copy(a).add(b).multiplyScalar(0.5); m.scale.set(thinB, Math.max(0.1, a.distanceTo(b)), thinB); m.quaternion.setFromUnitVectors(unitY, b.clone().sub(a).normalize()); });
      return off;
    };
    out.userData.rig = rig; return out;
  };
  /* What the slingshot is asked to do this frame. bend > 0 leans its top the way it faces; sq < 1 squashes it; px, py pull
     the pouch (px < 0 is back). [wind-up lean, strike lean, squash at the strike] per attack. Picture only: reads the game. */
  const SLING_ATK = { jab: [0.15, 0.25], jab2: [0.15, 0.3], jab3: [0.3, 0.55], ftilt: [0.35, 0.5], dtilt: [0.2, 0.45, 0.78], utilt: [0.2, -0.2, 1.18], dash: [0.2, 0.6],
    fsmash: [0.6, 0.8], usmash: [0.3, -0.3, 1.25], dsmash: [0.25, 0.1, 0.72], fair: [0.3, 0.55], bair: [-0.3, -0.6], uair: [0.1, -0.2, 1.2], dair: [0.1, 0.2, 0.8], grab: [0.2, 0.45], dgrab: [0.2, 0.5], pgrab: [0.3, 0.5], getup: [0.2, 0.5, 0.8] };
  const phase01 = (a, b) => b > 0 ? Math.min(1, Math.max(0, a / b)) : 1;
  function slingWant(f, rig) {
    const s = f.state, w = { bend: 0, sq: 1, px: 0, py: 0, feet: null, footX: 0 }, fr = tick, vxF = f.vx * f.face;
    if (s === 'idle') { w.sq = 1 + Math.sin(fr * 0.07) * 0.02; w.bend = Math.sin(fr * 0.035) * 0.04; w.py = Math.sin(fr * 0.07 + 1) * 0.3;
      if (f.ctl.c.ly < CROUCH_Y) { w.sq = 0.78; w.bend = 0.1; }
      if (Math.abs(f.vx) > 0.2) { w.bend = clamp(vxF * 0.12, -0.25, 0.25); w.feet = [Math.max(0, Math.sin(fr * 0.4)) * 0.8, Math.max(0, -Math.sin(fr * 0.4)) * 0.8]; } }
    else if (s === 'dash' || s === 'run') { w.bend = clamp(vxF * 0.16, -0.4, 0.4); w.sq = 0.96; w.px = -1.6; w.feet = [Math.max(0, Math.sin(fr * 0.55)) * 1.2, Math.max(0, -Math.sin(fr * 0.55)) * 1.2]; }
    else if (s === 'brake') { w.bend = -0.35; w.sq = 0.9; w.px = 1.6; w.footX = 1.2; }
    else if (s === 'jsq') w.sq = 0.78;
    else if (s === 'air' || s === 'helpless') { w.sq = f.vy > 0.5 ? 1.08 : 1; w.py = clamp(-f.vy * 0.5, -1.5, 1.5); w.bend = clamp(vxF * 0.08, -0.2, 0.2); if (f.ff) { w.sq = 1.12; w.py = 1.5; } }
    else if (s === 'land' || s === 'wd') w.sq = f.lag >= 9 ? 0.72 : 0.86;
    else if (s === 'shield' || s === 'shieldstun') { w.sq = 0.84; w.bend = -0.15; }
    else if (s === 'hurt') { w.bend = -0.4 * Math.sign(vxF || 1); w.sq = f.grounded ? 0.9 : 1.05; w.px = -vxF * 0.8; }
    else if (s === 'held') { w.sq = 1.12; w.bend = Math.sin(fr * 0.5) * 0.2; }
    else if (s === 'hold') { w.bend = 0.15; w.sq = 0.92; }
    else if (s === 'throw') { w.bend = (f.throwK === 'b' ? -0.6 : f.throwK === 'u' ? -0.1 : 0.5) * Math.sin(Math.min(1, f.sf / 14) * Math.PI); w.sq = f.throwK === 'd' ? 0.8 : f.throwK === 'u' ? 1.2 : 0.95; }
    else if (s === 'down') { w.sq = 0.75; w.bend = -0.6; }
    else if (s === 'ledge') { w.bend = 0.5; w.sq = 1.1; }
    else if (s === 'attack' && f.move) {
      const m = f.move, a = animState(f), tbl = SLING_ATK[f.mname];
      if (m.fowlUp && !f.upGo) { const c = (f.upC || 0) / 45; w.px = -2 - 5 * c; w.py = -1.5 - 2.5 * c; w.bend = -0.15 - 0.35 * c; w.sq = 0.92 - 0.12 * c; }   /* Catapult Cyclone charging: bands stretch, trunk leans back */
      else if (m.spin) { w.py = 2.6; w.sq = 1.1; }   /* end over end: the pouch is flung outward */
      else if (f.mname === 'sspec') { const k = phase01(f.mf, m.t); w.px = k < 0.6 ? -5 * k / 0.6 : 0; w.py = k < 0.6 ? -1.5 : 0; w.bend = k < 0.6 ? -0.25 : 0.1; }   /* aiming: drawn back, then let go */
      else if (f.mname === 'nspec') { w.sq = 1 + Math.sin(fr * 0.3) * 0.04; w.py = Math.sin(fr * 0.3) * 0.6; }   /* the selector open: the pouch jiggles */
      else if (tbl && a.mode === 'marks') { const [wind, hit, sq] = tbl, e = a.seg === 0 ? Math.sin(a.v * Math.PI / 2) : 1;
        if (a.seg === 0) { w.bend = -wind * e; w.sq = 1 - 0.1 * e; w.px = -1.5 * e; } else if (a.seg === 1) { w.bend = hit; w.sq = sq || 1; w.px = 1.5; } else { w.bend = hit * (1 - a.v) * 0.4; w.sq = 1 + ((sq || 1) - 1) * (1 - a.v); } }
      else w.sq = 1 - 0.12 * Math.sin(phase01(f.mf, m.t) * Math.PI);
    }
    /* one-off impulses at the moment something happens, so the follow-through shows */
    if (rig.lastState !== s) {
      if (s === 'land' || s === 'wd') rig.k = { sq: -0.08 - Math.min(0.12, Math.abs(rig.lastVy) * 0.03), py: -1.2 };
      else if (s === 'air' && rig.lastState === 'jsq') rig.k = { sq: 0.1, py: -2 };
      else if (s === 'hurt') rig.k = { bend: -0.25 * Math.sign(vxF || 1), sq: 0.06, px: -vxF * 1.5 };
      else if (s === 'brake') rig.k = { bend: -0.2, px: 1.5 };
      rig.lastState = s;
    }
    rig.lastVy = f.vy;
    return w;
  }
  const shots = new Map();
  const shotMesh = kind => {
    if (kind === 'pipmate') { const M = MODELS['Pip alone']; if (M && M.ready) { const o = cloneSkinned(M.scene), g2 = new THREE.Group(); o.scale.setScalar(M.cfg.height * 0.8 / M.height); o.rotation.y = Math.PI / 2; o.traverse(q => { if (q.isMesh) { q.castShadow = true; q.frustumCulled = false; } }); g2.add(o); g2.userData.mixer = new THREE.AnimationMixer(o); g2.userData.acts = {}; g2.userData.ph = (shots.size % 3) * 0.37; return g2; }   /* Pip's companions animate too, each a little out of step */
      return new THREE.Mesh(new THREE.SphereGeometry(2.2, 12, 9), new THREE.MeshStandardMaterial({ color: 0x2bb8b0, roughness: 0.6 })); }
    if (kind === 'sackglow') { const m = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, opacity: 0.28, depthWrite: false })); return m; }   /* Potato Sack's swelling Spud Bomb */
    if (kind === 'nest') { const g2 = new THREE.Group(), twig = new THREE.MeshStandardMaterial({ color: 0x8a6a3e, roughness: 0.9 }); const ring = new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.9, 6, 14), twig); ring.rotation.x = Math.PI / 2; g2.add(ring);
      const egg = new THREE.Mesh(new THREE.SphereGeometry(1.2, 12, 9), new THREE.MeshStandardMaterial({ color: 0xf4ead8, roughness: 0.5 })); egg.scale.set(0.8, 1, 0.8); egg.position.y = 0.6; g2.add(egg); return g2; }
    const e = (hex, i) => new THREE.MeshStandardMaterial({ color: hex, emissive: hex, emissiveIntensity: i, roughness: 0.5 });
    if (kind === 'bolt') return new THREE.Mesh(new THREE.CapsuleGeometry(0.9, 4, 4, 10).rotateZ(Math.PI / 2), e(0xffe8a3, 2));
    if (kind === 'gust') return new THREE.Mesh(new THREE.TorusGeometry(4.5, 0.7, 8, 24), new THREE.MeshStandardMaterial({ color: 0xf0dcff, transparent: true, opacity: 0.55, depthWrite: false }));
    if (kind === 'boulder') { const m = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ color: 0x8d8794, roughness: 0.95, flatShading: true })); m.castShadow = true; return m; }
    if (kind === 'dummy' || kind === 'clone' || kind === 'egg') { const m = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 9), new THREE.MeshStandardMaterial({ color: kind === 'egg' ? 0xf4ead8 : kind === 'clone' ? 0x2bb8b0 : 0x8a623a, roughness: 0.7 })); if (kind === 'egg') m.scale.set(0.8, 1, 0.8); m.castShadow = true; return m; }   /* wooden ammunition, Pip's doubles, Pearl's egg */
    if (kind === 'tape') { const m = new THREE.Group(), rim = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.55, 18).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xd9c24a, roughness: 0.45, metalness: 0.5 })), hub = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.3, 0.62), new THREE.MeshStandardMaterial({ color: 0x4a4d57, roughness: 0.6 })); rim.castShadow = true; m.add(rim, hub); return m; }   /* Sprocket's tape roll: a steel reel with a dark bar across it, so its turning shows */
    return new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), e(0xffa040, 2.6));   /* ember and flame */
  };

  /* ---- animation: the simulation says which action and which frame; this only poses the model to match ---- */
  const lerp = (a, b, t) => a + (b - a) * t, frac = x => x - Math.floor(x);
  function clipTime(M, a) {
    const alt = a.alt, as = alt && M.cfg.clips[alt.key], ac = as && M.clips[as.clip];
    if (ac && !(alt.mode === 'once' && alt.v >= ac.duration)) {   /* a variant this model has a clip for (anim.js animAlt) */
      if (alt.mode === 'once') return [as.clip, (as.from || 0) + alt.v];
      return clipTime(M, alt);
    }
    if (a.key === 'attack') {
      /* Moves without a clip of their own borrow a related one: later jabs use the jab, dash and pivot grabs use the grab. */
      const at = M.cfg.attacks[a.move] || M.cfg.attacks[{ jab2: 'jab', jab3: 'jab', jabr: 'jab', dgrab: 'grab', pgrab: 'grab' }[a.move]] || M.cfg.attacks['*'];
      clipTime.flip = !!at.flip; clipTime.spin = at.spin || 0;
      return [at.clip, a.whole ? lerp(at.start, at.end, a.v) : a.seg === 0 ? lerp(at.start, at.contact[0], a.v) : a.seg === 1 ? lerp(at.contact[0], at.contact[1], a.v) : lerp(at.contact[1], at.end, a.v)];
    }
    const sp = M.cfg.clips[a.key] || M.cfg.clips.idle, clip = M.clips[sp.clip], from = sp.from || 0, to = sp.to !== undefined ? sp.to : clip.duration, span = Math.max(1e-3, to - from);
    if (sp.at !== undefined) return [sp.clip, sp.at];
    if (a.mode === 'loop') { const t = a.v * (sp.rate || 1); if (sp.bounce) { const u = t % (2 * span); return [sp.clip, from + (u < span ? u : 2 * span - u)]; } return [sp.clip, from + t % span]; }
    if (a.mode === 'cycle') return [sp.clip, from + frac(a.v) * span];
    return [sp.clip, from + clamp(a.v, 0, 1) * span];
  }
  function applyAnim(v, f) {
    clipTime.flip = false; clipTime.spin = 0; const M = v.model, a = animState(f), [name, time] = clipTime(M, a); v.turned = clipTime.flip;   /* some attacks are played facing backward */
    /* A spinning attack turns the whole model through its active frames (spin counts turns: 0.5 carries a forward strike
       round to the back) and completes the turn early in the recovery. Picture only: the hitboxes are fixed by the simulation. */
    v.spin = 0; if (clipTime.spin && a.key === 'attack' && a.seg > 0) { const s = clipTime.spin * Math.PI * 2, full = Math.ceil(clipTime.spin) * Math.PI * 2; v.spin = a.seg === 1 ? s * a.v : s + (full - s) * Math.min(1, a.v / 0.45); }
    if (!v.cur || v.cur.name !== name) { v.prev = v.cur; v.cur = { name, time, since: tick }; }
    v.cur.time = time;
    /* A change of action is instant in the game; only the picture eases across, over four steps. */
    const b = v.prev ? clamp((tick - v.cur.since + 1) / 4, 0, 1) : 1;
    const act = n => v.actions[n] || (v.actions[n] = v.mixer.clipAction(M.clips[n]).play());
    for (const n in v.actions) v.actions[n].setEffectiveWeight(0);
    const set = (c, w) => { const a = act(c.name); a.setEffectiveWeight(w); a.time = clamp(c.time, 0, a.getClip().duration - 1e-4); };
    if (v.prev && b < 1) set(v.prev, 1 - b);
    set(v.cur, v.prev && b < 1 ? b : 1);
    v.mixer.update(0);
    R3.anim = R3.anim || []; R3.anim[f.idx] = name + ' @ ' + time.toFixed(2) + 's';
  }

  /* ---- follow-through: tails, ears and ribbons lag behind the body and settle on their own ----
     Each listed bone keeps a simulated tip in world space that is pulled toward where the animation puts it. The bone is
     then turned to point at that tip. It is stepped once per game step, so freezing the game freezes it too. */
  const _inv = new THREE.Matrix4(), _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _q = new THREE.Quaternion(), _pq = new THREE.Quaternion(), _qd = new THREE.Quaternion();
  function setupSprings(v, M) {
    v.springs = (M.cfg.springs || []).map(c => ({ k: c.k || 0.3, d: c.d || 0.7, max: c.max || 1.0, drag: c.drag === undefined ? 0.12 : c.drag,
      links: c.bones.map(n => v.obj.getObjectByName(n)).filter(Boolean).map(b => ({ bone: b, dir: null, dv: new THREE.Vector3(), lastHead: null, tipLocal: null, animQ: null, setQ: null })) }));
    for (const ch of v.springs) ch.links.forEach((l, i) => { const next = ch.links[i + 1]; l.tipLocal = next ? next.bone.position.clone() : (i > 0 ? ch.links[i - 1].tipLocal.clone() : new THREE.Vector3(0, 0.2, 0)); });
    v.springTick = -1;
  }
  /* Each bone keeps the direction it is pointing, in world space. That direction is pulled toward where the animation
     points the bone, carries a little momentum, and is dragged back by how fast the bone's base is travelling, so a tail
     streams behind a run and swings through when the body stops. Each bone only reads its parent, never the reverse,
     so the motion always dies away. */
  function applySprings(v) {
    const step = tick !== v.springTick; v.springTick = tick;
    /* The animation system only rewrites a bone when its value changes, so put back the animated value where ours is still there. */
    for (const ch of v.springs) for (const l of ch.links) { if (l.setQ && l.bone.quaternion.equals(l.setQ)) l.bone.quaternion.copy(l.animQ); else l.animQ = l.bone.quaternion.clone(); }
    v.root.updateMatrixWorld(true); _inv.copy(v.obj.matrixWorld).invert();
    for (const ch of v.springs) for (const l of ch.links) {
      const b = l.bone, head = new THREE.Vector3().setFromMatrixPosition(b.matrixWorld), want = l.tipLocal.clone().applyMatrix4(b.matrixWorld);
      const len = Math.max(1e-4, want.distanceTo(head)), aim = want.clone().sub(head).divideScalar(len);
      if (!l.dir || !l.lastHead || l.lastHead.distanceToSquared(head) > 400) { l.dir = aim.clone(); l.dv.set(0, 0, 0); l.lastHead = head.clone(); }   /* first frame, or a respawn */
      if (step) {
        const travel = head.clone().sub(l.lastHead); if (travel.lengthSq() > 9) travel.setLength(3);
        l.dv.addScaledVector(aim.clone().sub(l.dir), ch.k).multiplyScalar(ch.d);
        l.dir.add(l.dv).addScaledVector(travel, -ch.drag / len).normalize(); l.lastHead.copy(head);
        const off = aim.angleTo(l.dir); if (off > ch.max) { l.dir.copy(aim).lerp(l.dir, ch.max / off).normalize(); l.dv.multiplyScalar(0.5); }
      }
      /* Turn the bone inside the model's own space, where mirroring (Loom turning round) is only a change of position. */
      const h = head.clone().applyMatrix4(_inv), a = want.applyMatrix4(_inv).sub(h).normalize(), t = head.add(l.dir).applyMatrix4(_inv).sub(h).normalize();
      if (a.angleTo(t) > 1e-4) {
        _qd.setFromUnitVectors(a, t);
        _m.multiplyMatrices(_inv, b.matrixWorld).decompose(_p, _q, _s);
        _m.multiplyMatrices(_inv, b.parent.matrixWorld).decompose(_p, _pq, _s);
        b.quaternion.copy(_pq.invert().multiply(_qd.multiply(_q)));
      }
      l.setQ = b.quaternion.clone(); b.updateMatrixWorld(true);
    }
  }

  /* A layer over the clips for the fighters animated for it (manifest "feel"): whole-body squash and stretch on a spring,
     kicked when something happens (landing hard, taking off, being hit, a strike landing), a lean into air movement, and a
     hit-freeze shake along the direction of the hit instead of side to side. Picture only. */
  function feelLayer(v, f, p) {
    const fe = v.fe || (v.fe = { s: 0, sv: 0, tick: -1, st: '', seg: -1, vy: 0, vx: 0 }), step = fe.tick !== tick; fe.tick = tick;
    if (step) {
      const s = f.state, a = f.state === 'attack' ? animState(f) : null, seg = a && a.mode === 'marks' ? a.seg : -1;
      if (s !== fe.st) {
        if (s === 'land' || s === 'wd') fe.sv += Math.min(0.32, 0.06 + Math.abs(fe.vy) * 0.045);   /* harder landings squash more */
        else if (s === 'air' && fe.st === 'jsq') fe.sv -= 0.14;                                       /* take-off stretch */
        else if (s === 'hurt') fe.sv -= 0.08 + Math.min(0.12, Math.hypot(f.vx, f.vy) * 0.02);
        else if (s === 'jsq') fe.sv += 0.1;
        fe.st = s;
      }
      if (seg === 1 && fe.seg === 0) fe.sv -= 0.1;   /* the strike: a snap of stretch as it lands */
      if (seg === 2 && fe.seg === 1) fe.sv += 0.06;   /* and a little settle afterwards */
      fe.seg = seg; fe.sv = (fe.sv - fe.s * 0.28) * 0.72; fe.s = clamp(fe.s + fe.sv, -0.3, 0.35); fe.vy = f.vy; fe.vx = f.vx;
    }
    const k = fe.s; p.sx *= 1 + k * 0.5; p.sy *= 1 - k;
    if (!f.grounded && (f.state === 'air' || f.state === 'helpless')) p.rot += clamp(f.vx * f.face * 0.06, -0.16, 0.16);   /* leans into drift */
    if (f.hitlag > 0 && f.state === 'hurt') { const m = Math.hypot(f.vx, f.vy) || 1, amp = 0.25 + Math.min(0.6, f.hitlag * 0.05), sg = (tick & 1) ? 1 : -1; p.shx = sg * amp * f.vx / m * f.face; p.shy = sg * amp * f.vy / m; }
  }
  function poseOf(f, hasModel) {
    const h = f.st.h; let sx = 1, sy = 1, rot = 0, oy = 0;
    if (hasModel) {   /* a model animates itself; only whole-body spins and the swap shrink stay procedural */
      if (f.state === 'roll') return { sx, sy, rot: f.sf * 0.45 * f.rollDir * f.face, oy: h / 2 };
      if (f.state === 'hurt' && !f.grounded && f.tumble) return { sx, sy, rot: f.sf * 0.2, oy: h / 2 };
      if (f.state === 'attack' && f.move && f.move.spin && f.move.spinAt) return { sx, sy, rot: f.move.spinAt(f, f.mf), oy: FP };   /* Sling Spin and Catapult Cyclone: end over end round the rig's middle */
      if (f.state === 'attack' && f.move && f.move.swap) { const k = 1 - Math.sin(Math.min(1, f.mf / 34) * Math.PI) * 0.7; return { sx: k, sy: k, rot, oy }; }
      return { sx, sy, rot, oy };
    }
    if (f.state === 'jsq' || f.state === 'land') { sy = 0.8; sx = 1.12; } else if (f.state === 'dash' || f.state === 'run') rot = 0.18;
    else if (f.state === 'wd') { sy = 0.85; rot = -0.12 * Math.sign(f.vx * f.face); }
    else if (f.state === 'hurt' && !f.grounded) { rot = f.sf * 0.3; oy = h / 2; }
    else if (f.state === 'broken') rot = Math.sin(frame * 0.2) * 0.25;
    else if (f.state === 'roll') { rot = f.sf * 0.45 * f.rollDir * f.face; oy = h / 2; }
    else if (f.state === 'helpless') rot = 0.35;
    else if (f.state === 'attack' && f.move && f.move.swap) sx = sy = 1 - Math.sin(Math.min(1, f.mf / 34) * Math.PI) * 0.7;
    else if (f.state === 'attack' && f.move) rot = Math.sin(Math.min(1, f.mf / f.move.t) * Math.PI) * 0.22;
    else if (f.state === 'air') sy = 1 + clamp(Math.abs(f.vy) * 0.03, 0, 0.12);
    else if (f.state === 'idle' && f.ctl.c.ly < CROUCH_Y) { sy = 0.72; sx = 1.1; }
    else if (f.state === 'down') { sy = 0.45; sx = 1.25; }
    return { sx, sy, rot, oy };
  }

  /* ---- effects drawn in the scene: sparks, hit flashes, launch trails, KO bursts, drifting embers, far islands.
     Picture only: everything here reads the simulation and never writes to it. ---- */
  const dot = tex(64, 64, (c, w) => { const q = c.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); q.addColorStop(0, 'rgba(255,255,255,1)'); q.addColorStop(0.35, 'rgba(255,255,255,.55)'); q.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = q; c.fillRect(0, 0, w, w); });
  const glowMat = o => Object.assign({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }, o);
  /* sparks: the simulation's particles, as glowing points with a little depth */
  const SPARKS = 700, spPos = new Float32Array(SPARKS * 3), spCol = new Float32Array(SPARKS * 3), sparkGeo = new THREE.BufferGeometry(), spZ = new WeakMap();
  sparkGeo.setAttribute('position', new THREE.BufferAttribute(spPos, 3)); sparkGeo.setAttribute('color', new THREE.BufferAttribute(spCol, 3));
  const sparks = new THREE.Points(sparkGeo, new THREE.PointsMaterial(glowMat({ size: 4.4, map: dot, vertexColors: true }))); sparks.frustumCulled = false; scene.add(sparks);
  const colCache = new Map(), colOf = s => { let c = colCache.get(s); if (!c) { const m = /^rgba?\(([^)]+)\)/.exec(s); c = new THREE.Color(); if (m) { const p = m[1].split(',').map(Number); c.setRGB(p[0] / 255, p[1] / 255, p[2] / 255, THREE.SRGBColorSpace); } else c.set(s); colCache.set(s, c); } return c; };
  /* a flash of light on each hit, so the fighters and the deck light up */
  const flashes = [0, 1].map(() => { const l = new THREE.PointLight(0xfff0d0, 0, 80, 2); l.userData.i = 0; scene.add(l); return l; });
  /* a ribbon of light behind a fighter that has been launched */
  const TR = 16;
  const trails = [0, 1].map(idx => {
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(TR * 6), 3)); geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(TR * 6), 3));
    const ix = []; for (let k = 0; k < TR - 1; k++) ix.push(k * 2, k * 2 + 1, k * 2 + 2, k * 2 + 1, k * 2 + 3, k * 2 + 2); geo.setIndex(ix);
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial(glowMat({ vertexColors: true, side: THREE.DoubleSide }))); mesh.frustumCulled = false; mesh.visible = false; scene.add(mesh);
    return { mesh, pts: [], col: new THREE.Color(PCOL[idx]), last: -1 };
  });
  /* the KO burst: a ring that swells from where the fighter left, and a flare pointing back at the stage */
  const beamTex = tex(64, 256, (c, w, h) => { const q = c.createLinearGradient(0, 0, w, 0); q.addColorStop(0, 'rgba(255,255,255,0)'); q.addColorStop(0.5, 'rgba(255,255,255,1)'); q.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = q; c.fillRect(0, 0, w, h); const f = c.createLinearGradient(0, 0, 0, h); f.addColorStop(0, 'rgba(0,0,0,1)'); f.addColorStop(0.14, 'rgba(0,0,0,0)'); f.addColorStop(1, 'rgba(0,0,0,1)');   /* soft at both ends */ c.globalCompositeOperation = 'destination-out'; c.fillStyle = f; c.fillRect(0, 0, w, h); });
  const bursts = [0, 1].map(idx => {
    const ring = new THREE.Sprite(new THREE.SpriteMaterial(glowMat({ map: dot, color: PCOL[idx] }))), core = new THREE.Sprite(new THREE.SpriteMaterial(glowMat({ map: dot, color: 0xffffff })));
    const beam = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).translate(0, -0.5, 0), new THREE.MeshBasicMaterial(glowMat({ map: beamTex, color: PCOL[idx], side: THREE.DoubleSide })));
    const light = new THREE.PointLight(PCOL[idx], 0, 420, 1.6); ring.visible = core.visible = beam.visible = false; scene.add(ring, core, beam, light);
    return { ring, core, beam, light, t0: -999, x: 0, y: 0, was: true };
  });
  /* depth: embers drifting down behind the stage, and three far islands with a lamp each */
  const EMB = 260, ePos = new Float32Array(EMB * 3), eVar = new Float32Array(EMB * 2);
  for (let k = 0; k < EMB; k++) { const dz = Math.random(); ePos[k * 3] = (Math.random() - 0.5) * 1700; ePos[k * 3 + 1] = -170 + Math.random() * 660; ePos[k * 3 + 2] = -45 - dz * dz * 760; eVar[k * 2] = 0.1 + Math.random() * 0.3; eVar[k * 2 + 1] = Math.random() * 6.28; }
  const emberGeo = new THREE.BufferGeometry(); emberGeo.setAttribute('position', new THREE.BufferAttribute(ePos, 3));
  const embers = new THREE.Points(emberGeo, new THREE.PointsMaterial(glowMat({ size: 3.6, map: dot, color: 0xff9a44, opacity: 0.8 }))); embers.frustumCulled = false; scene.add(embers);
  const rock = new THREE.MeshStandardMaterial({ color: 0x3b3152, roughness: 1, flatShading: true }), moss = new THREE.MeshStandardMaterial({ color: 0x4f5a4a, roughness: 1, flatShading: true });
  const islands = [[-250, 34, -230, 44, 70], [285, 78, -380, 62, 96], [-470, 128, -640, 84, 130]].map(([x, y, z, r, h], k) => {
    const g = new THREE.Group(), under = new THREE.Mesh(new THREE.ConeGeometry(r, h, 7), rock); under.rotation.x = Math.PI; under.position.y = -h / 2; g.add(under);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.96, r, r * 0.16, 7), moss); top.position.y = r * 0.08; g.add(top);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.02, r * 0.03, r * 0.5, 6), iron); post.position.set(r * 0.3, r * 0.4, 0); g.add(post);
    const lampGlow = new THREE.Sprite(new THREE.SpriteMaterial(glowMat({ map: dot, color: 0xffb866 }))); lampGlow.scale.set(r * 0.9, r * 0.9, 1); lampGlow.position.set(r * 0.3, r * 0.68, 0); g.add(lampGlow);
    g.position.set(x, y, z); g.rotation.y = k * 1.3; g.userData = { y, ph: k * 2.1 }; g.visible = false; scene.add(g); return g;   /* hidden: the painted backdrop has its own scenery now */
  });
  let fxTick = -1;
  function fxFighter(f, idx, st, alive, v) {
    /* hit flash: when the freeze of a hit begins */
    const lag = alive && f.hitlag > 0 && f.state === 'hurt';
    if (lag && !v.lagged && DBG.fx) { const l = flashes[idx]; l.position.set(f.x, f.y + st.h / 2, 12); l.userData.i = 700 + f.hitlag * 190; }   /* stronger hits freeze longer, so they flash brighter */
    v.lagged = lag;
    /* launch trail */
    const tr = trails[idx], fast = alive && f.state === 'hurt' && !f.grounded && Math.hypot(f.vx, f.vy) > 1.5;
    if (tick !== tr.last) {
      tr.last = tick; const cx = f.x, cy = f.y + st.h / 2, p0 = tr.pts[0];
      if (fast) { if (!p0 || Math.hypot(p0[0] - cx, p0[1] - cy) > 0.4) tr.pts.unshift([cx, cy]); } else tr.pts.pop();
      if (tr.pts.length > TR) tr.pts.length = TR;
    }
    const n = tr.pts.length; tr.mesh.visible = n > 1;
    if (n > 1) {
      const pos = tr.mesh.geometry.attributes.position, col = tr.mesh.geometry.attributes.color, wide = st.h * 0.36;
      for (let k = 0; k < TR; k++) {
        const q = Math.min(k, n - 1), a = tr.pts[Math.max(0, q - 1)], b = tr.pts[Math.min(n - 1, q + 1)], p = tr.pts[q];
        let dx = b[0] - a[0], dy = b[1] - a[1]; const len = Math.hypot(dx, dy) || 1; dx /= len; dy /= len;
        const w = k < n ? wide * (1 - q / n) : 0, br = k < n ? 0.75 * (1 - q / n) : 0;
        pos.setXYZ(k * 2, p[0] - dy * w, p[1] + dx * w, -1.5); pos.setXYZ(k * 2 + 1, p[0] + dy * w, p[1] - dx * w, -1.5);
        col.setXYZ(k * 2, tr.col.r * br, tr.col.g * br, tr.col.b * br); col.setXYZ(k * 2 + 1, tr.col.r * br, tr.col.g * br, tr.col.b * br);
      }
      pos.needsUpdate = true; col.needsUpdate = true;
    }
    /* KO burst: starts the moment the fighter is lost */
    const b = bursts[idx]; if (!alive && b.was) { b.t0 = tick; b.x = clamp(f.x, BLAST.l, BLAST.r); b.y = clamp(f.y, BLAST.b, BLAST.t); } b.was = alive;
  }
  function fxFrame() {
    const dt = fxTick < 0 ? 0 : Math.min(4, tick - fxTick); fxTick = tick;
    let n = 0;
    for (const p of PART) {
      if (n >= SPARKS) break; let z = spZ.get(p); if (z === undefined) { z = (Math.random() - 0.5) * 12; spZ.set(p, z); }
      const c = colOf(p.col), a = Math.min(1, p.life / 12) * Math.min(1.4, 0.5 + p.r * 0.5);
      spPos[n * 3] = p.x; spPos[n * 3 + 1] = p.y; spPos[n * 3 + 2] = 2 + z; spCol[n * 3] = c.r * a; spCol[n * 3 + 1] = c.g * a; spCol[n * 3 + 2] = c.b * a; n++;
    }
    sparkGeo.setDrawRange(0, n); sparkGeo.attributes.position.needsUpdate = true; sparkGeo.attributes.color.needsUpdate = true;
    for (const l of flashes) { l.intensity = l.userData.i; if (dt) l.userData.i *= Math.pow(0.7, dt); if (l.userData.i < 20) l.userData.i = 0; }
    for (const b of bursts) {
      const age = tick - b.t0, on = age >= 0 && age < 50; b.ring.visible = b.core.visible = b.beam.visible = on; b.light.intensity = 0;
      if (!on) continue; const k = age / 50, fade = Math.pow(1 - k, 1.6);
      b.ring.position.set(b.x, b.y, 4); b.ring.scale.setScalar(70 + 430 * Math.sqrt(k)); b.ring.material.opacity = fade * 0.9;
      b.core.position.set(b.x, b.y, 5); b.core.scale.setScalar(150 * (1 - k) + 20); b.core.material.opacity = fade;
      const ang = Math.atan2(30 - b.y, 0 - b.x); b.beam.position.set(b.x, b.y, 3); b.beam.rotation.z = ang + Math.PI / 2; b.beam.scale.set(26 + 70 * (1 - k), 300 + 260 * k, 1); b.beam.material.opacity = fade;
      b.light.position.set(clamp(b.x, -150, 150), clamp(b.y, -40, 120), 30); b.light.intensity = 26000 * fade;
    }
    if (dt) {
      for (let k = 0; k < EMB; k++) { let y = ePos[k * 3 + 1] - eVar[k * 2] * dt; if (y < -170) y += 660; ePos[k * 3 + 1] = y; ePos[k * 3] += Math.sin(tick * 0.013 + eVar[k * 2 + 1]) * 0.07 * dt; }
      emberGeo.attributes.position.needsUpdate = true;
    }
    for (const g of islands) g.position.y = g.userData.y + Math.sin(tick * 0.008 + g.userData.ph) * 2.2;
  }

  let lastW = 0, lastH = 0;
  R3.show = on => { glc.style.visibility = on ? 'visible' : 'hidden'; };
  R3.render = () => {
    const w = cv.width, h = cv.height;
    if (w !== lastW || h !== lastH) { renderer.setPixelRatio(1); renderer.setSize(w, h, false); lastW = w; lastH = h; }
    /* Camera: reproduces the 2D view exactly on the play plane (z = 0), so the HUD layer, hit sparks and debug boxes line up. */
    const s = cam.s, vH = H / s, d = (vH / 2) / Math.tan(THREE.MathUtils.degToRad(FOV / 2)), lift = d * LIFT;
    camera.position.set(cam.x - SHK.x / s, cam.y + (0.02 * H + SHK.y) / s + lift, d); camera.rotation.set(0, 0, 0);
    camera.setViewOffset(w, h, 0, lift / vH * h, w, h);
    /* backdrop: a third bigger than the view at its distance, centred on what the shifted lens sees, sliding a little against the camera */
    { const bd = camera.position.z + 2600, fh = 2 * bd * Math.tan(THREE.MathUtils.degToRad(FOV / 2)), k = 1.34;
      backdrop.scale.set(fh * k / 9, fh * k / 9, 1);
      backdrop.position.set(camera.position.x - cam.x * 0.35, camera.position.y - lift / vH * fh - (cam.y - 30) * 0.3 + fh * 0.05, -2600); }
    lamps.forEach((l, k) => { l.intensity = l.userData.i * (1 + Math.sin(frame * 0.31 + k * 2) * 0.07 + Math.sin(frame * 0.113 + k) * 0.05); });   /* forge and lantern flicker */

    F.forEach((f, idx) => {
      const v = fighters[idx], st = f.st, alive = f.state !== 'dead';
      fxFighter(f, idx, st, alive, v);
      if (v.prop && !alive) v.prop.visible = false;
      v.root.visible = alive; v.shield.visible = alive && (f.state === 'shield' || f.state === 'shieldstun'); v.pad.visible = f.state === 'respawn';
      if (!alive) return;
      dress(v, f);
      if (v.model) applyAnim(v, f);
      const p = poseOf(f, !!v.model), want = f.face > 0 ? -0.35 : Math.PI + 0.35;
      if (v.model && v.model.cfg.feel) feelLayer(v, f, p);
      v.yaw += (want - v.yaw) * 0.4;
      /* A fighter that faces the camera (Loom) is not turned side-on: it angles a little toward where it is heading and is
         mirrored to turn round, flipping through edge-on like a kite. Its clips treat +X as forward. */
      const flat = v.model && v.model.cfg.faceCamera;
      if (v.model && f.state === 'attack' && f.aim) { p.rot -= f.aim * 0.3 * (flat ? f.face : 1); p.oy = st.h * 0.55; }   /* an angled tilt leans the body up or down about the chest */
      if (flat) { v.flip += (f.face - v.flip) * 0.3; v.obj.scale.x = v.unit * (Math.abs(v.flip) < 0.08 ? 0.08 * (v.flip < 0 ? -1 : 1) : v.flip); }
      v.root.position.set(f.x, f.y, 0); v.root.rotation.y = (flat ? 0.55 * v.flip : v.yaw) + (v.model && v.turned ? Math.PI : 0) - (v.model ? (v.spin || 0) * f.face : 0);
      v.pivot.position.set(p.shx !== undefined ? p.shx : f.hitlag > 0 && f.state === 'hurt' ? ((tick & 1) ? 0.35 : -0.35) : 0, p.oy + (p.shy || 0), 0); v.pivot.rotation.z = -p.rot; v.pivot.scale.set(p.sx, p.sy, p.sx);
      v.pivot.children.forEach(c => { if (c.userData.y0 === undefined) c.userData.y0 = c.position.y; c.position.y = c.userData.y0 - p.oy; });
      const ghost = (f.invuln > 0 && (tick >> 1) % 2) || f.state === 'spot' || f.state === 'airdodge', hot = f.flash > 0 || (f.hitlag > 0 && f.state === 'hurt');
      for (const m of v.mats) { m.transparent = ghost; m.opacity = ghost ? 0.45 : 1; m.emissive.setHex(hot ? 0xffffff : 0x000000); m.emissiveIntensity = hot ? 0.8 : 0; }
      if (v.shield.visible) { const [sx, sy, r] = shieldCircle(f); v.shield.scale.setScalar(r); v.shield.position.set(sx, sy, 0); }
      if (v.pad.visible) v.pad.position.set(f.x, f.y - 0.8, 0);
      if (v.springs.length) applySprings(v);
      if (v.prop && !v.hand) {   /* the living slingshot under its bird: posed by slingWant, the bird riding in its pouch */
        const spinning = f.state === 'attack' && f.move && f.move.spin && f.move.spinAt, rot = spinning ? f.move.spinAt(f, f.mf) : 0, rig = v.prop.userData.rig, step = rig.tick !== tick; rig.tick = tick;
        v.prop.rotation.y = f.face > 0 ? 0 : Math.PI;
        if (spinning) { v.prop.rotation.z = -rot; v.prop.position.set(f.x - f.face * FP * Math.sin(rot), f.y + FP - FP * Math.cos(rot), 0); }   /* the handle swings round the same middle, opposite the bird */
        else { v.prop.position.set(f.x, f.y, 0); v.prop.rotation.z = 0; }
        v.prop.scale.set(1, 1, 1); v.prop.visible = true;
        const off = rig.drive(slingWant(f, rig), step);
        /* the bird rides the pouch: move it by the pouch's offset, carried into the fighter's own turned frame */
        if (v.obj && !spinning) {   /* the pouch's movement in the play plane, carried into the fighter's own turned frame (depth ignored) */
          const wo = new THREE.Vector3(off.x, off.y, off.z); rig.grp.localToWorld(wo); const w0 = new THREE.Vector3(); rig.grp.localToWorld(w0); wo.sub(w0); wo.z = 0; if (wo.length() > 3.5) wo.setLength(3.5);
          v.root.updateWorldMatrix(true, false); wo.applyMatrix3(new THREE.Matrix3().setFromMatrix4(v.root.matrixWorld).invert()); v.obj.position.set(wo.x * 0.85, (v.obj.userData.y0 !== undefined ? v.obj.userData.y0 : (v.model.cfg.lift || 0)) - p.oy + wo.y * 0.85, wo.z * 0.85); }   /* keeping the pivot's own height correction */
      } else if (v.prop) {
        v.root.updateWorldMatrix(true, true); v.hand.getWorldPosition(v.prop.position);
        v.prop.rotation.z = clamp(-f.vx * 0.12, -0.5, 0.5) + Math.sin(frame * 0.12 + idx) * 0.05;
        v.prop.userData.glow.material.opacity = 0.85 + Math.sin(frame * 0.37 + idx * 2) * 0.12; v.prop.visible = true;
      }
    });
    F.forEach((f, idx) => { let e = emptySlings[idx];   /* the empty slingshot, waiting for its bird: it recoils from the launch, then stands slack */
      if (f.sling && f.state !== 'dead') { if (!e) { e = emptySlings[idx] = makeSling(); scene.add(e); } const rig = e.userData.rig, step = rig.tick !== tick; rig.tick = tick;
        if (!e.visible) { rig.k = { bend: -0.5, px: 4, py: 2, sq: 0.1 }; rig.bend = 0; rig.px = rig.py = 0; }   /* just fired: the bands snap forward and the trunk whips back */
        e.position.set(f.sling.x, f.sling.y, 0); e.rotation.y = f.sling.face > 0 ? 0 : Math.PI; e.visible = true;
        const fr = tick, airborne = !f.sling.plat && f.sling.vy !== 0, lost = f.sling.lost > 0;
        rig.drive({ bend: Math.sin(fr * 0.05 + idx) * 0.06 + (lost ? 0.3 * Math.sin(fr * 0.3) : 0), sq: airborne ? 1.06 : 1, px: 0.6, py: airborne ? 1.5 : -1.8, feet: airborne ? [0.6, 0.6] : null }, step);
      } else if (e) e.visible = false; });
    for (let k = F.length; k < 2; k++) { if (emptySlings[k]) emptySlings[k].visible = false; }
    for (let k = F.length; k < 2; k++) { if (fighters[k].prop) fighters[k].prop.visible = false; fighters[k].root.visible = false; fighters[k].shield.visible = false; fighters[k].pad.visible = false; }

    for (const [p, m] of shots) if (!PROJ.includes(p)) { scene.remove(m); m.traverse(o => { if (o.geometry) o.geometry.dispose(); }); shots.delete(p); }   /* a shot may be a group of parts (the tape roll) */
    for (const p of PROJ) {
      let m = shots.get(p); if (!m || m.userData.kind !== p.kind) { if (m) { scene.remove(m); } m = shotMesh(p.kind); m.userData.kind = p.kind; shots.set(p, m); scene.add(m); }
      m.position.set(p.x, p.y, 0);
      if (p.kind === 'boulder' || p.kind === 'tape') { m.scale.setScalar(p.r); m.rotation.z = -(p.rot || 0); }
      else if (p.kind === 'dummy' || p.kind === 'clone' || p.kind === 'egg') { m.scale.setScalar(p.r); m.rotation.z = -frame * 0.3 * p.face; }
      else if (p.kind === 'pipmate') { m.position.y = p.y - 3; m.rotation.y = (p.vx || F[p.owner] && F[p.owner].face || 1) < 0 ? Math.PI : 0; m.visible = true;
        const u = m.userData, PM = MODELS['Pip alone'];
        if (u.mixer && PM && PM.ready) {   /* flying while it moves, its own idle when it stops; a hop when it turns round */
          const sp = Math.hypot(p.x - (u.lx === undefined ? p.x : u.lx), p.y - (u.ly === undefined ? p.y : u.ly)); u.lx = p.x; u.ly = p.y;
          const want = sp > 0.35 ? 'Fly' : 'Idle', t = frame / 60 + u.ph;
          for (const n of ['Fly', 'Idle']) { const c = PM.clips[n]; if (!c) continue; const a = u.acts[n] || (u.acts[n] = u.mixer.clipAction(c).play()); a.setEffectiveWeight(n === want ? 1 : 0); a.time = t % c.duration; }
          u.mixer.update(0); m.rotation.z = sp > 0.35 ? clamp((p.y - (u.py || p.y)) * 0.15, -0.5, 0.5) : 0; u.py = p.y;
        } }
      else if (p.kind === 'sackglow') { m.scale.setScalar(p.r * (1 + Math.sin(frame * 0.6) * 0.04)); m.material.opacity = 0.2 + Math.min(0.25, p.r / 200); }
      else if (p.kind === 'nest') { m.position.y = p.y - 1.8; m.scale.setScalar(1 + Math.sin(frame * 0.2) * 0.03); }
      else if (p.kind === 'gust') { m.rotation.y = Math.PI / 2; m.rotation.x = frame * 0.25; }
      else if (p.kind === 'flame') m.scale.set(p.r * 0.8, p.r * (1.1 + Math.sin(frame * 0.5) * 0.3), p.r * 0.8);
      else if (p.kind === 'ember') m.scale.setScalar(p.r * 0.75);
      else if (p.kind === 'bolt') m.scale.x = p.face;
    }
    fxFrame();
    renderer.render(scene, camera);
    R3.info = { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles };
  };
  R3.fighters = fighters;   /* for inspection from the console and tests; nothing in the game reads it */
  R3.fx = { bursts, trails, flashes, sparks, embers, islands };
  R3.ready = true;
}
