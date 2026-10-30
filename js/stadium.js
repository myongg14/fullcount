// 구장 꾸미기: 외야 담장(파울 폴, 홈런 라인, 거리 표시), 계단식 관중석과 관객, 중앙 외야 전광판

// ---------- 설정 (숫자만 바꿔서 조절) ----------
const FENCE = {
  line: 98,        // 좌·우 파울 폴까지 거리(m)
  center: 122,     // 가운데 담장까지 거리(m)
  height: 3,       // 담장 높이(m)
};
const STANDS = {
  rows: 14,          // 관중석 줄 수
  rowDepth: 0.9,     // 한 줄의 깊이(m)
  rowRise: 0.45,     // 한 줄 올라갈 때 높이(m)
  infieldGap: 15,    // 파울 라인에서 내야 관중석까지 거리(m)
  infieldFront: 2.4, // 내야 관중석 첫 줄 높이(m). 그 아래는 그물 벽
  outfieldGap: 3,    // 외야 담장에서 외야 관중석까지 거리(m)
  outfieldFront: 3.4,
  seatGap: 0.62,     // 관객 사이 간격(m)
  fill: 0.62,        // 자리가 찰 확률(관객 수). iPad가 느리면 낮추기
};

// 각도(도, 0 = 가운데, 음수 = 3루 쪽)에 따른 담장 거리. 좌우 98m → 가운데 122m로 부드럽게 늘어난다
const fenceDist = deg => FENCE.line + (FENCE.center - FENCE.line) * Math.pow(Math.cos(clamp(deg, -45, 45) * Math.PI / 90), 1);
const polar = (deg, r, y = 0) => new BABYLON.Vector3(Math.sin(deg * Math.PI / 180) * r, y, Math.cos(deg * Math.PI / 180) * r);

// ---------- 바닥: 관중석 아래까지 넓게 ----------
const outerGround = BABYLON.MeshBuilder.CreateDisc('outerGround', { radius: 400, tessellation: 48 }, scene);
outerGround.rotation.x = Math.PI / 2; outerGround.position.y = -0.02; outerGround.material = mat('#2f6b3a');
outerGround.isPickable = false;

// ---------- 외야 담장 ----------
const fenceMat = mat('#1f5a36'); fenceMat.backFaceCulling = false;
const fenceLineMat = mat('#ffd23f', { emissive: '#6b5200' }); fenceLineMat.backFaceCulling = false;
{
  const bottom = [], top = [], lineLo = [], lineHi = [];
  for (let a = -45; a <= 45.001; a += 1) {
    const r = fenceDist(a);
    bottom.push(polar(a, r, 0)); top.push(polar(a, r, FENCE.height));
    lineLo.push(polar(a, r - 0.02, FENCE.height)); lineHi.push(polar(a, r - 0.02, FENCE.height + 0.18));
  }
  const wall = BABYLON.MeshBuilder.CreateRibbon('fence', { pathArray: [bottom, top], sideOrientation: BABYLON.Mesh.DOUBLESIDE }, scene);
  wall.material = fenceMat; wall.isPickable = false;
  // 담장 위 노란 홈런 라인
  const hrLine = BABYLON.MeshBuilder.CreateRibbon('hrLine', { pathArray: [lineLo, lineHi], sideOrientation: BABYLON.Mesh.DOUBLESIDE }, scene);
  hrLine.material = fenceLineMat; hrLine.isPickable = false;
}
// 파울 폴(노란 기둥)
[-45, 45].forEach(a => {
  const pole = BABYLON.MeshBuilder.CreateCylinder('pole' + a, { diameter: 0.35, height: 16, tessellation: 10 }, scene);
  pole.position.copyFrom(polar(a, FENCE.line + 0.3, 8)); pole.material = fenceLineMat; pole.isPickable = false;
});
// 거리 표시(담장 안쪽 면에 숫자)
const distSign = (deg, text) => {
  const tex = new BABYLON.DynamicTexture('dist' + deg, { width: 256, height: 128 }, scene, true);
  tex.hasAlpha = true;
  const ctx = tex.getContext();
  ctx.clearRect(0, 0, 256, 128);
  ctx.font = 'bold 92px "Do Hyeon", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff'; ctx.fillText(text, 128, 70);
  tex.update();
  const m = new BABYLON.StandardMaterial('distM' + deg, scene);
  m.diffuseTexture = tex; m.useAlphaFromDiffuseTexture = true; m.emissiveColor = new BABYLON.Color3(0.6, 0.6, 0.6);
  m.specularColor = new BABYLON.Color3(0, 0, 0);
  const p = BABYLON.MeshBuilder.CreatePlane('distP' + deg, { width: 3.2, height: 1.6 }, scene);
  p.position.copyFrom(polar(deg, fenceDist(deg) - 0.05, 1.6));
  p.rotation.y = deg * Math.PI / 180;      // 평면 앞면이 홈플레이트 쪽을 보게
  p.material = m; p.isPickable = false;
};
distSign(-42, '98'); distSign(42, '98'); distSign(-22.5, Math.round(fenceDist(22.5)) + ''); distSign(22.5, Math.round(fenceDist(22.5)) + ''); distSign(0, '122');

