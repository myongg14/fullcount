// 투구: 공 궤적 만들기, 컴퓨터 투수(타격 모드), 내 투구 조준·릴리즈와 컴퓨터 타자의 대응(투구 모드)

// ---------- 투구 설정 (숫자만 바꿔서 조절) ----------
// 존 테두리 근처를 노릴수록 정확히 던지기 어렵다. 제구·숙련도가 좋으면 어려움이 줄어든다.
const PITCH_TUNING = {
  skillRelief: 0.6,     // 제구 실력(0~1)에 곱해서 어려움을 덜어 주는 정도(제구 100이면 60% 덜 어려움)
  ringNarrow: 0.5,      // 테두리를 노리면 링이 '맞는' 구간이 최대 이만큼(50%) 좁아짐
  missGrow: 0.9,        // 테두리를 노리면 빗나가는 거리가 최대 이만큼(90%) 커짐
  cpuEdgeAim: 0.55,     // 컴퓨터 투수가 스트라이크를 노릴 때 테두리 근처를 노리는 비율
  cpuHangChance: 0.3,   // 컴퓨터 투수가 테두리를 노리다 가운데로 몰리는(실투) 최대 확률
};
// 컴퓨터 타자: 존 끝 공일수록 헛스윙·파울·약한 타구가 늘고, 가운데 공은 잘 친다
const AI_BAT_TUNING = {
  edgeContactLoss: 0.25,  // 테두리 공은 맞힐 확률이 이만큼 줄어듦
  outsideContactLoss: 0.1,// 존 밖 공은 추가로 이만큼 더 줄어듦
  centerContactBonus: 0.06,
  edgeFoul: 0.35,         // 테두리 공을 맞혔을 때 파울이 될 확률
  edgeWeak: 0.45,         // 테두리 공을 맞혔을 때 타구 질이 최대 이만큼 떨어짐
  centerPower: 0.2,       // 가운데 공을 맞히면 타구 질 +(가운데 실투는 장타 위험)
};
// 이 지점을 노릴 때의 어려움(0~1)
const aimDifficulty = (pt, ctrl) => borderK(zoneEdge(pt)) * (1 - PITCH_TUNING.skillRelief * ctrl);

// ---------- 투구 생성 ----------
// 투구 궤적: 직선 경로 + 꺾이는 변화. 끝점은 항상 target.
// pitcher: 던지는 투수(data/teams.js). 숙련도가 높을수록 변화가 크다(숙련도 0이면 60%, 100이면 100%).
const mastery = (pitcher, type) => (pitcher.pitches[type] ?? 50) / 100;
const makePitch = (type, target, quality = 1, pitcher = currentPitcher()) => {
  const P = PITCHES[type];
  const m = mastery(pitcher, type);
  const hand = pitcher.throws === 'L' ? -1 : 1;         // 왼손 투수는 좌우가 반대
  const speedFactor = (S.mode === 'bat' && S.rookie) ? 0.72 : 1;
  const kmh = (P.kmh + pitcher.velo - 6 * pitcherFatigue()) * (0.9 + 0.1 * quality);
  const mps = kmh / 3.6 * speedFactor;
  const start = new BABYLON.Vector3(-0.45 * hand, 1.85, MOUND_Z - 1.2);
  const bs = 0.6 + 0.4 * m;
  const brk = new BABYLON.Vector3(P.h * hand * bs, P.v * bs, 0);
  const tgt = target.clone();
  let wob = null;
  if (P.knuckle) {
    // 너클볼: 들어가는 곳도 조금씩 엇나가고, 날아오는 동안 위아래·좌우로 흔들린다
    tgt.x += rand(-1, 1) * 0.08 * (1.2 - m); tgt.y += rand(-1, 1) * 0.08 * (1.2 - m);
    wob = { amp: 0.11 * bs, fx: rand(9, 14), fy: rand(10, 16), px: rand(0, 6.3), py: rand(0, 6.3) };
  }
  const dur = (start.z - tgt.z) / mps;
  return { type, name: P.name, kmh: Math.round(kmh), start, target: tgt, brk, dur, t0: 0,
    exp: P.late ? 3 : 1.8, wob, arc: P.arc || 0 };
};
const pitchPos = (pc, s) => {
  const aim = pc.target.subtract(pc.brk);
  const p = BABYLON.Vector3.Lerp(pc.start, aim, s);
  p.addInPlace(pc.brk.scale(Math.pow(s, pc.exp)));
  const u = Math.min(s, 1);
  if (pc.arc) p.y += pc.arc * 4 * u * (1 - u);
  if (pc.wob) {
    const w = pc.wob.amp * Math.sin(Math.PI * u);   // 출발·도착에서는 0, 가운데서 가장 크게 흔들림
    p.x += w * Math.sin(u * pc.wob.fx + pc.wob.px);
    p.y += w * Math.sin(u * pc.wob.fy + pc.wob.py);
  }
  return p;
};
// 구종을 치기 어렵게 만드는 정도(변화가 클수록, 숙련도가 높을수록, 너클볼이면 더)
const pitchDifficulty = (type, pitcher) => {
  const P = PITCHES[type];
  return clamp(Math.hypot(P.h, P.v) * 0.2, 0, 0.14) * (0.6 + 0.4 * mastery(pitcher, type)) + (P.knuckle ? 0.08 : 0);
};
// 제구 실력(0~1): 투수 제구 60% + 그 구종 숙련도 40%
const controlOf = (pitcher, type) => (pitcher.control / 100) * 0.6 + mastery(pitcher, type) * 0.4;

