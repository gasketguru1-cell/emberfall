/* Emberfall 3D renderer (Three.js). It only reads the simulation: fighters, projectiles, camera. It never writes to it.
   A fighter with an entry in assets/manifest.json is drawn as its rigged model, posed every frame from the simulation's
   own frame counters (see anim.js). Fighters without a model yet are grey-box capsules. */
/* global W, H, TAU, clamp, MAIN, EDGE, PLATS, STAGES, STAGE_ON, BODY_H, RIM, DEPTH, SHOULDER, SHOULDER_IN, F, PROJ, cam, SHK, frame, tick, mode, cv, animState */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const glc = document.getElementById('gl');
const R3 = window.R3 = { ready: false, gpu: '', three: THREE.REVISION, show() {}, render() {}, info: null, models: {} };
const MODELS = R3.models;
let renderer = null;
try { renderer = new THREE.WebGLRenderer({ canvas: glc, antialias: true, stencil: true, powerPreference: 'high-performance' }); }
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

  /* ---- stage ---- */
  const stone = new THREE.MeshStandardMaterial({ color: 0x5b5560, roughness: 0.95, flatShading: true }), plain = new THREE.Group(); scene.add(plain);   /* plain: the stand-in stage shown until the island model has loaded */
  const bodyShape = new THREE.Shape([[-EDGE, 0], [EDGE, 0], [EDGE, -RIM], [EDGE - SHOULDER_IN, -SHOULDER], [0, -DEPTH], [-(EDGE - SHOULDER_IN), -SHOULDER], [-EDGE, -RIM]].map(p => new THREE.Vector2(p[0], p[1])));   /* the island's outline, the same as its collision in sim.js */
  const body = new THREE.Mesh(new THREE.ExtrudeGeometry(bodyShape, { depth: 44, bevelEnabled: false }), stone); body.position.z = -22; body.castShadow = body.receiveShadow = true; plain.add(body);
  const planks = tex(1024, 256, (g, w, h) => { g.fillStyle = '#b7a087'; g.fillRect(0, 0, w, h); for (let x = 0; x < w; x += 64) { g.fillStyle = (x / 64) % 2 ? 'rgba(0,0,0,.05)' : 'rgba(255,255,255,.04)'; g.fillRect(x, 0, 64, h); g.fillStyle = 'rgba(40,28,30,.55)'; g.fillRect(x, 0, 3, h); } for (let k = 0; k < 500; k++) { g.fillStyle = 'rgba(60,40,30,' + (Math.random() * 0.12).toFixed(3) + ')'; g.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 26, 1); } });
  planks.wrapS = planks.wrapT = THREE.RepeatWrapping; planks.repeat.set(2, 1);
  const deck = new THREE.Mesh(new THREE.BoxGeometry(EDGE * 2 + 4, 3, 48), new THREE.MeshStandardMaterial({ color: 0xffffff, map: planks, roughness: 0.82 })); deck.position.set(0, -1.5, 0); deck.castShadow = deck.receiveShadow = true; plain.add(deck);
  /* floating slabs: weathered stone with a copper band and a glowing ember line along the top edge */
  const slab = new THREE.MeshStandardMaterial({ color: 0x8a8079, roughness: 0.9, flatShading: true }), copper = new THREE.MeshStandardMaterial({ color: 0xa8623a, roughness: 0.45, metalness: 0.7 }), emberLine = new THREE.MeshStandardMaterial({ color: 0xffb060, emissive: 0xff8a30, emissiveIntensity: 2.4, roughness: 0.5 });
  const platGroup = new THREE.Group(); scene.add(platGroup);
  function buildPlats() { platGroup.traverse(o => { if (o.geometry) o.geometry.dispose(); }); platGroup.clear(); for (const p of PLATS) if (p.soft) {
    const w = p.x1 - p.x0, cx = (p.x0 + p.x1) / 2, g = new THREE.Group(); g.position.set(cx, p.y, 0); platGroup.add(g);
    const top = new THREE.Mesh(new THREE.BoxGeometry(w, 1.4, 15), slab); top.position.y = -0.7; top.castShadow = top.receiveShadow = true; g.add(top);
    const sh = new THREE.Shape([[-w / 2 + 1, 0], [w / 2 - 1, 0], [w / 2 - 4, -2.6], [-w / 2 + 4, -2.6]].map(q => new THREE.Vector2(q[0], q[1])));   /* the chamfered underside */
    const under = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 13, bevelEnabled: false }), slab); under.position.set(0, -1.4, -6.5); under.castShadow = true; g.add(under);
    const band = new THREE.Mesh(new THREE.BoxGeometry(w + 0.5, 0.7, 15.5), copper); band.position.y = -1.05; g.add(band);
    for (const z of [7.6, -7.6]) { const l = new THREE.Mesh(new THREE.BoxGeometry(w - 1, 0.28, 0.28), emberLine); l.position.set(0, -0.12, z); g.add(l); }
    for (const ex of [-w / 2, w / 2]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.28, 15), emberLine); l.position.set(ex, -0.12, 0); g.add(l); }
  } }
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

  /* ---- the stages (sim.js: STAGES). Each has a file that names its model and backdrop, places the model so its flat top is the
     floor and its rim the ledges, and may give its own look (sky, lights, platform colours). A stage is fetched the first time
     it is shown; until its model has arrived the plain stand-in shows. LOOK0 is the forge island's dawn. ---- */
  const LOOK0 = { sky: '#b4bcdc', fog: '#b7bedb', hemi: ['#cdd6ff', '#6b5a58', 0.8], key: ['#ffd9b0', 2.3], rim: ['#ffb7c8', 1.5], fill: ['#ffd9b0', 0.7], slab: '#8a8079', band: '#a8623a', line: ['#ffb060', '#ff8a30'], ember: '#ff9a44' };
  const byCfg = {}, SHOWN = STAGES.map(q => byCfg[q.cfg] || (byCfg[q.cfg] = { cfg: null, model: null, back: null, asked: false }));   /* stages that share a file share its model */ let shownStage = -1;
  function loadStage(k) {
    const S = SHOWN[k]; if (S.asked) return; S.asked = true;
    fetch(STAGES[k].cfg).then(r => r.ok ? r.json() : null).then(cfg => {
      if (!cfg) return; S.cfg = cfg; shownStage = -1;
      new THREE.TextureLoader().load(cfg.backdrop || 'assets/stage/export/backdrop.jpg', t => { t.colorSpace = THREE.SRGBColorSpace; S.back = t; shownStage = -1; });
      new GLTFLoader().load(cfg.file, g => {
        const m = g.scene; m.scale.set(cfg.scale[0], cfg.scale[1], cfg.scale[2]); m.position.set(cfg.offset[0], cfg.offset[1], cfg.offset[2]); m.rotation.y = (cfg.yaw || 0) * Math.PI / 180;
        m.traverse(o => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = true; o.frustumCulled = false; if (o.material) { o.material.envMapIntensity = 0.25;   /* takes the fighters' shadows; casts none itself, to keep the frame cheap */
          if (cfg.glow && o.material.map) { o.material.emissiveMap = o.material.map; o.material.emissive.set(cfg.glow[0]); o.material.emissiveIntensity = cfg.glow[1]; } } } });   /* lit from within by its own colours: bright lava shines, dark rock stays dark */
        m.visible = false; scene.add(m); S.model = m; shownStage = -1;
      }, undefined, e => console.warn('stage model failed to load; the plain stage stays', e));
    }).catch(() => {});
  }
  function applyStage() {
    const k = STAGE_ON, S = SHOWN[k]; loadStage(k); shownStage = k;
    const L = Object.assign({}, LOOK0, S.cfg && S.cfg.look);
    SHOWN.forEach(q => { if (q.model) q.model.visible = q === S; }); plain.visible = !S.model; R3.stage = S.model;
    backdrop.material.map = S.back; backdrop.material.color.set(S.back ? '#ffffff' : L.sky); backdrop.material.needsUpdate = true;
    scene.background.set(L.sky); scene.fog.color.set(L.fog);
    hemi.color.set(L.hemi[0]); hemi.groundColor.set(L.hemi[1]); hemi.intensity = L.hemi[2];
    key.color.set(L.key[0]); key.intensity = L.key[1]; rim.color.set(L.rim[0]); rim.intensity = L.rim[1]; fill.color.set(L.fill[0]); fill.intensity = L.fill[1];
    slab.color.set(L.slab); copper.color.set(L.band); emberLine.color.set(L.line[0]); emberLine.emissive.set(L.line[1]); embers.material.color.set(L.ember);
    /* the two warm lights: on the lamp posts while the stand-in shows, at the stage's own spots once its model is in */
    lamps.forEach((l, n) => { const q = S.model && S.cfg.lights && S.cfg.lights[n];
      if (q) { l.position.set(q.at[0], q.at[1], q.at[2]); l.color.set(q.color); l.userData.i = q.power; l.distance = q.reach; }
      else { l.position.set((n ? 1 : -1) * (EDGE - 10), 21, -9); l.color.set(0xffb866); l.userData.i = 2200; l.distance = 150; } });
    buildPlats();
  }

  /* ---- lights ---- */
  const hemi = new THREE.HemisphereLight(0xcdd6ff, 0x6b5a58, 0.8); scene.add(hemi);   /* dawn: cool sky above, warm rock below */
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
      if (cfg.axe) new GLTFLoader().load(cfg.axe.file, g => { M.axe = g.scene; }, undefined, e => console.warn('axe failed to load: ' + name, e));   /* Fyrdsman's axe on its own, drawn while it is thrown */
    }
  }).catch(e => console.warn('no model manifest', e));
  /* Props the owner made (2026-11-11): Sack's hot potato, Flint's ball of light, Chomp Chomp's coal on its rope (three parts:
     Loop, Cord, Coal) and Joey's steroid needle. Burning ones glow with their own colours. */
  const PROPS = {};
  const NEEDLE = { from: 0.5, to: 1.15, len: 3.2, z: 2.2 };   /* seconds into Grow it is in his hand; length in game units; how far in front of his middle it is kept */
  R3.NEEDLE = NEEDLE; R3.PROPS = PROPS;
  for (const [k, file, glow] of [['hotspud', 'assets/potato-sack/export/hot-potato.glb', 0.9], ['light', 'assets/flint/export/light-ball.glb', 1.3], ['coalrope', 'assets/chomp/export/coal-rope.glb', 0], ['needle', 'assets/joey/export/needle.glb', 0]])
    new GLTFLoader().load(file, g => { g.scene.traverse(q => { if (!q.isMesh) return; q.castShadow = true; q.frustumCulled = false;
        let hot = glow; for (let u = q; u; u = u.parent) if (k === 'coalrope' && u.name === 'Coal') hot = 1;
        if (hot && q.material && q.material.map) { q.material = q.material.clone(); q.material.emissiveMap = q.material.map; q.material.emissive = new THREE.Color(0xffffff); q.material.emissiveIntensity = hot; } });
      PROPS[k] = g.scene; }, undefined, e => console.warn('prop failed to load: ' + k, e));
  /* a prop (or one named part of it) centred on its middle and scaled so its longest side is 1 */
  function propOf(k, part) { const src = PROPS[k] && (part ? PROPS[k].getObjectByName(part) : PROPS[k]); if (!src) return null; const o = src.clone(true); o.position.set(0, 0, 0); o.updateMatrixWorld(true);
    const b = new THREE.Box3().setFromObject(o), c = b.getCenter(new THREE.Vector3()), d = b.getSize(new THREE.Vector3()), s = 1 / Math.max(d.x, d.y, d.z); o.scale.multiplyScalar(s); o.position.copy(c).multiplyScalar(-s); const g2 = new THREE.Group(); g2.add(o); return g2; }

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
    v.mixer = null; v.model = null; v.chomp = null; v.bubble = null; v.actions = {}; v.cur = null; v.prev = null; v.hand = null; v.springs = []; v.springTick = -1; v.jiggle = [];
    if (v.stick) { scene.remove(v.stick.grp); v.stick = null; }
    if (v.prop) { scene.remove(v.prop); v.prop = null; }
    if (useModel) {
      /* A copy of the loaded model with its own skeleton, scaled to the fighter's height and turned so its front is +x. */
      const obj = cloneSkinned(M.scene); obj.scale.setScalar(M.cfg.height / M.height); obj.rotation.y = M.cfg.faceCamera ? 0 : Math.PI / 2; v.mats = [];
      v.obj = obj; v.unit = M.cfg.height / M.height; v.flip = f.face;
      obj.traverse(o => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; o.frustumCulled = false; o.material = o.material.clone(); if (f.alt) o.material.color.setRGB(0.78, 0.9, 1.25); v.mats.push(o.material); } });
      v.pivot.add(obj); v.model = M; v.mixer = new THREE.AnimationMixer(obj); setupSprings(v, M); if (M.cfg.stickLegs) setupStickLegs(v, M);
      if (M.cfg.lift) obj.position.y = M.cfg.lift;   /* a rider: the model sits this high above the fighter's feet */
      if (M.cfg.prop && M.cfg.prop.type === 'sling') { v.prop = makeSling(); v.hand = null; scene.add(v.prop); if (/ alone/.test(prevKey)) v.prop.userData.rig.k = { py: -2.2, sq: -0.14, bend: 0.15 }; }   /* the bird drops back into the pouch: the bands take its weight */
      if (fm.name === 'Chomp Chomp') { const bubble = makeBubble(); bubble.position.y = 6; v.pivot.add(bubble); v.bubble = bubble; }   /* his Bubble Ride bubble */
      if (M.cfg.prop && M.cfg.prop.type === 'lantern') { v.hand = obj.getObjectByName(M.cfg.prop.bone) || null; if (v.hand) { v.prop = makeLantern(); scene.add(v.prop); } }
      return;
    }
    if (fm.name === 'Chomp Chomp') { buildChomp(v, col); return; }   /* built from simple shapes here until a generated model is made */
    const r = st.w * 0.45, len = Math.max(0.1, st.h - 2 * r);
    const mk = (geo, hex, x, y, z) => { const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(hex), roughness: 0.55 }); const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; v.pivot.add(m); v.mats.push(mat); return m; };
    v.mats = [];
    mk(new THREE.CapsuleGeometry(r, len, 8, 20), col[0], 0, st.h / 2, 0);
    mk(new THREE.BoxGeometry(r * 0.7, st.h * 0.16, r * 1.5), col[2], r * 0.72, st.h * 0.72, 0);          /* visor: shows which way it faces */
    mk(new THREE.TorusGeometry(r * 1.02, r * 0.14, 8, 24), col[1], 0, st.h * 0.42, 0).rotation.x = Math.PI / 2;   /* belt in the accent colour */
  }

  /* ---- projectiles ---- */
  /* The living slingshot (Furious Fowls): the owner's model, cut by tools/blender/slingshot.py into this puppet's own parts
     (trunk, fork, pouch, two bands, two feet) with its anchors, so the same code below moves it. Faces +x. Until the model has
     loaded, the puppet wears simple stand-in shapes, and every slingshot already made is dressed in the model when it arrives. */
  const emptySlings = [], SLING = { scene: null, waiting: [] };
  const dressSling = rig => {
    const S = SLING.scene, part = n => { const m = S.getObjectByName(n).clone(); m.castShadow = m.receiveShadow = true; m.frustumCulled = false; return m; }, at = n => S.getObjectByName(n).position.clone();
    for (const o of rig.stand) o.visible = false;
    rig.trunk.add(part('sling_trunk')); rig.fork.add(part('sling_fork'));
    rig.tips.forEach((tp, i) => tp.position.copy(at('tip' + i))); rig.seat.position.copy(at('seat'));
    rig.seatRest = rig.seat.position.clone().add(new THREE.Vector3(0, rig.trunk.position.y + rig.fork.position.y, 0)); rig.ends = [at('end0'), at('end1')];
    const pouch = new THREE.Group(); pouch.add(part('sling_pouch')); rig.grp.add(pouch); rig.pouch = pouch;
    rig.bands = [0, 1].map(i => { const m = part('sling_band' + i); rig.grp.add(m); return m; });
    rig.feet = rig.feet.map((old, i) => { const g = new THREE.Group(), m = part('sling_foot' + i); g.position.copy(old.position); m.position.copy(old.position).negate(); g.add(m); rig.grp.add(g); return g; });   /* stepping lifts each foot from where it stands */
  };
  new GLTFLoader().load('assets/fowls/export/slingshot-v2.glb', g => { SLING.scene = g.scene; SLING.waiting.forEach(dressSling); SLING.waiting.length = 0; },
    undefined, e => console.warn('slingshot model failed to load; the stand-in shapes stay', e));
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
    const stand = []; grp.traverse(o => { if (o.isMesh) stand.push(o); });   /* the stand-in shapes, hidden once the model is on */
    const rig = { grp, trunk, fork, tips, pouch, seat, bands, feet, stand, ends: null, bend: 0, bendV: 0, sq: 1, sqV: 0, px: 0, py: 0, pvx: 0, pvy: 0, tick: -1, lastVy: 0, lastState: '', lastKey: '', k: null, seatRest: null };
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
      rig.tips.forEach((tp, i) => { const a = tp.getWorldPosition(new THREE.Vector3()); rig.grp.worldToLocal(a); const b = c.clone().add(rig.ends ? rig.ends[i] : new THREE.Vector3(0.1, -0.6, i ? -1.4 : 1.4)), m = rig.bands[i];
        m.position.copy(a).add(b).multiplyScalar(0.5); m.scale.set(thinB, Math.max(0.1, a.distanceTo(b)), thinB); m.quaternion.setFromUnitVectors(unitY, b.clone().sub(a).normalize()); });
      return off;
    };
    if (SLING.scene) dressSling(rig); else SLING.waiting.push(rig);
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
  /* Chomp Chomp, built from simple shapes: a round blue body with a dark outline, a big mouth of triangular teeth on the
     front that opens when he bites, small beady eyes, stubby feet, little fins and a leaf sprout. Faces +x. */
  const makeBubble = () => { const b = new THREE.Mesh(new THREE.SphereGeometry(7.8, 24, 16), new THREE.MeshStandardMaterial({ color: 0xcfe8ff, transparent: true, opacity: 0.22, roughness: 0.05, metalness: 0.1, depthWrite: false })); b.visible = false; return b; };
  function buildChomp(v, col) {
    const M2 = (c, o) => { const m = new THREE.MeshStandardMaterial(Object.assign({ color: new THREE.Color(c), roughness: 0.55 }, o || {})); v.mats.push(m); return m; };
    const add = (geo, mat, x, y, z, sx, sy, sz) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); if (sx) m.scale.set(sx, sy, sz); m.castShadow = true; v.pivot.add(m); return m; };
    v.mats = []; const blue = M2(col[0]), dark = M2(new THREE.Color(col[0]).multiplyScalar(0.7).getHex()), ink = new THREE.MeshBasicMaterial({ color: 0x111111, side: THREE.BackSide });
    add(new THREE.SphereGeometry(5.2, 28, 20), blue, 0, 5.7, 0, 1, 0.98, 0.95);
    add(new THREE.SphereGeometry(5.2, 24, 16), ink, 0, 5.7, 0, 1.05, 1.03, 1.0).castShadow = false;   /* the outline */
    for (const z of [2, -2]) add(new THREE.SphereGeometry(1.8, 14, 10), dark, 0.5, 0.7, z, 1.15, 0.55, 0.8);   /* feet */
    for (const z of [5, -5]) add(new THREE.SphereGeometry(1.6, 12, 8), dark, -0.2, 4.6, z, 0.7, 0.45, 0.9).rotation.x = z > 0 ? -0.5 : 0.5;   /* fins */
    const mouth = new THREE.Group(); mouth.position.set(3.3, 4.8, 0); v.pivot.add(mouth);
    const red = M2(0x5a0f1c), tooth = M2(0xffffff, { roughness: 0.35 });
    const gap = new THREE.Mesh(new THREE.SphereGeometry(2.6, 18, 12), red); gap.scale.set(0.75, 0.55, 1.35); gap.position.set(0.6, 0, 0); mouth.add(gap);
    const upper = new THREE.Group(), lower = new THREE.Group(); mouth.add(upper, lower);
    for (let k = 0; k < 7; k++) { const z = -3 + k, t2 = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.1, 6), tooth); t2.position.set(1.9 - Math.abs(z) * 0.18, 0.75, z * 0.9); t2.rotation.z = Math.PI; upper.add(t2); }
    for (let k = 0; k < 4; k++) { const z = -1.5 + k, t2 = new THREE.Mesh(new THREE.ConeGeometry(0.38, 0.9, 6), tooth); t2.position.set(1.8 - Math.abs(z) * 0.2, -0.75, z * 0.95); lower.add(t2); }
    const eyeM = M2(0x0d0d0d, { roughness: 0.2 }), glint = new THREE.MeshBasicMaterial({ color: 0xffffff });
    for (const z of [1.1, -1.1]) { add(new THREE.SphereGeometry(0.5, 12, 8), eyeM, 4.45, 8.2, z); add(new THREE.SphereGeometry(0.16, 6, 4), glint, 4.85, 8.4, z + 0.12).castShadow = false; }
    const leaf = new THREE.Group(); leaf.position.set(0, 10.6, 0); v.pivot.add(leaf);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.24, 1.6, 6), M2(0x2f6b1e)); stem.position.y = 0.8; leaf.add(stem);
    for (const [x, rz, c2] of [[1.1, -0.5, col[1]], [-0.9, 0.6, new THREE.Color(col[1]).multiplyScalar(0.8).getHex()]]) { const l = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), M2(c2)); l.scale.set(1.3, 0.35, 0.7); l.position.set(x, 1.8, 0); l.rotation.z = rz; l.castShadow = true; leaf.add(l); }
    const bubble = new THREE.Mesh(new THREE.SphereGeometry(7.8, 24, 16), new THREE.MeshStandardMaterial({ color: 0xcfe8ff, transparent: true, opacity: 0.22, roughness: 0.05, metalness: 0.1, depthWrite: false }));
    bubble.position.y = 5.7; bubble.visible = false; v.pivot.add(bubble);
    v.chomp = { mouth, upper, lower, gap, leaf, bubble, open: 0.2 };
  }
  /* per frame: the mouth opens to bite, the leaf bobs and lags, the bubble shows. Picture only. */
  function poseChomp(v, f) {
    const c = v.chomp, a = f.state === 'attack' ? animState(f) : null;
    let want = 0.2 + Math.max(0, Math.sin(tick * 0.05)) * 0.08;
    if (a && a.mode === 'marks') want = a.seg === 0 ? 0.3 + 0.7 * a.v : a.seg === 1 ? 0.15 : 0.2 + 0.4 * (1 - a.v);   /* opens wide in the wind-up, snaps shut on the hit */
    if (f.state === 'attack' && f.mname === 'nspec') want = 0.9;
    if (f.state === 'hold' || f.state === 'throw') want = 0.1;
    if (f.state === 'hurt') want = 0.6;
    c.open += (want - c.open) * 0.45;
    c.lower.position.y = -c.open * 1.6; c.upper.position.y = c.open * 0.5; c.gap.scale.y = 0.35 + c.open * 0.6;
    c.leaf.rotation.z = Math.sin(tick * 0.15) * 0.12 - clamp(f.vx * f.face * 0.08, -0.35, 0.35) + (f.vy > 0.5 ? -0.15 : f.vy < -0.5 ? 0.2 : 0);
    c.bubble.visible = !!f.bubble; if (f.bubble) c.bubble.scale.setScalar(1 + Math.sin(tick * 0.3) * 0.03);
  }
  /* Chomp Chomp's ropes (from the simulation: chompRopes) drawn as thin cords; they never hit, so they never glow */
  const ropePool = [], ropeMat = new THREE.MeshStandardMaterial({ color: 0xb08a55, roughness: 0.9 }), hookMat = new THREE.MeshStandardMaterial({ color: 0x6b5a4a, roughness: 0.8 });
  const ROPE_TH = 12;   /* the model rope's thickness and loop size, x its own */
  function drawRopes() {
    const list = typeof chompRopes === 'function' ? chompRopes().slice() : [];
    for (const f of F) if (f.state === 'attack' && f.mname === 'sspec' && f.rsGo) { const cy = f.y + f.st.h / 2, dx = f.rsAx - f.x, dy = f.rsAy - cy, d = Math.hypot(dx, dy) || 1; list.push([f.rsAx, f.rsAy, f.x + dx / d * 4.2, cy + dy / d * 4.2, 'swing']); }   /* the rope he swings on, from its hook to his teeth */
    if (PROPS.coalrope && !ropePool.model) { for (const q of ropePool) scene.remove(q.cord, q.hook); ropePool.length = 0; ropePool.model = true; }   /* the owner's rope arrived: rebuild with it */
    while (ropePool.length < list.length) {
      let cord, hook;
      if (PROPS.coalrope) {   /* the model's cord runs along +X from its loop end (1.282 long): stretched along X to the rope's length; its loop sits at the hook */
        const c0 = PROPS.coalrope.getObjectByName('Cord').clone(true), l0 = PROPS.coalrope.getObjectByName('Loop').clone(true); c0.position.set(0, 0, 0); l0.position.set(0, 0, 0);
        cord = new THREE.Group(); cord.add(c0); cord.userData.model = true; hook = new THREE.Group(); hook.add(l0);
      } else { cord = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 1, 6), ropeMat); hook = new THREE.Mesh(new THREE.SphereGeometry(0.8, 8, 6), hookMat); }
      scene.add(cord, hook); ropePool.push({ cord, hook }); }
    ropePool.forEach((q, k) => { const r = list[k]; q.cord.visible = !!r; q.hook.visible = !!r && r[4] === 'swing'; if (!r) return;
      const a = new THREE.Vector3(r[0], r[1], 0), b = new THREE.Vector3(r[2], r[3], 0), len = Math.max(0.01, a.distanceTo(b));
      if (q.cord.userData.model) { const qu = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), b.clone().sub(a).normalize()), th = ROPE_TH;
        q.cord.position.copy(a); q.cord.quaternion.copy(qu); q.cord.scale.set(len / 1.282, th, th); q.hook.position.copy(a); q.hook.quaternion.copy(qu); q.hook.scale.setScalar(th); return; }
      q.cord.position.copy(a).add(b).multiplyScalar(0.5); q.cord.scale.set(1, len, 1); q.cord.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()); q.hook.position.copy(a); });
  }
  const shots = new Map();
  const shotMesh = kind => {
    if (kind === 'pipmate') { const M = MODELS['Pip alone']; if (M && M.ready) { const o = cloneSkinned(M.scene), g2 = new THREE.Group(); o.scale.setScalar(M.cfg.height * 0.8 / M.height); o.rotation.y = Math.PI / 2; o.traverse(q => { if (q.isMesh) { q.castShadow = true; q.frustumCulled = false; } }); g2.add(o); g2.userData.mixer = new THREE.AnimationMixer(o); g2.userData.acts = {}; g2.userData.ph = (shots.size % 3) * 0.37; return g2; }   /* Pip's companions animate too, each a little out of step */
      return new THREE.Mesh(new THREE.SphereGeometry(2.2, 12, 9), new THREE.MeshStandardMaterial({ color: 0x2bb8b0, roughness: 0.6 })); }
    if (kind === 'hotspud') { const m = propOf('hotspud'); if (m) return m; const f2 = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 9), e(0xff8a2a, 1.6)); f2.userData.wantProp = 'hotspud'; return f2; }   /* Potato Sack's flaming potato */
    if (kind === 'ember') { const m = propOf('light'); if (m) return m; const f2 = new THREE.Mesh(new THREE.SphereGeometry(0.25, 14, 10), e(0xffa040, 2.6)); f2.userData.wantProp = 'light'; return f2; }   /* Flint's ball of light: the head leads, the flames trail */
    if (kind === 'coal' && PROPS.coalrope) { const g2 = new THREE.Group(), m = propOf('coalrope', 'Coal');
      const glow2 = new THREE.Sprite(new THREE.SpriteMaterial({ map: dot, color: 0xffa040, transparent: true, opacity: 0.4, depthWrite: false, blending: THREE.AdditiveBlending })); glow2.scale.setScalar(6); g2.add(m, glow2); g2.userData.core = m; g2.userData.prop = 1; return g2; }   /* Chomp Chomp's hot coal, the owner's model */
    if (kind === 'coal') { const g2 = new THREE.Group(), m = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ color: 0xff8a2a, emissive: 0xff5a10, emissiveIntensity: 1.6, roughness: 0.7, flatShading: true }));
      const glow2 = new THREE.Sprite(new THREE.SpriteMaterial({ map: dot, color: 0xffa040, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending })); glow2.scale.setScalar(5); m.castShadow = true; g2.add(m, glow2); g2.userData.core = m; return g2; }   /* Chomp Chomp's hot coal */
    if (kind === 'ant') { const g2 = new THREE.Group(), red = new THREE.MeshStandardMaterial({ color: 0xc2402a, roughness: 0.5 }), legM = new THREE.MeshStandardMaterial({ color: 0x2a1a14 });
      for (const [x, r] of [[-1.1, 0.8], [0, 0.6], [1.1, 0.75]]) { const b = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), red); b.position.x = x; b.castShadow = true; g2.add(b); }
      g2.userData.legs = []; for (const x of [-0.5, 0, 0.5]) for (const z of [0.6, -0.6]) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.1, 4), legM); l.position.set(x, -0.5, z); l.rotation.x = z > 0 ? 0.6 : -0.6; g2.add(l); g2.userData.legs.push(l); }
      for (const z of [0.25, -0.25]) { const an = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1, 4), legM); an.position.set(1.6, 0.6, z); an.rotation.z = -0.7; g2.add(an); }
      return g2; }   /* Chomp Chomp's ant */
    if (kind === 'sackglow') { const m = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, opacity: 0.28, depthWrite: false })); return m; }   /* Potato Sack's swelling Spud Bomb */
    if (kind === 'nest') { const g2 = new THREE.Group(), twig = new THREE.MeshStandardMaterial({ color: 0x8a6a3e, roughness: 0.9 }); const ring = new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.9, 6, 14), twig); ring.rotation.x = Math.PI / 2; g2.add(ring);
      const egg = new THREE.Mesh(new THREE.SphereGeometry(1.2, 12, 9), new THREE.MeshStandardMaterial({ color: 0xf4ead8, roughness: 0.5 })); egg.scale.set(0.8, 1, 0.8); egg.position.y = 0.6; g2.add(egg); return g2; }
    const e = (hex, i) => new THREE.MeshStandardMaterial({ color: hex, emissive: hex, emissiveIntensity: i, roughness: 0.5 });
    if (kind === 'shaker') { const m = new THREE.Group(), body = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.4, 1.5, 12), new THREE.MeshStandardMaterial({ color: 0xe9eef3, roughness: 0.4 })), lid = new THREE.Mesh(new THREE.CylinderGeometry(0.47, 0.47, 0.35, 12), new THREE.MeshStandardMaterial({ color: 0x5a8fd8, roughness: 0.5 })); lid.position.y = 0.85; m.add(body, lid); return m; }
    if (kind === 'bolt') return new THREE.Mesh(new THREE.CapsuleGeometry(0.9, 4, 4, 10).rotateZ(Math.PI / 2), e(0xffe8a3, 2));
    if (kind === 'gust') return new THREE.Mesh(new THREE.TorusGeometry(4.5, 0.7, 8, 24), new THREE.MeshStandardMaterial({ color: 0xf0dcff, transparent: true, opacity: 0.55, depthWrite: false }));
    if (kind === 'boulder') { const m = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ color: 0x8d8794, roughness: 0.95, flatShading: true })); m.castShadow = true; return m; }
    if (kind === 'dummy' || kind === 'clone' || kind === 'egg') { const m = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 9), new THREE.MeshStandardMaterial({ color: kind === 'egg' ? 0xf4ead8 : kind === 'clone' ? 0x2bb8b0 : 0x8a623a, roughness: 0.7 })); if (kind === 'egg') m.scale.set(0.8, 1, 0.8); m.castShadow = true; return m; }   /* wooden ammunition, Pip's doubles, Pearl's egg */
    if (kind === 'tape') { const m = new THREE.Group(), rim = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.55, 18).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xd9c24a, roughness: 0.45, metalness: 0.5 })), hub = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.3, 0.62), new THREE.MeshStandardMaterial({ color: 0x4a4d57, roughness: 0.6 })); rim.castShadow = true; m.add(rim, hub); return m; }   /* Sprocket's tape roll: a steel reel with a dark bar across it, so its turning shows */
    if (kind === 'vaxe') {   /* Fyrdsman's thrown axe: his own axe model, turned about its balance point 0.85 m up the haft; mirrored by the pivot so the blade leads */
      const M = MODELS.Fyrdsman, g2 = new THREE.Group(), pivot = new THREE.Group(); g2.add(pivot); g2.userData.pivot = pivot;
      if (M && M.axe && M.ready) { const s = M.cfg.height / M.height, o = M.axe.clone(true); o.scale.setScalar(s); o.rotation.y = Math.PI / 2; o.position.y = -(M.cfg.axe.bal || 0.85) * s; o.traverse(q => { if (q.isMesh) { q.castShadow = true; q.frustumCulled = false; } }); pivot.add(o); g2.userData.s = s; }
      else { const b = new THREE.Mesh(new THREE.BoxGeometry(0.8, 13, 0.8), new THREE.MeshStandardMaterial({ color: 0x5a3a24 })), hd = new THREE.Mesh(new THREE.BoxGeometry(3, 3.4, 0.5), new THREE.MeshStandardMaterial({ color: 0x9aa4ae, metalness: 0.6 })); hd.position.set(1.5, 4.5, 0); pivot.add(b, hd); g2.userData.s = 8.4; }
      return g2;
    }
    return new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), e(0xffa040, 2.6));   /* ember and flame */
  };

  /* ---- animation: the simulation says which action and which frame; this only poses the model to match ---- */
  const lerp = (a, b, t) => a + (b - a) * t, frac = x => x - Math.floor(x);
  function clipTime(M, a) {
    let alt = a.alt; while (alt && alt.fb && !(M.cfg.clips[alt.key] && M.clips[M.cfg.clips[alt.key].clip])) alt = alt.fb;   /* fb: what to show when this model has no clip for the variant */
    const as = alt && M.cfg.clips[alt.key], ac = as && M.clips[as.clip];
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
    if (a.mode === 'cycle') return [sp.clip, from + frac(sp.stride && a.d !== undefined ? a.d / sp.stride : a.v) * span];   /* stride: the ground one cycle of this model's clip covers, so its planted feet stay put */
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
    const bn = (M.cfg.blendIn && M.cfg.blendIn[name]) || 4, b = v.prev ? clamp((tick - v.cur.since + 1) / bn, 0, 1) : 1;   /* blendIn: a longer ease into some clips (a heavy fighter settling back to his guard) */
    const act = n => v.actions[n] || (v.actions[n] = v.mixer.clipAction(M.clips[n]).play());
    for (const n in v.actions) v.actions[n].setEffectiveWeight(0);
    const set = (c, w) => { const a = act(c.name); a.setEffectiveWeight(w); a.time = clamp(c.time, 0, a.getClip().duration - 1e-4); };
    if (v.prev && b < 1) set(v.prev, 1 - b);
    set(v.cur, v.prev && b < 1 ? b : 1);
    v.mixer.update(0);
    R3.anim = R3.anim || []; R3.anim[f.idx] = name + ' @ ' + time.toFixed(2) + 's';
  }

  /* Fyrdsman's axe has three places, and is drawn in exactly one of them (or none):
     - in his hand: the axe part of his own mesh (skinned to the "axe" bone), only inside an axe move between the clip times
       the manifest gives it (axe.armed: { clip: [draw, stow] }), where the clip has his hand at his back to take it or put it back;
     - on his back: a copy of the axe model hung from his chest bone (axe.back: pommel, haft direction d and edge e in the
       model's own metres, the bind pose), the rest of the time;
     - thrown: the projectile (render of PROJ), while the game says it is away. Neither copy on him shows then.
     The hand's axe world pose is kept every frame, so a thrown axe can start from exactly where his hand let it go. */
  const _v3 = new THREE.Vector3(), _v4 = new THREE.Vector3();
  function axeShow(v, f) {
    const cfg = v.model.cfg.axe, M = v.model;
    if (v.axeObj !== v.obj) {
      v.axeObj = v.obj; v.axeBone = v.obj.getObjectByName(cfg.bone); v.axeMeshes = []; v.backAxe = null;
      let chest = null, bindInv = null;
      v.obj.traverse(o => {
        if (!o.isSkinnedMesh) return;
        const B = o.skeleton.bones, ai = B.indexOf(v.axeBone), si = o.geometry.attributes.skinIndex, sw = o.geometry.attributes.skinWeight;
        let n = 0; const m = Math.min(si.count, 200);
        for (let i = 0; i < m; i++) { let best = 0, bi = -1; for (let c = 0; c < 4; c++) { const w = sw.getComponent(i, c); if (w > best) { best = w; bi = si.getComponent(i, c); } } if (bi === ai) n++; }
        if (n > m * 0.9) v.axeMeshes.push(o);   /* the axe's own mesh: every vertex on the axe bone */
        else if (!chest) { const ci = B.findIndex(b => b.name === (cfg.backBone || 'chest')); if (ci >= 0) { chest = B[ci]; bindInv = o.skeleton.boneInverses[ci]; } }
      });
      if (chest && M.axe && cfg.back) {
        const bk = cfg.back, d = new THREE.Vector3(...bk.d).normalize(), e = new THREE.Vector3(...bk.e).normalize(), x = new THREE.Vector3().crossVectors(d, e).normalize();
        e.crossVectors(x, d).normalize();
        const mb = new THREE.Matrix4().makeBasis(x, d, e).setPosition(...bk.pommel);   /* the axe model: haft along +y from the pommel, edge +z */
        const local = bindInv.clone().multiply(mb);   /* from the model's bind space into the chest bone's own */
        const o = M.axe.clone(true); o.matrixAutoUpdate = false; o.matrix.copy(local); o.traverse(q => { if (q.isMesh) { q.castShadow = true; q.frustumCulled = false; } });
        chest.add(o); v.backAxe = o;
      }
    }
    const arm = cfg.armed && v.cur && cfg.armed[v.cur.name], inHand = !f.axeAway && !!arm && v.cur.time >= arm[0] && v.cur.time < arm[1];
    for (const m of v.axeMeshes) m.visible = inHand;
    if (v.backAxe) v.backAxe.visible = !f.axeAway && !inHand;
    if (inHand && v.axeBone) {   /* the balance point and the head's direction in the world, for the hand-off to a thrown axe */
      v.axeBone.updateMatrixWorld(true); const b = cfg.bal - cfg.hold;
      v.axeBone.localToWorld(_v3.set(0, b, 0)); v.axeBone.localToWorld(_v4.set(0, b + 1, 0)).sub(_v3);
      v.axeHand = { x: _v3.x, y: _v3.y, rot: Math.atan2(_v4.y, _v4.x), tick };
    }
  }

  /* While a fighter whose model says so (manifest carry) throws someone, the one held is drawn hanging from his hand
     (carry.bone, its feet carry.drop of their height below it) instead of at the game's own place; the difference eases
     in and out, so the release hands back to the game's place smoothly. The picture only: the game's positions decide the hit. */
  function carried(v, f, idx) {
    let tx = 0, ty = 0; const h = F[1 - idx], hv = fighters[1 - idx];
    if (f.state === 'held' && h && h.state === 'throw' && h.victim === f && hv && hv.model && hv.model.cfg.carry && hv.handW && tick - hv.handW.t <= 2) {
      tx = hv.handW.x - f.x; ty = hv.handW.y - f.st.h * hv.model.cfg.carry.drop - f.y; if (Math.hypot(tx, ty) > 16) tx = ty = 0; }
    const o = v.cOff || (v.cOff = { x: 0, y: 0 }); o.x += (tx - o.x) * 0.35; o.y += (ty - o.y) * 0.35;
    if (Math.abs(o.x) + Math.abs(o.y) > 0.01) { v.root.position.x += o.x; v.root.position.y += o.y; }
  }
  /* Fyrdsman's overlays, on top of whatever clip is playing (manifest overlays): the axe's weight landing in his hand when it
     comes home (his arm and chest dip and recover), and the Berserker roar held past the 8-frame move (head back, chest
     heaving, arms flung wide and shaking). Like the springs, a bone the mixer left alone this frame gets its clip value back
     before the overlay is added again. Axes are in the model's own frame (x his left, y up, z forward), degrees. */
  const _oq = new THREE.Quaternion(), _oa = new THREE.Vector3(), _ow = new THREE.Quaternion();
  function overlayBone(v, name, ax, ay, az, ang) {
    const o = v.ovl[name] || (v.ovl[name] = { b: v.obj.getObjectByName(name), setQ: null, animQ: null }); if (!o.b) return;
    if (!o.fresh) { if (o.setQ && o.b.quaternion.equals(o.setQ)) o.b.quaternion.copy(o.animQ); else o.animQ = o.b.quaternion.clone(); o.fresh = true; }
    if (Math.abs(ang) < 0.05) return;
    v.obj.getWorldQuaternion(_ow); _oa.set(ax, ay, az).applyQuaternion(_ow);   /* the model's axis in the world */
    o.b.updateWorldMatrix(true, false); o.b.getWorldQuaternion(_ow); _oa.applyQuaternion(_ow.invert()).normalize();   /* and in the bone's own frame */
    o.b.quaternion.multiply(_oq.setFromAxisAngle(_oa, ang * Math.PI / 180));
  }
  function fyrdOverlay(v, f) {
    if (v.ovlObj !== v.obj) { v.ovlObj = v.obj; v.ovl = {}; v.catchT = v.roarT = -999; }
    if (v.lastAway && !f.axeAway && f.state !== 'respawn' && f.state !== 'dead') v.catchT = tick;   /* the axe came home */
    v.lastAway = f.axeAway;
    if (f.state === 'attack' && f.mname === 'berserk') { if (!v.inRoar) { v.inRoar = true; v.roarT = tick - f.mf; } } else v.inRoar = false;   /* the roar began when the move did, however often frames are drawn */
    const u = (tick - v.catchT) / 14, c = u >= 0 && u < 1 ? Math.sin(Math.PI * u) * (1 - 0.3 * u) : 0;
    const r = tick - v.roarT, w = r < 8 ? 0 : r < 14 ? (r - 8) / 6 : r < 36 ? 1 : r < 46 ? 1 - (r - 36) / 10 : 0, rw = (f.state === 'idle' || f.state === 'attack') ? w : 0;
    for (const n in v.ovl) v.ovl[n].fresh = false;
    v.root.updateMatrixWorld(true);
    overlayBone(v, 'chest', 1, 0, 0, 7 * c - (14 + 5 * Math.sin(tick * 0.45)) * rw);   /* the chest heaving open */
    overlayBone(v, 'head', 1, 0, 0, -30 * rw);   /* the head thrown back */
    overlayBone(v, 'armR', 1, 0, 0, 24 * c + (34 + 4 * Math.sin(tick * 1.7 + 1)) * rw); overlayBone(v, 'foreR', 1, 0, 0, 12 * c);   /* the arms flung back, shaking (seen from the side, back is what shows) */
    overlayBone(v, 'armL', 1, 0, 0, (34 + 4 * Math.sin(tick * 1.9)) * rw);
    overlayBone(v, 'armL', 0, 0, 1, 18 * rw); overlayBone(v, 'armR', 0, 0, 1, -18 * rw);
    for (const n in v.ovl) { const o = v.ovl[n]; if (o.b) o.setQ = o.b.quaternion.clone(); }
  }

  /* ---- stick legs (manifest stickLegs): below the shorts the model's legs are a mesh of their own ("legs", cut by
     tools/blender/rig.py legcut). It is not drawn; one dark line per leg is, from the middle of the shorts' hem through the
     knee and ankle to the toes. During the moves listed (the kicks and stomps) the line gives way to an outline of the
     real legs: the leg mesh marks its shape in the stencil buffer without drawing, and a copy pushed out along its normals,
     drawn dark from behind, shows only where it is outside that shape. Picture only. */
  const _sa = new THREE.Vector3(), _sb = new THREE.Vector3(), _sy = new THREE.Vector3(0, 1, 0);
  function stickPoints(M, legs) {   /* once per model: where the hem's middle sits on each thigh, and the toes' tip on each toe */
    if (M.stick) return M.stick;
    const g = legs.geometry, P = g.attributes.position, SI = g.attributes.skinIndex, SW = g.attributes.skinWeight, idx = g.index, B = legs.skeleton.bones, out = {};
    const K = new Array(P.count); for (let i = 0; i < P.count; i++) K[i] = Math.round(P.getX(i) * 1e4) + ',' + Math.round(P.getY(i) * 1e4) + ',' + Math.round(P.getZ(i) * 1e4);
    const side = i => { let best = 0, bi = 0; for (let c = 0; c < 4; c++) { const w = SW.getComponent(i, c); if (w > best) { best = w; bi = SI.getComponent(i, c); } } return B[bi].name.endsWith('L') ? 'L' : 'R'; };
    /* the open edge of the leg mesh (welded across the texture seams): edges used by one triangle only */
    const uses = new Map();
    for (let t = 0; t < idx.count; t += 3) for (let e = 0; e < 3; e++) { const a = K[idx.getX(t + e)], b = K[idx.getX(t + (e + 1) % 3)], k = a < b ? a + '|' + b : b + '|' + a; uses.set(k, (uses.get(k) || 0) + 1); }
    const rim = new Set(); for (const [k, n] of uses) if (n === 1) { const [a, b] = k.split('|'); rim.add(a); rim.add(b); }
    const local = (name, p) => { const i = B.findIndex(b => b.name === name); return { bone: i, p: p.clone().applyMatrix4(legs.bindMatrix).applyMatrix4(legs.skeleton.boneInverses[i]) }; };
    for (const s of ['R', 'L']) {
      const tip = new THREE.Vector3(); let zt = -1e9; const seen = new Set();
      for (let i = 0; i < P.count; i++) { if (side(i) !== s) continue;
        if (rim.has(K[i])) seen.add(K[i]);
        if (P.getZ(i) > zt) { zt = P.getZ(i); tip.set(P.getX(i), P.getY(i), P.getZ(i)); } }
      /* the hem is the top of that edge: its highest third (anything open lower down, between the toes, is left out) */
      const pts = [...seen].map(k => k.split(',').map(x => +x / 1e4)).sort((a, b) => b[1] - a[1]), top = pts.slice(0, Math.max(1, Math.ceil(pts.length / 3)));
      const hem = new THREE.Vector3(); for (const [x, y, z] of top) hem.add(_sa.set(x, y, z)); hem.divideScalar(top.length);
      out[s] = { hem: local('thigh' + s, hem), knee: B.findIndex(b => b.name === 'shin' + s), ankle: B.findIndex(b => b.name === 'foot' + s), tip: local('toe' + s, tip) };
    }
    return (M.stick = out);
  }
  function setupStickLegs(v, M) {
    let legs = null; v.obj.traverse(o => { if (o.isSkinnedMesh && /^legs/.test(o.name)) legs = o; }); if (!legs) return;
    const c = M.cfg.stickLegs, col = new THREE.Color(c.color || '#161616'), mat = new THREE.MeshStandardMaterial({ color: col, roughness: 1 }); v.mats.push(mat);
    const grp = new THREE.Group(), seg = () => { const m = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 8), mat); m.castShadow = true; grp.add(m); return m; }, dot = () => { const m = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), mat); m.castShadow = true; grp.add(m); return m; };
    scene.add(grp);
    const thick = { value: 0 }, hullMat = new THREE.MeshStandardMaterial({ color: col, roughness: 1, side: THREE.BackSide, stencilWrite: true, stencilRef: 1, stencilFunc: THREE.NotEqualStencilFunc });
    hullMat.onBeforeCompile = sh => { sh.uniforms.outlineW = thick; sh.vertexShader = 'uniform float outlineW;\n' + sh.vertexShader.replace('#include <skinning_vertex>', '#include <skinning_vertex>\n  transformed += normalize( objectNormal ) * outlineW;'); };
    v.mats.push(hullMat);
    const fillMat = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, stencilWrite: true, stencilRef: 1, stencilFunc: THREE.AlwaysStencilFunc, stencilZPass: THREE.ReplaceStencilOp });
    const hull = new THREE.SkinnedMesh(legs.geometry, hullMat); hull.bind(legs.skeleton, legs.bindMatrix); hull.position.copy(legs.position); hull.quaternion.copy(legs.quaternion); hull.scale.copy(legs.scale);
    hull.frustumCulled = false; hull.renderOrder = 11; legs.renderOrder = 10; legs.castShadow = false; legs.parent.add(hull);
    const i = v.mats.indexOf(legs.material); if (i >= 0) v.mats.splice(i, 1);
    legs.material = fillMat;
    v.stick = { grp, legs, hull, thick, pts: stickPoints(M, legs), sides: ['R', 'L'].map(() => ({ segs: [seg(), seg(), seg()], dots: [dot(), dot(), dot(), dot()] })) };
  }
  function stickLegs(v, f) {
    const st = v.stick, c = v.model.cfg.stickLegs, outline = f.state === 'attack' && (c.moves || []).includes(f.mname);
    st.legs.visible = outline; st.hull.visible = outline; st.grp.visible = !outline;
    v.root.updateMatrixWorld(true);
    if (outline) { st.legs.getWorldScale(_sa); st.thick.value = (c.outline || 0.22) / Math.max(1e-6, _sa.x); return; }
    const B = st.legs.skeleton.bones, r = c.line || 0.3;
    st.sides.forEach((L, k) => { const p = st.pts[k ? 'L' : 'R'];
      const at = [p.hem.p.clone().applyMatrix4(B[p.hem.bone].matrixWorld), B[p.knee].getWorldPosition(new THREE.Vector3()), B[p.ankle].getWorldPosition(new THREE.Vector3()), p.tip.p.clone().applyMatrix4(B[p.tip.bone].matrixWorld)];
      L.dots.forEach((d, i) => { d.position.copy(at[i]); d.scale.setScalar(r); });
      L.segs.forEach((m, i) => { _sa.copy(at[i]); _sb.copy(at[i + 1]); const len = _sa.distanceTo(_sb); m.position.copy(_sa).add(_sb).multiplyScalar(0.5); m.scale.set(r, Math.max(1e-3, len), r);
        m.quaternion.setFromUnitVectors(_sy, _sb.sub(_sa).normalize()); }); });
  }

  /* ---- follow-through: tails, ears and ribbons lag behind the body and settle on their own ----
     Each listed bone keeps a simulated tip in world space that is pulled toward where the animation puts it. The bone is
     then turned to point at that tip. It is stepped once per game step, so freezing the game freezes it too. */
  const _inv = new THREE.Matrix4(), _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _q = new THREE.Quaternion(), _pq = new THREE.Quaternion(), _qd = new THREE.Quaternion();
  function setupSprings(v, M) {
    /* "tip": where the last bone ends, in its own axes (tools/addbones.mjs writes it); without it the last bone is taken to
       be as long as the one before it */
    v.springs = (M.cfg.springs || []).map(c => ({ k: c.k || 0.3, d: c.d || 0.7, max: c.max || 1.0, drag: c.drag === undefined ? 0.12 : c.drag, tip: c.tip,
      links: c.bones.map(n => v.obj.getObjectByName(n)).filter(Boolean).map(b => ({ bone: b, dir: null, dv: new THREE.Vector3(), lastHead: null, tipLocal: null, animQ: null, setQ: null })) }));
    for (const ch of v.springs) ch.links.forEach((l, i) => { const next = ch.links[i + 1]; l.tipLocal = next ? next.bone.position.clone() : ch.tip ? new THREE.Vector3(...ch.tip) : (i > 0 ? ch.links[i - 1].tipLocal.clone() : new THREE.Vector3(0, 0.2, 0)); });
    v.springTick = -1;
    /* jiggle (manifest "jiggle"): soft flesh that slides behind the bone the animation moves it with */
    v.jiggle = (M.cfg.jiggle || []).map(c => ({ b: v.obj.getObjectByName(c.bone), k: c.k || 0.2, d: c.d || 0.8, max: c.max || 0.05, g: c.g === undefined ? 1 : c.g,
      off: new THREE.Vector3(), vel: new THREE.Vector3(), tv: new THREE.Vector3(), last: null, animP: null, setP: null })).filter(j => j.b);
  }
  /* Each jiggle bone keeps an offset from where the animation puts it, in world space. When the anchor moves (the
     fighter running, landing, being hit, or the clip itself throwing the body about) the flesh is left behind by that much
     and springs back, overshooting and wobbling until it settles. The offset is eased off toward its limit so it never
     tears away. Stepped once per game step, like the springs. */
  const _jw = new THREE.Vector3(), _jd = new THREE.Vector3();
  function applyJiggle(v) {
    const step = tick !== v.jiggleTick; v.jiggleTick = tick;
    for (const j of v.jiggle) { if (j.setP && j.b.position.equals(j.setP)) j.b.position.copy(j.animP); else j.animP = j.b.position.clone(); }
    v.root.updateMatrixWorld(true);
    const scale = new THREE.Vector3().setFromMatrixScale(v.obj.matrixWorld), u = (Math.abs(scale.x) + scale.y + scale.z) / 3;
    for (const j of v.jiggle) {
      j.b.updateWorldMatrix(true, false); _jw.setFromMatrixPosition(j.b.matrixWorld);
      if (!j.last || j.last.distanceToSquared(_jw) > 400) { j.last = _jw.clone(); j.off.set(0, 0, 0); j.vel.set(0, 0, 0); j.tv.set(0, 0, 0); }
      const lim = j.max * u;
      if (step) {
        _jd.copy(_jw).sub(j.last); j.last.copy(_jw);
        const acc = _jd.clone().sub(j.tv); j.tv.copy(_jd); if (acc.lengthSq() > 16) acc.setLength(4);   /* the anchor speeding up or stopping, not steady travel */
        j.vel.addScaledVector(acc, -j.g).addScaledVector(j.off, -j.k).multiplyScalar(j.d); j.off.add(j.vel);
        if (j.off.length() > lim * 2.5) { j.off.setLength(lim * 2.5); j.vel.multiplyScalar(0.5); }
      }
      const n = j.off.length();
      if (n > 1e-5) {
        _jd.copy(j.off).multiplyScalar(lim * Math.tanh(n / lim) / n).add(_jw);
        j.b.parent.worldToLocal(_jd); j.b.position.copy(_jd); j.b.updateMatrixWorld(true);
      }
      j.setP = j.b.position.clone();
    }
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
      if (f.state === 'attack' && f.mname === 'sspec' && f.rsGo && f.rsTh !== undefined) return { sx, sy, rot: -f.rsTh * f.face, oy: h / 2 };   /* Chomp Chomp hanging from his rope: turned to lie along it */
      if (f.state === 'hurt' && !f.grounded && f.tumble) return { sx, sy, rot: f.sf * 0.2, oy: h / 2 };
      if (f.state === 'attack' && f.move && f.move.spin && f.move.spinAt) return { sx, sy, rot: f.move.spinAt(f, f.mf), oy: FP };   /* Sling Spin and Catapult Cyclone: end over end round the rig's middle */
      if (f.state === 'attack' && f.move && f.move.drill) {   /* Potato Sack's Spud Drill: tips flat with his top pointing backward, then spins along his length */
        const n = f.mf, k = n < 6 ? n / 6 : n <= 32 ? 1 : Math.max(0, 1 - (n - 32) / 6), sp = n < 6 ? n * n * 0.05 : n <= 32 ? 1.8 + (n - 6) * 0.95 + (f.hitlag > 0 ? tick * 0.6 : 0) : 26.5 + (n - 32) * 0.4;
        return { sx: 1 - 0.12 * k, sy: 1 + 0.18 * k, rot: -Math.PI / 2 * k, oy: h / 2, drill: sp * k }; }
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
  /* A blade's arc (a model with cfg.blade: Brand). While any of a move's sword hits is out (from the first active frame of
     its blade hits to the last, gaps included), the path the blade has swept since just before that first frame stays on
     screen as a glowing ribbon, with a red spot on the point; after the last active frame it fades over a few steps. Read
     from the model's own sword bones, so it follows the sword as drawn. Hits marked nb (the hilt, the door) draw none. */
  const ARC = 120, ARC_SUB = 5, ARC_LEAD = 3, ARC_FADE = 7, bladeSpans = new WeakMap();
  const spanOf = m => { if (!bladeSpans.has(m)) { const hs = (m.h || []).filter(h => !h.grab && !h.nb && h.d > 0); bladeSpans.set(m, hs.length ? [Math.min(...hs.map(h => h.f0)), Math.max(...hs.map(h => h.f1))] : null); } return bladeSpans.get(m); };
  const arcs = [0, 1].map(() => {
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(ARC * 6), 3)); geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(ARC * 8), 4));   /* with alpha: the swing fades toward its start */
    const ix = []; for (let k = 0; k < ARC - 1; k++) ix.push(k * 2, k * 2 + 1, k * 2 + 2, k * 2 + 1, k * 2 + 3, k * 2 + 2); geo.setIndex(ix);
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, side: THREE.DoubleSide, depthTest: false, depthWrite: false, fog: false }));   /* not additive: it stays forge-coloured against a bright sky */ mesh.frustumCulled = false; mesh.visible = false; mesh.renderOrder = 5; scene.add(mesh);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), new THREE.MeshBasicMaterial({ color: 0xff1414, transparent: true, depthTest: false, fog: false })); tip.renderOrder = 7; tip.visible = false; scene.add(tip);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial(glowMat({ map: dot, color: 0xff2020, depthTest: false }))); halo.renderOrder = 6; halo.visible = false; scene.add(halo);
    return { mesh, tip, halo, s: [], key: '', mf: -1, fade: 0, last: -1, bones: null, boneKey: '' };
  });
  const hideArc = idx => { const A = arcs[idx]; A.mesh.visible = A.tip.visible = A.halo.visible = false; A.s = []; A.fade = 0; A.key = ''; };
  const _aq = new THREE.Quaternion(), _aq0 = new THREE.Quaternion(), _d0 = new THREE.Vector3(), _d1 = new THREE.Vector3();
  function bladeArc(v, f, idx) {
    const A = arcs[idx], B = v.model && v.model.cfg.blade;
    if (!B || !v.obj) { if (A.key || A.mesh.visible || A.tip.visible) hideArc(idx); return; }
    if (A.boneKey !== v.key) { A.boneKey = v.key; A.bones = [v.obj.getObjectByName(B.base), v.obj.getObjectByName(B.tip)]; }
    if (!A.bones[0] || !A.bones[1]) return;
    const m = f.state === 'attack' ? f.move : null, span = m ? spanOf(m) : null;
    if (span && (A.key !== f.mname || f.mf < A.mf)) { A.s = []; A.key = f.mname; A.fade = 0; }   /* a new swing */
    A.mf = span ? f.mf : -1;
    const live = !!span && f.mf >= span[0] - ARC_LEAD && f.mf <= span[1], out = live && f.mf >= span[0];
    v.root.updateMatrixWorld(true);
    const grip = new THREE.Vector3().setFromMatrixPosition(A.bones[0].matrixWorld), point = new THREE.Vector3().setFromMatrixPosition(A.bones[1].matrixWorld), base = grip.clone().lerp(point, B.at || 0.2);
    if (live && tick !== A.last) { A.last = tick; const s0 = A.s[A.s.length - 1]; if (!s0 || s0.mf !== f.mf) A.s.push({ mf: f.mf, b: base.clone(), t: point.clone() }); }
    if (out) A.fade = ARC_FADE; else if (A.fade > 0 && tick !== A.last) { A.last = tick; A.fade--; }
    const k = out ? 1 : A.fade / ARC_FADE;
    if (k <= 0 || !A.s.length) { A.mesh.visible = A.tip.visible = A.halo.visible = false; if (!live) { A.s = []; if (!span) A.key = ''; } return; }
    /* the red point: on the sword while it is out, left where it ended while the arc fades */
    const tp = out ? point : A.s[A.s.length - 1].t, r = (B.dot || 0.6) * (out ? 1 : 0.6 + 0.4 * k);
    A.tip.visible = A.halo.visible = B.dot !== 0;   /* dot 0: an arc with no red point (Fyrdsman's axe) */ A.tip.position.copy(tp); A.tip.scale.setScalar(r); A.tip.material.opacity = k; A.halo.position.copy(tp); A.halo.scale.set(r * 6, r * 6, 1); A.halo.material.opacity = 0.9 * k;
    /* the ribbon: each recorded step, with the blade turned smoothly round its base between steps */
    const pts = [], S = out ? A.s.concat([{ b: base, t: point }]) : A.s;
    for (let i = 0; i < S.length; i++) {
      const a = S[i], b = S[i + 1]; pts.push([a.b, a.t]); if (!b) break;
      _d0.subVectors(a.t, a.b); _d1.subVectors(b.t, b.b); const l0 = _d0.length(), l1 = _d1.length(); _d0.normalize(); _d1.normalize(); _aq.setFromUnitVectors(_d0, _d1);
      for (let j = 1; j < ARC_SUB; j++) { const u = j / ARC_SUB, bb = a.b.clone().lerp(b.b, u); _aq0.identity().slerp(_aq, u); pts.push([bb, bb.clone().add(_d0.clone().applyQuaternion(_aq0).multiplyScalar(l0 + (l1 - l0) * u))]); }
    }
    while (pts.length > ARC) pts.shift();
    const n = pts.length; A.mesh.visible = n > 1; if (n < 2) return;
    const pos = A.mesh.geometry.attributes.position, col = A.mesh.geometry.attributes.color, hot = new THREE.Color(B.col || 0xffb45a), cool = new THREE.Color(B.col2 || 0xff5a1e);
    for (let i = 0; i < ARC; i++) {
      const q = Math.min(i, n - 1), pb = pts[q][0], pt = pts[q][1], age = 1 - q / (n - 1), al = k * (0.92 - 0.35 * age);   /* the newest part strongest; the start of the swing stays visible */
      pos.setXYZ(i * 2, pb.x, pb.y, pb.z); pos.setXYZ(i * 2 + 1, pt.x, pt.y, pt.z);
      col.setXYZW(i * 2, cool.r, cool.g, cool.b, al * 0.5); col.setXYZW(i * 2 + 1, hot.r, hot.g, hot.b, al);
    }
    pos.needsUpdate = true; col.needsUpdate = true;
  }
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
  /* Fyrdsman's fire (his atlas, II / RENDERING): embers that start on his bones and his axe and drift up in the world. In
     Berserker, wisps round his chest, shoulders, head and greaves, and fire on whatever strikes (the axe's blade, a fist or a
     boot) through each hit's frames; the meteor charge burns at the shoulder always, hotter in Berserker; the flying axe
     always trails embers, most when it homes. Picture only, from bones and the axe's place: nothing here touches a hitbox.
     At most FIRE embers on screen; switched off with the hit effects (the reduced-flash setting). */
  const FIRE = 520, fPos = new Float32Array(FIRE * 3), fCol = new Float32Array(FIRE * 3), fireGeo = new THREE.BufferGeometry(), fire = [];
  fireGeo.setAttribute('position', new THREE.BufferAttribute(fPos, 3)); fireGeo.setAttribute('color', new THREE.BufferAttribute(fCol, 3));
  const firePts = new THREE.Points(fireGeo, new THREE.PointsMaterial(glowMat({ size: 3.4, map: dot, vertexColors: true }))); firePts.frustumCulled = false; firePts.renderOrder = 4; scene.add(firePts);
  const _fp = new THREE.Vector3();
  function emit(p, n, spread, hot, vx, vy) {
    if (!p) return;
    for (let k = 0; k < n; k++) { if (fire.length >= FIRE) fire.shift(); const life = 12 + Math.random() * 14;
      fire.push({ x: p.x + (Math.random() - 0.5) * spread, y: p.y + (Math.random() - 0.5) * spread, z: p.z + (Math.random() - 0.5) * spread * 0.6, vx: (vx || 0) + (Math.random() - 0.5) * 0.18, vy: 0.08 + Math.random() * 0.14 + (vy || 0), life, max: life, hot }); }
  }
  function fireFighter(f, idx, v) {
    const cfg = v.model && v.model.cfg.fire; if (!cfg || !DBG.fx || !v.obj || f.state === 'dead') return;
    if (v.fireTick === tick) return; v.fireTick = tick;
    if (v.fireKey !== v.key) { v.fireKey = v.key; v.fireB = {}; }
    const at = n => { let b = v.fireB[n]; if (b === undefined) b = v.fireB[n] = v.obj.getObjectByName(n) || null; return b ? b.getWorldPosition(_fp).clone() : null; };
    const bz = !!f.berserk;
    if (bz) for (const n of cfg.aura) if (Math.random() < 0.4) emit(at(n), 1, 2.6, 0.55);
    if (f.state !== 'attack' || !f.move) return;
    const m = f.move;
    if (f.mname === 'sspec') { if (f.mf >= 6 && f.mf <= 44) emit(at(cfg.shoulder), bz ? 6 : 3, bz ? 3.4 : 2.4, bz ? 1 : 0.75, -f.face * (f.mf >= 15 ? 0.9 : 0.1), 0.02); return; }   /* the meteor: always red, a wake behind the shoulder once he flies */
    if ((f.mname === 'dspecHit' || f.mname === 'dspecHitE') && f.mf <= 8) { emit(at(cfg.fists[0]), bz ? 6 : 3, 2.5, 1, 0, 0.45); return; }   /* the counter's answer: fire up the launcher */
    if (!bz) return;
    for (const h of m.h) {
      if (h.grab || f.mf < h.f0 - 1 || f.mf > h.f1) continue;
      if (!h.nb && !f.axeAway) { const a = at(cfg.axe[0]), b = at(cfg.axe[1]); if (a && b) for (let k = 0; k < 4; k++) emit(a.clone().lerp(b, Math.random()), 1, 1.6, 1); }
      else { const hx = f.x + h.x * f.face, hy = f.y + h.y; let best = null, bd = 1e9; for (const n of cfg.fists.concat(cfg.feet)) { const p = at(n); if (p) { const d = Math.hypot(p.x - hx, p.y - hy); if (d < bd) { bd = d; best = p; } } } emit(best, 3, 1.8, 1); }
      break;
    }
  }
  function fireAxe(p) {
    if (!DBG.fx || p.st === 'stuck' && Math.random() > 0.08) return; const ow = F[p.owner], k = p.st === 'home' ? 6 : ow && ow.berserk ? 4 : 2;
    emit(_fp.set(p.x, p.y, 0).clone(), p.st === 'stuck' ? 1 : k, p.st === 'home' ? 3.6 : 2.6, p.st === 'home' ? 1 : 0.8, -(p.vx || 0) * 0.15, -(p.vy || 0) * 0.15);
  }
  function fireStep(dt) {
    let n = 0;
    for (let i = fire.length - 1; i >= 0; i--) { const q = fire[i]; q.life -= dt; if (q.life <= 0) { fire.splice(i, 1); continue; } q.x += q.vx * dt; q.y += q.vy * dt; q.vx *= Math.pow(0.94, dt); }
    for (const q of fire) { if (n >= FIRE) break; const u = q.life / q.max, a = Math.min(1, u * 1.6) * (0.55 + 0.45 * q.hot);
      fPos[n * 3] = q.x; fPos[n * 3 + 1] = q.y; fPos[n * 3 + 2] = q.z + 1; fCol[n * 3] = a; fCol[n * 3 + 1] = a * (0.12 + 0.5 * u * q.hot); fCol[n * 3 + 2] = a * 0.04 * u; n++; }   /* yellow-orange when new, dark red as it dies */
    fireGeo.setDrawRange(0, n); fireGeo.attributes.position.needsUpdate = true; fireGeo.attributes.color.needsUpdate = true;
  }
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
    fireStep(dt);
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

  /* ---- the final hit (finalhit.js): while the game is frozen, the island goes, the backdrop shows the red burst filling the
     view exactly, a red light comes from behind, and the view tilts ---- */
  const finalCv = document.createElement('canvas'); finalCv.width = 1280; finalCv.height = 720;
  const finalTex = new THREE.CanvasTexture(finalCv); finalTex.colorSpace = THREE.SRGBColorSpace;
  const finalLight = new THREE.DirectionalLight(0xff3a1e, 0); finalLight.position.set(0, 60, -160); scene.add(finalLight);
  let finalOn = false, bdMap = null, bdCol = null;
  function finalView(s, vH, lift) {
    const on = typeof finalT !== 'undefined' && finalT > 0 && !!FINAL && !!F[FINAL.v] && typeof finalBg === 'function';
    const world = [plain, embers, R3.stage, platGroup].filter(Boolean);
    if (on && !finalOn) { bdMap = backdrop.material.map; bdCol = backdrop.material.color.getHex(); backdrop.material.map = finalTex; backdrop.material.color.set(0xffffff); backdrop.material.needsUpdate = true; world.forEach(o => { o.userData.finalWas = o.visible; o.visible = false; }); scene.fog.far = 1e6; }
    if (!on && finalOn) { backdrop.material.map = bdMap; backdrop.material.color.setHex(bdCol); backdrop.material.needsUpdate = true; world.forEach(o => { if (o.userData.finalWas !== undefined) { o.visible = o.userData.finalWas; delete o.userData.finalWas; } }); scene.fog.far = 3600; backdrop.rotation.z = 0; finalLight.intensity = 0; }
    finalOn = on; if (!on) return;
    finalBg(finalCv.getContext('2d'), W, H, finalSpots()); finalTex.needsUpdate = true;
    const bd = camera.position.z + 2600, fh = 2 * bd * Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    backdrop.scale.set(fh * 1.06 / 9, fh * 1.06 / 9, 1); backdrop.position.set(camera.position.x, camera.position.y - lift / vH * fh, -2600); backdrop.rotation.z = FINAL_ROLL;   /* turns with the camera: the picture carries its own tilt */
    camera.rotation.z = FINAL_ROLL; finalLight.intensity = 4.5;
  }

  let lastW = 0, lastH = 0;
  R3.show = on => { glc.style.visibility = on ? 'visible' : 'hidden'; };
  R3.render = () => {
    const w = cv.width, h = cv.height;
    if (shownStage !== STAGE_ON) applyStage();
    if (w !== lastW || h !== lastH) { renderer.setPixelRatio(1); renderer.setSize(w, h, false); lastW = w; lastH = h; }
    /* Camera: reproduces the 2D view exactly on the play plane (z = 0), so the HUD layer, hit sparks and debug boxes line up. */
    const s = cam.s, vH = H / s, d = (vH / 2) / Math.tan(THREE.MathUtils.degToRad(FOV / 2)), lift = d * LIFT;
    camera.position.set(cam.x - SHK.x / s, cam.y + (0.02 * H + SHK.y) / s + lift, d); camera.rotation.set(0, 0, 0);
    camera.setViewOffset(w, h, 0, lift / vH * h, w, h);
    /* backdrop: a third bigger than the view at its distance, centred on what the shifted lens sees, sliding a little against the camera */
    { const bd = camera.position.z + 2600, fh = 2 * bd * Math.tan(THREE.MathUtils.degToRad(FOV / 2)), k = 1.34;
      backdrop.scale.set(fh * k / 9, fh * k / 9, 1);
      backdrop.position.set(camera.position.x - cam.x * 0.35, camera.position.y - lift / vH * fh - (cam.y - 30) * 0.3 + fh * 0.05, -2600); }
    finalView(s, vH, lift);
    lamps.forEach((l, k) => { l.intensity = l.userData.i * (1 + Math.sin(frame * 0.31 + k * 2) * 0.07 + Math.sin(frame * 0.113 + k) * 0.05); });   /* forge and lantern flicker */

    F.forEach((f, idx) => {
      const v = fighters[idx], st = f.st, alive = f.state !== 'dead';
      fxFighter(f, idx, st, alive, v);
      if (v.prop && !alive) v.prop.visible = false;
      v.root.visible = alive; v.shield.visible = alive && (f.state === 'shield' || f.state === 'shieldstun'); v.pad.visible = f.state === 'respawn';
      if (v.stick) v.stick.grp.visible = alive;
      if (!alive) { hideArc(idx); return; }
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
      v.pivot.position.set(p.shx !== undefined ? p.shx : f.hitlag > 0 && f.state === 'hurt' ? ((tick & 1) ? 0.35 : -0.35) : 0, p.oy + (p.shy || 0), 0); v.pivot.rotation.order = 'ZYX'; v.pivot.rotation.z = -p.rot; v.pivot.rotation.y = p.drill || 0; v.pivot.scale.set(p.sx, p.sy, p.sx);   /* ZYX: a drill spins about the body's own length, then the body is tipped */
      v.pivot.children.forEach(c => { if (c.userData.y0 === undefined) c.userData.y0 = c.position.y; c.position.y = c.userData.y0 - p.oy; });
      if (v.model && v.model.cfg.chargeShake && f.state === 'attack' && f.charge > 0) v.pivot.position.x += Math.sin(tick * 2.3) * v.model.cfg.chargeShake * Math.min(1, 0.4 + f.charge / 30);   /* a held smash trembles with the strain */
      carried(v, f, idx);
      if (v.model && v.model.cfg.overlays) fyrdOverlay(v, f);
      const ghost = (f.invuln > 0 && (tick >> 1) % 2) || f.state === 'spot' || f.state === 'airdodge', hot = (f.flash > 0 || (f.hitlag > 0 && f.state === 'hurt')) && !(typeof finalT !== 'undefined' && finalT > 0 && finalT < FINAL_FREEZE - 3);   /* the final-hit freeze shows the fighter, not a white flash */
      for (const m of v.mats) { m.transparent = ghost; m.opacity = ghost ? 0.45 : 1; m.emissive.setHex(hot ? 0xffffff : 0x000000); m.emissiveIntensity = hot ? 0.8 : 0; }
      if (v.shield.visible) { const [sx, sy, r] = shieldCircle(f); v.shield.scale.setScalar(r); v.shield.position.set(sx, sy, 0); }
      if (v.pad.visible) v.pad.position.set(f.x, f.y - 0.8, 0);
      if (v.chomp) poseChomp(v, f);
      if (v.bubble) { const on = !!f.bubble, grow = f.state === 'attack' && f.mname === 'uspec' && !on ? clamp((f.mf - 3) / 5, 0, 1) : 0;   /* it swells from his mouth as he blows, then wobbles round him; it sits round his middle whatever the pivot is doing */
        v.bubble.visible = on || grow > 0; v.bubble.scale.setScalar(on ? 1 + Math.sin(tick * 0.3) * 0.03 : 0.15 + 0.85 * grow); v.bubble.position.x = on ? 0 : 5 * (1 - grow); }
      if (v.jiggle && v.jiggle.length) applyJiggle(v);
      if (v.springs.length) applySprings(v);
      if (v.stick) stickLegs(v, f);
      if (v.model && v.model.cfg.axe) axeShow(v, f);
      if (v.model && v.model.cfg.carry) { const c = v.model.cfg.carry; if (v.carryObj !== v.obj) { v.carryObj = v.obj; v.carryB = v.obj.getObjectByName(c.bone); } if (v.carryB) { v.carryB.updateWorldMatrix(true, false); v.carryB.getWorldPosition(_v3); v.handW = { x: _v3.x, y: _v3.y, t: tick }; } }
      if (v.model && f.def.transform && !v.needleTried && PROPS.needle) { v.needleTried = true; v.needle = propOf('needle'); v.needle.visible = false; scene.add(v.needle); }   /* Joey's steroid needle, the owner's model */
      if (v.needle) {   /* in his right hand from the pocket to just after the jab */
        const sec = f.state === 'grow' && v.model === MODELS['Joey'] ? f.sf / 60 : -1, on = sec >= NEEDLE.from && sec <= NEEDLE.to;
        if (on && v.handKey !== v.model) { v.handKey = v.model; v.handR = v.obj.getObjectByName('handR'); }
        const hb = on ? v.handR : null; v.needle.visible = !!hb;
        /* his right hand is the far one from the camera, so the needle is kept just in front of his body and laid flat to
           the screen, its point along his fingers (the hand bone's length) */
        if (hb) { hb.updateMatrixWorld(true); hb.getWorldPosition(v.needle.position); const e = hb.matrixWorld.elements, d = new THREE.Vector3(e[4], e[5], 0);
          if (d.lengthSq() < 1e-6) d.set(f.face, 0, 0); d.normalize(); v.needle.position.z = Math.max(v.needle.position.z, NEEDLE.z); v.needle.position.addScaledVector(d, NEEDLE.len * 0.3);
          v.needle.quaternion.setFromUnitVectors(new THREE.Vector3(-1, 0, 0), d); v.needle.scale.setScalar(NEEDLE.len); } }
      bladeArc(v, f, idx);
      fireFighter(f, idx, v);
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
      let m = shots.get(p); if (!m || m.userData.kind !== p.kind || (m.userData.wantProp && PROPS[m.userData.wantProp]) || (p.kind === 'coal' && PROPS.coalrope && !m.userData.prop)) { if (m) { scene.remove(m); } m = shotMesh(p.kind); m.userData.kind = p.kind; shots.set(p, m); scene.add(m); }
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
      else if (p.kind === 'ember') { m.scale.setScalar(m.userData.wantProp ? p.r * 3 : p.r * 3.2); m.rotation.set(0, 0, Math.atan2(p.vy || 0, p.vx || p.face || 1)); }   /* head first along its path */
      else if (p.kind === 'hotspud') { m.scale.setScalar(p.r * 3.7); m.rotation.set(Math.sin(frame * 0.2) * 0.15, frame * 0.18, Math.sin(frame * 0.13) * 0.2); }   /* flames up, turning as it rises and falls */
      else if (p.kind === 'bolt') m.scale.x = p.face;
      else if (p.kind === 'vaxe') {   /* p.rot is the direction the head points; stuck, the head is buried a hand's width in */
        m.rotation.z = (p.rot || 0) - Math.PI / 2; m.userData.pivot.scale.x = p.face || 1;
        if (m.userData.from === undefined) { const h = fighters[p.owner] && fighters[p.owner].axeHand; m.userData.from = h && tick - h.tick <= 2 && p.st === 'fly' ? { x: h.x, y: h.y, rot: h.rot, tick } : null; }
        const fr = m.userData.from, k = fr ? (tick - fr.tick) / 8 : 1;   /* the first 8 steps ease from where his hand let it go onto the game's own path */
        if (k < 1) { const u = k * k * (3 - 2 * k); let dr = (p.rot - fr.rot) % (2 * Math.PI); if (dr > Math.PI) dr -= 2 * Math.PI; if (dr < -Math.PI) dr += 2 * Math.PI;
          m.position.x = fr.x + (m.position.x - fr.x) * u; m.position.y = fr.y + (m.position.y - fr.y) * u; m.rotation.z = fr.rot + dr * u - Math.PI / 2; }
        if (p.st === 'stuck') { const k = 0.6 * m.userData.s; m.position.x -= Math.cos(p.rot) * k; m.position.y -= Math.sin(p.rot) * k; }
        fireAxe(p);
      }
      else if (p.kind === 'coal') { m.userData.core.scale.setScalar(m.userData.prop ? p.r * 2.6 : p.r); m.userData.core.rotation.set(frame * 0.05, frame * 0.07, 0); }
      else if (p.kind === 'ant') { m.rotation.y = p.face < 0 ? Math.PI : 0; m.rotation.z = Math.atan2(p.vy, Math.abs(p.vx) + 1e-6); m.userData.legs.forEach((l, k) => { l.rotation.z = Math.sin(frame * 0.8 + k * 1.7) * 0.5; }); }
    }
    drawRopes();
    fxFrame();
    renderer.render(scene, camera);
    R3.info = { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles };
  };
  R3.fighters = fighters;   /* for inspection from the console and tests; nothing in the game reads it */
  R3.fx = { bursts, trails, arcs, flashes, sparks, embers, islands };
  R3.ready = true;
}
