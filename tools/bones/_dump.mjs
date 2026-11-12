import { NodeIO } from '@gltf-transform/core'; import { ALL_EXTENSIONS } from '@gltf-transform/extensions'; import * as THREE from 'three';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
for (const f of process.argv.slice(2)) {
  const doc = await io.read(f), root = doc.getRoot(), skin = root.listSkins()[0], J = skin.listJoints(), ibm = skin.getInverseBindMatrices().getArray();
  const prim = root.listMeshes()[0].listPrimitives()[0], P = prim.getAttribute('POSITION'); const lo=[1e9,1e9,1e9],hi=[-1e9,-1e9,-1e9],p=[];
  for (let i=0;i<P.getCount();i++){P.getElement(i,p);for(let k=0;k<3;k++){lo[k]=Math.min(lo[k],p[k]);hi[k]=Math.max(hi[k],p[k]);}}
  console.log('##', f.split('/').pop(), 'meshes', root.listMeshes().length, 'prims', root.listMeshes().map(m=>m.listPrimitives().length).join(','), 'verts', P.getCount(), 'bbox', lo.map(v=>v.toFixed(2)).join(','), '..', hi.map(v=>v.toFixed(2)).join(','));
  console.log('  bones:', J.map((j,i)=>{const m=new THREE.Matrix4().fromArray(ibm.slice(i*16,i*16+16)).invert();const v=new THREE.Vector3().setFromMatrixPosition(m);return j.getName()+'<'+(j.getParentNode()?.getName()||'-')+'>('+[v.x,v.y,v.z].map(x=>x.toFixed(2)).join(',')+')'}).join(' '));
  console.log('  clips:', root.listAnimations().map(a=>a.getName()+':'+Math.max(...a.listSamplers().map(s=>{const t=s.getInput().getArray();return t[t.length-1]})).toFixed(2)).join(' '));
}
