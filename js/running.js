// 주루: 주자 위치, 볼넷 밀어내기, 도루, 태그업, 한 베이스 더, 안타 뒤 주자 연출, 홈런 베이스 돌기

// 타자를 1루로 보내고 밀려나는 주자를 진루시킨다
function walk() {
  if (bases[0]) {
    if (bases[1]) {
      if (bases[2]) score++;
      bases[2] = bases[1];
    }
    bases[1] = bases[0];
  }
  bases[0] = batterTag();
}
// 도루 버튼을 눌렀는지
let stealReq = false;
// 진행 중인 도루 { i: 주자 베이스, ok: 성공 여부 }
let steal = null;
// 한 베이스 더 갈 수 있는 주자 베이스(null 없음)
let extraBase = null;
// i루 주자가 서 있는 자리
const runnerSpot = i => new THREE.Vector3(BASES[i][0] + 0.7, 0, BASES[i][1] + 0.7);
// 도루할 수 있는 주자(0: 1루, 1: 2루, 없으면 -1)
const stealer = () => (bases[1] && !bases[2] ? 1 : bases[0] && !bases[1] ? 0 : -1);
// i루 베이스 위 송구 목표 지점
const basePoint = i => new THREE.Vector3(BASES[i][0], 1.1, BASES[i][1]);
// 주자 칸에 넣을 타자 표시(타순+1)
const batterTag = () => curBatter() + 1;
// 주자가 있으면 1, 없으면 0
const occupied = x => (x ? 1 : 0);
// i루 주자의 주력
const runnerSpeed = i => {
  const p = LINEUPS[pitcherMode ? 'o' : 'm'][((bases[i] || 1) - 1) % 9];
  return p ? p[2] : 5;
};
// 태그업할 수 있는 주자(없으면 -1)
const tagUpCandidate = () => {
  if (outs >= 2) return -1;
  for (let i = 2; i >= 0; i--) if (bases[i] && (i === 2 || !bases[i + 1])) return i;
  return -1;
};
// 주자를 i루에서 j루로 달리게 한다
function runTo(i, j, dur, done) {
  const A = runnerSpot(i),
    B = runnerSpot(j),
    r = runnerRoots[i];
  r.rotation.y = Math.atan2(B.x - A.x, B.z - A.z);
  tween(
    dur,
    u => {
      r.position.lerpVectors(A, B, u);
      r.visible = true;
      runnerRoots[j].visible = false;
      runPose(runnerRigs[i], frameDt, 8);
    },
    () => {
      r.position.copy(A);
      r.rotation.y = -2.3;
      readyPose(runnerRigs[i]);
      updateHud();
      if (done) done();
    },
  );
}
// 주자 아웃 하나(3아웃이면 공수 교대). 이닝이 끝나면 true
function runnerOut() {
  outs++;
  if (outs >= 3) {
    outs = 0;
    bases = [0, 0, 0];
    nextHalf();
    newBat();
    return true;
  }
  return false;
}
// 투구와 함께 도루를 시작한다
function startSteal() {
  const i = stealer();
  if (!stealReq || i < 0) {
    stealReq = false;
    return;
  }
  steal = { i, ok: rand() < clamp(0.12 + (pitch.t.d - 575) / 600 + (runnerSpeed(i) - 5) * 0.04, 0.1, 0.6) };
  runTo(i, i + 1, pitch.t.d * 1.08 + 560);
  tone(700, 0.1, 0.08);
}
// 도루 성공/실패를 판정한다
function endSteal(ip) {
  const r = { t: '', e: false };
  if (!steal) return r;
  const { i, ok } = steal,
    rv = bases[i];
  steal = null;
  stealReq = false;
  bases[i] = 0;
  if (ip || ok) {
    bases[i + 1] = rv;
    r.t = ip ? '' : '도루 성공!';
  } else {
    r.t = '도루 실패!';
    throwBall(new THREE.Vector3(0, 1.1, 1), basePoint(i + 1), 550);
    r.e = runnerOut();
    tone(200, 0.2);
  }
  return r;
}
// 한 베이스 더 달리기를 판정한다
function doExtra() {
  const j = extraBase;
  extraBase = null;
  if (j == null) return;
  const ok = rand() < clamp(0.5 - (hit.dist || 60) / 400 + (runnerSpeed(j) - 5) * 0.03, 0.15, 0.42),
    f = fielders[hit.fi].g.position;
  $('hint').textContent = '';
  const rv = bases[j];
  bases[j] = 0;
  let t,
    e = false;
  if (ok) {
    bases[j + 1] = rv;
    t = '한 베이스 더! 세이프';
  } else {
    t = '송구 아웃!';
    e = runnerOut();
  }
  throwBall(new THREE.Vector3(f.x, 1.3, f.z), basePoint(j + 1), 650);
  runTo(j, j + 1, 950);
  showBanner(t, e ? '3아웃' : '', ok);
  waitUntil = now + 1700;
  tone(ok ? 660 : 200, 0.15);
}
// 안타 뒤 주자들이 베이스를 도는 연출, 끝나면 점수 반영
function runScene(bo, ih, ph, k) {
  const nb = bases.slice(),
    ended = inning !== ih || pitcherMode !== ph;
  if (ended || (!pendingRuns && !bo.some(Boolean))) {
    score += pendingRuns;
    pendingRuns = 0;
    return;
  }
  extraBase = null;
  $('hint').textContent = '';
  bases = bo.slice();
  let T = 0;
  for (let i = 0; i < 3; i++) {
    if (!bo[i]) continue;
    const d =
      k === 'hr' || k === '3b'
        ? 3
        : k === '2b'
          ? i
            ? 3
            : 2
          : k === '1b'
            ? i
              ? 3
              : 1
            : i === 2 && pendingRuns > 0
              ? 3
              : -1;
    if (d < 0) continue;
    const P = [];
    for (let j = i; j <= d; j++) P.push(j < 3 ? runnerSpot(j) : new THREE.Vector3(0.4, 0, 0.5));
    const legs = P.length - 1,
      dur = legs * (k === 'hr' ? TROT_LEG_MS : 600);
    T = Math.max(T, dur);
    tween(
      dur,
      u => {
        const f = u * legs,
          a = Math.min(legs - 1, Math.floor(f)),
          v = f - a,
          r = runnerRoots[i];
        r.rotation.y = Math.atan2(P[a + 1].x - P[a].x, P[a + 1].z - P[a].z);
        r.position.lerpVectors(P[a], P[a + 1], v);
        r.visible = true;
        runPose(runnerRigs[i], frameDt, k === 'hr' ? 4 : 8);
      },
      () => {
        runnerRoots[i].position.copy(runnerSpot(i));
        runnerRoots[i].visible = false;
        readyPose(runnerRigs[i]);
      },
    );
  }
  if (pendingRuns > 0) T = Math.max(T, 900);
  if (k === 'hr' && trot) T = Math.max(T, trot.t0 + trot.dur - now);
  hit.rs = T;
  tween(
    T + 1,
    () => {},
    () => {
      score += pendingRuns;
      pendingRuns = 0;
      bases = nb;
      updateHud();
    },
  );
}
// 홈런 베이스 돌기 상태(null 아님 = 도는 중)
let trot = null;
// 베이스 한 구간 도는 시간(ms)
const TROT_LEG_MS = 3200;
// 베이스 돌기 때 카메라 위치
const TROT_CAM = new THREE.Vector3(0, 26, 30);
// 홈런 베이스 돌기를 건너뛴다
function skipTrot() {
  const jump = Math.max(0, trot.t0 + trot.dur - now) + 30;
  tweens.forEach(a => {
    a.t0 -= jump;
  });
  trot.t0 -= jump;
  if (phase === 'wait') waitUntil -= jump;
  if ($('hint').textContent === '탭하면 건너뛰기') $('hint').textContent = '';
}
// 홈런 타자의 베이스 돌기를 시작한다
function trotStart() {
  $('hint').textContent = '탭하면 건너뛰기';
  trot = {
    P: [
      batterRig.root.position.clone(),
      new THREE.Vector3(19.4, 0, -19.4),
      new THREE.Vector3(0, 0, -38.8),
      new THREE.Vector3(-19.4, 0, -19.4),
      new THREE.Vector3(0.2, 0, 0.3),
    ],
    t0: now,
    dur: TROT_LEG_MS * 4,
  };
  bat.visible = false;
}
// 베이스 돌기 한 프레임
function trotStep(dt) {
  const u = (now - trot.t0) / trot.dur;
  if (u >= 1) {
    batterRig.root.position.set(-0.78 * batSide, 0, 0.1);
    batterRig.root.rotation.z = 0;
    bat.visible = true;
    trot = null;
    if ($('hint').textContent === '탭하면 건너뛰기') $('hint').textContent = '';
    return;
  }
  const f = u * 4,
    k = Math.min(3, Math.floor(f)),
    A = trot.P[k],
    Q = trot.P[k + 1];
  batterRig.root.position.lerpVectors(A, Q, f - k);
  batterRig.root.rotation.set(0, Math.atan2(Q.x - A.x, Q.z - A.z), 0);
  runPose(batterRig, dt, 4);
}