// 공을 손에서 놓는 순간: 공을 출발점에 두고 꼬리를 새로 시작한다
const releaseBall = () => {
  S.pitch.t0 = now(); S.phase = 'pitch';
  ball.position.copyFrom(pitchPos(S.pitch, 0));
  ball.isVisible = true; shadow.isVisible = true;
  startTrail(S.pitch.type);
};

// ---------- 타격 모드: AI가 던지고 내가 친다 ----------
const startAIPitch = () => {
  if (S.mode !== 'bat' || S.phase !== 'idle') return;
  const pitcher = currentPitcher();
  // 숙련도가 높은 구종을 더 자주 던진다
  const types = Object.keys(pitcher.pitches);
  const weights = types.map(k => pitcher.pitches[k] ** 2);
  let r = Math.random() * weights.reduce((a, b) => a + b, 0), type = types[0];
  for (let i = 0; i < types.length; i++) { r -= weights[i]; if (r <= 0) { type = types[i]; break; } }
  const wantStrike = G.balls >= 3 ? 0.85 : G.strikes >= 2 ? 0.45 : 0.62;
  const cy = (ZONE.yLo + ZONE.yHi) / 2;
  let tgt;
  if (Math.random() < wantStrike) {
    tgt = new BABYLON.Vector3(rand(-ZONE.x, ZONE.x), rand(ZONE.yLo + 0.03, ZONE.yHi - 0.03), 0);
    if (Math.random() < PITCH_TUNING.cpuEdgeAim) {
      // 테두리 근처(가운데에서 75~100%)를 노린다
      const s = rand(0.75, 1) / Math.max(zoneEdge(tgt), 0.01);
      tgt.x *= s; tgt.y = cy + (tgt.y - cy) * s;
    }
  } else tgt = new BABYLON.Vector3(rand(-0.42, 0.42), rand(0.3, 1.35), 0);
  // 테두리를 노리면 어렵다: 가운데로 몰리는 실투가 나오거나, 더 크게 빗나가 볼이 된다
  const ctrl = controlOf(pitcher, type);
  const diff = aimDifficulty(tgt, ctrl);
  if (Math.random() < PITCH_TUNING.cpuHangChance * diff) {
    const u = rand(0.5, 0.8);
    tgt.x *= 1 - u; tgt.y = cy + (tgt.y - cy) * (1 - u);
  }
  // 제구가 나쁠수록, 지칠수록, 테두리를 노릴수록 노린 곳에서 빗나간다
  const err = (0.03 + (1 - ctrl) * 0.16) * (1 + pitcherFatigue()) * (1 + PITCH_TUNING.missGrow * diff);
  const a = Math.random() * Math.PI * 2, d = rand(0, err);
  tgt.x = clamp(tgt.x + Math.cos(a) * d, -0.8, 0.8); tgt.y = clamp(tgt.y + Math.sin(a) * d, 0.15, 1.6);
  S.pitch = makePitch(type, tgt, rand(0.85, 1), pitcher);
  S.swing = null;
  windup(releaseBall);
  hint('공이 홈플레이트에 들어오는 순간, 공이 있는 곳을 탭하세요.');
};
let windT = 0, windCb = null;
const windup = cb => { S.phase = 'windup'; windT = now(); windCb = cb; pitchThrown(); };

