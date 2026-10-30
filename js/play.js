// 수비와 주루: 타구가 나면 수비수가 공을 쫓아 잡고 던지며, 주자가 베이스를 돈다.
// 결과(아웃·안타·홈런·병살)는 판정 코드가 먼저 정하고, 이 파일은 그 결과에 맞는 움직임을 미리 시간표로 짜서 보여 주기만 한다.
// 그래서 화면을 탭해 건너뛰어도 결과는 같다.

// ---------- 설정 (숫자만 바꿔서 조절) ----------
const PLAY_TUNING = {
  maxSec: 6,                    // 한 플레이 최대 길이(초). 더 길면 빠르게 재생(홈런은 예외)
  fielderSpeed: 7.2,            // 수비수 달리기(m/s)
  throwSpeed: 30,               // 송구 속도(m/s)
  runnerMin: 6.2, runnerMax: 8.6,   // 주자 속도(m/s): 주력 0 → 100
  hrTrot: 5.2,                  // 홈런 때 천천히 베이스를 도는 속도(m/s)
  hrFast: 4,                    // 홈런 빨리 감기 배속
  dive: 0.95,                   // 필요한 속도가 수비수 속도의 이 비율을 넘으면 다이빙 캐치
  camPos: [0, 15, -20], camFov: 0.8,  // 플레이 중 카메라 위치와 시야
};

const V3 = (x, y, z) => new BABYLON.Vector3(x, y, z);
const BASE_PTS = [V3(0, 0, 0.2), V3(19.4, 0, 19.4), V3(0, 0, 38.8), V3(-19.4, 0, 19.4)];
const basePt = i => BASE_PTS[((i % 4) + 4) % 4];
// 수비 위치(투수·포수는 players.js)
const FIELD_POS = { '1B': V3(17, 0, 24), '2B': V3(8, 0, 34.5), SS: V3(-8.5, 0, 34), '3B': V3(-17, 0, 24), LF: V3(-40, 0, 72), CF: V3(0, 0, 88), RF: V3(40, 0, 72) };
const INFIELD = ['P', '1B', '2B', 'SS', '3B'], OUTFIELD = ['LF', 'CF', 'RF'];
const fielders = {};
Object.keys(FIELD_POS).forEach(code => { fielders[code] = new BABYLON.TransformNode('fielder' + code, scene); });
const runnerRoots = [0, 1, 2].map(i => new BABYLON.TransformNode('runner' + i, scene));
const fielderRoot = code => (code === 'P' ? pitcher : fielders[code]);
const fielderHome = code => (code === 'P' ? V3(0, 0.24, MOUND_Z) : FIELD_POS[code]);
const rigOf = root => root.metadata && root.metadata.rig;
const faceToward = (root, target) => {
  const dx = target.x - root.position.x, dz = target.z - root.position.z;
  if (dx * dx + dz * dz > 1e-4) root.rotation.y = Math.atan2(dx, dz);
};
const flat = v => V3(v.x, 0, v.z);
const dist2d = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
// 더그아웃 쪽(원정팀 3루 쪽, 홈팀 1루 쪽)
const dugoutPt = () => (battingSide() === 'away' ? V3(-24, 0, -3) : V3(24, 0, -3));
const runnerSpeed = spd => PLAY_TUNING.runnerMin + (PLAY_TUNING.runnerMax - PLAY_TUNING.runnerMin) * spd / 100;

// 타석이 시작될 때: 수비수 7명을 제자리에, 베이스에 있는 주자를 베이스 위에
const dressField = (fKit, bKit) => {
  const fTeam = team(fieldingSide());
  Object.keys(FIELD_POS).forEach((code, i) => {
    const r = fielders[code];
    r.setEnabled(true); r.position.copyFrom(FIELD_POS[code]); faceToward(r, V3(0, 0, 0));
    dressRig(r, { role: 'fielder', kit: fKit, num: fTeam.batters[i + 1].num, hand: 1 });
  });
  runnerRoots.forEach((r, i) => {
    r.setEnabled(G.bases[i]);
    if (!G.bases[i]) return;
    const b = basePt(i + 1), n = basePt(i + 2);
    r.position.copyFrom(b.add(n.subtract(b).normalize().scale(1.2)));   // 다음 베이스 쪽으로 한 걸음 리드
    faceToward(r, V3(0, 0, 0));
    dressRig(r, { role: 'runner', kit: bKit, num: '', hand: 1 });
  });
};

