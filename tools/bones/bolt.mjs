// Bolt: the template's 30 bones (tools/bones/_fowl.mjs), fitted to her mesh. Sharp-eyed, so the brows knit firmly.
import { fowl } from './_fowl.mjs';
export default await fowl({ in: 'assets/fowl-bolt/export/bolt-v1.glb', out: 'assets/fowl-bolt/export/bolt-b.glb', manifest: ['Bolt', 'Bolt alone'],
  cheekS: 1.35, chinS: 1.5, eyes: [[0.2, 1.12], [-0.3, 1.12]], eyeZ: 0.55, eyeR: 0.08, angry: 16 });
