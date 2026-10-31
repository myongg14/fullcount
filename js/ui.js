// 화면 표시: 점수판·배너, 홈런 리플레이, 상황별 버튼, 투수 선택 버튼, 타자 카드, 미니 존·3D 핫존·스트라이크존 표시

// 3D 스트라이크존 테두리(투수 시점에서 보임)
const zone = new THREE.LineSegments(
  new THREE.EdgesGeometry(new THREE.PlaneGeometry(ZONE_HALF_W * 2, ZONE_TOP - ZONE_BOTTOM)),
  new THREE.LineBasicMaterial({ color: 0xffe36b, transparent: true, opacity: 0.95 }),
);
zone.position.set(0, (ZONE_BOTTOM + ZONE_TOP) / 2, 0);
scene.add(zone);
// 공이 지나간 자리 표시(초록 = 스트라이크, 빨강 = 볼)
const pitchMark = new THREE.Mesh(
  new THREE.SphereGeometry(0.06, 12, 8),
  new THREE.MeshBasicMaterial({ color: 0x5fd16a }),
);
pitchMark.visible = false;
scene.add(pitchMark);
// 볼·스트라이크·아웃 동그라미를 그린다
function drawDots(id, n, v) {
  $(id).innerHTML = Array.from({ length: n }, (_, i) => `<i class="${i < v ? 'on' : ''}"></i>`).join('');
}
// 점수판(점수·이닝·카운트·주자)을 새로 그린다
function updateHud() {
  $('sc').textContent = twoWay
    ? `${myRuns + (pitcherMode ? 0 : score)} : ${oppRuns + (pitcherMode ? score : 0)}`
    : score + (pitcherMode ? '실점' : '점');
  $('inn').textContent =
    `${Math.min(inning, totalInnings)}회${twoWay ? (pitcherMode ? ' 말' : ' 초') : ''} / ${totalInnings}회`;
  drawDots('bd', 3, balls);
  drawDots('sd', 2, strikes);
  drawDots('od', 2, outs);
  [0, 1, 2].forEach(i => {
    $('bs' + i).classList.toggle('on', !!bases[i]);
    runnerRoots[i].visible = !!bases[i];
  });
  boardUpd();
  if (derby) {
    $('sc').textContent = 'HR ' + derbyHR;
    $('inn').textContent = Math.min(derbyPitches, 10) + ' / 10구';
  }
}
// 화면 가운데 큰 글자 배너를 띄운다
function showBanner(t, sub, good) {
  const e = $('banner');
  e.innerHTML = `<b class="${good ? 'g' : ''}">${t}</b><small>${sub || ''}</small>`;
  e.classList.remove('show');
  void e.offsetWidth;
  e.classList.add('show');
}
// 홈런 타구 궤적 기록 [시간, x, y, z, ...]
let replayRec = [];
// 궤적 기록 시간(초)
let replayT = 0;
// 리플레이 중인지
let isReplay = false;
// 리플레이 상태
let replay = null;
// 리플레이 카메라가 있어야 할 위치
function replayWant(p) {
  const d = replay.dir;
  return new THREE.Vector3(p.x - d.x * 20 - d.z * 9, Math.max(3.5, p.y * 0.45 + 3), p.z - d.z * 20 + d.x * 9);
}
// 기록해 둔 궤적에서 지금 공 위치를 꺼낸다
function replayBall() {
  const n = replayRec.length / 4,
    t = Math.min(replay.dur, ((now - replay.t0) / 1000) * replay.spd);
  let lo = 0,
    hi = n - 1;
  while (lo < hi) {
    const m = (lo + hi + 1) >> 1;
    if (replayRec[m * 4] <= t) lo = m;
    else hi = m - 1;
  }
  const a = lo * 4,
    b = Math.min(n - 1, lo + 1) * 4,
    span = replayRec[b] - replayRec[a],
    u = span > 0 ? clamp((t - replayRec[a]) / span, 0, 1) : 0;
  ball.position.set(
    replayRec[a + 1] + (replayRec[b + 1] - replayRec[a + 1]) * u,
    replayRec[a + 2] + (replayRec[b + 2] - replayRec[a + 2]) * u,
    replayRec[a + 3] + (replayRec[b + 3] - replayRec[a + 3]) * u,
  );
  ball.visible = true;
  burst(ball.position.x, ball.position.y, ball.position.z, 1, [0.9, 0.9, 1], 0.3, 0.45);
}
// 홈런 슬로모션 리플레이를 시작한다
function startReplay() {
  if (replayRec.length < 16 || !hit) return;
  const dur = replayRec[replayRec.length - 4];
  replay = { t0: now, dur, spd: clamp(dur / 6, 0.5, 1), dir: hit.dir.clone() };
  isReplay = true;
  const tg = $('replay-tag');
  tg.textContent = '📺 INSTANT REPLAY · 슬로모션' + (hit.dist > 30 ? ' · ' + hit.dist + 'm' : '');
  tg.style.display = 'block';
  replayBall();
  camera.position.copy(replayWant(ball.position));
  camLook.copy(ball.position);
  camera.lookAt(camLook);
}
// 리플레이를 끝낸다
function endReplay() {
  isReplay = false;
  replay = null;
  $('replay-tag').style.display = 'none';
  ball.visible = false;
}
// 리플레이 중 카메라가 공을 따라간다
function replayCam(dt) {
  if (((now - replay.t0) / 1000) * replay.spd > replay.dur + 0.6) {
    endReplay();
    return;
  }
  if (camera.zoom !== 1) {
    camera.zoom = 1;
    camera.updateProjectionMatrix();
  }
  const p = ball.position;
  camera.position.lerp(replayWant(p), 1 - Math.exp(-5 * dt));
  camLook.lerp(p, 1 - Math.exp(-8 * dt));
  camera.lookAt(camLook);
}
// 상황에 맞는 버튼(구종·견제·도루·번트 등)을 보여준다
function updateControls() {
  diveUI();
  const c = $('ctl');
  $('sw').style.display =
    phase === 'title' || phase === 'over'
      ? 'none'
      : (phase === 'aim' || phase === 'wait') && (!pitcherMode || myStamina <= 30)
        ? 'block'
        : 'none';
  if (pitcherMode && myStamina <= 30) $('sw').textContent = '🔥 불펜 투수 몸 풀기';
  let h = '';
  const g = $('pg'),
    on = pitcherMode && phase !== 'title' && phase !== 'over';
  g.style.display = on ? 'block' : 'none';
  if (on) {
    $('stf').style.width = myStamina + '%';
    $('stf').style.background = myStamina < 30 ? '#e8453c' : myStamina < 60 ? '#f2b632' : '#5fd16a';
    $('pwf').style.width = (pitchPower - 0.5) * 200 + '%';
    $('pgl').textContent = `체력 ${Math.round(myStamina)} · 구속 ${Math.round(pitchPower * 100)}% (막대를 드래그)`;
  }
  if (pitcherMode && phase === 'aim') {
    h = pitchTypes
      .map((t, i) => `<button data-a="t${i}" class="${i === selPitch ? 'sel' : ''}">${t.n}</button>`)
      .join('');
    if (bases.some(x => x)) h += '<button data-a="pk">견제</button>';
    h += '<button data-a="ibb">고의사구</button>';
    h += `<button data-a="si" class="${infieldShift ? 'sel' : ''}">내야 시프트</button><button data-a="so" class="${outfieldShift ? 'sel' : ''}">외야 시프트</button>`;
  } else if (pitcherMode && phase === 'windup' && bases.some(x => x)) h = '<button data-a="pk">견제</button>';
  else if (!pitcherMode && phase === 'windup') {
    if (!stealReq && !steal && stealer() >= 0) h += '<button data-a="st">도루!</button>';
    h += buntReq ? '<button data-a="bt">번트 취소</button>' : '<button data-a="bt">번트</button>';
    h += `<button data-a="sm">${swingMode === 'p' ? '💪 강공' : '🎯 정확'}</button><button data-a="gs">노림수: ${['없음', '직구', '변화구'][guessType]}</button>`;
  }
  if (c.dataset.h !== h) {
    c.dataset.h = h;
    c.innerHTML = h;
  }
  c.style.display = h ? 'flex' : 'none';
}
$('ctl').addEventListener('pointerdown', e => {
  const a = e.target.dataset.a;
  if (!a) return;
  e.preventDefault();
  unlockAudio();
  if (a[0] === 't') selPitch = +a[1];
  else if (a === 'st') {
    stealReq = true;
    $('hint').textContent = '도루 GO!';
  } else if (a === 'sm') swingMode = swingMode === 'p' ? 'c' : 'p';
  else if (a === 'gs') guessType = (guessType + 1) % 3;
  else if (a === 'si') {
    infieldShift = infieldShift ? 0 : 1;
    applyShift();
  } else if (a === 'so') {
    outfieldShift = outfieldShift ? 0 : 1;
    applyShift();
  } else if (a === 'bt' && phase === 'windup') {
    buntReq = !buntReq;
    $('hint').textContent = buntReq ? '번트: 공이 오면 탭!' : '';
  } else if (a === 'ibb' && phase === 'aim') {
    if (now - ibbTapT < 2500) ibbDo();
    else {
      const t = (ibbTapT = now);
      $('hint').textContent = '고의사구: 한 번 더 누르면 확정!';
      setTimeout(() => {
        if (phase === 'aim' && ibbTapT === t) {
          ibbTapT = 0;
          $('hint').textContent = '구종·구속 선택 후 드래그로 조준, 손 떼면 투구!';
        }
      }, 2500);
    }
  } else if (a === 'pk' && phase === 'windup') balk();
  else if (a === 'pk' && phase === 'aim') {
    const i = stealer() >= 0 ? stealer() : bases.findIndex(x => x);
    if (i >= 0) doPick(i, cpuStealPlan && i === stealer());
  }
});
$('pc').innerHTML = PITCHERS.map(
  (P, i) =>
    `<button data-i="${i}" class="${i ? '' : 'on'}">${P.n}<small>${P.hand === 'L' ? '좌완' : '우완'} · ${P.s}</small></button>`,
).join('');
$('pc').addEventListener('pointerdown', e => {
  const b = e.target.closest('button');
  if (!b) return;
  e.stopPropagation();
  selectPitcher(+b.dataset.i, false);
});
$('sw').textContent = '🔄 ' + PITCHERS[0].n;
$('ho').addEventListener('pointerdown', e => {
  e.preventDefault();
  e.stopPropagation();
  handOverride = handOverride === 0 ? 1 : handOverride === 1 ? -1 : 0;
  $('ho').textContent = '내 타석: ' + (handOverride === 0 ? '선수별' : handOverride > 0 ? '전부 우타' : '전부 좌타');
});
$('sw').addEventListener('pointerdown', e => {
  e.preventDefault();
  e.stopPropagation();
  if ((phase === 'aim' || phase === 'wait') && (!pitcherMode || myStamina <= 30))
    selectPitcher((curPitcher + 1) % PITCHERS.length, true);
});
{
  const f = new THREE.Mesh(
    new THREE.PlaneGeometry(ZONE_HALF_W * 2, ZONE_TOP - ZONE_BOTTOM),
    new THREE.MeshBasicMaterial({ color: 0xffe36b, transparent: true, opacity: 0.14, depthWrite: false }),
  );
  zone.add(f);
  const o = new THREE.LineSegments(zone.geometry, zone.material);
  o.scale.set(1.05, 1.05, 1);
  zone.add(o);
}
// 오른쪽 위 타자 카드
const cardEl = $('card');
// 오른쪽 위 타자 카드를 그린다
function cardUpd() {
  if (phase === 'title' || phase === 'over') {
    cardEl.style.display = 'none';
    return;
  }
  const bt = pitcherMode ? 'o' : 'm',
    bi = curBatter(),
    r = LINEUPS[bt][bi];
  if (!r) return;
  const P = PITCHERS[curPitcher],
    t = (zoneStats[bt][bi] || []).reduce((a, c) => [a[0] + c.h, a[1] + c.n], [0, 0]);
  cardEl.style.display = 'block';
  cardEl.innerHTML = `<small>${TEAM_NAMES[bt]} ${bi + 1}번 · ${r[1]}</small><br><span>${r[0]}</span> ${curHand() < 0 ? '좌타' : '우타'}<br><small>오늘 ${t[0]}/${t[1]} · 투수 ${P.n}(${P.hand === 'L' ? '좌' : '우'}완)</small>`;
}
// 미니 스트라이크존: 타자 핫/콜드 존 + 공이 지나간 위치
const miniZoneCanvas = $('zone');
const miniZoneCtx = miniZoneCanvas.getContext('2d');
// 왼쪽 가운데 미니 스트라이크존(핫존·공 위치)을 그린다
function zoneUpd() {
  const W = miniZoneCanvas.width,
    H = miniZoneCanvas.height,
    X = x => ((x + 0.32) / 0.64) * W,
    Y = y => ((1.4 - y) / 1.15) * H;
  miniZoneCtx.clearRect(0, 0, W, H);
  if (phase === 'title' || phase === 'over') return;
  const batting = !pitcherMode,
    prof = HOT_ZONES[batting ? 'm' : 'o'][curBatter()] || [];
  if (batting) {
    for (let r = 0; r < 3; r++)
      for (let c = 0; c < 3; c++) {
        const v = effectiveHot(batting ? 'm' : 'o', curBatter(), r * 3 + c),
          x0 = X(-ZONE_HALF_W + (2 * ZONE_HALF_W * c) / 3),
          x1 = X(-ZONE_HALF_W + (2 * ZONE_HALF_W * (c + 1)) / 3),
          y0 = Y(ZONE_TOP - ((ZONE_TOP - ZONE_BOTTOM) * r) / 3),
          y1 = Y(ZONE_TOP - ((ZONE_TOP - ZONE_BOTTOM) * (r + 1)) / 3);
        miniZoneCtx.fillStyle = v >= 0 ? `rgba(232,69,60,${0.15 + v * 0.6})` : `rgba(60,120,240,${0.15 - v * 0.6})`;
        miniZoneCtx.fillRect(x0, y0, x1 - x0, y1 - y0);
      }
    miniZoneCtx.font = '9px Jua, sans-serif';
    miniZoneCtx.textAlign = 'left';
    miniZoneCtx.textBaseline = 'top';
    miniZoneCtx.fillStyle = '#fff';
    miniZoneCtx.fillText(LINEUPS.m[curBatter()][0], 3, 3);
    {
      const cs = zoneStats.m[curBatter()];
      let hh = 0,
        nn = 0;
      cs.forEach(x => {
        hh += x.h;
        nn += x.n;
      });
      miniZoneCtx.fillText(`안타 ${hh}/${nn}`, 3, H - 12);
    }
  }
  miniZoneCtx.strokeStyle = 'rgba(230,238,255,.7)';
  miniZoneCtx.lineWidth = 1;
  miniZoneCtx.strokeRect(X(-ZONE_HALF_W), Y(ZONE_TOP), X(ZONE_HALF_W) - X(-ZONE_HALF_W), Y(ZONE_BOTTOM) - Y(ZONE_TOP));
  if (!pitch || pitch.xT === undefined) return;
  const c = swing && swing.miss ? '#9fb0e8' : swing ? '#f2b632' : inZone(pitch) ? '#5fd16a' : '#ffffff';
  miniZoneCtx.fillStyle = c;
  miniZoneCtx.beginPath();
  miniZoneCtx.arc(X(pitch.xT), Y(pitch.yT), 4, 0, Math.PI * 2);
  miniZoneCtx.fill();
}
// 3D 스트라이크존: 홈플레이트 앞, 포수 바로 앞에 실제 크기로 띄움
const zone3DCanvas = document.createElement('canvas');
zone3DCanvas.width = 256;
zone3DCanvas.height = 256;
const zone3DCtx = zone3DCanvas.getContext('2d');
const zone3DTex = new THREE.CanvasTexture(zone3DCanvas);
// 홈플레이트 위 3D 핫존 격자(타자 시점)
const zone3D = new THREE.Mesh(
  new THREE.PlaneGeometry(2 * ZONE_HALF_W, ZONE_TOP - ZONE_BOTTOM),
  new THREE.MeshBasicMaterial({
    map: zone3DTex,
    transparent: true,
    opacity: 1,
    depthWrite: false,
    side: THREE.DoubleSide,
  }),
);
zone3D.position.set(0, (ZONE_BOTTOM + ZONE_TOP) / 2, 0.1);
zone3D.scale.set(1.5, 1.5, 1);
zone3D.renderOrder = 5;
scene.add(zone3D);
// 3D 핫존을 마지막으로 그린 내용 표시
let zone3DKey = '';
// 홈플레이트 위 3D 핫존 격자를 그린다
function zone3DUpd() {
  zone3D.visible = !(phase === 'title' || phase === 'over' || pitcherMode);
  if (!zone3D.visible) return;
  const W = zone3DCanvas.width,
    H = zone3DCanvas.height,
    g = zone3DCtx;
  const team = !pitcherMode ? 'm' : 'o',
    idx = curBatter();
  // 내용이 바뀌었을 때만 다시 그린다(텍스처를 GPU로 보내는 일을 줄여 iPad 성능을 아낀다)
  const key = [team, idx, [0, 1, 2, 3, 4, 5, 6, 7, 8].map(c => effectiveHot(team, idx, c).toFixed(3)), pitch && pitch.xT, pitch && pitch.yT, swing ? (swing.miss ? 2 : 1) : 0].join();
  if (key === zone3DKey) return;
  zone3DKey = key;
  g.clearRect(0, 0, W, H);
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 3; c++) {
      const v = effectiveHot(team, idx, r * 3 + c);
      g.fillStyle = v >= 0 ? `rgba(232,69,60,${0.5 + v * 0.5})` : `rgba(40,100,230,${0.08 + (1 + v) * 0.25})`;
      g.fillRect((c * W) / 3, (r * H) / 3, W / 3, H / 3);
    }
  g.strokeStyle = 'rgba(255,255,255,.85)';
  g.lineWidth = 4;
  g.strokeRect(2, 2, W - 4, H - 4);
  g.beginPath();
  for (let i = 1; i < 3; i++) {
    g.moveTo((i * W) / 3, 0);
    g.lineTo((i * W) / 3, H);
    g.moveTo(0, (i * H) / 3);
    g.lineTo(W, (i * H) / 3);
  }
  g.lineWidth = 2;
  g.stroke();
  if (pitch && pitch.xT !== undefined) {
    const x = ((pitch.xT + ZONE_HALF_W) / (2 * ZONE_HALF_W)) * W,
      y = ((ZONE_TOP - pitch.yT) / (ZONE_TOP - ZONE_BOTTOM)) * H;
    g.fillStyle = swing && swing.miss ? '#9fb0e8' : swing ? '#f2b632' : '#ffffff';
    g.beginPath();
    g.arc(x, y, 9, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#1a1a2a';
    g.lineWidth = 2;
    g.stroke();
  }
  zone3DTex.needsUpdate = true;
}
// 일시정지 중인지
let paused = false;
// 지금 일시정지할 수 있는지(경기 중이고, 시즌 창·기록실이 떠 있지 않을 때)
const canPause = () =>
  phase !== 'title' && phase !== 'over' && $('season-modal').style.display !== 'flex' && $('hof').style.display !== 'flex';
