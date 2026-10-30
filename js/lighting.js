// 밤낮: 낮(하늘색 하늘·해) / 밤(남색 하늘·별·조명탑 불빛). 조명탑과 빛나는 램프(GlowLayer)

// ---------- 설정 (숫자만 바꿔서 조절) ----------
const NIGHT = {
  sky: '#0a1430',          // 밤하늘 색
  stars: 160,              // 별 개수
  towerHeight: 42,         // 조명탑 높이(m)
  glow: 0.9,               // 램프 빛 번짐 세기
  fieldLight: 0.55,        // 경기장을 비추는 불빛 세기
};
const DAY_SKY = '#8fd0f2';

// ---------- 조명탑: 내야 관중석 뒤 4개 + 외야 관중석 뒤 2개 ----------
// [각도(도), 홈플레이트에서 거리(m)]. 램프는 경기장 가운데(내야와 외야 사이)를 향한다
const TOWER_SPOTS = [[-78, 64], [78, 64], [-140, 46], [140, 46], [-32, 140], [32, 140]];
const towerMat = mat('#5a6270');
const lampOffMat = mat('#c9ccd2');
const lampOnMat = new BABYLON.StandardMaterial('lampOn', scene);
lampOnMat.diffuseColor = new BABYLON.Color3(0, 0, 0); lampOnMat.specularColor = new BABYLON.Color3(0, 0, 0);
lampOnMat.emissiveColor = BABYLON.Color3.FromHexString('#fff3d6'); lampOnMat.disableLighting = true;
const lampFaces = [];
TOWER_SPOTS.forEach(([deg, r], i) => {
  const base = polar(deg, r, 0), H = NIGHT.towerHeight;
  const pole = BABYLON.MeshBuilder.CreateCylinder('tower' + i, { diameterTop: 0.8, diameterBottom: 1.4, height: H, tessellation: 8 }, scene);
  pole.position.set(base.x, H / 2, base.z); pole.material = towerMat; pole.isPickable = false;
  // 램프 판: 뒤판(철골) + 앞면(불빛)
  const head = new BABYLON.TransformNode('towerHead' + i, scene);
  head.position.set(base.x, H + 2, base.z);
  head.lookAt(new BABYLON.Vector3(0, 0, 45));
  const back = BABYLON.MeshBuilder.CreateBox('lampBack' + i, { width: 8, height: 4.5, depth: 0.6 }, scene);
  back.parent = head; back.material = towerMat; back.isPickable = false;
  const face = BABYLON.MeshBuilder.CreateBox('lampFace' + i, { width: 7.4, height: 3.9, depth: 0.1 }, scene);
  face.parent = head; face.position.z = 0.36; face.material = lampOffMat; face.isPickable = false;
  lampFaces.push(face);
});

// ---------- 밤하늘 별 ----------
const star = BABYLON.MeshBuilder.CreateBox('star', { size: 2.2 }, scene);
const starMat = new BABYLON.StandardMaterial('starMat', scene);
starMat.emissiveColor = new BABYLON.Color3(1, 1, 0.95); starMat.disableLighting = true;
star.material = starMat; star.isPickable = false; star.alwaysSelectAsActiveMesh = true;
{
  const m = new Float32Array(NIGHT.stars * 16), M = new BABYLON.Matrix();
  for (let i = 0; i < NIGHT.stars; i++) {
    const az = Math.random() * Math.PI * 2, el = (10 + Math.random() * 70) * Math.PI / 180, R = 900;
    const s = 0.5 + Math.random();
    BABYLON.Matrix.ComposeToRef(new BABYLON.Vector3(s, s, s), BABYLON.Quaternion.Identity(),
      new BABYLON.Vector3(Math.cos(el) * Math.sin(az) * R, Math.sin(el) * R, Math.cos(el) * Math.cos(az) * R), M);
    M.copyToArray(m, i * 16);
  }
  star.thinInstanceSetBuffer('matrix', m, 16, true);
}
star.setEnabled(false);

// ---------- 밤 조명 ----------
// 경기장 위 높은 곳의 불빛 2개(멀어질수록 약해져서 경기장이 관중석 바깥보다 밝다)
const fieldLights = [[0, 55, 20], [0, 60, 85]].map(([x, y, z], i) => {
  const l = new BABYLON.PointLight('fieldLight' + i, new BABYLON.Vector3(x, y, z), scene);
  l.diffuse = BABYLON.Color3.FromHexString('#fff6e4'); l.specular = new BABYLON.Color3(0.1, 0.1, 0.1);
  l.range = 190; l.intensity = NIGHT.fieldLight; l.setEnabled(false);
  return l;
});
// 램프만 빛나게 하는 빛 번짐 효과(밤에만 켬)
const glow = new BABYLON.GlowLayer('glow', scene, { mainTextureRatio: 0.25, blurKernelSize: 16 });
glow.intensity = NIGHT.glow;
lampFaces.forEach(f => glow.addIncludedOnlyMesh(f));
if (BALL_VIEW.halo) glow.addIncludedOnlyMesh(ballHalo);   // 테두리를 켜면 밤에 은은하게 빛난다
glow.isEnabled = false;

// 낮 조명 값(밤에서 낮으로 돌아갈 때 씀)
const DAY_LIGHT = {
  hemi: hemi.intensity, hemiDiffuse: hemi.diffuse.clone(), hemiGround: hemi.groundColor.clone(),
  sun: sun.intensity, sunDir: sun.direction.clone(), sunDiffuse: sun.diffuse.clone(),
};
let isNight = false;
const applyTimeOfDay = night => {
  isNight = night;
  scene.clearColor = BABYLON.Color4.FromHexString((night ? NIGHT.sky : DAY_SKY) + 'ff');
  if (night) {
    // 해는 끄고(약한 달빛 정도), 조명탑에서 내려오는 흰 불빛으로 경기장을 비춘다
    hemi.intensity = 0.32; hemi.diffuse = BABYLON.Color3.FromHexString('#b9c6ff'); hemi.groundColor = new BABYLON.Color3(0.08, 0.1, 0.12);
    sun.intensity = 0.55; sun.direction = new BABYLON.Vector3(0.1, -1, 0.25); sun.diffuse = BABYLON.Color3.FromHexString('#fff2dc');
  } else {
    hemi.intensity = DAY_LIGHT.hemi; hemi.diffuse = DAY_LIGHT.hemiDiffuse.clone(); hemi.groundColor = DAY_LIGHT.hemiGround.clone();
    sun.intensity = DAY_LIGHT.sun; sun.direction = DAY_LIGHT.sunDir.clone(); sun.diffuse = DAY_LIGHT.sunDiffuse.clone();
  }
  fieldLights.forEach(l => l.setEnabled(night));
  lampFaces.forEach(f => { f.material = night ? lampOnMat : lampOffMat; });
  glow.isEnabled = night;
  star.setEnabled(night);
};
