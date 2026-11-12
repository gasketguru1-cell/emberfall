// Pip: the template's 30 bones (tools/bones/_fowl.mjs), fitted to her mesh. Wide-eyed and sweet, so the brows barely knit.
import { fowl } from './_fowl.mjs';
export default await fowl({ in: 'assets/fowl-pip/export/pip-v1.glb', out: 'assets/fowl-pip/export/pip-b.glb', manifest: ['Pip', 'Pip alone'],
  eyes: [[0.33, 1.1], [-0.25, 1.08]], eyeZ: 0.63, eyeR: 0.1, angry: 6 });
