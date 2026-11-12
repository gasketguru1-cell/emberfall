// Rusty: the template's 30 bones (tools/bones/_fowl.mjs), fitted to his mesh. A scowler, so the brows knit hard.
import { fowl } from './_fowl.mjs';
export default await fowl({ in: 'assets/fowl-rusty/export/rusty-v1.glb', out: 'assets/fowl-rusty/export/rusty-b.glb', manifest: ['Rusty', 'Rusty alone'],
  eyes: [[0.2, 0.79], [-0.21, 0.79]], eyeZ: 0.62, eyeR: 0.08, angry: 18 });
