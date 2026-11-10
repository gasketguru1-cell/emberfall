'use strict';
/* Where each attack's hitbox sits, measured from the animations with tools/measure.html (a few are set by hand there:
   body slams, spins and downward lashes). x is forward and y is up from the fighter's feet, in game units; r is the radius.
   Only positions and sizes live here. Timing, damage and launch are defined with the moves in sim.js.
   To refresh after changing an animation: open tools/measure.html and copy its result here. */
const HITBOXES = {
  Flint: {
    jab: [{ x: 7.8, y: 10.7, r: 4.5 }], jab2: [{ x: 6.6, y: 11.4, r: 4.5 }], jab3: [{ x: 6.3, y: 9.6, r: 5.2 }],
    ftilt: [{ x: 6.9, y: 11, r: 5 }], utilt: [{ x: 3.4, y: 12.6, r: 5.5 }], dtilt: [{ x: 6, y: 1.2, r: 4.5 }], dash: [{ x: 7, y: 10.3, r: 5.5 }],
    fsmash: [{ x: 7.8, y: 8.5, r: 6.5 }], usmash: [{ x: 1.5, y: 16, r: 7 }], dsmash: [{ x: 7.5, y: 2, r: 5.5 }, { x: -7.5, y: 2, r: 5.5 }],
    fair: [{ x: 7.3, y: 10.2, r: 5.5 }], bair: [{ x: -7.5, y: 12, r: 5.5 }], uair: [{ x: 0, y: 15, r: 6 }], dair: [{ x: 0.5, y: 2.5, r: 6.5 }],
    grab: [{ x: 7.8, y: 10.7, r: 4.5 }], dgrab: [{ x: 10.3, y: 10.7, r: 4.5 }], pgrab: [{ x: 10.8, y: 10.7, r: 4.5 }],
    getup: [{ x: 7.5, y: 2.5, r: 6 }, { x: -7.5, y: 2.5, r: 6 }], sspec: [{ x: 7.5, y: 9.1, r: 6 }],
  },
  Nib: {
    jab: [{ x: 6.6, y: 6.4, r: 4.2 }], jab2: [{ x: 6.6, y: 6.4, r: 4.2 }], jab3: [{ x: 7.9, y: 5.9, r: 4.8 }],
    ftilt: [{ x: 7.9, y: 5.9, r: 4.7 }], utilt: [{ x: -3.4, y: 12.2, r: 5.1 }], dtilt: [{ x: 8.3, y: 3.6, r: 4.2 }], dash: [{ x: 6.9, y: 6.8, r: 5.1 }],
    fsmash: [{ x: 7.9, y: 7.8, r: 6.1 }], usmash: [{ x: -1.5, y: 12.5, r: 6.5 }], dsmash: [{ x: 6.3, y: 2.8, r: 5.1 }, { x: -8.4, y: 4.9, r: 5.1 }],
    fair: [{ x: 7.9, y: 7.8, r: 5.1 }], bair: [{ x: -7.7, y: 9.3, r: 5.1 }], uair: [{ x: -3.4, y: 12.2, r: 5.6 }], dair: [{ x: 5, y: 1.4, r: 5.1 }],
    grab: [{ x: 7.9, y: 5.9, r: 4 }], dgrab: [{ x: 10.4, y: 5.9, r: 4 }], pgrab: [{ x: 10.9, y: 5.9, r: 4 }],
    getup: [{ x: 6.5, y: 2.4, r: 5.6 }, { x: -6.5, y: 0.9, r: 5.6 }], sspec: [{ x: 6.9, y: 6.8, r: 5.5 }],
  },
  Loom: {
    jab: [{ x: 9.7, y: 5.9, r: 5.1 }],
    ftilt: [{ x: 11.2, y: 6.5, r: 5.7 }], utilt: [{ x: 2.1, y: 17.6, r: 6.2 }], dtilt: [{ x: 8, y: 4.5, r: 5.5 }], dash: [{ x: 12.7, y: 2.3, r: 6.2 }],
    fsmash: [{ x: 12.7, y: 2.3, r: 7.4 }], usmash: [{ x: 2.1, y: 17.6, r: 7.9 }], dsmash: [{ x: 8, y: 5, r: 6 }, { x: -8, y: 5, r: 6 }],
    fair: [{ x: 11.2, y: 6.4, r: 6.2 }], bair: [{ x: -11.2, y: 6.5, r: 6.2 }], dair: [{ x: 0, y: 1.5, r: 6.2 }],
    grab: [{ x: 9.7, y: 5.9, r: 4.5 }], dgrab: [{ x: 12.2, y: 5.9, r: 4.5 }], pgrab: [{ x: 12.7, y: 5.9, r: 4.5 }],
    getup: [{ x: 8, y: 5, r: 6 }, { x: -8, y: 5, r: 6 }], sspec: [{ x: 12.5, y: 6.5, r: 4.5 }, { x: 7.5, y: 6.9, r: 3 }],   /* Ribbon Sling: the weight at the tip, then the inner ribbon (smaller, and it wins up close) */
  },
  Hod: {
    jab: [{ x: 8.8, y: 4.4, r: 4.7 }], jab2: [{ x: 8.8, y: 4.4, r: 4.7 }], jab3: [{ x: 9.1, y: 3.9, r: 5.4 }],
    ftilt: [{ x: 9.3, y: 3.1, r: 5.2 }], utilt: [{ x: 2.6, y: 17.3, r: 5.7 }], dtilt: [{ x: 11.4, y: 0.8, r: 4.7 }], dash: [{ x: 11, y: 5.3, r: 5.7 }],
    fsmash: [{ x: 9.3, y: 2.4, r: 6.8 }], dsmash: [{ x: 8.6, y: 1.1, r: 5.7 }, { x: -10.5, y: 1.4, r: 5.7 }],
    fair: [{ x: 8.6, y: 6.2, r: 5.7 }], bair: [{ x: -12.5, y: 2.5, r: 5.7 }], uair: [{ x: 2.6, y: 17.3, r: 6.3 }], dair: [{ x: 1, y: 1.5, r: 7 }],
    grab: [{ x: 9.2, y: 4.6, r: 5 }], dgrab: [{ x: 11.7, y: 4.6, r: 5 }], pgrab: [{ x: 12.2, y: 4.6, r: 5 }],
    getup: [{ x: 8.8, y: 1, r: 6.3 }, { x: -6.5, y: 1.9, r: 6.3 }], sspec: [{ x: 11, y: 5.3, r: 7 }],
  },
  /* Potato Sack fights with its body: the boxes sit on the fist for the jab and tilt, on its leading bulk for the slams,
     at its sides for the low spin, and over its tuft for the upward strikes. Set by hand from the bone positions measured
     in tools/measure.html, then checked with tools/audit.js. */
  'Potato Sack': {
    jab: [{ x: 7.1, y: 6, r: 4.4 }], ftilt: [{ x: 7.2, y: 6, r: 4.9 }], utilt: [{ x: 0, y: 15.5, r: 5.4 }], dtilt: [{ x: 6.6, y: 3.2, r: 4.6 }], dash: [{ x: 7.6, y: 3.5, r: 5.4 }],
    fsmash: [{ x: 7.6, y: 3.5, r: 6.4 }], usmash: [{ x: 0, y: 16, r: 6.6 }], dsmash: [{ x: 6.8, y: 3.4, r: 5.4 }, { x: -6.8, y: 3.4, r: 5.4 }],
    nair: [{ x: 0, y: 6, r: 7 }], fair: [{ x: 7.6, y: 3.5, r: 5.4 }], bair: [{ x: -7, y: 5.5, r: 5.4 }], uair: [{ x: 0, y: 15.5, r: 5.9 }], dair: [{ x: 0.2, y: 0.8, r: 5.4 }],
    grab: [{ x: 7.2, y: 5.6, r: 4.8 }], dgrab: [{ x: 8.6, y: 5.6, r: 4.8 }], pgrab: [{ x: 9.2, y: 5.6, r: 4.8 }], getup: [{ x: 7, y: 3.4, r: 5.9 }, { x: -7, y: 3.4, r: 5.9 }],
  },
};