// 타구가 담장에 닿는 순간(담장 거리를 처음 넘는 점). 없으면 -1
const fenceCrossIndex = pts => pts.findIndex(q => {
  const deg = Math.atan2(q.x, q.z) * 180 / Math.PI;
  return Math.abs(deg) <= 45 && Math.hypot(q.x, q.z) >= fenceDist(deg);
});
// 외야 관중석 바닥 높이(홈런 타구가 관중석에 떨어지는 곳을 찾을 때 씀)
const bleacherFloor = (deg, r) => {
  const r0 = fenceDist(deg) + STANDS.outfieldGap;
  if (r < r0) return 0;
  const k = Math.min(Math.floor((r - r0) / STANDS.rowDepth), STANDS.rows - 1);
  return STANDS.outfieldFront + k * STANDS.rowRise;
};

// ---------- 계단식 관중석 ----------
const standMat = mat('#34465f'); standMat.backFaceCulling = false;
const backMat = mat('#24324a'); backMat.backFaceCulling = false;
// 내야 관중석 안쪽 가장자리: 파울 라인에서 gap만큼 떨어진 선(홈플레이트 뒤에서 만난다). deg: 54~306
const infieldR = (deg, gap) => {
  const a = deg <= 180 ? deg : 360 - deg;
  return gap / Math.sin((a - 45) * Math.PI / 180);
};
// 앞에서 뒤로 계단 모양 경로들을 만든다. at(deg, k) = k번째 줄 앞 가장자리 거리, y(k) = 높이
const buildSteps = (name, degs, at, y0) => {
  const paths = [];
  const N = STANDS.rows;
  paths.push(degs.map(d => polar(d, at(d, 0), 0)));          // 맨 앞 벽 아래
  for (let k = 0; k < N; k++) {
    const y = y0 + k * STANDS.rowRise;
    paths.push(degs.map(d => polar(d, at(d, k), y)));        // 이 줄 앞
    paths.push(degs.map(d => polar(d, at(d, k + 1), y)));    // 이 줄 뒤
  }
  paths.push(degs.map(d => polar(d, at(d, N), y0 + N * STANDS.rowRise + 2)));   // 뒤 난간
  paths.push(degs.map(d => polar(d, at(d, N), 0)));         // 뒤 벽 아래
  const m = BABYLON.MeshBuilder.CreateRibbon(name, { pathArray: paths, sideOrientation: BABYLON.Mesh.DOUBLESIDE }, scene);
  m.material = standMat; m.isPickable = false;
  return m;
};
const range = (a, b, step) => { const r = []; for (let d = a; d <= b + 1e-6; d += step) r.push(d); return r; };
const IN_DEGS = range(54, 306, 2);
const OUT_DEGS = range(-46, 46, 1.5);
const inAt = (d, k) => infieldR(d, STANDS.infieldGap + k * STANDS.rowDepth);
const outAt = (d, k) => fenceDist(d) + STANDS.outfieldGap + k * STANDS.rowDepth;
buildSteps('standsIn', IN_DEGS, inAt, STANDS.infieldFront);
buildSteps('standsOut', OUT_DEGS, outAt, STANDS.outfieldFront);
// 홈플레이트 뒤 그물 벽(내야 관중석 첫 줄 앞)
{
  const net = BABYLON.MeshBuilder.CreateRibbon('backstop', {
    pathArray: [IN_DEGS.map(d => polar(d, inAt(d, 0) - 0.1, 0)), IN_DEGS.map(d => polar(d, inAt(d, 0) - 0.1, STANDS.infieldFront))],
    sideOrientation: BABYLON.Mesh.DOUBLESIDE }, scene);
  net.material = backMat; net.isPickable = false;
}