// 일시정지: 게임 시계와 소리를 멈추고 '이어하기 / 처음으로' 창을 연다
function openPause() {
  if (paused || !canPause()) return;
  paused = true;
  // 조준 중이었으면 던지지 않고 조준만 취소
  aimPointer = null;
  aimEl.style.display = 'none';
  $('pause').style.display = 'flex';
  $('pauseBtn').style.display = 'none';
  document.body.classList.add('paused');
  try {
    if (audioCtx && audioCtx.state === 'running') audioCtx.suspend();
  } catch (e) {}
}
// 이어하기
function closePause() {
  if (!paused) return;
  paused = false;
  $('pause').style.display = 'none';
  document.body.classList.remove('paused');
  try {
    if (audioCtx) audioCtx.resume();
  } catch (e) {}
}
// 일시정지 버튼은 경기 중에만 보인다
function updatePauseButton() {
  const d = canPause() ? 'block' : 'none';
  if ($('pauseBtn').style.display !== d) $('pauseBtn').style.display = d;
}
const tapOnly = fn => e => {
  e.preventDefault();
  e.stopPropagation();
  fn();
};
$('pauseBtn').addEventListener('pointerdown', tapOnly(openPause));
$('resumeBtn').addEventListener('pointerdown', tapOnly(closePause));
$('toTitleBtn').addEventListener('pointerdown', tapOnly(() => {
  closePause();
  backToTitle();
}));
$('pause').addEventListener('pointerdown', e => e.stopPropagation());
// iPad에서 다른 앱으로 가거나 화면이 꺼지면 자동으로 일시정지
document.addEventListener('visibilitychange', () => {
  if (document.hidden) openPause();
});
// FPS 표시(PERF.showFps)
let fpsFrames = 0;
let fpsT0 = 0;
function countFps(t) {
  if (!PERF.showFps) return;
  fpsFrames++;
  if (t - fpsT0 >= 500) {
    const el = $('fps');
    el.style.display = 'block';
    el.textContent = Math.round((fpsFrames * 1000) / (t - fpsT0)) + ' FPS';
    fpsFrames = 0;
    fpsT0 = t;
  }
}
// ---------- 타이틀 화면 경기 설정 ----------
// 설정 버튼들의 켜짐 표시와 안내 글을 지금 설정에 맞춘다
function renderSettings() {
  document.querySelectorAll('#settings .seg').forEach(seg => {
    const key = seg.dataset.key;
    const cur = key === 'sound' ? (SETTINGS.sound ? 'on' : 'off') : String(SETTINGS[key]);
    seg.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.v === cur));
  });
  $('volFill').style.width = Math.round(SETTINGS.volume * 100) + '%';
  $('volBar').classList.toggle('off', !SETTINGS.sound);
  $('modeText').textContent = SETTINGS.innings + '회 정식 경기';
}
// 설정 하나를 바꾸고 기억한다
function setSetting(key, v) {
  if (key === 'innings') SETTINGS.innings = Number(v);
  else if (key === 'sound') SETTINGS.sound = v === 'on';
  else SETTINGS[key] = v;
  saveSettings();
  renderSettings();
  if (key === 'tod') setTimeOfDay(titleTod()); // 타이틀 배경도 고른 시간대로
  if (key === 'sound' || key === 'volume') {
    unlockAudio();
    applyVolume();
  }
}
// 설정 칸을 눌러도 경기가 시작되지 않게 막는다
$('settings').addEventListener('pointerdown', e => e.stopPropagation());
$('settings').addEventListener('click', e => {
  const b = e.target.closest('.seg button');
  if (b) setSetting(b.closest('.seg').dataset.key, b.dataset.v);
});
// 음량 막대 드래그
{
  const bar = $('volBar');
  const setFrom = e => {
    const r = bar.getBoundingClientRect();
    SETTINGS.volume = Math.round(clamp((e.clientX - r.left) / r.width, 0, 1) * 20) / 20;
    if (!SETTINGS.sound) SETTINGS.sound = true;
    applyVolume();
    renderSettings();
  };
  bar.addEventListener('pointerdown', e => {
    e.preventDefault();
    try {
      bar.setPointerCapture(e.pointerId);
    } catch (_) {}
    unlockAudio();
    setFrom(e);
  });
  bar.addEventListener('pointermove', e => {
    if (e.buttons) setFrom(e);
  });
  bar.addEventListener('pointerup', () => {
    saveSettings();
    tone(660, 0.08); // 바뀐 크기로 짧게 들려준다
  });
}
renderSettings();