// ---------- 시간표 도구 ----------
// 움직임: [{ t, p }] 사이를 직선으로 이동
const track = start => ({ keys: [{ t: 0, p: start.clone() }] });
const lastKey = tr => tr.keys[tr.keys.length - 1];
const hold = (tr, t) => { if (t > lastKey(tr).t) tr.keys.push({ t, p: lastKey(tr).p.clone() }); };
const moveTo = (tr, t, p) => { tr.keys.push({ t: Math.max(t, lastKey(tr).t + 1e-3), p: p.clone() }); };
const posAt = (tr, t) => {
  const k = tr.keys;
  if (t <= k[0].t) return k[0].p;
  for (let i = 1; i < k.length; i++) {
    if (t <= k[i].t) { const a = k[i - 1], b = k[i]; return BABYLON.Vector3.Lerp(a.p, b.p, (t - a.t) / (b.t - a.t)); }
  }
  return k[k.length - 1].p;
};
// t0부터 속도 v로 점들을 차례로 지나간다. 마지막에 도착하는 시간을 돌려준다
const runPath = (tr, t0, pts, v) => {
  hold(tr, t0);
  let t = Math.max(t0, lastKey(tr).t), cur = lastKey(tr).p;
  for (const p of pts) { t += dist2d(cur, p) / v; moveTo(tr, t, p); cur = p; }
  return t;
};
// 베이스 a에서 b까지 지나는 점들(b가 4면 홈)
const basesBetween = (a, b) => { const pts = []; for (let i = a + 1; i <= b; i++) pts.push(basePt(i)); return pts; };
const pathLen = (from, pts) => { let d = 0, cur = from; for (const p of pts) { d += dist2d(cur, p); cur = p; } return d; };

// 공 위치 구간들: 날아가기, 구르기, 손에 쥐기, 던지기
const flightDur = pts => (pts.length - 1) / 84;      // main.js와 같은 재생 속도(1초에 84점)
const flightSeg = (pts, t0) => ({ t0, t1: t0 + flightDur(pts), at: t => {
  const f = (t - t0) * 84, i = Math.min(Math.floor(f), pts.length - 1), j = Math.min(i + 1, pts.length - 1);
  return BABYLON.Vector3.Lerp(pts[i], pts[j], f - i);
} });
const rollAt = (from, dir, v0, a) => τ => {
  const tt = Math.min(τ, v0 / a);
  return from.add(dir.scale(v0 * tt - 0.5 * a * tt * tt));
};
const rollSeg = (roll, t0, t1) => ({ t0, t1, at: t => { const p = roll(t - t0); return V3(p.x, 0.06, p.z); } });
const heldSeg = (actor, t0, t1) => ({ t0, t1, at: t => posAt(actor.tr, t).add(V3(0, 1.15, 0)) });
// from → to 로 살짝 포물선을 그리며 던진다. 도착 시간을 돌려준다
const throwSeg = (segs, from, to, t0) => {
  const d = BABYLON.Vector3.Distance(from, to), dur = Math.max(0.25, d / PLAY_TUNING.throwSpeed), h = d * 0.04;
  segs.push({ t0, t1: t0 + dur, at: t => {
    const u = clamp((t - t0) / dur, 0, 1);
    return BABYLON.Vector3.Lerp(from, to, u).add(V3(0, 4 * h * u * (1 - u), 0));
  } });
  return t0 + dur;
};

