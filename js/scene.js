// 구장: 3D 엔진·카메라·조명, 잔디·흙·베이스·펜스·관중석, 스트라이크존·공, 화면 좌표 변환

const canvas = $('game');

// ---------- 장면 ----------
const engine = new BABYLON.Engine(canvas, true, { preserveDrawingBuffer: false, stencil: false, adaptToDeviceRatio: true });
const scene = new BABYLON.Scene(engine);
scene.clearColor = BABYLON.Color4.FromHexString('#8fd0f2ff');
scene.ambientColor = new BABYLON.Color3(0.4, 0.4, 0.4);

const cam = new BABYLON.UniversalCamera('cam', new BABYLON.Vector3(0, 1.35, -4.6), scene);
cam.setTarget(new BABYLON.Vector3(0, 0.5, MOUND_Z));
cam.fov = 0.55; cam.minZ = 0.05; cam.inputs.clear();

const hemi = new BABYLON.HemisphericLight('h', new BABYLON.Vector3(0.2, 1, -0.3), scene);
hemi.intensity = 0.85; hemi.groundColor = new BABYLON.Color3(0.35, 0.45, 0.35);
const sun = new BABYLON.DirectionalLight('sun', new BABYLON.Vector3(-0.4, -1, 0.6), scene);
sun.intensity = 0.7;

const mat = (hex, opts = {}) => {
  const m = new BABYLON.StandardMaterial('m' + hex + Math.random(), scene);
  m.diffuseColor = BABYLON.Color3.FromHexString(hex);
  m.specularColor = new BABYLON.Color3(0.08, 0.08, 0.08);
  if (opts.emissive) m.emissiveColor = BABYLON.Color3.FromHexString(opts.emissive);
  if (opts.alpha != null) m.alpha = opts.alpha;
  return m;
};

// 잔디, 내야 흙, 마운드, 홈플레이트
const grass = BABYLON.MeshBuilder.CreateGround('grass', { width: 260, height: 260 }, scene);
grass.position.z = 100; grass.material = mat('#3f9b4a');
const stripes = mat('#47a853');
for (let i = 0; i < 9; i++) {
  const st = BABYLON.MeshBuilder.CreateGround('st' + i, { width: 260, height: 9 }, scene);
  st.position.set(0, 0.005, 25 + i * 18); st.material = stripes;
}
const dirt = mat('#c58b55');
const infield = BABYLON.MeshBuilder.CreateGround('inf', { width: 27.4, height: 27.4 }, scene);
infield.rotation.y = Math.PI / 4; infield.position.set(0, 0.01, 27.43 / Math.SQRT2);
infield.material = dirt;
const grassIn = BABYLON.MeshBuilder.CreateGround('gin', { width: 21, height: 21 }, scene);
grassIn.rotation.y = Math.PI / 4; grassIn.position.set(0, 0.015, 27.43 / Math.SQRT2 + 0.6); grassIn.material = mat('#43a24e');
const mound = BABYLON.MeshBuilder.CreateCylinder('mound', { diameterTop: 2.2, diameterBottom: 5.5, height: 0.25, tessellation: 32 }, scene);
mound.position.set(0, 0.12, MOUND_Z); mound.material = dirt;
const homeDirt = BABYLON.MeshBuilder.CreateDisc('hd', { radius: 4, tessellation: 40 }, scene);
homeDirt.rotation.x = Math.PI / 2; homeDirt.position.set(0, 0.02, 0); homeDirt.material = dirt;
const plate = BABYLON.MeshBuilder.CreateBox('plate', { width: 0.43, height: 0.02, depth: 0.43 }, scene);
plate.position.set(0, 0.03, 0.1); plate.material = mat('#ffffff');
// 베이스
[[19.4, 19.4], [0, 38.8], [-19.4, 19.4]].forEach(([x, z], i) => {
  const b = BABYLON.MeshBuilder.CreateBox('base' + i, { width: 0.38, height: 0.06, depth: 0.38 }, scene);
  b.position.set(x, 0.04, z); b.material = mat('#ffffff');
});
// 파울라인
const lineMat = mat('#ffffff', { emissive: '#666666' });
[-1, 1].forEach(s => {
  const l = BABYLON.MeshBuilder.CreateGround('fl' + s, { width: 0.1, height: 140 }, scene);
  l.rotation.y = s * Math.PI / 4; l.position.set(s * 70 / Math.SQRT2, 0.03, 70 / Math.SQRT2); l.material = lineMat;
});
// 외야 펜스(반지름 105m 호)
const fenceMat = mat('#1f5a36');
for (let a = -45; a <= 45; a += 3) {
  const r = a * Math.PI / 180, R = 105;
  const f = BABYLON.MeshBuilder.CreateBox('f' + a, { width: 5.6, height: 3, depth: 0.4 }, scene);
  f.position.set(Math.sin(r) * R, 1.5, Math.cos(r) * R); f.rotation.y = r; f.material = fenceMat;
}
// 관중석 띠
const standMat = mat('#2b3c55');
for (let a = -60; a <= 60; a += 6) {
  const r = a * Math.PI / 180, R = 118;
  const st = BABYLON.MeshBuilder.CreateBox('s' + a, { width: 13, height: 16, depth: 8 }, scene);
  st.position.set(Math.sin(r) * R, 8, Math.cos(r) * R); st.rotation.y = r; st.rotation.x = -0.35; st.material = standMat;
}

