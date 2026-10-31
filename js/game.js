// 경기 진행: 경기 상태 값, 경기 시작, 다음 투구, 카운트·아웃·이닝, 안타 결과 반영, 시프트·바람, 경기 종료

// 지금 단계: title(타이틀), windup(와인드업), pitch(공이 날아옴), hit(타구), wait(다음 투구 대기), aim(투수 조준), anim(견제 등 연출), over(경기 끝)
let phase = 'title';
// 게임 시계(ms)
let now = 0;
// 이 단계가 시작된 시각
let phaseStart = 0;
// 이 시각이 되면 다음 투구
let waitUntil = 0;
// 지금 이닝
let inning;
// 아웃 수
let outs;
// 볼 수
let balls;
// 스트라이크 수
let strikes;
// 이번 공격(초 또는 말)에서 낸 점수
let score;
// 안타 수
let hits;
// 홈런 수
let homers;
// 주자: [1루, 2루, 3루]. 0 비어 있음, 숫자는 그 주자의 타순+1
let bases = [0, 0, 0];
// 최고 기록(기기에 저장)
let best = 0;
// 지금 투구 정보(구종, 목표 위치, 구속 등)
let pitch;
// 지금 스윙 정보(null 아님 = 스윙함)
let swing;
// 지금 타구 정보
let hit;
// 내 팀 현재 타순(0~8)
let myBatter = 0;
// 상대 팀 현재 타순(0~8)
let oppBatter = 0;
// 내 팀 이닝별 득점
let myLine = [];
// 상대 팀 이닝별 득점
let oppLine = [];
// 내 팀 안타
let myHits = 0;
// 상대 팀 안타
let oppHits = 0;
// 번트를 준비했는지
let buntReq = false;
// 지금 타석에 선 타자 번호(0~8)
const curBatter = () => (pitcherMode ? oppBatter : myBatter);
try {
  best = +localStorage.getItem('nb3_best') || 0;
} catch (e) {}
// 경기를 처음부터 시작한다(pm: 투수부터, sw: 공수 교대 정식 경기)
function startGame(pm, sw) {
  applyOpp();
  myBatter = 0;
  oppBatter = 0;
  zoneStats = makeZoneStats();
  myLine = [];
  oppLine = [];
  myHits = 0;
  oppHits = 0;
  totalInnings = 9;
  myStamina = 100;
  cpuStamina = 100;
  myErrors = 0;
  oppErrors = 0;
  infieldShift = 0;
  outfieldShift = 0;
  shiftKey = '';
  derby = derbyQueued;
  derbyQueued = false;
  derbyPitches = 0;
  derbyHR = 0;
  {
    const w = randRange(1, 4),
      a = randRange(0, 6.283);
    windX = Math.sin(a) * w;
    windZ = -Math.cos(a) * w;
    if (derby) {
      windX = 0;
      windZ = -3;
    }
  }
  windUI();
  pitchPower = 0.8;
  lastHalfKey = 0;
  twoWay = !!sw;
  myRuns = 0;
  oppRuns = 0;
  pitcherMode = !!pm;
  strikeouts = 0;
  steal = null;
  stealReq = false;
  extraBase = null;
  inning = 1;
  outs = 0;
  balls = 0;
  strikes = 0;
  score = 0;
  hits = 0;
  homers = 0;
  bases = [0, 0, 0];
  $('title').style.display = 'none';
  $('end').style.display = 'none';
  $('hud').style.display = 'flex';
  nextPitch();
}
// 컴퓨터 투수 체력(0~100)
let cpuStamina = 100;
// 내 팀 실책
let myErrors = 0;
// 상대 팀 실책
let oppErrors = 0;
// 내야 시프트(1 켜짐)
let infieldShift = 0;
// 외야 시프트(1 켜짐)
let outfieldShift = 0;
// 시프트를 정한 타석 표시
let shiftKey = '';
// 바람 옆 방향(m/s)
let windX = 0;
// 바람 앞뒤 방향(m/s, 음수 = 외야로 부는 순풍)
let windZ = 0;
// 찬스 음악을 튼 타석 표시
let rallyKey = '';
// 이닝에 따른 시간대(0 낮, 1 저녁, 2 밤)
const timeOfDayFor = () => {
  const r = Math.min(inning, totalInnings) / totalInnings;
  return r <= 0.34 ? 0 : r <= 0.67 ? 1 : 2;
};
// 수비 시프트에 맞춰 수비수 위치를 옮긴다
function applyShift() {
  if (!pitcherMode) {
    const k = inning + '-' + curBatter();
    if (k !== shiftKey) {
      shiftKey = k;
      const c = batterContact();
      infieldShift = rand() < 0.2 + 0.07 * c ? 1 : 0;
      outfieldShift = rand() < 0.08 + 0.06 * c ? 1 : 0;
    }
  }
  const d = -curHand();
  fielders.forEach((f, i) => {
    if (!f.h0) f.h0 = f.h.clone();
    f.h.copy(f.h0);
    if (i < 4 && infieldShift) f.h.x += d * (i === 0 ? 2 : 6);
    if (i >= 4 && outfieldShift) {
      f.h.x += d * 10;
      f.h.z -= 4;
    }
    f.g.position.set(f.h.x, 0, f.h.z);
  });
}
// 바람 표시(왼쪽 아래)
const windEl = document.createElement('div');
windEl.style.cssText =
  'position:fixed;left:8px;bottom:calc(env(safe-area-inset-bottom,0px) + 8px);font-size:13px;color:#cfd8ff;background:rgba(10,20,50,.55);border:1px solid #2a3a72;border-radius:6px;padding:3px 8px;pointer-events:none;display:none;z-index:2';