// 땅에 떨어진 뒤 굴러가는 공: 마지막 두 점으로 방향과 속도를 구한다
const rollFrom = (pts, keep, decel) => {
  const a = pts[Math.max(0, pts.length - 2)], b = pts[pts.length - 1];
  const v = V3(b.x - a.x, 0, b.z - a.z);
  const sp = v.length() * 84;
  const dir = sp > 0.01 ? v.normalize() : flat(b).normalize();
  const v0 = Math.max(2, sp * keep);
  return { roll: rollAt(V3(b.x, 0, b.z), dir, v0, decel), stop: v0 / decel };
};
// 굴러가는 공을 가장 먼저 잡을 수 있는 수비수와 그 시간·지점
const interceptRoll = (codes, roll, stop, tStart) => {
  let best = null;
  for (const code of codes) {
    const home = fielderHome(code);
    for (let τ = 0; τ <= stop + 1e-6; τ += 0.05) {
      const p = roll(τ), need = dist2d(home, p) / PLAY_TUNING.fielderSpeed;
      if (need <= tStart + τ - 0.15) { if (!best || tStart + τ < best.t) best = { code, t: tStart + τ, p }; break; }
    }
  }
  if (best) return best;
  // 아무도 굴러가는 중에는 못 잡으면, 공이 멈춘 곳에 가장 가까운 수비수가 간다
  const p = roll(stop);
  const code = codes.reduce((m, c) => (dist2d(fielderHome(c), p) < dist2d(fielderHome(m), p) ? c : m), codes[0]);
  return { code, t: Math.max(tStart + stop, dist2d(fielderHome(code), p) / PLAY_TUNING.fielderSpeed + 0.1), p };
};

// 땅볼 아웃용: 공이 굴러가는 길에 가장 가까이 있는 내야수가 그 지점을 막는다(공은 그 자리에서 멈춘다)
const blockRoll = (codes, roll, stop, tStart) => {
  let best = null;
  for (const code of codes) {
    const home = fielderHome(code);
    for (let τ = 0; τ <= stop + 1e-6; τ += 0.05) {
      const d = dist2d(home, roll(τ));
      if (!best || d < best.d) best = { code, τ, d };
    }
  }
  const p = roll(best.τ);
  return { code: best.code, τ: best.τ, p, t: Math.max(tStart + best.τ, best.d / PLAY_TUNING.fielderSpeed + 0.15) };
};

// ---------- 플레이 만들기 ----------
let play = null;
// 등장인물: root(선수), tr(움직임), events(던지기·잡기·다이빙), face(서 있을 때 바라볼 곳), hideAt(사라지는 시간)
const newActor = (P, root, extra = {}) => {
  const a = { root, tr: track(V3(root.position.x, root.position.y, root.position.z)), events: [], phase: 0, ...extra };
  P.actors.push(a);
  return a;
};
const fielderActor = (P, code) => {
  let a = P.actors.find(x => x.code === code);
  if (!a) a = newActor(P, fielderRoot(code), { code, fielder: true });
  return a;
};
// 아웃된 주자·타자는 더그아웃 쪽으로 걸어 나가다 사라진다
const walkOff = (a, t) => {
  const from = lastKey(a.tr).p, to = dugoutPt();
  const end = runPath(a.tr, t, [from.add(to.subtract(from).normalize().scale(Math.min(12, dist2d(from, to))))], 1.8);
  a.hideAt = end; a.walk = true;
};