// ---------- 관객: 몸통 + 머리. 수천 명을 '씬 인스턴스'로 두 번에 그린다(한 사람에 삼각형 24개) ----------
const crowdBody = BABYLON.MeshBuilder.CreateBox('crowdBody', { width: 0.44, height: 0.56, depth: 0.3 }, scene);
crowdBody.bakeTransformIntoVertices(BABYLON.Matrix.Translation(0, 0.3, 0));
const crowdHead = BABYLON.MeshBuilder.CreateBox('crowdHead', { size: 0.26 }, scene);   // 멀리서 보이니 머리도 상자로(삼각형 12개)
crowdHead.bakeTransformIntoVertices(BABYLON.Matrix.Translation(0, 0.74, 0));
const crowdBodyMat = mat('#ffffff'); crowdBody.material = crowdBodyMat;
crowdHead.material = mat('#e6bb92');
[crowdBody, crowdHead].forEach(m => { m.isPickable = false; m.alwaysSelectAsActiveMesh = true; });

const crowd = { n: 0, matrix: null, baseY: null, phase: null, side: null, cheerT0: -1e9, cheerLevel: 0 };
{
  const seats = [];
  const addRow = (degs, rAt, y, k) => {
    // 줄 가운데에 한 사람씩, 간격 seatGap
    const r = (d) => (rAt(d, k) + rAt(d, k + 1)) / 2;
    for (let i = 0; i < degs.length - 1; i++) {
      const d0 = degs[i], d1 = degs[i + 1];
      const p0 = polar(d0, r(d0)), p1 = polar(d1, r(d1));
      const len = BABYLON.Vector3.Distance(p0, p1);
      const n = Math.max(1, Math.round(len / STANDS.seatGap));
      for (let j = 0; j < n; j++) {
        if (Math.random() > STANDS.fill) continue;
        const p = BABYLON.Vector3.Lerp(p0, p1, (j + Math.random() * 0.3) / n);
        seats.push({ x: p.x, z: p.z, y, side: (d0 + d1) / 2 });
      }
    }
  };
  for (let k = 0; k < STANDS.rows; k++) {
    addRow(IN_DEGS, inAt, STANDS.infieldFront + k * STANDS.rowRise, k);
    addRow(OUT_DEGS, outAt, STANDS.outfieldFront + k * STANDS.rowRise, k);
  }
  const n = crowd.n = seats.length;
  crowd.matrix = new Float32Array(n * 16);
  crowd.baseY = new Float32Array(n); crowd.phase = new Float32Array(n); crowd.side = new Float32Array(n);
  const m = new BABYLON.Matrix();
  seats.forEach((s, i) => {
    // 모두 홈플레이트를 바라본다
    const yaw = Math.atan2(-s.x, -s.z);
    BABYLON.Matrix.ComposeToRef(new BABYLON.Vector3(1, 1, 1), BABYLON.Quaternion.RotationYawPitchRoll(yaw, 0, 0),
      new BABYLON.Vector3(s.x, s.y, s.z), m);
    m.copyToArray(crowd.matrix, i * 16);
    crowd.baseY[i] = s.y; crowd.phase[i] = Math.random() * Math.PI * 2;
    crowd.side[i] = s.side > 180 ? s.side - 360 : s.side;   // 3루 쪽 음수, 1루 쪽 양수
  });
  crowdBody.thinInstanceSetBuffer('matrix', crowd.matrix, 16, false);
  crowdHead.thinInstanceSetBuffer('matrix', crowd.matrix, 16, false);
}
// 옷 색: 홈팀 색이 가장 많고, 원정팀 색이 조금, 나머지는 여러 색
const CROWD_COLORS = ['#e8e8e8', '#2b2b2b', '#4d7fc4', '#7bc47f', '#f0d35a', '#b06ac9', '#e98f5a', '#9aa3ad', '#d65a7a'];
const paintCrowd = (homeColors, awayColors) => {
  const col = new Float32Array(crowd.n * 4);
  for (let i = 0; i < crowd.n; i++) {
    const r = Math.random();
    const hex = r < 0.45 ? homeColors[r < 0.3 ? 0 : 1] : r < 0.6 ? awayColors[r < 0.53 ? 0 : 1]
      : CROWD_COLORS[Math.floor(Math.random() * CROWD_COLORS.length)];
    const c = BABYLON.Color3.FromHexString(hex);
    col.set([c.r, c.g, c.b, 1], i * 4);
  }
  crowdBody.thinInstanceSetBuffer('color', col, 4, true);
};
paintCrowd(TEAMS[1].colors, TEAMS[0].colors);

