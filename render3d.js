/* Emberfall 3D renderer (Three.js). It only reads the simulation: fighters, projectiles, camera. It never writes to it.
   Fighters are grey-box capsules until real models are imported; the stage, lights and shadows are in place. */
/* global W, H, TAU, clamp, MAIN, PLATS, BODY_H, F, PROJ, cam, SHK, frame, cv */
import * as THREE from 'three';

const glc = document.getElementById('gl');
const R3 = window.R3 = { ready: false, gpu: '', three: THREE.REVISION, show() {}, render() {}, info: null };
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
  const scene = new THREE.Scene(); scene.fog = new THREE.Fog(0x7a4a72, 650, 2900);
  const camera = new THREE.PerspectiveCamera(FOV, 16 / 9, 5, 6000);

  /* ---- sky, moon, stars, hills ---- */
  const tex = (w, h, paint) => { const c = document.createElement('canvas'); c.width = w; c.height = h; paint(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; };
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(9000, 3600), new THREE.MeshBasicMaterial({ fog: false, depthWrite: false, map: tex(4, 512, (g, w, h) => { const q = g.createLinearGradient(0, 0, 0, h); q.addColorStop(0, '#0d1230'); q.addColorStop(0.42, '#2c2356'); q.addColorStop(0.72, '#8a4a6e'); q.addColorStop(1, '#f0a063'); g.fillStyle = q; g.fillRect(0, 0, w, h); }) }));
  sky.position.set(0, 500, -2600); scene.add(sky);
  const sp = new Float32Array(500 * 3); for (let k = 0; k < 500; k++) { sp[k * 3] = (Math.random() - 0.5) * 6000; sp[k * 3 + 1] = 250 + Math.random() * 1600; sp[k * 3 + 2] = -2500; }
  const stars = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(sp, 3)), new THREE.PointsMaterial({ color: 0xfff6e0, size: 2.2, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.8 }));
  scene.add(stars);
  const moon = new THREE.Mesh(new THREE.CircleGeometry(95, 48), new THREE.MeshBasicMaterial({ color: 0xfff3d6, fog: false })); moon.position.set(1050, 760, -2450); scene.add(moon);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ fog: false, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, map: tex(256, 256, (g, w) => { const q = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); q.addColorStop(0, 'rgba(255,230,180,.55)'); q.addColorStop(0.3, 'rgba(255,220,170,.16)'); q.addColorStop(1, 'rgba(255,220,170,0)'); g.fillStyle = q; g.fillRect(0, 0, w, w); }) }));
  glow.scale.set(900, 900, 1); glow.position.set(1050, 760, -2440); scene.add(glow);
  [[-330, -70, 0x231a3c, 0], [-760, -20, 0x3a2a58, 2], [-1250, 60, 0x5b3f73, 4]].forEach(([z, base, col, ph]) => {
    const sh = new THREE.Shape(); sh.moveTo(-4200, -1400);
    for (let x = -4200; x <= 4200; x += 60) sh.lineTo(x, base + Math.sin(x * 0.0023 + ph) * 120 + Math.sin(x * 0.0061 + ph * 2) * 45 + Math.sin(x * 0.017 + ph) * 12);
    sh.lineTo(4200, -1400);
    const m = new THREE.Mesh(new THREE.ShapeGeometry(sh), new THREE.MeshBasicMaterial({ color: col })); m.position.z = z; scene.add(m);
  });

  /* ---- stage ---- */
  const stone = new THREE.MeshStandardMaterial({ color: 0x4d4260, roughness: 0.95, flatShading: true });
  const bodyShape = new THREE.Shape([[-80, 0], [80, 0], [80, -13], [54, -19], [38, -BODY_H], [-38, -BODY_H], [-54, -19], [-80, -13]].map(p => new THREE.Vector2(p[0], p[1])));
  const body = new THREE.Mesh(new THREE.ExtrudeGeometry(bodyShape, { depth: 44, bevelEnabled: false }), stone); body.position.z = -22; body.castShadow = body.receiveShadow = true; scene.add(body);
  const planks = tex(1024, 256, (g, w, h) => { g.fillStyle = '#b7a087'; g.fillRect(0, 0, w, h); for (let x = 0; x < w; x += 64) { g.fillStyle = (x / 64) % 2 ? 'rgba(0,0,0,.05)' : 'rgba(255,255,255,.04)'; g.fillRect(x, 0, 64, h); g.fillStyle = 'rgba(40,28,30,.55)'; g.fillRect(x, 0, 3, h); } for (let k = 0; k < 500; k++) { g.fillStyle = 'rgba(60,40,30,' + (Math.random() * 0.12).toFixed(3) + ')'; g.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 26, 1); } });
  planks.wrapS = planks.wrapT = THREE.RepeatWrapping; planks.repeat.set(2, 1);
  const deck = new THREE.Mesh(new THREE.BoxGeometry(164, 3, 48), new THREE.MeshStandardMaterial({ color: 0xffffff, map: planks, roughness: 0.82 })); deck.position.set(0, -1.5, 0); deck.castShadow = deck.receiveShadow = true; scene.add(deck);
  const wood = new THREE.MeshStandardMaterial({ color: 0xd2b184, roughness: 0.7 }), trim = new THREE.MeshStandardMaterial({ color: 0x5a4638, roughness: 0.8 });
  for (const p of PLATS) if (p.soft) {
    const w = p.x1 - p.x0, m = new THREE.Mesh(new THREE.BoxGeometry(w, 1.8, 15), wood); m.position.set((p.x0 + p.x1) / 2, p.y - 0.9, 0); m.castShadow = m.receiveShadow = true; scene.add(m);
    for (const ex of [p.x0 + 1, p.x1 - 1]) { const c = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.4, 16), trim); c.position.set(ex, p.y - 1, 0); c.castShadow = true; scene.add(c); }
  }
  const iron = new THREE.MeshStandardMaterial({ color: 0x3d3548, roughness: 0.6, metalness: 0.4 }), lampGlass = new THREE.MeshStandardMaterial({ color: 0xffe2a0, emissive: 0xffb85a, emissiveIntensity: 2.2, roughness: 0.4 });
  const lamps = [];
  for (const lx of [-70, 70]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.6, 19, 10), iron); pole.position.set(lx, 9.5, -17); pole.castShadow = true; scene.add(pole);
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.8, 1.2, 12), iron); foot.position.set(lx, 0.6, -17); scene.add(foot);
    const glass = new THREE.Mesh(new THREE.BoxGeometry(2.8, 3.6, 2.8), lampGlass); glass.position.set(lx, 21, -17); scene.add(glass);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(2.6, 2, 4), iron); cap.position.set(lx, 23.8, -17); cap.rotation.y = Math.PI / 4; scene.add(cap);
    const light = new THREE.PointLight(0xffb866, 2200, 150, 2); light.position.set(lx, 21, -9); scene.add(light); lamps.push(light);
  }

  /* ---- lights ---- */
  scene.add(new THREE.HemisphereLight(0x9a8fd0, 0x2a2030, 1.15));
  const key = new THREE.DirectionalLight(0xffe6c8, 2.5); key.position.set(-70, 150, 130); key.target.position.set(0, 10, 0); scene.add(key, key.target);
  key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.6;
  Object.assign(key.shadow.camera, { left: -150, right: 150, top: 150, bottom: -70, near: 10, far: 520 }); key.shadow.camera.updateProjectionMatrix();
  const rim = new THREE.DirectionalLight(0x8fa8ff, 1.7); rim.position.set(90, 70, -140); scene.add(rim);

  /* ---- fighters (grey-box) ---- */
  const PCOL = [0xff7b6c, 0x6cb4ff];
  const fighters = [0, 1].map(idx => {
    const root = new THREE.Group(), pivot = new THREE.Group(); root.add(pivot); scene.add(root);
    const shield = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 18), new THREE.MeshStandardMaterial({ color: PCOL[idx], emissive: PCOL[idx], emissiveIntensity: 0.5, transparent: true, opacity: 0.42, roughness: 0.2, depthWrite: false })); shield.visible = false; scene.add(shield);
    const pad = new THREE.Mesh(new THREE.BoxGeometry(18, 1.4, 10), new THREE.MeshStandardMaterial({ color: 0xffe6a0, emissive: 0xffc860, emissiveIntensity: 1.2 })); pad.visible = false; scene.add(pad);
    return { root, pivot, shield, pad, key: '', yaw: idx ? Math.PI : 0, mats: [] };
  });
  function dress(v, f) {
    const fm = f.form, col = f.alt ? fm.alt : fm.col, st = fm.st, k = fm.name + (f.alt ? '*' : '');
    if (v.key === k) return; v.key = k;
    while (v.pivot.children.length) { const c = v.pivot.children.pop(); c.geometry.dispose(); }
    const r = st.w * 0.45, len = Math.max(0.1, st.h - 2 * r);
    const mk = (geo, hex, x, y, z) => { const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(hex), roughness: 0.55 }); const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; v.pivot.add(m); v.mats.push(mat); return m; };
    v.mats = [];
    mk(new THREE.CapsuleGeometry(r, len, 8, 20), col[0], 0, st.h / 2, 0);
    mk(new THREE.BoxGeometry(r * 0.7, st.h * 0.16, r * 1.5), col[2], r * 0.72, st.h * 0.72, 0);          /* visor: shows which way it faces */
    mk(new THREE.TorusGeometry(r * 1.02, r * 0.14, 8, 24), col[1], 0, st.h * 0.42, 0).rotation.x = Math.PI / 2;   /* belt in the accent colour */
  }

  /* ---- projectiles ---- */
  const shots = new Map();
  const shotMesh = kind => {
    const e = (hex, i) => new THREE.MeshStandardMaterial({ color: hex, emissive: hex, emissiveIntensity: i, roughness: 0.5 });
    if (kind === 'bolt') return new THREE.Mesh(new THREE.CapsuleGeometry(0.9, 4, 4, 10).rotateZ(Math.PI / 2), e(0xffe8a3, 2));
    if (kind === 'gust') return new THREE.Mesh(new THREE.TorusGeometry(4.5, 0.7, 8, 24), new THREE.MeshStandardMaterial({ color: 0xf0dcff, transparent: true, opacity: 0.55, depthWrite: false }));
    if (kind === 'boulder') { const m = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ color: 0x8d8794, roughness: 0.95, flatShading: true })); m.castShadow = true; return m; }
    return new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), e(0xffa040, 2.6));   /* ember and flame */
  };

  function poseOf(f) {
    const h = f.st.h; let sx = 1, sy = 1, rot = 0, oy = 0;
    if (f.state === 'jsq' || f.state === 'land') { sy = 0.8; sx = 1.12; } else if (f.state === 'dash' || f.state === 'run') rot = 0.18;
    else if (f.state === 'wd') { sy = 0.85; rot = -0.12 * Math.sign(f.vx * f.face); }
    else if (f.state === 'hurt' && !f.grounded) { rot = f.sf * 0.3; oy = h / 2; }
    else if (f.state === 'broken') rot = Math.sin(frame * 0.2) * 0.25;
    else if (f.state === 'roll') { rot = f.sf * 0.45 * f.rollDir * f.face; oy = h / 2; }
    else if (f.state === 'helpless') rot = 0.35;
    else if (f.state === 'attack' && f.move && f.move.swap) sx = sy = 1 - Math.sin(Math.min(1, f.mf / 34) * Math.PI) * 0.7;
    else if (f.state === 'attack' && f.move) rot = Math.sin(Math.min(1, f.mf / f.move.t) * Math.PI) * 0.22;
    else if (f.state === 'air') sy = 1 + clamp(Math.abs(f.vy) * 0.03, 0, 0.12);
    else if (f.state === 'idle' && f.ctl.c.ly < -0.6) { sy = 0.72; sx = 1.1; }
    else if (f.state === 'down') { sy = 0.45; sx = 1.25; }
    return { sx, sy, rot, oy };
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
    stars.position.x = camera.position.x * 0.9; sky.position.x = camera.position.x; moon.position.x = 1050 + camera.position.x * 0.85; glow.position.x = moon.position.x;
    lamps.forEach((l, k) => { l.intensity = 2200 * (1 + Math.sin(frame * 0.31 + k * 2) * 0.05); });

    F.forEach((f, idx) => {
      const v = fighters[idx], st = f.st, alive = f.state !== 'dead';
      v.root.visible = alive; v.shield.visible = alive && (f.state === 'shield' || f.state === 'shieldstun'); v.pad.visible = f.state === 'respawn';
      if (!alive) return;
      dress(v, f);
      const p = poseOf(f), want = f.face > 0 ? -0.35 : Math.PI + 0.35;
      v.yaw += (want - v.yaw) * 0.4;
      v.root.position.set(f.x, f.y, 0); v.root.rotation.y = v.yaw;
      v.pivot.position.set(0, p.oy, 0); v.pivot.rotation.z = -p.rot; v.pivot.scale.set(p.sx, p.sy, p.sx);
      v.pivot.children.forEach(c => { if (c.userData.y0 === undefined) c.userData.y0 = c.position.y; c.position.y = c.userData.y0 - p.oy; });
      const ghost = (f.invuln > 0 && (frame >> 1) % 2) || f.state === 'spot' || f.state === 'airdodge', hot = f.flash > 0 || (f.hitlag > 0 && f.state === 'hurt');
      for (const m of v.mats) { m.transparent = ghost; m.opacity = ghost ? 0.45 : 1; m.emissive.setHex(hot ? 0xffffff : 0x000000); m.emissiveIntensity = hot ? 0.8 : 0; }
      if (v.shield.visible) { const r = 4 + f.shieldHp / 50 * 6; v.shield.scale.setScalar(r); v.shield.position.set(f.x, f.y + st.h / 2, 0); }
      if (v.pad.visible) v.pad.position.set(f.x, f.y - 0.8, 0);
    });
    for (let k = F.length; k < 2; k++) { fighters[k].root.visible = false; fighters[k].shield.visible = false; fighters[k].pad.visible = false; }

    for (const [p, m] of shots) if (!PROJ.includes(p)) { scene.remove(m); m.geometry.dispose(); shots.delete(p); }
    for (const p of PROJ) {
      let m = shots.get(p); if (!m || m.userData.kind !== p.kind) { if (m) { scene.remove(m); } m = shotMesh(p.kind); m.userData.kind = p.kind; shots.set(p, m); scene.add(m); }
      m.position.set(p.x, p.y, 0);
      if (p.kind === 'boulder') { m.scale.setScalar(p.r); m.rotation.z = -(p.rot || 0); }
      else if (p.kind === 'gust') { m.rotation.y = Math.PI / 2; m.rotation.x = frame * 0.25; }
      else if (p.kind === 'flame') m.scale.set(p.r * 0.8, p.r * (1.1 + Math.sin(frame * 0.5) * 0.3), p.r * 0.8);
      else if (p.kind === 'ember') m.scale.setScalar(p.r * 0.75);
      else if (p.kind === 'bolt') m.scale.x = p.face;
    }
    renderer.render(scene, camera);
    R3.info = { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles };
  };
  R3.ready = true;
}
