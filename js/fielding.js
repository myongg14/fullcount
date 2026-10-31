// 수비: 땅볼·뜬공 판단, 수비수 달리기, 타구 비행과 포구, 송구, 다이빙 캐치·홈런 훔치기

// 수비 조작 설정표
const FIELD_TUNING = {
  enabled: true, // false면 예전처럼(다이빙 버튼, 송구는 자동)
  slow: 0.5, // 캐치 링·송구 고르기 동안 시간 배율(0.5 = 절반 속도)
  ringWhiteR: 30, // 캐치 링: 흰 링 반지름(px)
  ringMaxR: 110, // 노란 링 처음 반지름(px)
  ringMinR: 8, // 노란 링 마지막 반지름(px, 공이 떨어지는 순간)
  ringPerfect: 0.08, // 완벽 판정 폭(노란 링 크기 범위에 대한 비율)
  ringGood: 0.2, // 좋음 판정 폭
  ringBonus: { perfect: 0.25, good: 0.1, bad: -0.2 }, // 링 판정에 따른 잡을 확률 보정
  ringTapPad: 60, // 노란 링 바깥 이 거리(px)까지 탭을 인정
  ringReach: 7.5, // 수비수가 낙구 지점에서 이 거리(m) 안일 때만 링을 띄운다(아슬아슬한 타구만)
  ringMinSec: 0.35, // 공이 떨어지기까지 이 시간(초)보다 적게 남았으면 링을 띄우지 않는다
  wallJump: 6, // 담장에서 이 거리(m) 안이면 다이빙 대신 점프 캐치
  rollFix: true, // 땅볼이 제대로 굴러가게(예전엔 땅에 닿은 뒤 매 프레임 튕김 처리로 금방 멈춤). false면 예전처럼
  choiceMs: 1200, // 송구 베이스를 고를 시간(ms). 넘으면 예전처럼 자동
  dpChance: 0.45, // 2루로 던진 뒤 1루로 이어 병살에 성공할 확률
  tagThrowBase: 0.75, // 태그업 주자를 송구로 잡을 기본 확률
  tagThrowPerM: 1 / 120, // 수비수와 베이스 거리 1m마다 줄어드는 확률
  cpuTag3: 0.6, // 컴퓨터 3루 주자가 태그업할 확률
  cpuTag2: 0.4, // 컴퓨터 2루 주자가 태그업할 확률
};
// 수비하는 팀의 평균 수비(KBO 데이터)에 따른 수비 범위 배율(±5% 안쪽). 수비 값이 없으면 1
function fieldDefFactor() {
  const rows = LINEUPS[pitcherMode ? 'm' : 'o'].filter(p => p[8] != null);
  return rows.length ? attrFactor(rows.reduce((s, p) => s + p[8], 0) / rows.length) : 1;
}
// 캐치 링 상태(null = 없음)와 송구 고르기 상태(null = 없음)
let catchRing = null;
let throwChoice = null;
// 수비 조작 중이면 시간이 느려진다
const fieldSlow = () => FIELD_TUNING.enabled && (catchRing || throwChoice);

