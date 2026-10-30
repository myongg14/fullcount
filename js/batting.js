// 타격·타구: 타구 비행 계산과 결과 판정, 내 스윙 판정, 타구 날아가는 동안의 처리

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
const judgeBatted = (ev, la, dir) => {
  const fl = simFlight(ev, la, dir);
  if (Math.abs(dir) > 45) return { kind: 'foul', fl };
  // 펜스를 넘을 때의 높이로 홈런 판정
  const atWall = fl.pts.find(q => Math.hypot(q.x, q.z) >= 105);
  if (atWall && atWall.y > 3) return { kind: 'hr', fl };
  if (la > 50) return { kind: 'out', label: '내야 뜬공', fl };
  if (la < 8) {
    const p = ev > 150 ? 0.45 : ev > 125 ? 0.25 : 0.1;
    return Math.random() < p ? { kind: 'hit', label: '땅볼 안타', bases: 1, fl } : { kind: 'out', label: '땅볼 아웃', fl };
  }
  if (la < 25) {
    const p = ev > 140 ? 0.75 : ev > 115 ? 0.55 : 0.3;
    if (Math.random() < p) return { kind: 'hit', label: fl.dist > 70 ? '2루타' : '안타', bases: fl.dist > 70 ? 2 : 1, fl };
    return { kind: 'out', label: '라인드라이브 아웃', fl };
  }
  if (fl.dist > 95 && Math.random() < 0.5) return { kind: 'hit', label: '펜스 직격 2루타', bases: 2, fl };
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
  const win = (S.rookie ? 170 : 120) * (S.power ? 0.7 : 1);
  const posWin = (S.rookie ? 0.2 : 0.15) * (S.power ? 0.75 : 1);
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
  const res = judgeBatted(ev, la, dir);
  const timing = Math.abs(dt) < win * 0.25 ? '정타 타이밍' : dt < 0 ? '조금 빠름' : '조금 늦음';
  launchFlight(res, `${Math.round(ev)}km/h · ${Math.round(la)}° · ${timing}`);
};

// ---------- 타구 비행 ----------
const launchFlight = (res, sub) => {
  S.phase = 'flight';
  flight = { res, sub, t0: now(), pts: res.fl.pts };
  ball.isVisible = true; shadow.isVisible = true;
};
const finishFlight = () => {
  const { res, sub } = flight; flight = null;
  landMark.position.set(res.fl.land.x, 0.04, res.fl.land.z); landMark.isVisible = res.kind !== 'foul';
  const d = Math.round(res.fl.dist);
  if (res.kind === 'foul') return callPitch('foul', sub);
  if (res.kind === 'hr') return endPA('hr', '홈런!', `${d}m · ${sub}`);
  if (res.kind === 'hit') return endPA('hit', res.label, `${d}m · ${sub}`);
  return endPA('out', res.label, `${d}m · ${sub}`);
};
