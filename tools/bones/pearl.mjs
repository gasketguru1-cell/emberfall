// Pearl: the template's 30 bones (tools/bones/_fowl.mjs), fitted to her mesh. Prim: the brows knit a little.
import { fowl } from './_fowl.mjs';
export default await fowl({ in: 'assets/fowl-pearl/export/pearl-v1.glb', out: 'assets/fowl-pearl/export/pearl-b.glb', manifest: ['Pearl', 'Pearl alone'],
  chinS: 1.45, eyes: [[0.2, 1.16], [-0.29, 1.16]], eyeZ: 0.4, eyeR: 0.08, angry: 10 });