// 땅볼: 타구 방향이 내야수 정면이면 잡아서 송구 아웃, 수비 사이로 빠지면 안타 (시프트로 옮긴 수비 위치도 반영)
function groundPlay(th, q) {
  const a = (th * Math.PI) / 180,
    dx = Math.sin(a),
    dz = -Math.cos(a),
    reach = clamp(5.2 - 2.2 * q, 2.8, 5.2) * fieldDefFactor();
  let bi = -1,
    bs = 9;
  fielders.forEach((f, i) => {
    if (i > 3) return;
    const t = f.h.x * dx + f.h.z * dz;
    if (t < 8) return;
    const sc = Math.abs(f.h.x * dz - f.h.z * dx) / reach;
    if (sc < bs) {
      bs = sc;
      bi = i;
    }
  });
  return { i: bi, p: bi < 0 ? 0 : clamp(1.1 - 0.85 * bs, 0.04, 0.88) };
}
// 굴러가는 공: 공이 구르는 경로에서 가장 가까운(적게 뛰는) 수비수가 처리
function chaser(dir, Dm, p0, onlyInf) {
  const sp0 = Math.sqrt(Dm * 8) * 0.8,
    len = (sp0 * sp0) / 6.4;
  let bi = 0,
    bd = 1e9,
    bx = 0,
    bz = 0;
  fielders.forEach((f, i) => {
    if (onlyInf && i > 3) return;
    const u = clamp((f.h.x - p0.x) * dir.x + (f.h.z - p0.z) * dir.z, 0, len),
      qx = p0.x + dir.x * u,
      qz = p0.z + dir.z * u,
      d = Math.hypot(f.h.x - qx, f.h.z - qz);
    if (d < bd) {
      bd = d;
      bi = i;
      bx = qx;
      bz = qz;
    }
  });
  return { i: bi, ip: new THREE.Vector3(bx, 0, bz) };
}
// 뜬공을 수비수가 잡을 수 있는 거리인지
const flyCatchable = (D, th) => {
  if (D > fenceUnits(th) - 20) return false;
  const a = (th * Math.PI) / 180,
    Dm = D * 0.42,
    L = new THREE.Vector3(Math.sin(a) * Dm, 0, -Math.cos(a) * Dm);
  let bd = 1e9;
  fielders.forEach(f => {
    bd = Math.min(bd, f.h.distanceTo(L));
  });
  const air = 0.4138 * Math.sqrt(Dm);
  return bd <= 9 * air * 0.92 * fieldDefFactor();
};
// 수비수를 목표 지점으로 달리게 한다
function moveFielder(f, tx, tz, sp, dt) {
  const g = f.g.position,
    dx = tx - g.x,
    dz = tz - g.z,
    d = Math.hypot(dx, dz);
  if (d > 0.05) {
    const m = Math.min(d, sp * dt);
    g.x += (dx / d) * m;
    g.z += (dz / d) * m;
    f.g.rotation.y = Math.atan2(dx, dz);
    f.mv = m / dt;
  }
}
// 날아가는 타구와 쫓아가는 수비수를 한 프레임 움직인다
function stepHit(dt) {
  const h = hit,
    p = ball.position;
  if (!h.hold) {
    burst(p.x, p.y, p.z, 1, [0.55, 0.55, 0.7], 0.3, 0.45);
    h.v.y -= GRAVITY * dt;
    p.addScaledVector(h.v, dt);
    // 땅에 닿음(떨어지는 중일 때만 튕긴다. 굴러가는 공은 아래 마찰로 서서히 멈춤)
    if (p.y <= 0.04 && (FIELD_TUNING.rollFix ? h.v.y < 0 : h.v.y <= 0)) {
      p.y = 0.04;
      if (!h.landed) {
        h.landed = true;
        h.dist = Math.hypot(p.x, p.z);
        burst(p.x, 0.2, p.z, 16, [0.75, 0.55, 0.35], 3.5, 0.7);
        if (h.k === 'hr') h.endAt = now + 900;
      }
      h.v.y *= -0.42;
      h.v.x *= 0.8;
      h.v.z *= 0.8;
      if (Math.abs(h.v.y) < 1.2) h.v.y = 0;
    }
    if (p.y <= 0.045 && h.v.y === 0) {
      const sp = Math.hypot(h.v.x, h.v.z),
        ns = Math.max(0, sp - 3.2 * dt);
      if (sp > 0) {
        h.v.x *= ns / sp;
        h.v.z *= ns / sp;
      }
      if (ns < 0.3 && !h.endAt && h.k !== 'go' && !['1b', '2b', '3b'].includes(h.k)) h.endAt = now + 600;
    }
  }
  if (!h.hold && !h.landed) maybeStartCatchRing();
  if (h.k === 'hr' && !h.hold) {
    replayT += dt;
    replayRec.push(replayT, p.x, p.y, p.z);
  }
  const f = fielders[h.fi];
  if (h.k !== 'hr' && h.k !== 'foul') {
    const th = (Math.atan2(p.x, -p.z) * 180) / Math.PI,
      wr = fenceUnits(th) * 0.42,
      n = Math.hypot(p.x, p.z);
    if (n > wr) {
      p.x *= (wr / n) * 0.97;
      p.z *= (wr / n) * 0.97;
      h.v.x *= -0.3;
      h.v.z *= -0.3;
      h.v.y = 2.4;
      h.L.set(p.x, 0, p.z);
    }
  }
  if (!h.hold && h.k !== 'hr' && h.k !== 'foul')
    fielders.forEach((g, gi) => {
      if (gi !== h.fi) moveFielder(g, g.h.x + (p.x - g.h.x) * 0.25, g.h.z + (p.z - g.h.z) * 0.25, 5, dt);
    });
  // 공이 오기로 한 자리(ip)에서 기다리다가, 공이 그 전에 멈추면 공 쪽으로 간다
  const stopped = FIELD_TUNING.rollFix && h.landed && Math.hypot(h.v.x, h.v.z) < 0.5,
    T = h.ip && !stopped && Math.hypot(p.x - h.ip.x, p.z - h.ip.z) > 2.5 ? h.ip : p;
  if (h.k === 'fo') moveFielder(f, h.L.x, h.L.z, h.fsp, dt);
  else if (h.k === 'go') moveFielder(f, T.x, T.z, 12, dt);
  else if (h.landed && ['1b', '2b', '3b'].includes(h.k)) moveFielder(f, T.x, T.z, 12, dt);
  else moveFielder(f, h.L.x, h.L.z, 11, dt);
  if (
    !h.hold &&
    ((h.k === 'fo' && (h.landed || (p.y < 2.2 && Math.hypot(f.g.position.x - p.x, f.g.position.z - p.z) < 1.4))) ||
      ((h.k === 'go' || (['1b', '2b', '3b'].includes(h.k) && h.landed)) &&
        Math.hypot(f.g.position.x - p.x, f.g.position.z - p.z) < 1.2))
  ) {
    h.hold = true;
    p.set(f.g.position.x, 1.1, f.g.position.z);
    if (h.fumble) {
      burst(p.x, 0.6, p.z, 16, [1, 0.35, 0.2], 0.22, 0.7);
      $('hint').textContent = '실책!';
    }
    if (h.k !== 'fo' && h.k !== 'go') {
      const bi = h.k === '1b' ? 0 : h.k === '2b' ? 1 : 2,
        A = new THREE.Vector3(f.g.position.x, 1.1, f.g.position.z);
      h.play = 'hit';
      h.pi = bi;
      h.pu = 0;
      tween(
        320,
        u => {
          h.pu = u;
        },
        () => seqThrow([A, basePoint(bi)], clamp((A.distanceTo(basePoint(bi)) / 32) * 800, 260, 800)),
      );
      h.endAt = now + 320 + clamp((A.distanceTo(basePoint(bi)) / 32) * 800, 260, 800) + 200;
    } else if (h.k === 'go' && h.fumble) {
      h.play = 'err';
      h.endAt = now + 900;
    } else if (h.k === 'go') {
      fieldGroundBall(h, f);
    } else if (!fieldFlyCatch(h, f)) {
      const tg_ = !pitcherMode && !h.fumble && tagUpCandidate() >= 0;
      h.endAt = now + (tg_ ? 1600 : 600);
      if (tg_) $('hint').textContent = '탭! 태그업 진루 (실패하면 아웃)';
    }
  }
  if (!h.endAt && !throwChoice && now - h.t0 > 9000) h.endAt = now;
  if (h.endAt && now >= h.endAt) land();
}
// 공을 A에서 B로 포물선으로 던진다
function throwBall(A, B, dur, done) {
  ball.visible = true;
  tween(
    dur,
    u => {
      ball.position.lerpVectors(A, B, u);
      ball.position.y += Math.sin(Math.PI * u) * 0.9;
    },
    () => {
      ball.visible = false;
      if (done) done();
    },
  );
}
// 수비수가 공을 잡아 던지는 동작
function fieldPose(p, i, fr) {
  const PH = fr.r,
    pitcher = fr.g,
    _dm = { set() {}, z: 0 };
  const h = PH,
    yw = PK_YAW[i],
    turn = smoothstep(0, 0.5, p),
    lift = smoothstep(0, 0.28, p) * (1 - smoothstep(0.28, 0.55, p)),
    plant = smoothstep(0.4, 0.6, p),
    cock = smoothstep(0.05, 0.5, p),
    rel = smoothstep(0.52, 0.78, p),
    fol = smoothstep(0.78, 1, p);
  resetPose(h, 0.95 - 0.08 * plant);
  fr.g.rotation.y = yw * turn;
  _dm.set(
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
  pitcher.updateMatrixWorld(true);
  const q = pitcher.quaternion,
    S = h.Ra.ua.getWorldPosition(V3());
  const o = PK_REST.clone().lerp(PK_COCK, cock).lerp(PK_REL, rel).lerp(PK_FOL, fol).applyQuaternion(q);
  armIK(h.Ra, S.add(o), new THREE.Vector3(-0.5, -0.8, -0.2).applyQuaternion(q));
  pitcher.updateMatrixWorld(true);
}
// 타구 처리 뒤 송구 연출과 추가 진루 안내
function landX() {
  const k = hit.k,
    f = fielders[hit.fi].g.position;
  if (k === 'go' && !hit.fumble && !hit.manual) throwBall(new THREE.Vector3(f.x, 1.3, f.z), basePoint(0), 650);
  if (!pitcherMode && k === 'fo' && hit.tag) {
    const { i, ok } = hit.tag;
    if (ok) {
      if (i < 2) runTo(i, i + 1, 600);
    } else throwBall(new THREE.Vector3(f.x, 1.3, f.z), i < 2 ? basePoint(i + 1) : new THREE.Vector3(0, 1.1, 0.2), 650);
  }
  if (!pitcherMode && (k === '1b' || k === '2b')) {
    const j = k === '1b' ? 0 : 1;
    if (!bases[j + 1]) {
      extraBase = j;
      $('hint').textContent = '탭! 한 베이스 더 (송구 아웃 위험)';
    }
  }
}
// 공을 여러 지점을 거쳐 차례로 던진다(병살 송구 등)
function seqThrow(P, dur) {
  ball.visible = true;
  tween(
    dur,
    u => {
      const n = P.length - 1,
        f = u * n,
        k = Math.min(n - 1, Math.floor(f)),
        v = f - k;
      ball.position.lerpVectors(P[k], P[k + 1], v);
      ball.position.y += Math.sin(Math.PI * v) * 0.7;
    },
    () => {
      ball.visible = false;
    },
  );
}
// 홈런 훔치기용: 담장까지 거리와 타구 거리
function robWall() {
  const L = hit.L,
    th = Math.atan2(L.x, -L.z) * 57.3;
  return { W: fenceUnits(th) * 0.42, Dm: Math.hypot(L.x, L.z) };
}
// 지금 다이빙 캐치를 시도할 수 있는지
function diveOK() {
  if (!(pitcherMode && phase === 'hit' && hit && !derby && !hit.landed && !hit.hold && !hit.dv && hit.air > 0.5))
    return false;
  if (['1b', '2b', '3b'].includes(hit.k)) return true;
  if (hit.k === 'hr') {
    const r = robWall();
    return r.Dm - r.W <= 5.5;
  }
  return false;
}
// 다이빙 버튼을 보이거나 숨긴다
function diveUI() {
  const e = $('dv');
  if (e) e.style.display = !FIELD_TUNING.enabled && diveOK() ? 'block' : 'none';
}
// 다이빙 캐치를 시도한다
function tryDive(grade) {
  if (paused || !diveOK()) return;
  if (FIELD_TUNING.enabled && grade === undefined) grade = catchGrade(); // 스와이프도 링 타이밍으로 판정
  catchRing = null;
  const h = hit,
    f = fielders[h.fi],
    L = h.L,
    hr = h.k === 'hr',
    r = robWall(),
    sc = hr ? r.W / r.Dm : 1,
    gp = f.g.position,
    d = Math.hypot(gp.x - L.x * sc, gp.z - L.z * sc),
    u = (now - h.t0) / (h.air * 1000);
  let p =
    clamp(0.8 - d * 0.07, 0.1, 0.72) +
    (grade ? FIELD_TUNING.ringBonus[grade] : u > 0.4 && u < 0.9 ? 0.12 : u < 0.25 ? -0.2 : 0);
  if (hr) p *= 0.6;
  p = clamp(p, 0.05, 0.85);
  const ok = d <= 9.5 && rand() < p;
  h.dv = ok ? 'ok' : 'no';
  if (ok) {
    if (hr) h.L = new THREE.Vector3(L.x * sc * 0.97, 0, L.z * sc * 0.97);
    h.k = 'fo';
    h.fsp = 17;
    h.fumble = false;
    if (isSeason) seasonStats.dv++;
    cheer(0.8, 2);
    tone(784, 0.25, 0.1, 'triangle');
  } else if (!hr) h.k = h.k === '1b' ? '2b' : '3b';
  const g = f.g,
    jump = FIELD_TUNING.enabled && (hr || r.W - r.Dm < FIELD_TUNING.wallJump);
  g.rotation.order = 'YXZ';
  tween(
    650,
    q => {
      // 담장 근처면 점프 캐치(위로), 아니면 앞으로 몸을 날리는 다이빙
      if (jump) g.position.y = 1.4 * Math.sin(Math.PI * q);
      else g.rotation.x = 1.35 * Math.sin(Math.PI * q);
    },
    () => {
      g.rotation.x = 0;
      g.position.y = 0;
    },
  );
  const what = jump ? (hr ? '홈런 훔치기' : '점프 캐치') : '다이빙 캐치';
  $('hint').textContent = ok ? what + ' 성공!' : what + ' 실패...';
  diveUI();
}
$('dv').addEventListener('pointerdown', e => {
  e.preventDefault();
  e.stopPropagation();
  tryDive();
});
{
  let s0 = null;
  addEventListener(
    'pointerdown',
    e => {
      s0 = [e.clientX, e.clientY];
    },
    true,
  );
  addEventListener(
    'pointerup',
    e => {
      if (s0 && Math.hypot(e.clientX - s0[0], e.clientY - s0[1]) >= 50) tryDive();
      s0 = null;
    },
    true,
  );
}
// ---------- 캐치 링 ----------
// 공이 땅(홈런이면 담장)에 닿기까지 남은 시간(초, 물리 시간)
function ballTimeLeft() {
  const p = ball.position,
    v = hit.v,
    tGround = (v.y + Math.sqrt(Math.max(0, v.y * v.y + 2 * GRAVITY * (p.y - 0.04)))) / GRAVITY;
  if (hit.k !== 'hr') return tGround;
  const r = robWall(),
    hv = Math.hypot(v.x, v.z) || 1;
  return Math.max(0, Math.min(tGround, (r.W - Math.hypot(p.x, p.z)) / hv));
}
// 공을 잡을 지점(홈런이면 담장 위)
function catchPoint() {
  const L = hit.L;
  if (hit.k !== 'hr') return new THREE.Vector3(L.x, 0.3, L.z);
  const r = robWall(),
    sc = r.W / r.Dm;
  return new THREE.Vector3(L.x * sc, 2.6, L.z * sc);
}
// 아슬아슬한 타구면 캐치 링을 띄운다(매 프레임 확인)
function maybeStartCatchRing() {
  if (!FIELD_TUNING.enabled || catchRing || hit.ringDone || !diveOK()) return;
  const f = fielders[hit.fi].g.position,
    c = catchPoint(),
    tl = ballTimeLeft();
  if (tl < FIELD_TUNING.ringMinSec || Math.hypot(f.x - c.x, f.z - c.z) > FIELD_TUNING.ringReach) return;
  hit.ringDone = true;
  catchRing = { tl0: tl };
  $('hint').textContent = hit.k === 'hr' ? '링이 겹칠 때 탭! 홈런 훔치기' : '링이 겹칠 때 탭! 다이빙 캐치';
}
// 지금 노란 링 반지름(px): 공이 떨어질수록 줄어든다
function catchRingR() {
  const F = FIELD_TUNING;
  return F.ringMinR + (F.ringMaxR - F.ringMinR) * clamp(ballTimeLeft() / catchRing.tl0, 0, 1);
}
// 탭한 순간 판정: 'perfect' / 'good' / 'bad'
function catchGrade() {
  if (!catchRing) return 'bad';
  const F = FIELD_TUNING,
    m = Math.abs(catchRingR() - F.ringWhiteR) / (F.ringMaxR - F.ringMinR);
  return m <= F.ringPerfect ? 'perfect' : m <= F.ringGood ? 'good' : 'bad';
}
// 화면 위치(px)
function toScreenXY(v) {
  camera.updateMatrixWorld(); // 이번 프레임에 움직인 카메라 기준으로
  const q = v.clone().project(camera);
  return { x: ((q.x + 1) / 2) * innerWidth, y: ((1 - q.y) / 2) * innerHeight, behind: q.z > 1 };
}
// 캐치 링을 화면에 그린다(매 프레임)
function updateCatchRing() {
  const el = $('catchRing');
  if (catchRing && (phase !== 'hit' || !hit || hit.landed || hit.hold || !diveOK())) {
    catchRing = null;
    if ($('hint').textContent.startsWith('링이 겹칠 때')) $('hint').textContent = '';
  }
  if (!catchRing) {
    if (el.style.display !== 'none') el.style.display = 'none';
    return;
  }
  const s = toScreenXY(catchPoint()),
    x = clamp(s.x, 60, innerWidth - 60),
    y = clamp(s.y, 80, innerHeight - 60),
    r = catchRingR();
  catchRing.x = x;
  catchRing.y = y;
  el.style.display = 'block';
  el.style.left = x + 'px';
  el.style.top = y + 'px';
  $('catchY').style.width = $('catchY').style.height = 2 * r + 'px';
  $('catchY').style.margin = -r + 'px 0 0 ' + -r + 'px';
}
// 화면을 탭했을 때: 캐치 링 근처면 다이빙/점프 캐치. 처리했으면 true
function catchTap(px, py) {
  if (!catchRing) return false;
  if (Math.hypot(px - catchRing.x, py - catchRing.y) > FIELD_TUNING.ringMaxR + FIELD_TUNING.ringTapPad) return false;
  tryDive(catchGrade());
  return true;
}
// ---------- 송구 베이스 고르기 ----------
// 베이스 위치(송구 목표). 0 = 1루, 1 = 2루, 2 = 3루, 3 = 홈
const throwTarget = b => (b === 3 ? new THREE.Vector3(0, 1.1, 0.2) : basePoint(b));
// 고르기 시작: opts는 보여줄 베이스 번호들
function startThrowChoice(kind, opts, A) {
  throwChoice = { kind, opts, A, t0: now };
  hit.endAt = 0;
  $('hint').textContent = '송구할 베이스를 탭!';
}
// 땅볼을 잡았을 때: 주자가 있어 고를 베이스가 있으면 버튼, 없으면 예전처럼 자동 송구
function fieldGroundBall(h, f) {
  const A = new THREE.Vector3(f.g.position.x, 1.1, f.g.position.z),
    r1 = bases[0],
    r2 = bases[1],
    r3 = bases[2];
  if (FIELD_TUNING.enabled && pitcherMode) {
    const opts = [0];
    if (r1) opts.push(1);
    if (r1 && r2) opts.push(2);
    if (r1 && r2 && r3) opts.push(3);
    if (opts.length > 1) {
      startThrowChoice('go', opts, A);
      return;
    }
  }
  autoGroundThrow(h, A);
}
// 예전 방식 자동 송구(병살·삼중살은 확률)
function autoGroundThrow(h, A) {
  const r1 = bases[0],
    r2 = bases[1],
    r3 = bases[2];
  h.play = r1 && r2 && r3 && outs === 0 && rand() < 0.15 ? 'tp' : r1 && outs < 2 && rand() < 0.45 ? 'dp' : 'out';
  const pts =
    h.play === 'tp'
      ? [A, basePoint(2), basePoint(1), basePoint(0)]
      : h.play === 'dp'
        ? [A, basePoint(1), basePoint(0)]
        : [A, r1 ? basePoint(1) : basePoint(0)];
  h.pi = h.play === 'tp' ? 2 : h.play === 'dp' || r1 ? 1 : 0;
  throwSequence(h, pts);
}
// 송구 동작 후 공을 pts 순서로 던지고, 다 던지면 결과 처리
function throwSequence(h, pts) {
  h.pu = 0;
  const td = pts.slice(1).reduce((q2, P2, i2) => q2 + pts[i2].distanceTo(P2), 0),
    dur = clamp((td / 32) * 800, 380, 1500);
  tween(
    320,
    u => {
      h.pu = u;
    },
    () => seqThrow(pts, dur),
  );
  h.endAt = now + 320 + dur + 200;
}
// 내가 고른 베이스로 송구
function chooseThrow(b) {
  const c = throwChoice,
    h = hit;
  if (!c || !h) return;
  throwChoice = null;
  $('hint').textContent = '';
  h.manual = true;
  if (c.kind === 'go') {
    if (b === 0) {
      h.play = 'out';
      h.pi = 0;
      throwSequence(h, [c.A, basePoint(0)]);
    } else if (b === 1 && outs < 2 && rand() < FIELD_TUNING.dpChance) {
      // 2루 → 1루 자동 연결 병살
      h.play = 'dp';
      h.pi = 1;
      throwSequence(h, [c.A, basePoint(1), basePoint(0)]);
    } else {
      // 그 베이스로 밀려 들어가던 주자를 포스 아웃, 타자는 1루
      h.play = 'fc';
      h.forceBase = b;
      h.pi = Math.min(b, 2);
      throwSequence(h, [c.A, throwTarget(b)]);
    }
  } else {
    // 태그업 주자 잡기: 수비수와 베이스가 멀수록 어렵다
    const T = throwTarget(b),
      d = c.A.distanceTo(T);
    h.cpuTag.throwTo = b;
    h.cpuTag.out = rand() < clamp(FIELD_TUNING.tagThrowBase - d * FIELD_TUNING.tagThrowPerM, 0.1, 0.65);
    const dur = clamp((d / 32) * 800, 380, 1500);
    throwBall(c.A, T, dur);
    h.endAt = now + dur + 300;
  }
}
// 고를 시간이 지나면 자동 처리
function autoThrowChoice() {
  const c = throwChoice;
  throwChoice = null;
  $('hint').textContent = '';
  if (c.kind === 'go') autoGroundThrow(hit, c.A);
  else hit.endAt = now + 300; // 태그업 주자는 그대로 진루
}
// 송구 베이스 버튼을 베이스 위에 그리고, 시간이 지나면 자동 처리(매 프레임)
function updateThrowChoice() {
  const box = $('fieldBtns');
  if (throwChoice && (phase !== 'hit' || !hit)) throwChoice = null;
  if (throwChoice && now - throwChoice.t0 > FIELD_TUNING.choiceMs) autoThrowChoice();
  if (!throwChoice) {
    if (box.style.display !== 'none') box.style.display = 'none';
    return;
  }
  box.style.display = 'block';
  box.querySelectorAll('button').forEach(btn => {
    const b = Number(btn.dataset.b);
    if (!throwChoice.opts.includes(b)) {
      btn.style.display = 'none';
      return;
    }
    const s = toScreenXY(throwTarget(b));
    btn.style.display = 'block';
    btn.style.left = clamp(s.x, 50, innerWidth - 50) + 'px';
    btn.style.top = clamp(s.y, 90, innerHeight - 50) + 'px';
  });
}
$('fieldBtns').addEventListener('pointerdown', e => {
  e.preventDefault();
  e.stopPropagation();
  const btn = e.target.closest('button');
  if (btn && !paused) chooseThrow(Number(btn.dataset.b));
});
// 뜬공을 잡았을 때: 컴퓨터 주자가 태그업하면 홈/3루 송구 버튼
function fieldFlyCatch(h, f) {
  if (!FIELD_TUNING.enabled || !pitcherMode || h.fumble || outs >= 2) return false;
  const t3 = !!bases[2] && rand() < FIELD_TUNING.cpuTag3,
    t2 = !!bases[1] && (!bases[2] || t3) && rand() < FIELD_TUNING.cpuTag2;
  if (!t3 && !t2) return false;
  h.cpuTag = { t3, t2, throwTo: -1, out: false };
  const opts = [];
  if (t3) opts.push(3);
  if (t2) opts.push(2);
  startThrowChoice('tag', opts, new THREE.Vector3(f.g.position.x, 1.3, f.g.position.z));
  $('hint').textContent = '주자 태그업! 송구할 베이스를 탭!';
  return true;
}
