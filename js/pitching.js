// 투구: 공 궤적 만들기, 컴퓨터 투수(타격 모드), 내 투구 조준·릴리즈와 컴퓨터 타자의 대응(투구 모드)

// ---------- 투구 생성 ----------
// 투구 궤적: 직선 경로 + 늦게 꺾이는 변화. 끝점은 항상 target.
const makePitch = (type, target, quality = 1) => {
  const P = PITCHES[type];
  const speedFactor = (S.mode === 'bat' && S.rookie) ? 0.72 : 1;
  const kmh = P.kmh * (0.9 + 0.1 * quality);
  const mps = kmh / 3.6 * speedFactor;
  const start = new BABYLON.Vector3(-0.45, 1.85, MOUND_Z - 1.2);
  const brk = new BABYLON.Vector3(P.brk[0], P.brk[1], 0);
  const dur = (start.z - target.z) / mps;
  return { type, name: P.name, kmh: Math.round(kmh), start, target: target.clone(), brk, dur, t0: 0 };
};
const pitchPos = (pc, s) => {
  const aim = pc.target.subtract(pc.brk);
  const p = BABYLON.Vector3.Lerp(pc.start, aim, s);
  return p.add(pc.brk.scale(s * s * s));
};

// ---------- 타격 모드: AI가 던지고 내가 친다 ----------
const startAIPitch = () => {
  if (S.mode !== 'bat' || S.phase !== 'idle') return;
  const types = Object.keys(PITCHES);
  const type = types[Math.floor(Math.random() * types.length)];
  const wantStrike = S.balls >= 3 ? 0.85 : S.strikes >= 2 ? 0.45 : 0.62;
  const tgt = Math.random() < wantStrike
    ? new BABYLON.Vector3(rand(-ZONE.x, ZONE.x), rand(ZONE.yLo + 0.03, ZONE.yHi - 0.03), 0)
    : new BABYLON.Vector3(rand(-0.42, 0.42), rand(0.3, 1.35), 0);
  S.pitch = makePitch(type, tgt, rand(0.85, 1));
  S.swing = null;
  windup(() => { S.pitch.t0 = now(); S.phase = 'pitch'; ball.isVisible = true; shadow.isVisible = true; });
  hint('공이 홈플레이트에 들어오는 순간, 공이 있는 곳을 탭하세요.');
};
let windT = 0, windCb = null;
const windup = cb => { S.phase = 'windup'; windT = now(); windCb = cb; };

// ---------- 투구 모드: 내가 던지고 AI가 친다 ----------
const aim = { active: false, start: 0, x: 0, y: 0 };
const readyPitch = () => {
  if (S.mode !== 'pitch') return;
  S.phase = 'idle';
  hint('구종을 고르고, 존 위를 눌러 조준하세요. 노란 링이 흰 링과 겹칠 때 손을 떼면 정확히 들어가요.');
};
const shrinkScale = t => { const c = 1.3; const u = ((t / 1000) % c) / c; return 2.4 - u * 2.0; }; // 2.4 → 0.4 반복
const startAim = (cx, cy) => {
  if (S.mode !== 'pitch' || S.phase !== 'idle') return;
  aim.active = true; aim.start = now(); aim.x = cx; aim.y = cy;
  $('aimTarget').hidden = false; $('aimShrink').hidden = false; moveAim(cx, cy);
};
const moveAim = (cx, cy) => {
  if (!aim.active) return;
  aim.x = cx; aim.y = cy;
  for (const id of ['aimTarget', 'aimShrink']) { const e = $(id); e.style.left = cx + 'px'; e.style.top = cy + 'px'; }
};
const releaseAim = () => {
  if (!aim.active) return;
  aim.active = false; $('aimTarget').hidden = true; $('aimShrink').hidden = true;
  const sc = shrinkScale(now() - aim.start);
  const acc = clamp(1 - Math.abs(sc - 1) / 1.0, 0, 1);       // 1 = 완벽
  const pt = pickPlate(aim.x, aim.y) || new BABYLON.Vector3(0, 0.8, 0);
  const err = (1 - acc) * 0.38;
  const a = Math.random() * Math.PI * 2;
  const tgt = new BABYLON.Vector3(clamp(pt.x + Math.cos(a) * err, -0.8, 0.8), clamp(pt.y + Math.sin(a) * err, 0.15, 1.6), 0);
  S.pitch = makePitch(S.selPitch, tgt, 0.6 + 0.4 * acc);
  S.pitch.acc = acc;
  const accText = acc > 0.85 ? '완벽한 릴리즈' : acc > 0.55 ? '좋은 릴리즈' : '실투';
  hint(accText);
  windup(() => { S.pitch.t0 = now(); S.phase = 'pitch'; ball.isVisible = true; shadow.isVisible = true; });
};
const aiBatterDecide = () => {
  const pc = S.pitch;
  const zone = inZone(pc.target);
  const edge = zone ? Math.min(ZONE.x - Math.abs(pc.target.x), pc.target.y - ZONE.yLo, ZONE.yHi - pc.target.y) : 0;
  let swingP = zone ? 0.72 : 0.28;
  if (S.strikes === 2) swingP += 0.15;
  if (S.balls === 3) swingP -= 0.15;
  const sub = `${pc.name} ${pc.kmh}km/h`;
  if (Math.random() > swingP) return callPitch(zone ? 'strike' : 'ball', sub + (zone ? ' · 루킹' : ''));
  const breakBonus = { fast: 0, slider: 0.1, curve: 0.12, change: 0.1 }[pc.type];
  let contact = 0.8 - breakBonus - (zone ? clamp(0.12 - edge, 0, 0.12) * 1.5 : 0.3) - (pc.acc > 0.85 ? 0.08 : 0);
  if (Math.random() > contact) return callPitch('strike', sub + ' · 헛스윙');
  const q = Math.random() * (pc.acc > 0.85 ? 0.8 : 1) + (pc.acc < 0.5 ? 0.25 : 0);
  const ev = 90 + clamp(q, 0, 1) * 80;
  const la = rand(-15, 45);
  const dir = rand(-60, 60);
  swingAnim = now();
  launchFlight(judgeBatted(ev, la, dir), `${Math.round(ev)}km/h · ${Math.round(la)}°`);
};
