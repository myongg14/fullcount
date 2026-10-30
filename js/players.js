// 선수 모델: 투수(팔), 타자, 배트, 포수와 미트. 좌/우에 맞게 서는 위치 바꾸기

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
pitchArm.position.set(0.38, 1.05, 0);

const batter = makePlayer('#b8222c', '#b8222c');
batter.position.set(-0.95, 0, 0.1); batter.rotation.y = Math.PI / 2;
batter.getChildMeshes().forEach(m => { m.material = m.material.clone('bm'); m.material.alpha = 0.55; });
const batPivot = new BABYLON.TransformNode('bp', scene);
batPivot.position.set(-0.62, 1.1, 0.1);
const bat = BABYLON.MeshBuilder.CreateCylinder('bat', { diameterTop: 0.07, diameterBottom: 0.035, height: 0.86 }, scene);
bat.material = mat('#d9a066'); bat.parent = batPivot; bat.position.set(0, 0.43, 0);
const BAT_REST = new BABYLON.Vector3(0.0, 0, -0.6);
batPivot.rotation.copyFrom(BAT_REST);

// 포수와 미트. 투구 모드(투수 시점)에서만 보인다.
// 투수 눈높이에서는 포수가 존 뒤에 겹쳐 보이므로, 낮게 쪼그려 앉히고(몸을 땅에 묻음) 반투명하게 한다. 숫자를 바꿔 조절
const CATCHER_VIEW = { y: -0.9, scale: 0.85, alpha: 0.35, mittAlpha: 0.6 };
const catcher = makePlayer('#2b3c55', '#2b3c55');
catcher.position.set(0, CATCHER_VIEW.y, -0.95); catcher.scaling.setAll(CATCHER_VIEW.scale);
catcher.getChildMeshes().forEach(m => { m.material.alpha = CATCHER_VIEW.alpha; m.isPickable = false; });
const mitt = BABYLON.MeshBuilder.CreateSphere('mitt', { diameter: 0.26, segments: 12 }, scene);
mitt.scaling.z = 0.5; mitt.material = mat('#7a4520', { alpha: CATCHER_VIEW.mittAlpha }); mitt.isPickable = false;
const MITT_REST = new BABYLON.Vector3(0, 0.75, -0.45);
mitt.position.copyFrom(MITT_REST);
catcher.setEnabled(false); mitt.setEnabled(false);

// 왼손/오른손에 맞게 서는 쪽 바꾸기. batSide: 우타 1, 좌타 -1 (좌타는 좌우를 거울처럼 뒤집음)
let batSide = 1;
const setBatterSide = bats => {
  batSide = bats === 'L' ? -1 : 1;
  batter.position.x = -0.95 * batSide; batter.rotation.y = batSide * Math.PI / 2;
  batPivot.position.x = -0.62 * batSide;
  batPivot.rotation.set(BAT_REST.x, BAT_REST.y * batSide, BAT_REST.z * batSide);
};
// 던지는 팔: 우투는 투수의 오른쪽(포수가 볼 때 왼쪽), 좌투는 반대
let pitchHand = 1;
const setPitcherHand = throws => {
  pitchHand = throws === 'L' ? -1 : 1;
  pitchArm.position.x = 0.38 * pitchHand;
};
