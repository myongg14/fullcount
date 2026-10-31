// 타격: 스윙 판정과 타구 결과, 담장 거리, 핫존 보너스, 좌타/우타, 타구 처리 결과 반영

// 스윙 방식: 'c' 정확, 'p' 강공
let swingMode = 'c';
// 노림수: 0 없음, 1 직구, 2 변화구
let guessType = 0;
// 각도(도)에 따른 담장까지 거리(게임 거리 단위, ×0.42 = m)
const fenceUnits = a => 290 - 57 * (Math.abs(a) / 45) ** 1.5;
// 공이 존 가운데에서 얼마나 벗어났는지(0 가운데 ~ 1 테두리 밖)
const zoneEdgeDist = p => {
  const u = p.xT / ZONE_HALF_W,
    v = ((p.yT - ZONE_BOTTOM) / (ZONE_TOP - ZONE_BOTTOM)) * 2 - 1;
  if (Math.abs(u) > 1 || Math.abs(v) > 1) return 1;
  return clamp(Math.hypot(u, v) / Math.SQRT2, 0, 1);
};
// 지금 타자의 컨택 능력치
const batterContact = () => {
  const r = LINEUPS[pitcherMode ? 'o' : 'm'][curBatter()];
  return r && r[3] ? r[3] : 5;
};
// 스윙 타이밍과 공 위치로 타구 결과를 정하고 공을 날린다
function resolveSwing() {
  const d = (now - (pitch.t0 + pitch.t.d)) / 1000,
    ad = Math.abs(d),
    off = Math.hypot(pitch.xT / ZONE_HALF_W, (pitch.yT - 0.8) / 0.3);
  if (
    ad > (swing.bunt ? 0.1 : swingMode === 'p' ? 0.105 : 0.13) ||
    off > 1.5 ||
    (swing.bunt && (ad > 0.1 || zoneEdgeDist(pitch) >= 1))
  ) {
    swing.miss = true;
    return;
  }
  const gb = guessType ? ((['fast', 'sinker'].includes(pitch.t.k) ? 1 : 2) === guessType ? 0.12 : -0.1) : 0,
    tq = 1 - ad / 0.12,
    lq = clamp(1 - zoneEdgeDist(pitch) * 0.85, 0, 1),
    q = clamp(
      tq * 0.75 +
        lq * 0.25 +
        (batterContact() - 5) * 0.03 +
        cellBoost(pitch) +
        gb +
        (swingMode === 'c' ? 0.03 : 0) +
        randRange(-0.08, 0.08) -
        (pitch.warp ? 0.14 : 0),
      0,
      1,
    );
  const th = batSide * clamp((d / 0.13) * 52 + randRange(-12, 12), -70, 70);
  let D =
    q > 0.78 ? randRange(250, 340) : q > 0.5 ? randRange(150, 260) : q > 0.25 ? randRange(70, 160) : randRange(30, 80);
  D *= swingMode === 'p' ? 1.3 : 1.12;
  {
    const aw = (th * Math.PI) / 180;
    D *= 1 + 0.035 * (windX * Math.sin(aw) - windZ * Math.cos(aw));
  }
  const lr = rand();
  let loft =
    q > 0.78
      ? lr < 0.6
        ? 'fly'
        : 'line'
      : q > 0.5
        ? lr < 0.4
          ? 'fly'
          : lr < 0.75
            ? 'line'
            : 'ground'
        : lr < 0.55
          ? 'ground'
          : lr < 0.85
            ? 'fly'
            : 'line';
  if (loft === 'ground') D = Math.min(D * 0.7, 200);
  const alp = ((loft === 'fly' ? randRange(30, 45) : randRange(11, 18)) * Math.PI) / 180;
  let k,
    gPick = -1,
    foulC = false;
  const p0 = pitchPos(pitch, clamp((now - pitch.t0) / pitch.t.d, 0, 1)),
    aq = (th * Math.PI) / 180,
    dq = loft === 'ground' ? Math.min(D * 0.42, 27.4) : D * 0.42,
    fx = p0.x + Math.sin(aq) * dq,
    fz = p0.z - Math.cos(aq) * dq,
    fair = -fz > 0 && Math.abs(fx) <= -fz + 0.1;
  if (!fair) {
    k = 'foul';
    D = Math.min(D, 240);
    if (loft === 'fly' && !swing.bunt && flyCatchable(D, th) && rand() < CFG.foulCatch) {
      k = 'fo';
      foulC = true;
    }
  } else if (
    loft !== 'ground' &&
    (() => {
      const W = fenceUnits(th) * 0.42,
        Dm = D * 0.42;
      return Dm > W && W * Math.tan(alp) * (1 - W / Dm) > 5.4;
    })()
  )
    k = 'hr';
  else if (loft === 'fly') {
    const po = flyCatchable(D, th) ? CFG.flyCatch : CFG.flyMiss;
    k =
      rand() < po
        ? 'fo'
        : D > 190
          ? D > fenceUnits(th) - 40 && Math.abs(th) > 28 && rand() < 0.25
            ? '3b'
            : '2b'
          : '1b';
  } else if (loft === 'line') {
    k = rand() < CFG.lineOut ? 'fo' : D > 170 ? (rand() < 0.45 ? '2b' : '1b') : '1b';
    if (k === '2b' && Math.abs(th) > 28 && D > fenceUnits(th) - 50 && rand() < 0.2) k = '3b';
  } else {
    const gp = groundPlay(th, q);
    gPick = gp.i;
    k = rand() < gp.p ? 'go' : '1b';
  }
  if (swing.bunt) {
    const bsp = (LINEUPS[pitcherMode ? 'o' : 'm'][curBatter()] || [0, 0, 5])[2];
    if (Math.abs(pitch.xT) > ZONE_HALF_W * 1.6) {
      k = 'foul';
      D = Math.min(D, 240);
    } else if (ad > 0.07 || zoneEdgeDist(pitch) > 0.9) {
      k = 'fo';
      loft = 'fly';
      D = randRange(25, 55);
    } else {
      k = rand() < CFG.buntHit + (bsp - 5) * CFG.buntSpd ? 'bh' : 'bs';
      loft = 'ground';
      D = randRange(12, 24);
    }
  }
  if (k !== 'hr' && loft === 'line') D = Math.min(D, fenceUnits(th) - 15, 235);
  if (k !== 'hr' && k !== 'foul') D = Math.min(D, fenceUnits(th) - 10);
  if (loft === 'fly' && (k === '1b' || k === '2b' || k === '3b')) {
    const aa = (th * Math.PI) / 180,
      sn = Math.sin(aa),
      cs = -Math.cos(aa),
      mx = Math.min(D + 40, fenceUnits(th) - 12, 300);
    let bm = -1,
      bd2 = D;
    for (let d = 60; d <= mx; d += 6) {
      const P = new THREE.Vector3(sn * d * 0.42, 0, cs * d * 0.42);
      let m = 1e9;
      fielders.forEach(f => {
        m = Math.min(m, f.h.distanceTo(P));
      });
      if (m > bm) {
        bm = m;
        bd2 = d;
      }
    }
    D = bd2;
  }
  if (k === '1b') D = Math.min(D, randRange(150, 185));
  if (k === 'go') D = randRange(52, 70);
  const fumble = !foulC && (k === 'fo' || k === 'go') && rand() < CFG.fumble;
  {
    const ci = zoneCell(pitch.xT, pitch.yT),
      ss = zoneStats[pitcherMode ? 'o' : 'm'][curBatter()];
    if (ci >= 0 && k !== 'foul') {
      ss[ci].n++;
      if (['1b', '2b', '3b', 'hr', 'bh'].includes(k)) ss[ci].h++;
    }
  }
  const lab =
    pitch.warp && ad > 0.06 ? '속았다!' : ad < 0.03 ? 'PERFECT' : ad < 0.07 ? 'GOOD' : d < 0 ? '빠름' : '늦음';
  const a = (th * Math.PI) / 180,
    Dm = D * 0.42,
    dir = new THREE.Vector3(Math.sin(a), 0, -Math.cos(a)),
    v = new THREE.Vector3();
  let air = 0;
  if (loft === 'ground') {
    const sp = Math.sqrt(Dm * 8);
    v.copy(dir).multiplyScalar(sp);
    v.y = -1;
  } else {
    const al = swing.bunt && loft === 'fly' ? (randRange(34, 46) * Math.PI) / 180 : alp,
      sp = Math.sqrt((Dm * GRAVITY) / Math.sin(2 * al));
    v.copy(dir).multiplyScalar(sp * Math.cos(al));
    v.y = sp * Math.sin(al);
    air = (2 * v.y) / GRAVITY;
  }
  const L = dir.clone().multiplyScalar(Dm);
  let fi = 0,
    bd = 1e9;
  const gro = k === 'go',
    LP = gro ? dir.clone().multiplyScalar(Dm * 1.1) : L;
  fielders.forEach((f, i) => {
    if (gro && i > 3) return;
    const dd = f.h.distanceTo(LP);
    if (dd < bd) {
      bd = dd;
      fi = i;
    }
  });
  if (loft === 'fly' && (k === '1b' || k === '2b' || k === '3b') && bd < 4.2) k = 'fo';
  let gip = null;
  if (loft === 'ground' && (k === 'go' || k === '1b')) {
    const c = chaser(dir, Dm, p0, k === 'go');
    fi = c.i;
    gip = c.ip;
  }
  ball.position.copy(pitchPos(pitch, clamp((now - pitch.t0) / pitch.t.d, 0, 1)));
  ball.position.y = Math.max(0.5, ball.position.y);
  hit = {
    k,
    fumble,
    v,
    L,
    fi,
    air,
    t0: now,
    lab,
    landed: false,
    endAt: 0,
    hold: false,
    dir,
    fsp: clamp(bd / Math.max(1.2, air * 0.92), 4, 17),
  };
  hit.ip = gip;
  hit.foulOut = foulC;
  hit.ev = Math.max(40, Math.round(v.length() * 4.5));
  hit.la = Math.round(Math.atan2(v.y, Math.hypot(v.x, v.z)) * 57.3);
  phase = 'hit';
  replayRec = [0, ball.position.x, ball.position.y, ball.position.z];
  replayT = 0;
  zone.visible = false;
  batCrack();
  if (k === 'hr') tone(880, 0.4, 0.1, 'triangle');
  hit.dist = 0;
  {
    const bp = ball.position;
    burst(bp.x, bp.y, bp.z, q > 0.78 ? 40 : 22, [1, 0.9, 0.5], q > 0.78 ? 9 : 6, 0.5);
  }
  slowUntil = ['fo', 'go', 'bs', 'foul'].includes(k) ? 0 : now + (k === 'hr' ? 750 : q > 0.78 ? 280 : 150);
  shake = q > 0.78 ? 0.22 : 0.1;
  $('info').textContent =
    `${lab}${guessType && gb > 0 ? ' · 노림수 적중!' : ''} · 타구속도 ${hit.ev}km/h · 발사각 ${hit.la}°`;
  $('hint').textContent = '';
}
// 타구 처리가 끝나면 결과를 반영하고 배너를 띄운다
function land() {
  if (hit.k === 'foul') {
    steal = null;
    stealReq = false;
    showBanner(countPitch('foul'), hit.lab, false);
  } else {
    endSteal(true);
    const bo = bases.slice(),
      ih = inning,
      ph = pitcherMode,
      r = applyHit(hit.k),
      dx = hit.k !== 'go' && hit.dist > 30 ? ` · ${Math.round(hit.dist)}m` : '';
    showBanner(
      hit.dv ? (hit.dv === 'ok' ? '다이빙 캐치!!' : r.txt + ' · 다이빙 실패') : r.txt,
      (hit.lab + ' ' + r.sub + dx + ' · ' + hit.ev + 'km/h ' + hit.la + '°').trim(),
      r.good,
    );
    landX();
    cheer(hit.k === 'hr' ? 0.95 : r.good ? 0.5 : 0.2, hit.k === 'hr' ? 4 : 2);
    if (hit.k === 'hr') {
      tone(660, 0.5, 0.1, 'triangle');
      organ(ph ? 'sad' : 'hr');
      fwEnd = now + 2600;
      fwNext = now;
      trotStart();
      startReplay();
    }
    runScene(bo, ih, ph, hit.k);
  }
  updateHud();
  phase = 'wait';
  waitUntil = now + (hit.k === 'hr' || extraBase != null || hit.tag ? 2400 : 1700);
  if (hit.rs) waitUntil = Math.max(waitUntil, now + hit.rs + 800);
}
// 타자 다리 들기 정도(0~1)
let batLoad = 0;
// 9칸 존별 타격 기록 표를 새로 만든다
const makeZoneStats = () => ({
  m: [...Array(9)].map(() => [...Array(9)].map(() => ({ n: 0, h: 0 }))),
  o: [...Array(9)].map(() => [...Array(9)].map(() => ({ n: 0, h: 0 }))),
});
// 타자별 9칸 존 타격 기록(이번 경기)
let zoneStats = makeZoneStats();
// 기본 성향과 이번 경기 기록을 섞은 핫/콜드 값(-1~1)
const effectiveHot = (team, idx, c) => {
  const base = HOT_ZONES[team][idx][c],
    st = zoneStats[team][idx][c];
  const obs = st.n ? ((st.h + 0.5) / (st.n + 1) - 0.3) * 2 : 0;
  return clamp(base * 0.6 + obs * 0.4, -1, 1);
};
// 공 위치가 존 9칸 중 몇 번째인지(밖이면 -1)
const zoneCell = (x, y) => {
  if (Math.abs(x) > ZONE_HALF_W || y < ZONE_BOTTOM || y > ZONE_TOP) return -1;
  const c = Math.min(2, Math.floor(((x + ZONE_HALF_W) / (2 * ZONE_HALF_W)) * 3)),
    r = Math.min(2, Math.floor(((ZONE_TOP - y) / (ZONE_TOP - ZONE_BOTTOM)) * 3));
  return r * 3 + c;
};
// 공이 들어온 칸의 핫/콜드에 따른 타격 보너스
const cellBoost = p => {
  const c = zoneCell(p.xT, p.yT);
  return c < 0 ? -0.08 : effectiveHot(pitcherMode ? 'o' : 'm', curBatter(), c) * 0.12;
};
// 내 타자 좌우타 고정: 0 선수별, 1 전부 우타, -1 전부 좌타
let handOverride = 0;
// 지금 타자가 우타(1)인지 좌타(-1)인지
function curHand() {
  const r = LINEUPS[pitcherMode ? 'o' : 'm'][curBatter()] || [];
  if (!pitcherMode && handOverride) return handOverride;
  return r[4] === 'L' ? -1 : 1;
}
