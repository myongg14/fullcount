// 투구: 투수 데이터와 구종, 공 궤적, 컴퓨터 투수 체력, 투수 시점 조준·세기 막대, 견제·보크, 컴퓨터 타자 스윙, 투수 교체

// 전광판·화면에 보이는 구속 배율(공이 오는 속도는 그대로)
const SPEED_DISPLAY_SCALE = 1.05;
// 구종 정보를 만든다(k: 종류, n: 이름, d: 비행 시간, v: 구속 범위)
const pitchDef = (k, n, d, v, x) => Object.assign({ k, n, d, v }, x || {});
// 투구폼별 팔 각도(0 오버핸드, 1 사이드암, 2 언더핸드, 3 서브마린)
const ARM_SLOTS = [
  null,
  { a0: -0.9, a1: 1.25, a2: -0.5, ft: -0.6, ph: -1.25, lx: 0.25, lz: -0.5, dy: 0.03 },
  { a0: -0.9, a1: 0.85, a2: -0.85, ft: -0.5, ph: -0.1, lx: 0.45, lz: -0.3, dy: 0.08 },
  { a0: -0.9, a1: 0.8, a2: -0.95, ft: -0.4, ph: -0.2, lx: 0.7, lz: -0.48, dy: 0.2 },
];
// 구속·구종은 실제 선수 특징을 바탕으로 게임용으로 조정한 근사값
const PITCHERS = [
  {
    n: '오승환',
    cmd: 0.75,
    s: '오버핸드 · 돌직구',
    slot: 0,
    cy: 2.05,
    ars: [
      pitchDef('fast', '직구', 850, [147, 157]),
      pitchDef('slider', '슬라이더', 980, [134, 144]),
      pitchDef('sinker', '싱커', 930, [136, 146]),
      pitchDef('change', '체인지업', 1250, [128, 137]),
      pitchDef('fork', '포크', 1200, [132, 140]),
    ],
  },
  {
    n: '김병현',
    cmd: 0.6,
    s: '사이드암 · 프리스비 슬라이더',
    slot: 1,
    cy: 1.85,
    ars: [
      pitchDef('fast', '직구', 850, [141, 153]),
      pitchDef('slider', '슬라이더', 980, [128, 139], { mx: 1.45 }),
      pitchDef('sinker', '싱커', 930, [136, 146]),
      pitchDef('change', '체인지업', 1250, [122, 132]),
    ],
  },
  {
    n: '고영표',
    cmd: 0.8,
    s: '언더핸드 · 체인지업',
    slot: 2,
    cy: 1.6,
    ars: [
      pitchDef('fast', '직구', 850, [124, 137], { gf: 0.22 }),
      pitchDef('change', '체인지업', 1250, [115, 127], { mx: 1.2 }),
      pitchDef('curve', '커브', 1150, [104, 116]),
      pitchDef('knuckle', '너클볼', 1250, [96, 108]),
    ],
  },
  {
    n: '박종훈',
    cmd: 0.55,
    s: '서브마린 · 낮은 릴리스',
    slot: 3,
    cy: 1.35,
    ars: [
      pitchDef('fast', '직구', 850, [122, 135], { gf: 0.12 }),
      pitchDef('curve', '커브', 1150, [98, 114], { mx: 1.2 }),
      pitchDef('slider', '슬라이더', 980, [112, 124]),
    ],
  },
  {
    n: '류현진',
    hand: 'L',
    cmd: 0.8,
    s: '오버핸드 · 체인지업',
    slot: 0,
    cy: 2.05,
    ars: [
      pitchDef('fast', '직구', 850, [140, 150]),
      pitchDef('curve', '커브', 1150, [108, 121]),
      pitchDef('change', '체인지업', 1250, [124, 134]),
      pitchDef('slider', '슬라이더', 980, [128, 138]),
    ],
  },
  {
    n: '양현종',
    hand: 'L',
    cmd: 0.7,
    s: '스리쿼터 · 슬라이더',
    slot: 0,
    cy: 1.95,
    ars: [
      pitchDef('fast', '직구', 850, [138, 148]),
      pitchDef('slider', '슬라이더', 980, [126, 137], { mx: 1.2 }),
      pitchDef('change', '체인지업', 1250, [121, 131]),
      pitchDef('curve', '커브', 1150, [108, 119]),
    ],
  },
];
PITCHERS.forEach(P => {
  P.hand = P.hand || 'R';
});
// 지금 투수의 구종 목록
let pitchTypes = PITCHERS[0].ars;
// 지금 투수 번호(PITCHERS 순서)
let curPitcher = 0;
// 구종별 궤적 색
const PITCH_COLORS = {
  fast: '#ff4d4d',
  slider: '#ffc23d',
  sinker: '#ff8a3d',
  change: '#4dd2ff',
  curve: '#7b8cff',
  fork: '#4dffb0',
  knuckle: '#e06bff',
};
// 공 궤적 점 최대 개수
const TRAIL_MAX = 70;
const trailGeo = new THREE.BufferGeometry();
const trailPos = new Float32Array(TRAIL_MAX * 3);
const trailMat = new THREE.PointsMaterial({ size: 0.09, transparent: true, opacity: 0.85, depthWrite: false });
// 지금 찍힌 궤적 점 수
let trailCount = 0;
trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPos, 3));
// 공 궤적 점
const trailPoints = new THREE.Points(trailGeo, trailMat);
trailPoints.frustumCulled = false;
scene.add(trailPoints);
// 공 궤적 점을 지운다
function clearTrail() {
  trailCount = 0;
  trailGeo.setDrawRange(0, 0);
}
// 공 궤적 점을 하나 추가한다
function addTrail(q) {
  if (trailCount >= TRAIL_MAX) return;
  trailPos[trailCount * 3] = q.x;
  trailPos[trailCount * 3 + 1] = q.y;
  trailPos[trailCount * 3 + 2] = q.z;
  trailCount++;
  trailGeo.attributes.position.needsUpdate = true;
  trailGeo.setDrawRange(0, trailCount);
  trailMat.color.set(PITCH_COLORS[pitch.t.k] || '#ffffff');
}
// 컴퓨터 투수 체력을 줄이고 지치면 교체한다
function cpuPitcherTick() {
  if (pitcherMode || derby) return;
  cpuStamina = Math.max(0, cpuStamina - randRange(1, 1.7));
  if (cpuStamina < 20 && PITCHERS.length > 1) {
    const o = PITCHERS[curPitcher].n;
    selectPitcher((curPitcher + 1) % PITCHERS.length, false);
    cpuStamina = 100;
    setTimeout(() => showBanner('투수 교체', o + ' → ' + PITCHERS[curPitcher].n + ' 등판', false), 600);
  }
}
// 공이 스트라이크존에 들어왔는지
function inZone(p) {
  const m = 0.07;
  return Math.abs(p.xT) <= ZONE_HALF_W + m && p.yT >= ZONE_BOTTOM - m && p.yT <= ZONE_TOP + m;
}
// 투구 진행도 t(0~1)에서 공의 위치(구종별 휘는 궤적)
function pitchPos(p, t) {
  if (p.warp) t = Math.pow(Math.max(0, t), p.warp);
  t = t * (1 + 0.07 * (1 - t));
  const fk = p.fake ? 1 - t * t * t : 0;
  const tx = p.fake ? p.xT + ((p.xT < 0 ? -ZONE_HALF_W * 0.8 : ZONE_HALF_W * 0.8) - p.xT) * fk : p.xT,
    ty = p.fake ? p.yT + (clamp(p.yT, ZONE_BOTTOM + 0.12, ZONE_TOP - 0.12) - p.yT) * fk : p.yT;
  const q = new THREE.Vector3(p.rel.x + (tx - p.rel.x) * t, p.rel.y + (ty - p.rel.y) * t, p.rel.z * (1 - t));
  const T = p.t.d / 1250,
    MV = {
      curve: [0, -0.95, 2.6],
      change: [-0.2, -0.4, 2.2],
      slider: [0.9, -0.3, 2.6],
      sinker: [-0.55, -0.5, 2.4],
      fork: [0, -0.8, 2.5],
      knuckle: [p.side * 0.5, 0.15, 1.6],
    }[p.t.k] || [0, 0, 2],
    s = Math.pow(t, MV[2]) - t;
  q.y += 4.9 * T * T * (p.t.gf != null ? p.t.gf : p.t.k === 'fast' ? 0.7 : 1) * (t - t * t);
  const mk = Math.min(p.t.mx || 1, 1.2) * 0.75;
  q.x += MV[0] * s * mk;
  q.y += MV[1] * s * mk;
  return q;
}
// 조준점 표시
const aimEl = document.createElement('div');
aimEl.id = 'aimM';
document.body.appendChild(aimEl);
// 조준 중인 손가락 id
let aimPointer = null;
// 터치 위치(손가락에 가리지 않게 조금 위로)
const aimXY = e => [e.clientX, e.clientY - (e.pointerType === 'touch' ? 56 : 0)];
// 조준점 표시를 손가락 위치로 옮긴다
function aimMove(e) {
  const q = aimXY(e);
  aimEl.style.display = 'block';
  aimEl.style.left = q[0] + 'px';
  aimEl.style.top = q[1] + 'px';
}
// 내 투수 체력(0~100)
let myStamina = 100;
// 투구 세기(0.5~1, 막대로 조절)
let pitchPower = 0.8;
// 컴퓨터 투수가 견제할 베이스(-1 없음)
let pickoffBase = -1;
// 내가 투수일 때 컴퓨터 주자가 뛸 생각인지
let cpuStealPlan = false;
// 고른 구종 번호
let selPitch = 0;
// 투수 시점 카메라 위치
const pitcherCam = new THREE.Vector3(0.05, 2.05, -19.6);
// 견제할 베이스(1·2·3루) 방향 각도
const PK_YAW = [0, 1, 2].map(i => Math.atan2(BASES[i][0], BASES[i][1] + 18.44));
const PK_REST = new THREE.Vector3(-0.05, -0.25, 0.3);
const PK_COCK = new THREE.Vector3(-0.28, 0.08, -0.4);
const PK_REL = new THREE.Vector3(-0.12, 0.12, 0.57);
const PK_FOL = new THREE.Vector3(0.22, -0.28, 0.4);
// 투수의 견제 동작(p: 진행도, i: 견제할 베이스)
function pickPose(p, i) {
  const h = pitcherRig,
    yw = PK_YAW[i],
    turn = smoothstep(0, 0.5, p),
    lift = smoothstep(0, 0.28, p) * (1 - smoothstep(0.28, 0.55, p)),
    plant = smoothstep(0.4, 0.6, p),
    cock = smoothstep(0.05, 0.5, p),
    rel = smoothstep(0.52, 0.78, p),
    fol = smoothstep(0.78, 1, p);
  resetPose(h, 0.95 - 0.08 * plant);
  pitcherRoot.rotation.y = yw * turn;
  pitcherRoot.position.set(
    Math.sin(yw) * 0.35 * plant,
    0.25,
    -18.44 + Math.cos(yw) * 0.35 * plant - (i === 2 ? 0.3 * smoothstep(0, 0.4, p) : 0),
  );
  h.spine.rotation.set(0.08 + 0.2 * rel, -0.5 * cock * (1 - rel) + 0.3 * smoothstep(0.62, 0.9, p), -0.12 * fol);
  h.head.rotation.set(-0.15, clamp(yw * (1 - turn) * 0.8 - h.spine.rotation.y, -1.2, 1.2), 0);
  h.L.th.rotation.set(-0.75 * lift - 0.45 * plant, 0, 0.1);
  h.L.sn.rotation.x = 1.0 * lift + 0.25 * plant;
  h.Rl.th.rotation.x = 0.15 * plant;
  h.Rl.sn.rotation.x = 0.2 * plant;
  h.La.ua.rotation.set(-1.0 + 0.55 * rel, 0, 0.15 - 0.1 * rel);
  h.La.fa.rotation.x = -1.3;
  if (pitcherLefty) {
    mirrorPose(h);
    h.head.rotation.y = clamp(yw * (1 - turn) * 0.8 - h.spine.rotation.y, -1.2, 1.2);
  }
  pitcherRoot.updateMatrixWorld(true);
  const TAx = pitcherLefty ? h.La : h.Ra,
    q = pitcherRoot.quaternion,
    S = TAx.ua.getWorldPosition(V3());
  const o = PK_REST.clone().lerp(PK_COCK, cock).lerp(PK_REL, rel).lerp(PK_FOL, fol);
  if (pitcherLefty) o.x *= -1;
  o.applyQuaternion(q);
  armIK(TAx, S.add(o), new THREE.Vector3(pitcherLefty ? 0.5 : -0.5, -0.8, -0.2).applyQuaternion(q));
  pitcherRoot.updateMatrixWorld(true);
}
// 견제 뒤 투수를 제자리로
function pickEnd() {
  pitcherRoot.rotation.y = 0;
  pitcherRoot.position.set(0, 0.25, -18.44);
  pitcherAnim(0, 0);
  ball.visible = false;
}
// 견제구를 날린다
function pickThrow(A, B, dur, done) {
  ball.visible = true;
  tween(
    dur,
    u => {
      ball.position.lerpVectors(A, B, u);
      ball.position.y += Math.sin(Math.PI * u) * 0.25;
    },
    () => {
      ball.visible = false;
      if (done) done();
    },
  );
}
// 견제(또는 보크)를 실행한다
function doPick(i, lean) {
  if (!pitcherMode && rand() < 0.08) {
    balk();
    return;
  }
  phase = 'anim';
  stealReq = false;
  cpuStealPlan = false;
  pickoffBase = -1;
  $('hint').textContent = '';
  $('info').textContent = '';
  const out = lean && rand() < 0.55,
    TA = [380, 520, 420][i],
    B = basePoint(i);
  let thrown = false;
  pickPose(0, i);
  tween(TA, u => {
    pickPose(u, i);
    if (!thrown && u >= 0.78) {
      thrown = true;
      const A = (pitcherLefty ? pitcherRig.La : pitcherRig.Ra).hd.getWorldPosition(V3()),
        kmh = randRange(108, 122),
        dur = (A.distanceTo(B) / (kmh / 3.6)) * 1000;
      $('info').textContent = `견제구 ${Math.round(kmh)}km/h`;
      pickThrow(A, B, dur, () => {
        pickEnd();
        let t = '견제구!',
          sub = '세이프',
          g = false;
        if (out) {
          bases[i] = 0;
          const e = runnerOut();
          t = e ? '견제사! 3아웃' : '견제사!';
          sub = '아웃';
          g = pitcherMode;
        }
        showBanner(t, sub, g);
        updateHud();
        phase = 'wait';
        waitUntil = now + 1100;
        tone(out ? 200 : 420, 0.12);
      });
    } else if (!thrown && pitcherRoot.visible) {
      ball.visible = true;
      (pitcherLefty ? pitcherRig.La : pitcherRig.Ra).hd.getWorldPosition(ball.position);
    }
  });
}
// 내가 투수일 때 컴퓨터 타자가 칠지와 타이밍을 정한다
function aiSwing() {
  const z = inZone(pitch),
    k = pitch.t.k,
    cb = batterContact();
  const pz = clamp(CFG.aiZone + (cb - 5) * 0.03, 0.5, 0.95) * (k === 'curve' ? 0.92 : 1),
    po = clamp(CFG.aiOut - (cb - 5) * 0.02, 0.1, 0.45);
  if (rand() < (z ? pz : po)) {
    const e =
        randRange(-1, 1) * 0.11 * level().aiTimingError +
        (k === 'change' ? 0.07 : k === 'curve' ? 0.05 : k === 'slider' || k === 'sinker' ? 0.03 : 0),
      ct = pitch.t0 + pitch.t.d + e * 1000;
    swing = { t0: ct - 90, contactT: ct, miss: false, done: false };
  }
}
// 조준한 화면 위치로 투구를 정한다(세기·체력에 따른 오차 포함)
function aimTap(px, py) {
  const W = innerWidth,
    H = innerHeight,
    P = (x, y) => {
      const v = new THREE.Vector3(x, y, 0).project(camera);
      return [((v.x + 1) / 2) * W, ((1 - v.y) / 2) * H];
    },
    a = P(-ZONE_HALF_W, ZONE_TOP),
    c = P(ZONE_HALF_W, ZONE_BOTTOM);
  let x = -ZONE_HALF_W + ((px - a[0]) / (c[0] - a[0])) * 2 * ZONE_HALF_W,
    y = ZONE_TOP - ((py - a[1]) / (c[1] - a[1])) * (ZONE_TOP - ZONE_BOTTOM);
  const t = Object.assign({}, pitchTypes[selPitch]),
    e = pitchPower * (0.7 + (0.3 * myStamina) / 100),
    j =
      { fast: 0.06, curve: 0.11, change: 0.09, slider: 0.1, sinker: 0.1, fork: 0.09, knuckle: 0.14 }[t.k] *
      (0.75 + 0.9 * (e - 0.5) + (1 - myStamina / 100) * 0.6);
  t.d = Math.round(t.d * (1.27 - 0.34 * e) * 0.93);
  myStamina = Math.max(0, myStamina - (1.2 + 2.6 * pitchPower) * 0.65);
  x = clamp(x, -0.8, 0.8) + randRange(-j, j);
  y = clamp(y, 0.15, 1.7) + randRange(-j, j) * 0.8;
  Object.assign(pitch, {
    t,
    xT: x,
    yT: Math.max(0.12, y),
    kmh: Math.round(randRange(t.v[0], t.v[1]) * (0.88 + 0.14 * e)),
    side: rand() < 0.5 ? -1 : 1,
    t0: 0,
  });
  phase = 'windup';
  phaseStart = now;
  $('hint').textContent = bases.some(x => x) ? '투구 중 견제하면 보크!' : '';
  $('info').textContent = '';
  stealReq = cpuStealPlan && stealer() >= 0;
}
{
  const gw = $('pwb'),
    sp = e => {
      const r = gw.getBoundingClientRect();
      pitchPower = clamp(0.5 + (0.5 * (e.clientX - r.left)) / r.width, 0.5, 1);
    };
  gw.addEventListener('pointerdown', e => {
    e.preventDefault();
    e.stopPropagation();
    if (phase === 'aim') {
      gw.setPointerCapture(e.pointerId);
      sp(e);
    }
  });
  gw.addEventListener('pointermove', e => {
    if (e.buttons && phase === 'aim') sp(e);
  });
}
// 보크: 주자 모두 한 베이스씩 진루
function balk() {
  stealReq = false;
  cpuStealPlan = false;
  pickoffBase = -1;
  steal = null;
  ball.visible = false;
  $('hint').textContent = '';
  $('info').textContent = '';
  const r = occupied(bases[2]);
  bases = [0, bases[0], bases[1]];
  score += r;
  showBanner('보크!', r ? '+1점 · 주자 진루' : '주자 모두 진루', !pitcherMode);
  updateHud();
  tone(300, 0.25, 0.1, 'triangle');
  phase = 'wait';
  waitUntil = now + 1500;
}
// 투수를 고른다(mid: 경기 중 교체면 배너)
function selectPitcher(i, mid) {
  curPitcher = i;
  const P = PITCHERS[i];
  {
    const nh = P.hand === 'L',
      np = nh ? pitcherRigL : pitcherRigR;
    pitcherLefty = nh;
    if (np !== pitcherRig) {
      pitcherRig.root.visible = false;
      pitcherRig = np;
      pitcherRoot = pitcherRig.root;
      pitcherRoot.visible = !pitcherMode;
    }
  }
  armSlot = ARM_SLOTS[P.slot];
  pitchTypes = P.ars;
  selPitch = 0;
  pitcherCam.y = P.cy;
  if (pitcherMode) {
    myStamina = 100;
    if (phase === 'aim') camera.position.copy(pitcherCam);
  }
  $('sw').textContent = '🔄 ' + P.n;
  [...$('pc').children].forEach((b, k) => b.classList.toggle('on', k === i));
  if (mid) {
    showBanner(P.n + ' 등판', P.s, true);
    pitcherAnim(0, 0);
  }
}