// ---------- 투구 모드: 내가 던지고 AI가 친다 ----------
const aim = { active: false, start: 0, x: 0, y: 0, cycle: 1.3, win: 1 };
const readyPitch = () => {
  if (S.mode !== 'pitch' || S.phase === 'menu') return;
  S.phase = 'idle';
  hint('구종을 고르고, 존 위를 눌러 조준하세요. 노란 링이 흰 링과 겹칠 때 손을 떼면 정확히 들어가요.');
};
// 노란 링 크기: 2.4 → 0.4를 반복. cycle(초)이 짧을수록 빨리 줄어든다
const shrinkScale = (t, c = aim.cycle) => { const u = ((t / 1000) % c) / c; return 2.4 - u * 2.0; };
const startAim = (cx, cy) => {
  if (S.mode !== 'pitch' || S.phase !== 'idle' || !$('bullpen').hidden) return;
  aim.active = true; aim.start = now(); aim.x = cx; aim.y = cy;
  aim.cycle = 1.3 * (1 - 0.4 * pitcherFatigue());      // 지치면 링이 더 빨리 줄어든다
  $('aimTarget').hidden = false; $('aimShrink').hidden = false; moveAim(cx, cy);
};
const moveAim = (cx, cy) => {
  if (!aim.active) return;
  aim.x = cx; aim.y = cy;
  // 노리는 곳이 테두리에 가까울수록 링이 맞는 구간(win)이 좁아진다. 흰 링이 주황색이면 어려운 곳
  const pt = pickPlate(cx, cy);
  const d = pt ? aimDifficulty(pt, controlOf(currentPitcher(), S.selPitch)) : 0;
  aim.win = 1 - PITCH_TUNING.ringNarrow * d;
  $('aimTarget').style.borderColor = d > 0.25 ? `rgb(255, ${Math.round(240 - 110 * d)}, ${Math.round(220 - 160 * d)})` : '';
  for (const id of ['aimTarget', 'aimShrink']) { const e = $(id); e.style.left = cx + 'px'; e.style.top = cy + 'px'; }
};
const releaseAim = () => {
  if (!aim.active) return;
  aim.active = false; $('aimTarget').hidden = true; $('aimShrink').hidden = true;
  const pitcher = currentPitcher();
  const sc = shrinkScale(now() - aim.start);
  const acc = clamp(1 - Math.abs(sc - 1) / aim.win, 0, 1);   // 1 = 완벽. 테두리를 노리면 구간이 좁다
  const pt = pickPlate(aim.x, aim.y) || new BABYLON.Vector3(0, 0.8, 0);
  // 링을 놓친 만큼 + 제구·숙련도가 낮은 만큼 + 지친 만큼 + 테두리를 노린 만큼 빗나간다
  const ctrl = controlOf(pitcher, S.selPitch);
  const err = ((1 - acc) * 0.38 * (1.3 - ctrl * 0.6) + (1 - ctrl) * 0.06) * (1 + 0.8 * pitcherFatigue())
    * (1 + PITCH_TUNING.missGrow * aimDifficulty(pt, ctrl));
  const a = Math.random() * Math.PI * 2;
  const tgt = new BABYLON.Vector3(clamp(pt.x + Math.cos(a) * err, -0.8, 0.8), clamp(pt.y + Math.sin(a) * err, 0.15, 1.6), 0);
  S.pitch = makePitch(S.selPitch, tgt, 0.6 + 0.4 * acc, pitcher);
  S.pitch.acc = acc;
  const accText = acc > 0.85 ? '완벽한 릴리즈' : acc > 0.55 ? '좋은 릴리즈' : '실투';
  hint(accText);
  windup(releaseBall);
};
// 컴퓨터 타자: 선구안이 좋으면 존 안은 더 치고 존 밖은 덜 쫓아간다. 컨택이 좋으면 잘 맞히고, 파워가 좋으면 세게 친다.
const aiBatterDecide = () => {
  const pc = S.pitch, b = currentBatter();
  const eye = b.eye / 100, con = b.contact / 100, pow = b.power / 100;
  const zone = inZone(pc.target);
  let swingP = zone ? 0.62 + eye * 0.18 : 0.42 - eye * 0.3;
  if (G.strikes === 2) swingP += 0.15;
  if (G.balls === 3) swingP -= 0.15;
  const sub = `${pc.name} ${pc.kmh}km/h`;
  if (Math.random() > swingP) return callPitch(zone ? 'strike' : 'ball', sub + (zone ? ' · 루킹' : ''));
  const A = AI_BAT_TUNING;
  const e = zoneEdge(pc.target), k = edgeHardK(e), center = e <= BAT_TUNING.centerZone;
  let contact = 0.62 + con * 0.3 - pitchDifficulty(pc.type, currentPitcher())
    - A.edgeContactLoss * k - (zone ? 0 : A.outsideContactLoss) + (center ? A.centerContactBonus : 0)
    - (pc.acc > 0.85 ? 0.08 : 0);
  if (Math.random() > contact) return callPitch('strike', sub + ' · 헛스윙');
  let q = Math.random() * (pc.acc > 0.85 ? 0.8 : 1) + (pc.acc < 0.5 ? 0.25 : 0) + con * 0.1;
  q = q * (1 - A.edgeWeak * k) + (center ? A.centerPower : 0);
  const ev = 85 + clamp(q, 0, 1) * 75 + pow * 12;
  const la = rand(-15, 45);
  let dir = rand(-60, 60);
  if (Math.random() < A.edgeFoul * k) dir = (Math.random() < 0.5 ? -1 : 1) * rand(50, 75);   // 끝 공은 파울이 잦다
  swingAnim = now();
  const res = judgeBatted(ev, la, dir);
  res.ev = ev;
  launchFlight(res, `${Math.round(ev)}km/h · ${Math.round(la)}°`);
};
