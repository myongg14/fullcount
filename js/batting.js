// 타격·타구: 타구 비행 계산과 결과 판정, 내 스윙 판정, 타구 날아가는 동안의 처리

// ---------- 타격 설정 (숫자만 바꿔서 조절) ----------
const BAT_TUNING = {
  rookieTimeWin: 220,   // 루키: 공이 도착하는 순간 앞뒤로 이만큼(밀리초) 안에 탭하면 맞음 (v0.1은 170)
  proTimeWin: 120,      // 프로: 같은 값
  rookiePosWin: 0.26,   // 루키: 탭한 곳이 공에서 이 거리(m) 안이면 맞음 (v0.1은 0.20)
  proPosWin: 0.15,      // 프로: 같은 값
  powerTimeMul: 0.7,    // 파워 스윙이면 시간 폭에 곱함(더 좁아짐)
  powerPosMul: 0.75,    // 파워 스윙이면 위치 폭에 곱함
  // 존 끝 공: 존 가운데에서 멀수록(바깥쪽 절반부터) 타구가 약해지고 빗맞음·파울이 늘어난다
  centerZone: 0.35,     // 가운데에서 이 안쪽(존 크기 비율)이면 '가운데 공'
  centerEvBonus: 8,     // 가운데 공을 맞히면 타구 속도 +(km/h)
  edgeEvLoss: 22,       // 테두리 공을 맞히면 타구 속도 -(km/h)
  edgeMishit: 0.45,     // 테두리 공을 맞혔을 때 파울이나 빗맞은 타구가 될 확률
};

// ---------- 타구 결과 ----------
// ev: 타구 속도(km/h), la: 발사각(도), dir: 좌우 각도(도, 음수=3루 쪽)
const simFlight = (ev, la, dir) => {
  const v = ev / 3.6, th = la * Math.PI / 180, ph = dir * Math.PI / 180;
  let p = new BABYLON.Vector3(0, 1.0, 0.3);
  let vel = new BABYLON.Vector3(Math.sin(ph) * Math.cos(th) * v, Math.sin(th) * v, Math.cos(ph) * Math.cos(th) * v);
  const pts = [p.clone()]; const dt = 1 / 60; let t = 0;
  while (p.y > 0 && t < 8) {
    const sp = vel.length(); const drag = 0.0045 * sp;
    vel = vel.add(new BABYLON.Vector3(-vel.x * drag * dt, -9.8 * dt - vel.y * drag * dt, -vel.z * drag * dt));
    p = p.add(vel.scale(dt)); pts.push(p.clone()); t += dt;
  }
  const land = pts[pts.length - 1];
  const dist = Math.hypot(land.x, land.z);
  return { pts, dist, hang: t, land };
};
// 3루타: 외야 깊은 곳(이 거리 이상)에 떨어진 안타 중 일부
const TRIPLE_DIST = 90, TRIPLE_CHANCE = 0.3;
const judgeBatted = (ev, la, dir) => {
  const res = judgeBattedBase(ev, la, dir);
  if (res.kind === 'hit' && res.fl.dist >= TRIPLE_DIST && Math.random() < TRIPLE_CHANCE) {
    return { ...res, label: '3루타', bases: 3 };
  }
  return res;
};
const judgeBattedBase = (ev, la, dir) => {
  const fl = simFlight(ev, la, dir);
  if (Math.abs(dir) > 45) return { kind: 'foul', fl };
  // 담장(각도마다 거리가 다름)에 닿는 순간의 높이로 판정: 담장보다 높으면 홈런, 낮으면 담장 직격
  const wi = fenceCrossIndex(fl.pts);
  if (wi >= 0) {
    const atWall = fl.pts[wi];
    if (atWall.y > FENCE.height) {
      // 홈런: 비행 거리는 그대로 두고, 공은 외야 관중석에 떨어지는 곳에서 멈춘다
      const si = fl.pts.findIndex((q, i) => i > wi && q.y <= bleacherFloor(Math.atan2(q.x, q.z) * 180 / Math.PI, Math.hypot(q.x, q.z)));
      if (si > 0) { fl.pts = fl.pts.slice(0, si + 1); fl.land = fl.pts[si]; }
      return { kind: 'hr', fl };
    }
    // 담장 직격: 담장 앞에서 공이 아래로 떨어진다
    const hitPt = fl.pts[wi], back = hitPt.scale(1 - 0.4 / Math.hypot(hitPt.x, hitPt.z));
    const pts = fl.pts.slice(0, wi);
    for (let i = 1; i <= 24; i++) pts.push(new BABYLON.Vector3(back.x, Math.max(0, hitPt.y * (1 - (i / 24) ** 2)), back.z));
    fl.pts = pts; fl.land = pts[pts.length - 1]; fl.dist = Math.hypot(back.x, back.z);
    return { kind: 'hit', label: '펜스 직격 2루타', bases: 2, fl };
  }
  if (la > 50) return { kind: 'out', label: '내야 뜬공', fl };
  if (la < 8) {
    const p = ev > 150 ? 0.45 : ev > 125 ? 0.25 : 0.1;
    return Math.random() < p ? { kind: 'hit', label: '땅볼 안타', bases: 1, fl } : { kind: 'out', label: '땅볼 아웃', groundOut: true, fl };
  }
  if (la < 25) {
    const p = ev > 140 ? 0.75 : ev > 115 ? 0.55 : 0.3;
    if (Math.random() < p) return { kind: 'hit', label: fl.dist > 70 ? '2루타' : '안타', bases: fl.dist > 70 ? 2 : 1, fl };
    return { kind: 'out', label: '라인드라이브 아웃', fl };
  }
  if (fl.dist > 95 && Math.random() < 0.5) return { kind: 'hit', label: '2루타', bases: 2, fl };
  if (fl.dist > 60 && fl.dist < 80 && Math.random() < 0.25) return { kind: 'hit', label: '텍사스 안타', bases: 1, fl };
  return { kind: 'out', label: '뜬공 아웃', fl };
};