// 안타·홈런 때 관객이 들썩인다. level 1 = 안타(일부만 작게), 2 = 홈런(모두 크게)
const CHEER_MS = 2600;
const crowdCheer = level => { crowd.cheerT0 = now(); crowd.cheerLevel = level; };
scene.onBeforeRenderObservable.add(() => {
  const t = now() - crowd.cheerT0;
  if (t > CHEER_MS + 200 && crowd.cheerLevel === 0) return;
  const lvl = crowd.cheerLevel;
  const fade = t < CHEER_MS ? 1 - t / CHEER_MS : 0;
  const amp = (lvl === 2 ? 0.35 : 0.18) * fade;
  const M = crowd.matrix;
  for (let i = 0; i < crowd.n; i++) {
    // 안타 때는 절반 정도만 뛴다
    const jump = lvl === 2 || crowd.phase[i] < Math.PI ? Math.max(0, Math.sin(t / 130 + crowd.phase[i])) * amp : 0;
    M[i * 16 + 13] = crowd.baseY[i] + jump;
  }
  crowdBody.thinInstanceBufferUpdated('matrix');
  crowdHead.thinInstanceBufferUpdated('matrix');
  if (fade === 0) crowd.cheerLevel = 0;
});

// ---------- 중앙 외야 전광판(관중석 위) ----------
const BOARD_W = 1024, BOARD_H = 448;
const boardTex = new BABYLON.DynamicTexture('boardTex', { width: BOARD_W, height: BOARD_H }, scene, true);
const boardMat = new BABYLON.StandardMaterial('boardMat', scene);
boardMat.diffuseColor = new BABYLON.Color3(0, 0, 0); boardMat.specularColor = new BABYLON.Color3(0, 0, 0);
boardMat.emissiveTexture = boardTex; boardMat.disableLighting = true;
// 처음 한 번 빈 화면을 그려 둔다(한 번도 그리지 않은 텍스처는 '준비 안 됨'이라 구장 로딩이 끝나지 않는다)
{ const c = boardTex.getContext(); c.fillStyle = '#0b1610'; c.fillRect(0, 0, BOARD_W, BOARD_H); boardTex.update(); }
{
  const r = outAt(0, STANDS.rows) + 1.5;
  const baseY = STANDS.outfieldFront + STANDS.rows * STANDS.rowRise + 2;
  const W = 34, H = W * BOARD_H / BOARD_W;
  const frame = BABYLON.MeshBuilder.CreateBox('boardFrame', { width: W + 1.2, height: H + 1.2, depth: 0.8 }, scene);
  frame.position.set(0, baseY + 3 + H / 2, r + 0.5); frame.material = mat('#1a1f26'); frame.isPickable = false;
  const board = BABYLON.MeshBuilder.CreatePlane('board', { width: W, height: H }, scene);
  board.position.set(0, baseY + 3 + H / 2, r);   // 평면 앞면은 기본으로 홈플레이트 쪽(-z)을 본다
  board.material = boardMat; board.isPickable = false;
  [-1, 1].forEach(s => {
    const leg = BABYLON.MeshBuilder.CreateBox('boardLeg', { width: 1, height: baseY + 3, depth: 1 }, scene);
    leg.position.set(s * W * 0.35, (baseY + 3) / 2, r + 0.5); leg.material = frame.material; leg.isPickable = false;
  });
}
