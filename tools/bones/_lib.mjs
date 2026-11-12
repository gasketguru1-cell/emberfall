// Shapes and key helpers for the bone specs in this folder (see tools/addbones.mjs). Model coordinates: y up, +z forward,
// x the fighter's own left. A region is p => 0..1 (p a THREE.Vector3).
import * as THREE from 'three';
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), smooth = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
export const V = a => new THREE.Vector3(...a);
/* 1 inside r0, fading to 0 at r1 */
export const sphere = (c, r0, r1) => p => 1 - smooth((V(c).distanceTo(p) - r0) / Math.max(1e-6, r1 - r0));
/* an ellipsoid of radii r, its outer "soft" share fading */
export const ellipsoid = (c, r, soft = 0.3) => p => { const d = Math.hypot((p.x - c[0]) / r[0], (p.y - c[1]) / r[1], (p.z - c[2]) / r[2]); return 1 - smooth((d - (1 - soft)) / soft); };
/* within r0 of the segment a-b, fading to r1 */
export const capsule = (a, b, r0, r1) => p => { const A = V(a), B = V(b), ab = B.clone().sub(A), t = clamp(p.clone().sub(A).dot(ab) / ab.lengthSq(), 0, 1); return 1 - smooth((p.distanceTo(A.addScaledVector(ab, t)) - r0) / Math.max(1e-6, r1 - r0)); };
/* the side of a plane the normal points to, over a band "soft" wide */
export const half = (pt, n, soft) => p => { const N = V(n).normalize(); return smooth(p.clone().sub(V(pt)).dot(N) / soft + 0.5); };
export const box = (lo, hi, soft = 0.02) => p => ['x', 'y', 'z'].reduce((s, k, i) => s * smooth((p[k] - lo[i]) / soft + 0.5) * smooth((hi[i] - p[k]) / soft + 0.5), 1);
export const all = (...fs) => (p, G) => fs.reduce((s, f) => s * f(p, G), 1);
export const not = f => (p, G) => 1 - f(p, G);
/* mirror a point to the other side */
export const mx = a => [-a[0], a[1], a[2]];
/* a held pose with eases: rest until t0, pose from t1 to t2, rest again by t3 */
export function pulse(t0, t1, t2, t3, pose, rest = []) { return [[t0, rest], [t1, pose], [t2, pose], [t3, rest]].filter((k, i, a) => i === 0 || k[0] > a[i - 1][0] + 1e-6); }
export const scale = (list, s) => list.map(([a, d]) => [a, d * s]);
/* blinks for a clip of length dur: quick closes at the given fractions of the clip */
export function blinks(dur, at, shut, open = []) { const out = [[0, open]]; for (const f of at) { const t = f * dur; if (t < 0.06 || t > dur - 0.12) continue; out.push([t - 0.05, open], [t, shut], [t + 0.04, shut], [t + 0.11, open]); } out.push([dur, open]); return out.sort((a, b) => a[0] - b[0]); }
/* a sine wobble about an axis: amplitude degrees, period seconds, phase 0..1, across the clip */
export function wobble(dur, axis, amp, period, phase = 0, base = []) { const out = []; const n = Math.max(4, Math.round(dur / period * 8)); for (let i = 0; i <= n; i++) { const t = dur * i / n; out.push([t, base.concat([[axis, amp * Math.sin((t / period + phase) * Math.PI * 2)]])]); } return out; }
/* left/right pairs: build both sides from a function of side (1 his left, -1 his right) */
export const sides = fn => [...fn(1, 'L'), ...fn(-1, 'R')];