// 날아가는 중인 타구(없으면 null)
let flight = null;

const doSwing = (cx, cy) => {
  if (S.mode !== 'bat' || S.phase !== 'pitch' || S.swing) return;
  const pt = pickPlate(cx, cy);
  const t = now();
  S.swing = { t, pt };
  swingAnim = now();
  const m = $('tapMark'); m.style.left = cx + 'px'; m.style.top = cy + 'px'; m.style.opacity = 1;
  setTimeout(() => { m.style.opacity = 0; }, 350);
};
const resolveSwing = () => {
  const pc = S.pitch, sw = S.swing;
  const arrive = pc.t0 + pc.dur * 1000;
  const dt = sw.t - arrive;                 // + 늦음, - 빠름
  const T = BAT_TUNING;
  const win = (S.rookie ? T.rookieTimeWin : T.proTimeWin) * (S.power ? T.powerTimeMul : 1);
  const posWin = (S.rookie ? T.rookiePosWin : T.proPosWin) * (S.power ? T.powerPosMul : 1);
  const actual = pc.target;
  const sub = `${pc.name} ${pc.kmh}km/h`;
  if (!sw.pt || Math.abs(dt) > win) return callPitch('strike', sub + (dt < 0 ? ' · 너무 빨랐어요' : ' · 너무 늦었어요'));
  const dx = sw.pt.x - actual.x, dy = sw.pt.y - actual.y;
  const off = Math.hypot(dx, dy);
  if (off > posWin) return callPitch('strike', sub + ' · 헛스윙');
  const qPos = 1 - off / posWin, qTime = 1 - Math.abs(dt) / win;
  const q = clamp(0.55 * qPos + 0.45 * qTime, 0, 1);
  let ev = 95 + q * 75 + (S.power ? 12 : 0) + rand(-6, 6);
  // 공보다 아래를 치면(탭이 공 아래) 뜨고, 위를 치면 땅볼
  let la = clamp(14 - dy / posWin * 38 + rand(-5, 5), -20, 70);
  let dir = clamp(-dt / win * 55 + rand(-6, 6), -70, 70);
  if (q < 0.25 && Math.random() < 0.6) dir = (Math.random() < 0.5 ? -1 : 1) * rand(48, 80);
  // 존 끝 공은 맞혀도 약하고 빗맞기 쉽다. 가운데 공은 잘 맞는다
  const e = zoneEdge(actual), k = edgeHardK(e);
  if (e <= T.centerZone) ev += T.centerEvBonus;
  ev -= T.edgeEvLoss * k;
  if (Math.random() < T.edgeMishit * k) {
    if (Math.random() < 0.55) dir = (Math.random() < 0.5 ? -1 : 1) * rand(48, 80);   // 파울
    else { ev *= 0.7; la = Math.random() < 0.5 ? rand(-25, -8) : rand(55, 75); }      // 빗맞은 땅볼·뜬공
  }
  const res = judgeBatted(ev, la, dir);
  const timing = Math.abs(dt) < win * 0.25 ? '정타 타이밍' : dt < 0 ? '조금 빠름' : '조금 늦음';
  launchFlight(res, `${Math.round(ev)}km/h · ${Math.round(la)}° · ${timing}`);
};

// ---------- 타구 비행 ----------
const launchFlight = (res, sub) => {
  S.phase = 'flight';
  flight = { res, sub, t0: now(), pts: res.fl.pts };
  ball.position.copyFrom(res.fl.pts[0]);
  ball.isVisible = true; shadow.isVisible = true;
  startTrail('hit');
  // 떨어질 지점을 미리 보여 준다
  landMark.position.set(res.fl.land.x, 0.04, res.fl.land.z); landMark.isVisible = true;
};
const finishFlight = () => {
  const { res, sub } = flight; flight = null;
  landMark.position.set(res.fl.land.x, 0.04, res.fl.land.z); landMark.isVisible = res.kind !== 'foul';
  const d = Math.round(res.fl.dist);
  if (res.kind === 'foul') return callPitch('foul', sub);
  if (res.kind === 'hr') return endPA('hr', '홈런!', `${d}m · ${sub}`);
  if (res.kind === 'hit') return endPA('hit', res.label, `${d}m · ${sub}`, { bases: res.bases });
  return endPA('out', res.label, `${d}m · ${sub}`, { groundOut: res.groundOut });
};