// res: 판정 결과(batting.js). 볼넷은 { kind: 'bb' }
const startPlay = (res, sub) => {
  const T = PLAY_TUNING;
  const P = { t: 0, end: 0, speed: 1, actors: [], segs: [], res, sub, kind: res.kind, info: {}, landAt: 0 };
  const bases0 = G.bases.slice();
  const ballFace = t => ballAt(P, t);
  // 타자: 반투명이었다면 진하게 다시 입히고, 배트를 놓고 1루로
  const bs = battingSide();
  dressRig(batter, { role: 'batter', kit: kitFor(teamIndex(bs), bs === 'home'), num: currentBatter().num, own: true, alpha: 1, hand: batSide });
  const bt = newActor(P, batter, { runner: true });
  const bSpd = res.kind === 'hr' ? T.hrTrot : res.kind === 'bb' ? 4.5 : runnerSpeed(currentBatter().speed);
  P.batDrop = res.kind !== 'bb';
  // 베이스 위 주자들
  const rs = runnerRoots.map((r, i) => (bases0[i] ? newActor(P, r, { runner: true, base: i + 1 }) : null));
  // 플레이 중에는 포수도 제대로(땅 위에, 불투명하게) 보인다
  const fs = fieldingSide();
  catcher.setEnabled(true); catcher.position.y = 0; catcher.scaling.setAll(1);
  dressRig(catcher, { role: 'catcher', kit: kitFor(teamIndex(fs), fs === 'home'), num: 2, own: true, alpha: 1 });
  // 수비수들은 모두 등장(움직이지 않아도 공을 바라본다)
  [...INFIELD, ...OUTFIELD].forEach(c => { fielderActor(P, c).face = ballFace; });
  let end = 0;

  if (res.kind === 'bb') {
    // 볼넷: 타자는 1루로, 밀려나는 주자만 한 베이스씩
    end = runPath(bt.tr, 0.2, [basePt(1)], bSpd);
    let forced = true;
    for (let i = 0; i < 3 && forced; i++) {
      if (!bases0[i]) { forced = false; break; }
      const tEnd = runPath(rs[i].tr, 0.2, basesBetween(i + 1, i + 2), 4.5);
      if (i + 2 >= 4) walkOff(rs[i], tEnd);
      end = Math.max(end, tEnd);
    }
    P.noBall = true;
    P.end = end + 0.3;
  } else {
    const fl = res.fl, Tf = flightDur(fl.pts);
    P.landAt = Tf;
    if (res.kind === 'hr') {
      // 홈런: 공은 담장을 넘어가고, 모두 천천히 베이스를 한 바퀴
      P.segs.push(flightSeg(fl.pts, 0));
      rs.forEach((a, i) => { if (a) { const e = runPath(a.tr, 0.3, basesBetween(i + 1, 4), T.hrTrot); walkOff(a, e); } });
      end = runPath(bt.tr, 0.5, basesBetween(0, 4), bSpd);
      walkOff(bt, end);
      P.hr = true;
      P.end = end + 0.6;
    } else if (res.kind === 'out' && res.groundOut) {
      P.end = groundOutPlay(P, fl, Tf, bt, rs, bases0, bSpd);
    } else if (res.kind === 'out') {
      P.end = flyOutPlay(P, fl, Tf, bt, bSpd);
    } else {
      P.end = hitPlay(P, res, fl, Tf, bt, rs, bSpd);
    }
  }
  if (!P.hr && P.end > T.maxSec) P.speed = P.end / T.maxSec;
  play = P;
  S.phase = 'play';
  $('ffBtn').hidden = !P.hr;
  hint(P.hr ? '홈런! 빨리 감기를 누르거나 화면을 탭하면 건너뛰어요.' : '화면을 탭하면 건너뛰어요.');
};