// 스트라이크존 테두리(조준용)
const zoneLines = BABYLON.MeshBuilder.CreateLines('zone', { points: [
  new BABYLON.Vector3(-ZONE.x, ZONE.yLo, 0), new BABYLON.Vector3(ZONE.x, ZONE.yLo, 0),
  new BABYLON.Vector3(ZONE.x, ZONE.yHi, 0), new BABYLON.Vector3(-ZONE.x, ZONE.yHi, 0),
  new BABYLON.Vector3(-ZONE.x, ZONE.yLo, 0)] }, scene);
zoneLines.color = new BABYLON.Color3(1, 1, 1); zoneLines.alpha = 0.55;
// 투수 시점용 존 틀: 멀리서 봐도 보이게 굵게, 포수·타자보다 항상 앞에 그린다(renderingGroupId 1)
const zoneFrame = new BABYLON.TransformNode('zoneFrame', scene);
{
  const T = 0.016, w = ZONE.x * 2, h = ZONE.yHi - ZONE.yLo, cy = (ZONE.yLo + ZONE.yHi) / 2;
  const fm = mat('#ffffff', { emissive: '#ffffff' }); fm.disableLighting = true; fm.alpha = 0.9;
  [[0, ZONE.yLo, w + T, T], [0, ZONE.yHi, w + T, T], [-ZONE.x, cy, T, h], [ZONE.x, cy, T, h]].forEach(([x, y, bw, bh], i) => {
    const b = BABYLON.MeshBuilder.CreateBox('zf' + i, { width: bw, height: bh, depth: 0.005 }, scene);
    b.position.set(x, y, 0); b.material = fm; b.renderingGroupId = 1; b.isPickable = false; b.parent = zoneFrame;
  });
}
zoneFrame.setEnabled(false);
// 탭 판정용 보이지 않는 판(홈플레이트 위 세로면)
const hitPlane = BABYLON.MeshBuilder.CreatePlane('hp', { width: 6, height: 4 }, scene);
hitPlane.position.set(0, 1, 0); hitPlane.rotation.y = Math.PI; hitPlane.visibility = 0; hitPlane.isPickable = true;

const ball = BABYLON.MeshBuilder.CreateSphere('ball', { diameter: 0.09, segments: 12 }, scene);
ball.material = mat('#ffffff', { emissive: '#bbbbbb' }); ball.isVisible = false;
const shadow = BABYLON.MeshBuilder.CreateDisc('sh', { radius: 0.07, tessellation: 16 }, scene);
shadow.rotation.x = Math.PI / 2; shadow.material = mat('#000000', { alpha: 0.35 }); shadow.isVisible = false;
const landMark = BABYLON.MeshBuilder.CreateDisc('lm', { radius: 0.12, tessellation: 20 }, scene);
landMark.rotation.x = Math.PI / 2; landMark.material = mat('#ffc23d', { emissive: '#ffc23d' }); landMark.isVisible = false;

const toScreen = v => {
  const p = BABYLON.Vector3.Project(v, BABYLON.Matrix.Identity(), scene.getTransformMatrix(),
    cam.viewport.toGlobal(engine.getRenderWidth(), engine.getRenderHeight()));
  const k = canvas.clientWidth / engine.getRenderWidth();
  const r = canvas.getBoundingClientRect();
  return { x: r.left + p.x * k, y: r.top + p.y * k };
};
const pickPlate = (cx, cy) => {
  const r = canvas.getBoundingClientRect();
  const k = engine.getRenderWidth() / canvas.clientWidth;
  const pk = scene.pick((cx - r.left) * k, (cy - r.top) * k, m => m === hitPlane);
  return pk && pk.hit ? pk.pickedPoint : null;
};
