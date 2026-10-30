// 선수 모델: 투수(팔), 타자, 배트

// 카툰 선수: 몸통 캡슐 + 머리 + 모자
const makePlayer = (shirt, cap) => {
  const root = new BABYLON.TransformNode('p', scene);
  const body = BABYLON.MeshBuilder.CreateCapsule('b', { radius: 0.32, height: 1.25 }, scene);
  body.position.y = 0.75; body.material = mat(shirt); body.parent = root;
  const head = BABYLON.MeshBuilder.CreateSphere('h', { diameter: 0.5, segments: 16 }, scene);
  head.position.y = 1.62; head.material = mat('#f2c9a0'); head.parent = root;
  const capM = BABYLON.MeshBuilder.CreateSphere('c', { diameter: 0.52, segments: 16, slice: 0.5 }, scene);
  capM.position.y = 1.68; capM.material = mat(cap); capM.parent = root;
  const brim = BABYLON.MeshBuilder.CreateCylinder('br', { diameter: 0.34, height: 0.03 }, scene);
  brim.position.set(0, 1.69, 0.22); brim.material = capM.material; brim.parent = root;
  return root;
};
const pitcher = makePlayer('#e9eef2', '#1d3f8f');
pitcher.position.set(0, 0.24, MOUND_Z); pitcher.rotation.y = Math.PI;
const pitchArm = BABYLON.MeshBuilder.CreateCapsule('arm', { radius: 0.08, height: 0.7 }, scene);
pitchArm.material = mat('#e9eef2'); pitchArm.parent = pitcher;
pitchArm.setPivotPoint(new BABYLON.Vector3(0, 0.3, 0));
pitchArm.position.set(-0.38, 1.05, 0);

const batter = makePlayer('#b8222c', '#b8222c');
batter.position.set(-0.95, 0, 0.1); batter.rotation.y = Math.PI / 2;
batter.getChildMeshes().forEach(m => { m.material = m.material.clone('bm'); m.material.alpha = 0.55; });
const batPivot = new BABYLON.TransformNode('bp', scene);
batPivot.position.set(-0.62, 1.1, 0.1);
const bat = BABYLON.MeshBuilder.CreateCylinder('bat', { diameterTop: 0.07, diameterBottom: 0.035, height: 0.86 }, scene);
bat.material = mat('#d9a066'); bat.parent = batPivot; bat.position.set(0, 0.43, 0);
const BAT_REST = new BABYLON.Vector3(0.0, 0, -0.6);
batPivot.rotation.copyFrom(BAT_REST);