// 땅볼 아웃: 내야수가 굴러오는 공을 잡아 1루로(병살이면 2루 → 1루)
const groundOutPlay = (P, fl, Tf, bt, rs, bases0, bSpd) => {
  const dp = bases0[0] && G.outs < 2 && Math.random() < GAME_SETTINGS.doublePlayChance;
  P.info.dp = dp;
  P.segs.push(flightSeg(fl.pts, 0));
  const { roll, stop } = rollFrom(fl.pts, 0.85, 9);
  const ic = blockRoll(INFIELD, roll, stop, Tf);
  const f = fielderActor(P, ic.code);
  const grab = flat(ic.p);
  runPath(f.tr, Math.max(0.05, ic.t - dist2d(fielderHome(ic.code), grab) / PLAY_TUNING.fielderSpeed), [grab], PLAY_TUNING.fielderSpeed);
  hold(f.tr, ic.t);
  P.segs.push(rollSeg(τ => roll(Math.min(τ, ic.τ)), Tf, ic.t));
  f.events.push({ kind: 'catch', t0: ic.t - 0.2, t1: ic.t + 0.1 });
  const first = basePt(1).add(V3(0.6, 0, -0.2));
  const coverFirst = fielderActor(P, ic.code === '1B' ? 'P' : '1B');
  let tThrow = ic.t + 0.3, from = f, tArrive;
  if (dp) {
    // 2루 커버: 공을 잡은 수비수가 1루 쪽이면 유격수, 아니면 2루수
    const cov = fielderActor(P, ['1B', '2B', 'P'].includes(ic.code) ? 'SS' : '2B');
    const second = basePt(2).add(V3(0, 0, -0.5));
    runPath(cov.tr, 0.2, [second], PLAY_TUNING.fielderSpeed);
    P.segs.push(heldSeg(f, ic.t, tThrow));
    f.events.push({ kind: 'throw', t0: tThrow - 0.25, t1: tThrow + 0.15 });
    const t2 = throwSeg(P.segs, posAt(f.tr, tThrow).add(V3(0, 1.6, 0)), second.add(V3(0, 1.2, 0)), tThrow);
    hold(cov.tr, t2);
    // 1루 주자는 2루에서 공보다 늦게 도착해 아웃
    const r1 = rs[0];
    const d12 = dist2d(lastKey(r1.tr).p, basePt(2));
    runPath(r1.tr, Math.max(0.1, t2 + 0.25 - d12 / runnerSpeed(60)), [basePt(2)], runnerSpeed(60));
    walkOff(r1, t2 + 0.3);
    P.segs.push(heldSeg(cov, t2, t2 + 0.3));
    cov.events.push({ kind: 'throw', t0: t2 + 0.05, t1: t2 + 0.45 });
    from = cov; tThrow = t2 + 0.3;
  } else {
    P.segs.push(heldSeg(f, ic.t, tThrow));
    f.events.push({ kind: 'throw', t0: tThrow - 0.25, t1: tThrow + 0.15 });
  }
  runPath(coverFirst.tr, Math.min(Tf, 0.4), [first], PLAY_TUNING.fielderSpeed);
  tArrive = throwSeg(P.segs, posAt(from.tr, tThrow).add(V3(0, 1.6, 0)), first.add(V3(0, 1.2, 0)), tThrow);
  P.segs.push(heldSeg(coverFirst, tArrive, tArrive + 0.6));
  coverFirst.events.push({ kind: 'catch', t0: tArrive - 0.2, t1: tArrive + 0.2 });
  // 타자는 공보다 조금 늦게 1루에 도착해 아웃 → 더그아웃으로
  const d = pathLen(lastKey(bt.tr).p, [basePt(1)]);
  const v = Math.min(bSpd, d / Math.max(0.3, tArrive + 0.2 - 0.35));
  const tb = runPath(bt.tr, 0.35, [basePt(1)], v);
  walkOff(bt, tb + 0.2);
  return Math.max(tArrive, tb) + 0.5;
};

// 뜬공·라인드라이브 아웃: 가장 가까운 수비수가 떨어지는 곳으로 달려가 잡는다(아슬아슬하면 다이빙)
const flyOutPlay = (P, fl, Tf, bt, bSpd) => {
  const pts = fl.pts;
  // 글러브 높이(1.5m)까지 내려왔을 때 잡는다
  let ci = pts.length - 1;
  while (ci > 1 && pts[ci].y < 1.5) ci--;
  const tc = ci / 84, cp = flat(pts[ci]);
  P.segs.push(flightSeg(pts.slice(0, ci + 1), 0));
  P.landAt = tc;
  const codes = [...INFIELD.filter(c => c !== 'P'), ...OUTFIELD];
  const code = codes.reduce((m, c) => (dist2d(fielderHome(c), cp) < dist2d(fielderHome(m), cp) ? c : m), codes[0]);
  const f = fielderActor(P, code);
  const d = dist2d(fielderHome(code), cp), need = d / Math.max(0.2, tc - 0.15);
  if (need > PLAY_TUNING.fielderSpeed * PLAY_TUNING.dive && d > 2.5) {
    // 다이빙: 끝까지 달리다가 마지막 2.5m를 몸을 던져서
    const dir = cp.subtract(flat(fielderHome(code))).normalize();
    const pre = cp.subtract(dir.scale(2.5));
    const tPre = Math.max(0.1, tc - 0.35);
    runPath(f.tr, Math.max(0.05, tPre - dist2d(fielderHome(code), pre) / (PLAY_TUNING.fielderSpeed * 1.05)), [pre], PLAY_TUNING.fielderSpeed * 1.05);
    moveTo(f.tr, tc, cp);
    f.events.push({ kind: 'dive', t0: tPre, t1: tc + 0.8 });
    P.dive = true;
  } else {
    runPath(f.tr, Math.max(0.05, tc - 0.15 - d / PLAY_TUNING.fielderSpeed), [cp], PLAY_TUNING.fielderSpeed);
    f.events.push({ kind: 'catch', t0: tc - 0.3, t1: tc + 0.2 });
  }
  hold(f.tr, tc + 0.7);
  P.segs.push(heldSeg(f, tc, tc + 0.7));
  // 잡은 뒤 내야(2루)로 던진다
  const cov = fielderActor(P, code === '2B' ? 'SS' : '2B');
  const second = basePt(2).add(V3(0, 0, -0.5));
  runPath(cov.tr, 0.4, [second], PLAY_TUNING.fielderSpeed);
  const tThrow = tc + 0.7;
  f.events.push({ kind: 'throw', t0: tThrow - 0.25, t1: tThrow + 0.15 });
  const tArr = throwSeg(P.segs, posAt(f.tr, tThrow).add(V3(0, 1.6, 0)), second.add(V3(0, 1.2, 0)), tThrow);
  P.segs.push(heldSeg(cov, tArr, tArr + 0.3));
  // 타자는 1루 쪽으로 달리다가 공이 잡히면 더그아웃으로
  const full = runPath(bt.tr, 0.35, [basePt(1)], bSpd);
  if (full > tc) { bt.tr.keys = bt.tr.keys.filter(k => k.t <= tc); moveTo(bt.tr, tc, posAtPath(bt, 0.35, bSpd, tc)); }
  walkOff(bt, tc + 0.2);
  return tArr + 0.4;
};
// 홈에서 1루로 달리는 타자가 t초에 있는 곳
const posAtPath = (a, t0, v, t) => {
  const from = a.tr.keys[0].p, to = basePt(1), d = Math.min(dist2d(from, to), Math.max(0, (t - t0) * v));
  return from.add(flat(to).subtract(flat(from)).normalize().scale(d));
};