document.body.appendChild(windEl);
// 바람 방향·세기 표시를 그린다
function windUI() {
  const sp = Math.hypot(windX, windZ),
    dg = Math.round(Math.atan2(windX, -windZ) * 57.3),
    o = -windZ;
  windEl.style.display = 'block';
  windEl.innerHTML = `🌬 <span style="display:inline-block;transform:rotate(${dg}deg)">↑</span> ${sp.toFixed(1)}m/s ${o > 1 ? '순풍' : o < -1 ? '역풍' : '횡풍'}`;
}
// 2아웃 득점권이면 긴장 음악과 함성
function rallyCheck() {
  if (pitcherMode || derby || outs !== 2 || !(bases[1] || bases[2])) return;
  const k = inning + '-' + curBatter();
  if (k !== rallyKey) {
    rallyKey = k;
    organ('tense');
    cheer(0.4, 3);
  }
}
// 다음 투구를 준비한다(컴퓨터 투구 결정, 화면 정리)
function nextPitch() {
  if (isSeason && pitcherMode) seasonStats.gp[curPitcher]++;
  if (derby) {
    if (derbyPitches >= 10) {
      endDerby();
      return;
    }
    derbyPitches++;
    outs = 0;
    strikes = 0;
    balls = 0;
    score = 0;
    bases = [0, 0, 0];
  }
  buntReq = false;
  cpuPitcherTick();
  rallyCheck();
  setTimeOfDay(timeOfDayFor());
  clearTrail();
  applyShift();
  dressAll();
  fielders.forEach(f => f.g.position.set(f.h.x, 0, f.h.z));
  phase = 'windup';
  phaseStart = now;
  swing = null;
  hit = null;
  const t = Object.assign({}, pitchTypes[(rand() * pitchTypes.length) | 0]),
    countAdj = balls >= 2 && strikes < 2 ? 0.12 : strikes === 2 ? -0.1 : 0,
    inz = derby || rand() < CFG.strikeBase - CFG.strikePerInn * (inning - 1) + countAdj;
  t.d = Math.round(t.d * (0.93 - 0.025 * (inning - 1)));
  let x, y;
  if (inz) {
    x = randRange(-0.46, 0.46) * ZONE_HALF_W * 2;
    y = 0.8 + randRange(-0.46, 0.46) * (ZONE_TOP - ZONE_BOTTOM);
  } else {
    const sd = rand() < 0.5 ? -1 : 1;
    if (rand() < 0.6) {
      x = sd * (ZONE_HALF_W + randRange(0.04, 0.3));
      y = 0.8 + randRange(-0.6, 0.6) * 0.6;
    } else {
      x = randRange(-0.6, 0.6) * ZONE_HALF_W * 2;
      y = sd > 0 ? ZONE_TOP + randRange(0.05, 0.3) : ZONE_BOTTOM - randRange(0.05, 0.3);
    }
  }
  {
    const sg = (1 - (PITCHERS[curPitcher].cmd || 0.6)) * 0.45 * (pitcherMode ? 1 : 1 + (100 - cpuStamina) / 80),
      nz = () => rand() + rand() + rand() - 1.5;
    x += nz() * sg;
    y += nz() * sg * 0.8;
  }
  pitch = {
    t,
    xT: x,
    yT: Math.max(0.12, y),
    kmh: Math.round(
      randRange(t.v[0], t.v[1]) + 1.5 * (inning - 1) - (pitcherMode ? 0 : Math.round((100 - cpuStamina) * 0.09)),
    ),
    side: rand() < 0.5 ? -1 : 1,
    t0: 0,
    warp:
      rand() < (t.k === 'change' || t.k === 'curve' ? 0.3 : 0.14) + 0.01 * inning ? (rand() < 0.5 ? 1.35 : 0.72) : 0,
  };
  pitch.fake = !inZone(pitch) && rand() < 0.6;
  ball.visible = false;
  shadow.visible = false;
  zone.visible = pitcherMode;
  pitchMark.visible = false;
  bat.rotation.y = -1.4;
  batInner.rotation.z = 0.9;
  fielders.forEach(f => {
    f.g.position.copy(f.h);
    f.g.rotation.y = 0;
  });
  camera.position.copy(pitcherMode ? pitcherCam : camHome);
  camLook.set(0, pitcherMode ? 0.9 : 1, pitcherMode ? 0 : -10);
  pitcherRoot.visible = !pitcherMode;
  $('info').textContent = '';
  $('hint').textContent = '';
  updateHud();
  stealReq = false;
  steal = null;
  extraBase = null;
  pickoffBase = -1;
  cpuStealPlan = false;
  const hk = inning * 2 + (pitcherMode ? 1 : 0);
  if (hk !== lastHalfKey) {
    lastHalfKey = hk;
    if (!pitcherMode && inning <= totalInnings) organ('charge');
    if (inning <= totalInnings)
      showBanner(
        inning + '회' + (twoWay ? (pitcherMode ? ' 말 · 수비' : ' 초 · 공격') : ' 시작'),
        inning === totalInnings ? '마지막 이닝!' : twoWay ? '공수교대' : '',
        true,
      );
  }
  if (pitcherMode) {
    phase = 'aim';
    pitcherAnim(0, 0);
    ball.visible = false;
    cpuStealPlan = stealer() >= 0 && rand() < 0.4;
    $('info').textContent = cpuStealPlan ? '⚠ 주자가 뛸 기미!' : '';
    $('hint').textContent = '구종·구속 선택 후 드래그로 조준, 손 떼면 투구!';
  } else {
    if (inning >= totalInnings - 1 && (bases[1] || bases[2]) && !bases[0] && outs < 2 && rand() < 0.35) {
      ibbDo();
      return;
    }
    const o = [0, 1, 2].filter(i => bases[i]);
    if (o.length && rand() < 0.32) pickoffBase = o[(rand() * o.length) | 0];
  }
}
// 다음 타자로 넘기고 카운트를 지운다
function newBat() {
  balls = 0;
  strikes = 0;
  if (pitcherMode) oppBatter = (oppBatter + 1) % 9;
  else myBatter = (myBatter + 1) % 9;
}
// 고의사구 버튼을 처음 누른 시각(2.5초 안에 한 번 더 누르면 확정)
let ibbTapT = 0;
// 고의사구로 타자를 내보낸다
function ibbDo() {
  stealReq = false;
  cpuStealPlan = false;
  pickoffBase = -1;
  steal = null;
  ibbTapT = 0;
  const sc = score;
  walk();
  newBat();
  updateHud();
  showBanner('고의사구', score > sc ? '밀어내기 실점' : '타자 1루 진루', !pitcherMode);
  $('hint').textContent = '';
  $('info').textContent = '';
  phase = 'wait';
  waitUntil = now + 1300;
  tone(520, 0.08);
}
// 아웃을 n개 더하고 3아웃이면 공수 교대
function addOuts(n) {
  outs += n;
  if (outs >= 3) {
    outs = 0;
    bases = [0, 0, 0];
    nextHalf();
  }
  newBat();
}
// 몸에 맞는 공 연출이 끝나는 시각
let hbpUntil = 0;
// 주자 연출이 끝나면 더할 점수
let pendingRuns = 0;
// 볼·스트라이크·파울·몸에 맞는 공을 카운트에 반영하고 판정 글자를 돌려준다
function countPitch(k) {
  let t;
  if (k === 'hbp') {
    t = '몸에 맞는 공!';
    walk();
    newBat();
    tone(220, 0.2);
    if (rand() < 0.12) {
      t = '벤치 클리어링!';
      shake = 0.5;
      tone(140, 0.6);
      burst(pitch.xT, 1, 0, 60, [1, 0.4, 0.2], 8, 1.2);
      startBenchClear(now);
    }
  } else if (k === 'ball') {
    balls++;
    t = '볼';
    if (balls >= 4) {
      t = '볼넷!';
      walk();
      newBat();
    }
    tone(520, 0.08);
  } else if (k === 'foul') {
    if (strikes < 2) strikes++;
    t = '파울';
    tone(300, 0.1);
  } else {
    strikes++;
    t = k === 'swingmiss' ? '헛스윙!' : '스트라이크';
    tone(160, 0.15);
    if (strikes >= 3) {
      t = (k === 'swingmiss' ? '헛스윙 ' : '') + '삼진!';
      strikeouts++;
      ssK();
      addOuts(1);
    }
  }
  return t;
}
// 타구 결과(안타·아웃·홈런 등)를 주자·점수·아웃에 반영한다
function applyHit(k) {
  ssBat(k);
  const ob = outs,
    ih = inning,
    ph = pitcherMode;
  if (!pitcherMode && ['1b', '2b', '3b', 'hr', 'bh'].includes(k)) cpuStamina = Math.max(0, cpuStamina - 7);
  if (hit && hit.fumble && (k === 'fo' || k === 'go')) {
    if (pitcherMode) myErrors++;
    else oppErrors++;
  }
  let r = 0,
    txt = {
      hr: '홈런!!',
      '3b': '3루타!',
      '2b': '2루타!',
      '1b': '안타!',
      go: '땅볼 아웃',
      fo: hit && hit.foulOut ? '파울 플라이 아웃' : '플라이 아웃',
    }[k];
  if (k === 'bh') {
    r = occupied(bases[2]);
    bases = [batterTag(), bases[0], bases[1]];
    hits++;
    if (pitcherMode) oppHits++;
    else myHits++;
    txt = '번트 안타';
    newBat();
  } else if (k === 'bs') {
    const oc = outs;
    r = oc >= 2 ? 0 : occupied(bases[2]);
    bases = [0, bases[0], bases[1]];
    addOuts(1);
    txt = '희생번트';
  } else if (hit && hit.fumble && (k === 'fo' || k === 'go')) {
    r = occupied(bases[2]);
    bases = [batterTag(), bases[0], bases[1]];
    txt = '실책! 타자 출루';
    newBat();
  } else if (k === '1b') {
    r = occupied(bases[2]) + occupied(bases[1]);
    bases = [batterTag(), bases[0], 0];
    hits++;
    if (pitcherMode) oppHits++;
    else myHits++;
    newBat();
  } else if (k === '2b') {
    r = occupied(bases[2]) + occupied(bases[1]);
    bases = [0, batterTag(), bases[0]];
    hits++;
    if (pitcherMode) oppHits++;
    else myHits++;
    newBat();
  } else if (k === '3b') {
    r = occupied(bases[0]) + occupied(bases[1]) + occupied(bases[2]);
    bases = [0, 0, batterTag()];
    hits++;
    if (pitcherMode) oppHits++;
    else myHits++;
    newBat();
  } else if (k === 'hr') {
    r = occupied(bases[0]) + occupied(bases[1]) + occupied(bases[2]) + 1;
    bases = [0, 0, 0];
    hits++;
    if (pitcherMode) oppHits++;
    else myHits++;
    homers++;
    if (derby) derbyHR++;
    newBat();
  } else if (k === 'go') {
    const r1 = bases[0],
      r2 = bases[1],
      r3 = bases[2],
      pl = (hit && hit.play) || 'out';
    if (pl === 'tp' && outs === 0) {
      bases = [0, 0, 0];
      addOuts(3);
      txt = '트리플 플레이!';
    } else if (pl === 'dp' && r1 && ob < 2) {
      if (ob === 0) r = occupied(r3);
      bases = [0, 0, r2];
      addOuts(2);
      txt = '병살타!';
    } else {
      if (ob < 2) r = occupied(r3);
      bases = [0, r1, r2];
      addOuts(1);
      txt = r1 || r2 || r3 ? '땅상 아웃' : '송구 아웃';
    }
  } else if (k === 'fo') {
    const tg = !pitcherMode && hit.tag;
    if (tg) {
      if (tg.ok) {
        const rv = bases[tg.i];
        bases[tg.i] = 0;
        if (tg.i === 2) r = 1;
        else bases[tg.i + 1] = rv;
        txt = '태그업 성공!';
      } else {
        bases[tg.i] = 0;
        txt = '태그업 아웃!';
      }
      addOuts(tg.ok ? 1 : 2);
    } else {
      if (pitcherMode && ob < 2 && bases[2] && rand() < 0.6) {
        r = 1;
        bases[2] = 0;
        txt = '희생플라이';
      }
      addOuts(1);
    }
  }
  if (inning === ih && pitcherMode === ph) pendingRuns = r;
  else {
    r = 0;
    pendingRuns = 0;
  }
  return { txt, sub: r ? `+${r}점` : '', good: ['hr', '3b', '2b', '1b'].includes(k) || r > 0 };
}
// 경기 종료 화면을 보여준다
function endGame() {
  phase = 'over';
  phaseStart = now;
  if (twoWay) {
    $('fs').textContent = myRuns + ' : ' + oppRuns;
    $('fd').textContent = myRuns > oppRuns ? '🎉 승리!' : myRuns < oppRuns ? '패배...' : '무승부';
    $('fb').textContent = '나 vs 상대';
    $('hud').style.display = 'none';
    if (isSeason) {
      seasonResult();
      return;
    }
    $('end').style.display = 'flex';
    return;
  }
  const bk = pitcherMode ? 'nb3_bestP' : 'nb3_best';
  let bv = null;
  try {
    bv = localStorage.getItem(bk);
  } catch (e) {}
  if (bv === null || (pitcherMode ? score < +bv : score > +bv)) {
    bv = score;
    try {
      localStorage.setItem(bk, bv);
    } catch (e) {}
  }
  best = +bv;
  $('fs').textContent = score + (pitcherMode ? '실점' : '점');
  $('fd').textContent = pitcherMode
    ? `삼진 ${strikeouts}  피안타 ${hits}  피홈런 ${homers}`
    : `안타 ${hits}  홈런 ${homers}`;
  $('fb').textContent =
    `등급 ${pitcherMode ? (score <= 2 ? 'S' : score <= 5 ? 'A' : score <= 9 ? 'B' : 'C') : score >= 20 ? 'S' : score >= 12 ? 'A' : score >= 6 ? 'B' : 'C'} · ${pitcherMode ? '최소 실점' : '최고 기록'} ${best}점`;
  $('end').style.display = 'flex';
  $('hud').style.display = 'none';
}
// 공수 교대 정식 경기인지
let twoWay = false;
// 내 팀 총점
let myRuns = 0;
// 상대 팀 총점
let oppRuns = 0;
// 이닝 시작 배너를 띄운 초/말 표시
let lastHalfKey = 0;
// 지금 내가 투수(수비)인지
let pitcherMode = false;
// 삼진 수
let strikeouts = 0;
// 이닝의 초/말을 넘긴다
function nextHalf() {
  if (!twoWay) {
    inning++;
    return;
  }
  if (pitcherMode) oppLine[inning - 1] = score;
  else myLine[inning - 1] = score;
  if (pitcherMode) {
    oppRuns += score;
    inning++;
    if (inning > totalInnings && myRuns === oppRuns && totalInnings < 12) totalInnings++;
  } else {
    myRuns += score;
    if (inning >= totalInnings && oppRuns > myRuns) {
      score = 0;
      inning = totalInnings + 1;
      return;
    }
  }
  score = 0;
  pitcherMode = !pitcherMode;
  if (!pitcherMode) myStamina = Math.min(100, myStamina + 30);
}
// 경기를 그만두고 타이틀 화면으로 돌아간다(일시정지 창의 '처음으로')
function backToTitle() {
  if (isReplay) endReplay();
  tweens.length = 0;
  // 홈런 베이스 돌기 중이었으면 타자를 타석으로
  trot = null;
  bat.visible = true;
  batterRig.root.position.set(-0.78 * batSide, 0, 0.1);
  batterRig.root.rotation.z = 0;
  batterAnim(-1);
  // 공·주자·연출 정리
  swing = null;
  hit = null;
  steal = null;
  stealReq = false;
  extraBase = null;
  pickoffBase = -1;
  cpuStealPlan = false;
  pendingRuns = 0;
  bases = [0, 0, 0];
  ball.visible = false;
  shadow.visible = false;
  pitchMark.visible = false;
  zone.visible = false;
  clearTrail();
  slowUntil = 0;
  fwEnd = 0;
  shake = 0;
  hbpUntil = 0;
  benchClearT = -1e9;
  isSeason = false;
  derby = false;
  derbyQueued = false;
  // 투수·수비수 제자리로
  pitcherMode = false;
  pickEnd();
  pitcherRoot.visible = true;
  umpireRig.root.visible = false;
  fielders.forEach(f => {
    f.g.position.copy(f.h);
    f.g.rotation.set(0, 0, 0);
    readyPose(f.r);
  });
  camera.zoom = 1;
  camera.updateProjectionMatrix();
  setTimeOfDay(3);
  // 화면 정리
  aimPointer = null;
  aimEl.style.display = 'none';
  ['hud', 'end', 'season-modal', 'hof', 'replay-tag'].forEach(id => ($(id).style.display = 'none'));
  windEl.style.display = 'none';
  $('info').textContent = '';
  $('hint').textContent = '';
  $('banner').classList.remove('show');
  $('title').style.display = '';
  phase = 'title';
  updateHud();
  updateControls();
  cardUpd();
}
