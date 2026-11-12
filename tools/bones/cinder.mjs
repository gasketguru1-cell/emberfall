// Cinder: the template's 30 bones (tools/bones/_fowl.mjs), fitted to his mesh. A grump: small eyes under a heavy brow.
import { fowl } from './_fowl.mjs';
export default await fowl({ in: 'assets/fowl-cinder/export/cinder-v1.glb', out: 'assets/fowl-cinder/export/cinder-b.glb', manifest: ['Cinder', 'Cinder alone'],
  cheekS: 1.45, browS: 1.3, eyes: [[0.26, 1.24], [-0.25, 1.24]], eyeZ: 0.46, eyeR: 0.06, angry: 20 });