// 안타: 외야수가 공을 쫓아 주워서 내야로 던지고, 주자는 안타 수만큼 진루
const hitPlay = (P, res, fl, Tf, bt, rs, bSpd) => {
  const n = res.bases;
  P.segs.push(flightSeg(fl.pts, 0));
  const wall = res.label === '펜스 직격 2루타';
  const { roll, stop } = wall ? { roll: () => flat(fl.land), stop: 0 } : rollFrom(fl.pts, 0.55, 6);
  const ic = interceptRoll(OUTFIELD, roll, stop, Tf);
  const f = fielderActor(P, ic.code);
  const grab = flat(ic.p);
  runPath(f.tr, Math.max(0.05, ic.t - 0.1 - dist2d(fielderHome(ic.code), grab) / PLAY_TUNING.fielderSpeed), [grab], PLAY_TUNING.fielderSpeed);
  hold(f.tr, ic.t);
  P.segs.push(rollSeg(roll, Tf, ic.t));
  f.events.push({ kind: 'catch', t0: ic.t - 0.25, t1: ic.t + 0.1 });
  // 주자: 모두 n베이스씩. 홈을 밟으면 더그아웃으로
  let arrive = runPath(bt.tr, 0.35, basesBetween(0, n), bSpd);
  rs.forEach((a, i) => {
    if (!a) return;
    const e = runPath(a.tr, 0.1, basesBetween(i + 1, Math.min(i + 1 + n, 4)), runnerSpeed(60));
    if (i + 1 + n >= 4) walkOff(a, e);
    arrive = Math.max(arrive, e);
  });
  // 송구: 1루타는 2루로, 2루타는 3루로, 3루타는 홈으로. 주자들이 다 들어간 뒤에 도착하게
  const tgtBase = n === 1 ? 2 : n === 2 ? 3 : 4;
  const tgt = basePt(tgtBase).add(V3(0, 1.2, tgtBase === 4 ? 0 : -0.5));
  const covCode = tgtBase === 2 ? (ic.code === 'RF' ? '2B' : 'SS') : tgtBase === 3 ? '3B' : null;
  if (covCode) runPath(fielderActor(P, covCode).tr, 0.5, [flat(tgt)], PLAY_TUNING.fielderSpeed);
  const from = posAt(f.tr, ic.t).add(V3(0, 1.6, 0));
  const dur = BABYLON.Vector3.Distance(from, tgt) / PLAY_TUNING.throwSpeed;
  const tThrow = Math.max(ic.t + 0.35, arrive + 0.15 - dur);
  P.segs.push(heldSeg(f, ic.t, tThrow));
  f.events.push({ kind: 'throw', t0: tThrow - 0.25, t1: tThrow + 0.15 });
  const tArr = throwSeg(P.segs, posAt(f.tr, tThrow).add(V3(0, 1.6, 0)), tgt, tThrow);
  if (covCode) P.segs.push(heldSeg(fielderActor(P, covCode), tArr, tArr + 0.3));
  return Math.max(arrive, tArr) + 0.4;
};

// ---------- 매 프레임 ----------
const ballAt = (P, t) => {
  if (P.noBall) return V3(0, 1, 0);
  let seg = P.segs[0];
  for (const s of P.segs) { if (t >= s.t0) seg = s; }
  return seg.at(Math.min(t, seg.t1));
};
const updatePlay = dt => {
  const P = play;
  P.t = Math.min(P.end, P.t + dt * P.speed);
  const t = P.t;
  for (const a of P.actors) {
    const rig = rigOf(a.root);
    if (!rig) continue;
    if (a.hideAt != null && t >= a.hideAt) { a.root.setEnabled(false); continue; }
    a.root.setEnabled(true);
    const p = posAt(a.tr, t), prev = posAt(a.tr, Math.max(0, t - 0.06));
    a.root.position.x = p.x; a.root.position.z = p.z;
    const step = dist2d(p, prev);
    const moving = step > 0.03;
    const ev = a.events.find(e => t >= e.t0 && t <= e.t1);
    if (ev && ev.kind === 'dive') {
      // 다이빙 중에는 달려온 방향 그대로
      poseDive(rig, clamp((t - ev.t0) / 0.3, 0, 1));
      continue;
    }
    rig.root.rotation.x = 0; rig.root.rotation.z = 0;
    if (moving) {
      faceToward(a.root, p.add(p.subtract(prev)));
      a.phase += step * (a.walk ? 2.2 : 1.5);
      poseRun(rig, a.phase, a.walk ? 0.45 : 1);
    } else {
      if (a.face) faceToward(a.root, a.face(t));
      if (a.fielder) poseReady(rig); else restPose(rig);
    }
    if (ev && ev.kind === 'throw') poseThrow(rig, clamp((t - ev.t0) / (ev.t1 - ev.t0), 0, 1));
    if (ev && ev.kind === 'catch') poseCatch(rig);
  }
  // 배트를 던지듯 내려놓는다
  if (P.batDrop) {
    const u = clamp((t - 0.1) / 0.45, 0, 1);
    batPivot.position.set(-0.62 * batSide + 0.5 * batSide * u, 1.1 - 1.05 * u, 0.1 + 0.6 * u);
    batPivot.rotation.set(Math.PI / 2 * u, 0, (-0.6 - 1.0 * u) * batSide);
  }
  // 공
  if (!P.noBall) {
    const b = ballAt(P, t);
    ball.position.copyFrom(b); shadow.position.set(b.x, 0.03, b.z);
    ball.isVisible = true; shadow.isVisible = true;
    landMark.isVisible = t < P.landAt;
  } else { ball.isVisible = false; shadow.isVisible = false; landMark.isVisible = false; }
  if (P.t >= P.end) finishPlay();
};
// 카메라가 볼 곳: 공과 타자-주자 사이(공 쪽에 더 가깝게)
const playFocus = () => {
  const P = play, b = P.noBall ? posAt(P.actors[0].tr, P.t) : ballAt(P, P.t), r = posAt(P.actors[0].tr, P.t);
  const f = BABYLON.Vector3.Lerp(b, r, P.hr && P.t > P.landAt ? 0.85 : 0.3);
  return V3(f.x, Math.max(1, Math.min(f.y, 12)), Math.max(f.z, 4));
};
const skipPlay = () => { if (play) { play.t = play.end; updatePlay(0); } };
const finishPlay = () => {
  const P = play; play = null;
  $('ffBtn').hidden = true;
  const res = P.res;
  if (P.kind === 'bb') return endPA('bb', '볼넷', P.sub);
  const d = Math.round(res.fl.dist), sub = `${d}m · ${P.sub}`;
  if (P.kind === 'hr') return endPA('hr', '홈런!', sub);
  if (P.kind === 'hit') return endPA('hit', res.label, sub, { bases: res.bases });
  return endPA('out', P.dive ? `다이빙 캐치! ${res.label}` : res.label, sub, { groundOut: res.groundOut, dp: P.info.dp });
};
